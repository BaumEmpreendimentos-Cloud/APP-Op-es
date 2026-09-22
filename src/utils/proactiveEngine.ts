import { OptionLeg, PositionRecord } from '../types';
import { calculateBlackScholes, estimateB3Margin, calculatePortfolioGreeks } from './blackScholes';
import { B3_EXPIRATION_LETTERS } from '../data/ibovAssets';

export interface ProactiveSuggestion {
  id: string;
  type: 'CLOSE' | 'ROLL_CALENDAR' | 'ROLL_STRIKE_DEFENSIVE' | 'ROLL_STRIKE_AGGRESSIVE' | 'HEDGE_SPREAD' | 'INFO';
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'INFO';
  title: string;
  triggerReason: string;
  explanation: string;
  financialImpact: {
    netCashflow: number; // positive = credit received, negative = debit
    marginImpact: string;
    annualizedRate?: number;
    greeksImprovement: string;
  };
  costs: string[];
  benefits: string[];
  suggestedAction: {
    label: string;
    legToClose?: OptionLeg;
    targetStrike?: number;
    targetLetter?: string;
    targetPremium?: number;
    targetDays?: number;
  };
}

export interface PositionRiskDiagnosis {
  overallRiskLevel: 'BAIXO' | 'MODERADO' | 'ALTO' | 'CRITICO';
  marginRequired: number;
  marginType: string;
  maxProfit: number | 'ILIMITADO';
  maxLoss: number | 'ILIMITADA';
  portfolioDelta: number;
  portfolioGamma: number;
  dailyTheta: number;
  portfolioVega: number;
  daysToNearestExpiry: number;
  profitTargetReachedPercent?: number;
  stopLossProximityPercent?: number;
  hasNakedRisk: boolean;
  suggestions: ProactiveSuggestion[];
}

/**
 * Gets the next B3 expiration series letter given the current letter and option type
 */
export function getNextB3SeriesLetter(currentLetter: string, type: 'CALL' | 'PUT'): string {
  const letters = B3_EXPIRATION_LETTERS;
  const targetKey = type === 'CALL' ? 'callLetter' : 'putLetter';
  const currentIndex = letters.findIndex((b) => b[targetKey] === currentLetter.toUpperCase());

  if (currentIndex === -1 || currentIndex === letters.length - 1) {
    return type === 'CALL' ? letters[0].callLetter : letters[0].putLetter;
  }
  return letters[currentIndex + 1][targetKey];
}

/**
 * Evaluates an active position and generates proactive suggestions based on:
 * - Target Profit reached / close to target
 * - Stop Loss proximity
 * - Expiration risk (days to expiry <= 5)
 * - Theta exhaustion (>70% profit captured on short leg with gamma risk rising)
 * - Naked exposure / margin call threat
 */
