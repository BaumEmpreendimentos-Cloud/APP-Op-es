import { OptionLeg, PortfolioGreeks, MarginEstimate } from '../types';
import {
  calculateBlackScholes,
  calculatePortfolioGreeks,
  estimateB3Margin,
  calculateExpiryPayoffAtPrice,
  calculateCurrentPayoffAtPrice,
  findBreakEvens,
  cdfNormal,
} from './blackScholes';

export interface ScenarioPoint {
  label: string;
  changePercent: number;
  simulatedSpot: number;
  pnlToday: number;
  pnlD7: number;
  pnlExpiry: number;
  roiExpiry: number;
  status: 'LUCRO' | 'PREJUIZO' | 'NEUTRO';
  marginStressEstimate: number;
  deltaAtPrice: number;
  riskNote: string;
}

export interface VolatilityShockScenario {
  label: string;
  vixShiftPts: number;
  simulatedVix: number;
  pnlImpactToday: number;
  b3MarginImpactText: string;
  recommendation: string;
}

export interface GreeksEvolutionPoint {
  timeLabel: string;
  daysRemaining: number;
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  explanation: string;
}

export interface ComprehensiveRiskEvaluation {
  spotPrice: number;
  ticker: string;
  currentVix: number;
  initialCashflow: number;
  isCreditStrategy: boolean;
  maxProfit: number | 'ILIMITADO';
  maxLoss: number | 'INDEFINIDO';
  bestCaseRange: string;
  worstCaseRange: string;
  breakEvens: number[];
  winProbabilityEstimate: number; // 0 to 100%
  greeks: PortfolioGreeks;
  margin: MarginEstimate;

  // 1. Cenário Lateral / Próximo ao Spot (0%, +1%, -1%)
  lateralScenarios: ScenarioPoint[];

  // 2. Cenário Choque Moderado (±5%)
  moderateScenarios: ScenarioPoint[];

  // 3. Cenário Choque Agudo / Estresse de Cauda (±10%, ±15%)
  extremeScenarios: ScenarioPoint[];

  // 4. Choques de Volatilidade ancorados no VIX B3 (32.77)
  volatilityShocks: VolatilityShockScenario[];

  // 5. Evolução temporal das Gregas
  greeksEvolution: GreeksEvolutionPoint[];

  // 6. Diagnóstico Geral
  overallRiskLevel: 'BAIXO' | 'MODERADO' | 'ALTO' | 'CRITICO';
  keyRiskFactors: string[];
  recommendedProtocols: string[];
}