export function analyzePositionProactively(
  pos: PositionRecord,
  currentSpot: number,
  iv: number = 0.28,
  selic: number = 0.1325
): PositionRiskDiagnosis {
  const legs = pos.legs;
  const marginEst = estimateB3Margin(legs, currentSpot);
  const greeks = calculatePortfolioGreeks(legs, currentSpot, iv, selic);

  const nearestExpiry = Math.min(
    ...legs.map((l) => (l.type === 'STOCK' ? 999 : l.daysToExpiry || 22))
  );

  const unrealizedPnL = pos.unrealizedPnL ?? 0;
  const targetProfit = pos.targetProfit ?? 0;
  const stopLoss = pos.stopLoss ?? 0;

  // Profit target ratio
  const profitTargetReachedPercent =
    targetProfit > 0 ? (unrealizedPnL / targetProfit) * 100 : undefined;

  // Stop loss ratio (stopLoss is negative)
  const stopLossProximityPercent =
    stopLoss < 0 ? (Math.abs(Math.min(0, unrealizedPnL)) / Math.abs(stopLoss)) * 100 : undefined;

  // Identify short legs
  const shortLegs = legs.filter((l) => l.side === 'SELL');
  const longLegs = legs.filter((l) => l.side === 'BUY');
  const stockLeg = legs.find((l) => l.type === 'STOCK');
  const stockQty = stockLeg ? (stockLeg.side === 'BUY' ? stockLeg.quantity : -stockLeg.quantity) : 0;

  const totalSoldCallQty = shortLegs.filter((l) => l.type === 'CALL').reduce((a, l) => a + l.quantity, 0);
  const totalBoughtCallQty = longLegs.filter((l) => l.type === 'CALL').reduce((a, l) => a + l.quantity, 0);
  const totalSoldPutQty = shortLegs.filter((l) => l.type === 'PUT').reduce((a, l) => a + l.quantity, 0);
  const totalBoughtPutQty = longLegs.filter((l) => l.type === 'PUT').reduce((a, l) => a + l.quantity, 0);

  const uncoveredCalls = Math.max(0, totalSoldCallQty - Math.max(0, stockQty) - totalBoughtCallQty);
  const uncoveredPuts = Math.max(0, totalSoldPutQty - totalBoughtPutQty);
  const hasNakedRisk = uncoveredCalls > 0 || uncoveredPuts > 0;

  // Max Profit / Max Loss calculation
  let maxProfit: number | 'ILIMITADO' = 0;
  let maxLoss: number | 'ILIMITADA' = 0;

  if (uncoveredCalls > 0) {
    maxLoss = 'ILIMITADA';
  }

  // Calculate approximate bounds
  let testPrices = [0.1, currentSpot * 0.5, currentSpot * 0.8, currentSpot, currentSpot * 1.2, currentSpot * 1.5, currentSpot * 2.0];
  let pnlOutcomes: number[] = [];
  testPrices.forEach((tp) => {
    let pnlAtT = 0;
    legs.forEach((l) => {
      const sign = l.side === 'BUY' ? 1 : -1;
      if (l.type === 'STOCK') {
        pnlAtT += sign * (tp - pos.spotPriceAtEntry) * l.quantity;
      } else {
        const payoff = l.type === 'CALL' ? Math.max(0, tp - l.strike) : Math.max(0, l.strike - tp);
        pnlAtT += (l.side === 'BUY' ? payoff - l.premium : l.premium - payoff) * l.quantity;
      }
    });
    pnlOutcomes.push(pnlAtT);
  });

  if (maxLoss !== 'ILIMITADA') {
    maxLoss = Math.min(...pnlOutcomes);
  }
  const calculatedMaxProfit = Math.max(...pnlOutcomes);
  maxProfit = longLegs.some((l) => l.type === 'CALL' && l.quantity > totalSoldCallQty)
    ? 'ILIMITADO'
    : Math.max(0, calculatedMaxProfit);

  const suggestions: ProactiveSuggestion[] = [];

  // 1. TRIGGER: Take Profit Atingido ou > 75%
  if (profitTargetReachedPercent !== undefined && profitTargetReachedPercent >= 75) {
    const isFullTarget = profitTargetReachedPercent >= 100;
    suggestions.push({
      id: 'sug-profit-target',
      type: 'CLOSE',
      priority: isFullTarget ? 'CRITICAL' : 'HIGH',
      title: isFullTarget ? '🎯 Meta de Lucro 100% Atingida: Encerramento Recomendado' : '📈 75%+ da Meta de Lucro Atingida: Considere Realização Parcial',
      triggerReason: `Posição atingiu ${profitTargetReachedPercent.toFixed(1)}% do objetivo de ganho (R$ ${unrealizedPnL.toFixed(2)} de R$ ${targetProfit.toFixed(2)}).`,
      explanation: 'Manter a operação aberta nas últimas semanas após capturar a grande maioria do prêmio oferece assimetria desfavorável (ganho residual baixo vs risco gama elevado).',
      financialImpact: {
        netCashflow: unrealizedPnL,
        marginImpact: `Liberação de 100% da margem exigida (R$ ${marginEst.estimatedInitialMargin.toFixed(2)}) na B3.`,
        greeksImprovement: 'Zera a exposição direcional (Delta) e elimina o risco de cauda.',
      },
      costs: [
        'Custo de corretagem e emolumentos B3 para recompra/venda das pernas.',
        'Abertura de mão do ganho residual remanescente.',
      ],
      benefits: [
        `Garante no bolso o lucro líquido de R$ ${unrealizedPnL.toFixed(2)}.`,
        `Desaloca imediatamente R$ ${marginEst.estimatedInitialMargin.toFixed(2)} de margem retida na corretora.`,
        'Elimina risco de reversão brusca ou gap de mercado.',
      ],
      suggestedAction: {
        label: 'Encerrar Operação Agora',
      },
    });
  }

  // 2. TRIGGER: Stop Loss Atingido ou > 80%
  if (stopLossProximityPercent !== undefined && stopLossProximityPercent >= 80) {
    const isStopTriggered = stopLossProximityPercent >= 100;
    suggestions.push({
      id: 'sug-stop-loss',
      type: 'CLOSE',
      priority: 'CRITICAL',
      title: isStopTriggered ? '🛑 Limite de Stop Loss Atingido: Estancar Risco' : '⚠️ Alerta de Proximidade do Stop Loss (80%+)',
      triggerReason: `Prejuízo atual de R$ ${Math.abs(unrealizedPnL).toFixed(2)} atingiu ${stopLossProximityPercent.toFixed(1)}% do limite de perda configurado (R$ ${Math.abs(stopLoss).toFixed(2)}).`,
      explanation: 'Disciplina operacional na B3 exige respeito aos limites de perda máxima para preservar o patrimônio contra perdas irrecuperáveis.',
      financialImpact: {
        netCashflow: unrealizedPnL,
        marginImpact: `Libera R$ ${marginEst.estimatedInitialMargin.toFixed(2)} de garantias antes de chamadas compulsórias.`,
        greeksImprovement: 'Neutraliza o risco direcional negativo.',
      },
      costs: [
        `Realização do prejuízo acumulado de R$ ${Math.abs(unrealizedPnL).toFixed(2)}.`,
      ],
      benefits: [
        'Evita perdas descontroladas caso a tendência adversa continue.',
        'Libera margem e capital para novas operações com melhor relação risco x retorno.',
        'Preserva a saúde financeira da carteira.',
      ],
      suggestedAction: {
        label: 'Estancar Prejuízo (Fechar Posição)',
      },
    });
  }

  // 3. TRIGGER: Vencimento Próximo (DTE <= 6 dias úteis)
  if (nearestExpiry <= 6 && nearestExpiry > 0 && shortLegs.length > 0) {
    const mainShort = shortLegs[0];
    const nextLetter = getNextB3SeriesLetter(
      mainShort.ticker ? mainShort.ticker.charAt(4) : 'J',
      mainShort.type !== 'STOCK' ? mainShort.type : 'CALL'
    );
    const estNewPremium = Math.round((mainShort.currentPrice || mainShort.premium) * 1.4 * 100) / 100;

    suggestions.push({
      id: 'sug-expiry-roll',
      type: 'ROLL_CALENDAR',
      priority: nearestExpiry <= 3 ? 'CRITICAL' : 'HIGH',
      title: `⏳ Vencimento em ${nearestExpiry}d Úteis: Rolagem Tática B3`,
      triggerReason: `Faltam apenas ${nearestExpiry} dias úteis para o exercício mensal da B3. Opções no dinheiro (ATM/ITM) possuem risco de exercício antecipado.`,
      explanation: 'A rolagem para a próxima série mensal recompra a opção atual que já decaiu e vende a nova série, estendendo o prazo e capturando novo prêmio financeiro.',
      financialImpact: {
        netCashflow: (estNewPremium - (mainShort.currentPrice || mainShort.premium)) * mainShort.quantity,
        marginImpact: 'Manutenção de margem na nova série com possibilidade de crédito em conta.',
        annualizedRate: Math.round(((estNewPremium / (mainShort.strike || 1)) / 22) * 252 * 100),
        greeksImprovement: 'Restaura Theta positivo diário e reduz Gamma arriscado.',
      },
      costs: [
        `Desembolso para recompra da opção ${mainShort.ticker || 'atual'} a aprox. R$ ${(mainShort.currentPrice || mainShort.premium).toFixed(2)}.`,
        'Emolumentos e corretagem sobre as 2 pontas da rolagem na B3.',
      ],
      benefits: [
        `Recebimento estimado de R$ ${(estNewPremium * mainShort.quantity).toFixed(2)} na venda da série seguinte (${nextLetter}).`,
        'Evita taxas de corretagem de exercício físico da B3 (frequentemente 0.5% sobre o nocional).',
        'Continua rentabilizando a custódia por mais 22 a 44 dias úteis.',
      ],
      suggestedAction: {
        label: `Rolar para Série ${nextLetter} na Calculadora`,
        legToClose: mainShort,
        targetStrike: mainShort.strike,
        targetLetter: nextLetter,
        targetPremium: estNewPremium,
        targetDays: 44,
      },
    });
  }

  // 4. TRIGGER: Deterioração de Theta / Prêmios Residuais Baixos (< 25% do prêmio original)
  const exhaustedShort = shortLegs.find(
    (l) => l.currentPrice && l.premium > 0 && l.currentPrice <= l.premium * 0.25
  );
  if (exhaustedShort && nearestExpiry > 4) {
    const profitRatio = Math.round(((exhaustedShort.premium - (exhaustedShort.currentPrice || 0)) / exhaustedShort.premium) * 100);
    suggestions.push({
      id: 'sug-theta-exhaustion',
      type: 'ROLL_STRIKE_DEFENSIVE',
      priority: 'MEDIUM',
      title: `⚡ Esgotamento de Theta: ${profitRatio}% do Prêmio Capturado na Perna Vendida`,
      triggerReason: `A perna vendida ${exhaustedShort.ticker || 'curta'} desvalorizou para R$ ${(exhaustedShort.currentPrice || 0).toFixed(2)} (valia R$ ${exhaustedShort.premium.toFixed(2)}).`,
      explanation: 'O theta diário restante é insignificante frente ao risco de cauda e gama caso ocorra uma reversão brusca. Rolar antecipadamente otimiza o uso do capital.',
      financialImpact: {
        netCashflow: (exhaustedShort.premium - (exhaustedShort.currentPrice || 0)) * exhaustedShort.quantity,
        marginImpact: 'Permite abrir nova posição gerando retorno sobre a margem retida.',
        greeksImprovement: 'Substitui um theta fraco por uma nova curva de decaimento acentuada.',
      },
      costs: [
        `Custo irrisório de recompra: R$ ${((exhaustedShort.currentPrice || 0) * exhaustedShort.quantity).toFixed(2)}.`,
      ],
      benefits: [
        `Realiza ${profitRatio}% de lucro nesta perna sem passar pelo estresse dos dias finais.`,
        'Permite relançar opções mais próximas do dinheiro (ATM) com maior liquidez e prêmio gordo.',
      ],
      suggestedAction: {
        label: 'Recomprar Perna e Relançar',
        legToClose: exhaustedShort,
      },
    });
  }

  // 5. TRIGGER: Risco a Descoberto na B3 (Naked Short Call ou Put sem Trava)
  if (hasNakedRisk) {
    suggestions.push({
      id: 'sug-hedge-naked',
      type: 'HEDGE_SPREAD',
      priority: 'HIGH',
      title: '🛡️ Mitigação de Margem CORE B3: Travar Ponta Descoberta',
      triggerReason: `Operação contém pontas vendidas a seco (${uncoveredCalls > 0 ? `${uncoveredCalls} CALLs` : ''} ${uncoveredPuts > 0 ? `${uncoveredPuts} PUTs` : ''}) exigindo R$ ${marginEst.estimatedInitialMargin.toFixed(2)} de margem CORE.`,
      explanation: 'Comprar uma opção OTM protetora barata de strike mais afastado transforma a operação em uma trava (spread), limitando a perda máxima e derrubando a exigência de margem da B3 em até 80%.',
      financialImpact: {
        netCashflow: -uncoveredCalls * 0.35 * 100, // pequeno prêmio pago
        marginImpact: `Redução drástica de margem: de R$ ${marginEst.estimatedInitialMargin.toFixed(2)} para valor fixo do spread.`,
        greeksImprovement: 'Corta o Gamma negativo explosivo em caso de cisne negro.',
      },
      costs: [
        'Pequeno prêmio pago para comprar a opção OTM (asa de proteção).',
      ],
      benefits: [
        'Elimina o risco de perda financeira ilimitada.',
        'Libera limite de margem operacional na corretora para outras estratégias.',
        'Protege contra chamada de margem intradiária compulsória.',
      ],
      suggestedAction: {
        label: 'Simular Asa de Proteção no Simulador',
      },
    });
  }

  // Fallback info suggestion if everything is running smoothly
  if (suggestions.length === 0) {
    suggestions.push({
      id: 'sug-healthy',
      type: 'INFO',
      priority: 'INFO',
      title: '✅ Operação Dentro dos Parâmetros Saudáveis',
      triggerReason: `Parâmetros de risco equilibrados. Theta positivo de R$ ${greeks.theta.toFixed(2)}/dia útil atuando a favor.`,
      explanation: 'A operação não violou nenhum gatilho de stop loss, meta de lucro ou proximidade crítica de vencimento. Mantenha o acompanhamento.',
      financialImpact: {
        netCashflow: 0,
        marginImpact: `Margem estável em R$ ${marginEst.estimatedInitialMargin.toFixed(2)}.`,
        greeksImprovement: 'Decaimento temporal contínuo.',
      },
      costs: ['Nenhum custo operacional neste momento.'],
      benefits: ['Deixar o tempo agir (Theta Decay) para maximização do prêmio retido.'],
      suggestedAction: {
        label: 'Continuar Monitorando',
      },
    });
  }

  return {
    overallRiskLevel: marginEst.riskScore,
    marginRequired: marginEst.estimatedInitialMargin,
    marginType: marginEst.description,
    maxProfit,
    maxLoss,
    portfolioDelta: greeks.delta,
    portfolioGamma: greeks.gamma,
    dailyTheta: greeks.theta,
    portfolioVega: greeks.vega,
    daysToNearestExpiry: nearestExpiry,
    profitTargetReachedPercent,
    stopLossProximityPercent,
    hasNakedRisk,
    suggestions,
  };
}