export function evaluateStrategyRisks(
  legs: OptionLeg[],
  spotPrice: number,
  iv: number,
  interestRate: number,
  ticker: string = 'BOVA11',
  vixLevel: number = 32.77
): ComprehensiveRiskEvaluation {
  // Initial capital outlay or receipt
  let initialCashflow = 0;
  legs.forEach((l) => {
    const sign = l.side === 'SELL' ? 1 : -1;
    initialCashflow += sign * l.premium * l.quantity;
  });
  const isCreditStrategy = initialCashflow > 0;
  const capitalBase = Math.max(1000, Math.abs(initialCashflow) || (spotPrice * 100));

  // Base Greeks and Margin
  const greeks = calculatePortfolioGreeks(legs, spotPrice, iv, interestRate);
  const margin = estimateB3Margin(legs, spotPrice);
  const breakEvens = findBreakEvens(legs, spotPrice, 0.45);

  // Uncovered calls & puts detection for B3 CORE margin
  const shortCalls = legs.filter((l) => l.type === 'CALL' && l.side === 'SELL');
  const longCalls = legs.filter((l) => l.type === 'CALL' && l.side === 'BUY');
  const stockLeg = legs.find((l) => l.type === 'STOCK');
  const stockQty = stockLeg ? (stockLeg.side === 'BUY' ? stockLeg.quantity : -stockLeg.quantity) : 0;
  const uncoveredCalls = Math.max(
    0,
    shortCalls.reduce((s, l) => s + l.quantity, 0) - Math.max(0, stockQty) - longCalls.reduce((s, l) => s + l.quantity, 0)
  );
  const shortPuts = legs.filter((l) => l.type === 'PUT' && l.side === 'SELL');
  const longPuts = legs.filter((l) => l.type === 'PUT' && l.side === 'BUY');
  const uncoveredPuts = Math.max(
    0,
    shortPuts.reduce((s, l) => s + l.quantity, 0) - longPuts.reduce((s, l) => s + l.quantity, 0)
  );
  const hasUndefinedRisk = uncoveredCalls > 0 || uncoveredPuts > 0 || margin.marginType === 'RISCO_CORE_B3';

  // Maximum days to expiry among legs
  const maxDays = Math.max(1, ...legs.map((l) => (l.type === 'STOCK' ? 30 : l.daysToExpiry)));

  // Helper to build a scenario point
  const buildPoint = (changePercent: number, label: string): ScenarioPoint => {
    const simulatedSpot = Number((spotPrice * (1 + changePercent / 100)).toFixed(2));
    const pnlExpiry = Math.round(calculateExpiryPayoffAtPrice(legs, simulatedSpot, spotPrice));
    const pnlToday = Math.round(calculateCurrentPayoffAtPrice(legs, simulatedSpot, spotPrice, iv, interestRate, 0));
    const d7Elapsed = Math.min(maxDays - 1, 7);
    const pnlD7 = Math.round(calculateCurrentPayoffAtPrice(legs, simulatedSpot, spotPrice, iv, interestRate, d7Elapsed));
    const roiExpiry = Number(((pnlExpiry / capitalBase) * 100).toFixed(1));

    // Calculate dynamic margin estimate under this simulated spot price
    const marginAtPrice = Math.round(estimateB3Margin(legs, simulatedSpot).estimatedInitialMargin);

    // Dynamic Delta at simulated spot
    let totalDeltaAtPrice = 0;
    legs.forEach((leg) => {
      const sign = leg.side === 'BUY' ? 1 : -1;
      if (leg.type === 'STOCK') {
        totalDeltaAtPrice += sign * leg.quantity;
      } else {
        const bs = calculateBlackScholes(simulatedSpot, leg.strike, leg.daysToExpiry, iv, interestRate, leg.type);
        totalDeltaAtPrice += sign * bs.delta * leg.quantity;
      }
    });

    let status: 'LUCRO' | 'PREJUIZO' | 'NEUTRO' = 'NEUTRO';
    if (pnlExpiry > 25) status = 'LUCRO';
    else if (pnlExpiry < -25) status = 'PREJUIZO';

    let riskNote = '';
    if (Math.abs(changePercent) >= 10 && hasUndefinedRisk) {
      riskNote = '⚠️ Risco de Liquidação Compulsória B3 por salto no spot em perna descoberta!';
    } else if (status === 'LUCRO') {
      riskNote = `Zona de ganho favorável (${pnlExpiry >= 0 ? '+' : ''}R$ ${pnlExpiry.toLocaleString('pt-BR')})`;
    } else {
      riskNote = `Perda estimada no vencimento: R$ ${Math.abs(pnlExpiry).toLocaleString('pt-BR')}`;
    }

    return {
      label,
      changePercent,
      simulatedSpot,
      pnlToday,
      pnlD7,
      pnlExpiry,
      roiExpiry,
      status,
      marginStressEstimate: marginAtPrice,
      deltaAtPrice: Math.round(totalDeltaAtPrice),
      riskNote,
    };
  };

  // 1. Lateral Scenarios (0%, +1%, -1%)
  const lateralScenarios: ScenarioPoint[] = [
    buildPoint(-1.5, 'Leve Baixa (-1,5%)'),
    buildPoint(0, 'Cotação Estável / Lateral (0%)'),
    buildPoint(1.5, 'Leve Alta (+1,5%)'),
  ];

  // 2. Moderate Scenarios (±5%)
  const moderateScenarios: ScenarioPoint[] = [
    buildPoint(-5, 'Queda Moderada (-5%)'),
    buildPoint(5, 'Alta Moderada (+5%)'),
  ];

  // 3. Extreme Scenarios (±10%, ±15%)
  const extremeScenarios: ScenarioPoint[] = [
    buildPoint(-15, 'Crash / Estresse Severo (-15%)'),
    buildPoint(-10, 'Forte Queda (-10%)'),
    buildPoint(10, 'Forte Alta (+10%)'),
    buildPoint(15, 'Super Rally (+15%)'),
  ];

  // 4. Volatility Shocks anchored to VIX B3 (vixLevel, e.g. 32.77)
  const netVega = greeks.vega; // R$ per 1% of IV
  const volatilityShocks: VolatilityShockScenario[] = [
    {
      label: 'Forte Redução de Volatilidade (IV Crush -12 pts)',
      vixShiftPts: -12,
      simulatedVix: Math.max(10, Number((vixLevel - 12).toFixed(2))),
      pnlImpactToday: Math.round(-12 * netVega),
      b3MarginImpactText: 'Alívio substancial na margem CORE da B3. Margens exigidas caem entre 20% e 40%.',
      recommendation:
        netVega < 0
          ? 'Cenário ALTAMENTE FAVORÁVEL: a retração do VIX antecipa lucro rápido em posições vendidas em vol.'
          : 'Cenário DESFAVORÁVEL: perda de valor extrínseco em pernas compradas de opções.',
    },
    {
      label: 'Retração Típica Pós-Evento (-5 pts)',
      vixShiftPts: -5,
      simulatedVix: Math.max(12, Number((vixLevel - 5).toFixed(2))),
      pnlImpactToday: Math.round(-5 * netVega),
      b3MarginImpactText: 'Redução moderada da exigência de garantia no sistema CORE.',
      recommendation:
        netVega < 0
          ? 'Positivo: captura de taxa acelerada com a acomodação do mercado.'
          : 'Atenção: desaceleração no valor de mercado de puts e calls compradas.',
    },
    {
      label: 'Nova Disparada de Pânico / Estresse (+8 pts)',
      vixShiftPts: 8,
      simulatedVix: Number((vixLevel + 8).toFixed(2)),
      pnlImpactToday: Math.round(8 * netVega),
      b3MarginImpactText: '⚠️ ALERTA: Sistema CORE da B3 ampliará a margem exigida em até 50%!',
      recommendation:
        netVega < 0
          ? 'CRÍTICO se vendido a seco: risco de chamada de margem imediata. Se travado, risco delimitado.'
          : 'Beneficia pernas compradas: prêmios inflam com a explosão da aversão a risco.',
    },
    {
      label: 'Choque Extremo de Volatilidade (+15 pts)',
      vixShiftPts: 15,
      simulatedVix: Number((vixLevel + 15).toFixed(2)),
      pnlImpactToday: Math.round(15 * netVega),
      b3MarginImpactText: '🚨 ESTRESSE MÁXIMO B3: Aumento de mais de 80% nas garantias de risco indefinido.',
      recommendation:
        'Cenário de Circuit Breaker. Mantenha garantia 100% alocada em Tesouro Selic e evite operar vendido a seco.',
    },
  ];

  // 5. Greeks Evolution over Time (D-0, 25%, 50%, 80%, Expiry)
  const calcGreeksAtDay = (daysRemain: number, label: string, explanation: string): GreeksEvolutionPoint => {
    let totDelta = 0;
    let totGamma = 0;
    let totTheta = 0;
    let totVega = 0;

    legs.forEach((leg) => {
      const sign = leg.side === 'BUY' ? 1 : -1;
      const qty = leg.quantity;
      if (leg.type === 'STOCK') {
        totDelta += sign * qty;
      } else {
        const bs = calculateBlackScholes(spotPrice, leg.strike, daysRemain, iv, interestRate, leg.type);
        totDelta += sign * bs.delta * qty;
        totGamma += sign * bs.gamma * qty;
        totTheta += sign * bs.theta * qty;
        totVega += sign * bs.vega * qty;
      }
    });

    return {
      timeLabel: label,
      daysRemaining: daysRemain,
      delta: Math.round(totDelta),
      gamma: Number(totGamma.toFixed(4)),
      theta: Math.round(totTheta),
      vega: Math.round(totVega),
      explanation,
    };
  };

  const greeksEvolution: GreeksEvolutionPoint[] = [
    calcGreeksAtDay(
      maxDays,
      'Hoje (Montagem)',
      'Momento inicial: Vega elevado e Theta em ritmo linear gradual.'
    ),
    calcGreeksAtDay(
      Math.max(1, Math.round(maxDays * 0.6)),
      'Meio do Período (D+' + Math.round(maxDays * 0.4) + ')',
      'Aceleração do decaimento temporal Theta; encolhimento de Vega.'
    ),
    calcGreeksAtDay(
      Math.max(1, Math.round(maxDays * 0.2)),
      'Última Semana (D+' + Math.round(maxDays * 0.8) + ')',
      'Theta explosivo nas pernas OTM/ATM; Gamma atinge pico nas opções próximas ao dinheiro (Pin Risk).'
    ),
    calcGreeksAtDay(
      1,
      'Véspera do Vencimento (D-1)',
      'Valor extrínseco residual próximo de zero; opções viram pó ou passam a negociar como ativo-objeto puro.'
    ),
  ];

  // 6. Best Case & Worst Case calculation across a wide spectrum
  let minPnL = Infinity;
  let maxPnL = -Infinity;
  let minAtPrice = spotPrice;
  let maxAtPrice = spotPrice;

  for (let p = spotPrice * 0.4; p <= spotPrice * 1.8; p += spotPrice * 0.02) {
    const pnl = calculateExpiryPayoffAtPrice(legs, p, spotPrice);
    if (pnl < minPnL) {
      minPnL = pnl;
      minAtPrice = p;
    }
    if (pnl > maxPnL) {
      maxPnL = pnl;
      maxAtPrice = p;
    }
  }

  // Check if unbounded
  const farHighPnL = calculateExpiryPayoffAtPrice(legs, spotPrice * 3, spotPrice);
  const farLowPnL = calculateExpiryPayoffAtPrice(legs, 0.01, spotPrice);

  let finalMaxLoss: number | 'INDEFINIDO' = Math.round(minPnL);
  if (farHighPnL < -200000 || farLowPnL < -200000 || hasUndefinedRisk) {
    finalMaxLoss = 'INDEFINIDO';
  }

  let finalMaxProfit: number | 'ILIMITADO' = Math.round(maxPnL);
  if (farHighPnL > 200000) {
    finalMaxProfit = 'ILIMITADO';
  }

  // Statistical Win Probability using Normal CDF based on Break-Evens & IV
  const directionalBias = greeks.delta > 20 ? 'ALTA' : greeks.delta < -20 ? 'BAIXA' : 'NEUTRO';
  let winProb = 50;
  if (breakEvens.length === 1) {
    const be = breakEvens[0];
    const stdDev = spotPrice * iv * Math.sqrt(maxDays / 252);
    const z = (be - spotPrice) / stdDev;
    if (directionalBias === 'ALTA') {
      winProb = Math.round((1 - cdfNormal(z)) * 100);
    } else if (directionalBias === 'BAIXA') {
      winProb = Math.round(cdfNormal(z) * 100);
    } else {
      winProb = Math.round(Math.abs(0.5 - Math.abs(z * 0.2)) * 100);
    }
  } else if (breakEvens.length >= 2) {
    const be1 = Math.min(...breakEvens);
    const be2 = Math.max(...breakEvens);
    const stdDev = spotPrice * iv * Math.sqrt(maxDays / 252);
    const z1 = (be1 - spotPrice) / stdDev;
    const z2 = (be2 - spotPrice) / stdDev;
    const pInside = Math.abs(cdfNormal(z2) - cdfNormal(z1));
    const pnlBetween = calculateExpiryPayoffAtPrice(legs, (be1 + be2) / 2, spotPrice);
    winProb = pnlBetween > 0 ? Math.round(pInside * 100) : Math.round((1 - pInside) * 100);
  } else {
    winProb = isCreditStrategy ? 65 : 45;
  }
  winProb = Math.max(5, Math.min(95, winProb));

  // Determine Overall Risk Level
  let overallRiskLevel: 'BAIXO' | 'MODERADO' | 'ALTO' | 'CRITICO' = margin.riskScore;
  if (finalMaxLoss === 'INDEFINIDO') {
    overallRiskLevel = 'CRITICO';
  }

  const keyRiskFactors: string[] = [];
  if (uncoveredCalls > 0) {
    keyRiskFactors.push(`Venda de Call a Seco (${uncoveredCalls} un): Risco infinito em gaps de alta do ${ticker}.`);
  }
  if (uncoveredPuts > 0) {
    keyRiskFactors.push(`Venda de Put a Seco (${uncoveredPuts} un): Obrigação de compra do ativo em caso de queda brusca.`);
  }
  if (greeks.theta < -50) {
    keyRiskFactors.push(`Decaimento Theta desfavorável: Perda diária de R$ ${Math.abs(greeks.theta).toLocaleString('pt-BR')} por pregão.`);
  }
  if (Math.abs(greeks.vega) > 100) {
    keyRiskFactors.push(`Alta sensibilidade ao VIX: Cada 1 pt de variação no VIX altera a posição em R$ ${Math.abs(greeks.vega).toLocaleString('pt-BR')}.`);
  }
  if (keyRiskFactors.length === 0) {
    keyRiskFactors.push('Risco estrutural travado com asas delimitadas e probabilidade estatística equilibrada.');
  }

  const recommendedProtocols: string[] = [];
  if (isCreditStrategy) {
    recommendedProtocols.push('Gatilho de Stop Loss B3: Encerrar ou rolar caso a perda atinja 2x o crédito inicial recebido.');
    recommendedProtocols.push('Encerramento Antecipado: Recomenda-se realizar lucro ao atingir 60% a 75% do crédito máximo.');
  } else {
    recommendedProtocols.push('Gestão de Débito: Risco máximo já está travado no prêmio pago antecipadamente.');
    recommendedProtocols.push('Regra de Saída: Se a posição atingir 100% de valorização, realize pelo menos 50% do lote.');
  }
  if (hasUndefinedRisk) {
    recommendedProtocols.push('Mitigação de Margem CORE B3: Compre uma ponta protetora OTM para transformar a perna vendida em Trava.');
  }

  return {
    spotPrice,
    ticker,
    currentVix: vixLevel,
    initialCashflow,
    isCreditStrategy,
    maxProfit: finalMaxProfit,
    maxLoss: finalMaxLoss,
    bestCaseRange: `Preço em torno de R$ ${maxAtPrice.toFixed(2)}`,
    worstCaseRange: finalMaxLoss === 'INDEFINIDO' ? 'Qualquer movimento brusco contra a perna descoberta' : `Preço em torno de R$ ${minAtPrice.toFixed(2)}`,
    breakEvens,
    winProbabilityEstimate: winProb,
    greeks,
    margin,
    lateralScenarios,
    moderateScenarios,
    extremeScenarios,
    volatilityShocks,
    greeksEvolution,
    overallRiskLevel,
    keyRiskFactors,
    recommendedProtocols,
  };
}
