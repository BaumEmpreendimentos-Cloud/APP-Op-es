import { OptionLeg, PortfolioGreeks, MarginEstimate } from '../types';

// Standard normal cumulative distribution function (Abramowitz and Stegun approximation)
export function cdfNormal(x: number): number {
  const b1 = 0.319381530;
  const b2 = -0.356563782;
  const b3 = 1.781477937;
  const b4 = -1.821255978;
  const b5 = 1.330274429;
  const p = 0.2316419;
  const c = 0.39894228;

  if (x >= 0.0) {
    const t = 1.0 / (1.0 + p * x);
    return 1.0 - c * Math.exp(-x * x / 2.0) * t *
      (t * (t * (t * (t * b5 + b4) + b3) + b2) + b1);
  } else {
    const t = 1.0 / (1.0 - p * x);
    return c * Math.exp(-x * x / 2.0) * t *
      (t * (t * (t * (t * b5 + b4) + b3) + b2) + b1);
  }
}

// Standard normal probability density function
export function pdfNormal(x: number): number {
  return (1 / Math.sqrt(2 * Math.PI)) * Math.exp(-0.5 * x * x);
}

export interface BSResult {
  price: number;
  delta: number;
  gamma: number;
  theta: number; // per business day (base 252)
  vega: number;  // per 1% change in vol
  rho: number;   // per 1% change in interest rate
}

/**
 * Black-Scholes calculation adapted for Brazilian B3 market (252 business days convention)
 * @param S Current Spot Price
 * @param K Strike Price
 * @param daysToExpiry Days to expiration
 * @param iv Implied Volatility (decimal, e.g. 0.28)
 * @param r Risk-free rate (Selic / CDI, decimal, e.g. 0.1325)
 * @param type 'CALL' | 'PUT'
 */
export function calculateBlackScholes(
  S: number,
  K: number,
  daysToExpiry: number,
  iv: number,
  r: number = 0.1325,
  type: 'CALL' | 'PUT',
  exerciseStyle?: 'AMERICAN' | 'EUROPEAN'
): BSResult {
  // If at expiry or negative days
  if (daysToExpiry <= 0.001) {
    const intrinsic = type === 'CALL' ? Math.max(0, S - K) : Math.max(0, K - S);
    const delta = type === 'CALL' ? (S >= K ? 1 : 0) : (S <= K ? -1 : 0);
    return { price: intrinsic, delta, gamma: 0, theta: 0, vega: 0, rho: 0 };
  }

  // T in years based on B3 business days (252)
  const T = Math.max(0.001, daysToExpiry / 252);
  const sigma = Math.max(0.01, iv);

  const d1 = (Math.log(S / K) + (r + (sigma * sigma) / 2) * T) / (sigma * Math.sqrt(T));
  const d2 = d1 - sigma * Math.sqrt(T);

  const Nd1 = cdfNormal(d1);
  const Nd2 = cdfNormal(d2);
  const N_minus_d1 = cdfNormal(-d1);
  const N_minus_d2 = cdfNormal(-d2);
  const nd1 = pdfNormal(d1);

  const discount = Math.exp(-r * T);

  let price = 0;
  let delta = 0;
  let theta = 0;
  let rho = 0;

  if (type === 'CALL') {
    price = S * Nd1 - K * discount * Nd2;
    delta = Nd1;
    // Theta per business day (252 trading days)
    theta = (-(S * nd1 * sigma) / (2 * Math.sqrt(T)) - r * K * discount * Nd2) / 252;
    rho = (K * T * discount * Nd2) / 100;
  } else {
    price = K * discount * N_minus_d2 - S * N_minus_d1;
    delta = Nd1 - 1;
    theta = (-(S * nd1 * sigma) / (2 * Math.sqrt(T)) + r * K * discount * N_minus_d2) / 252;
    rho = (-K * T * discount * N_minus_d2) / 100;
  }

  const gamma = nd1 / (S * sigma * Math.sqrt(T));
  const vega = (S * Math.sqrt(T) * nd1) / 100;

  return {
    price: Math.max(0, price),
    delta,
    gamma,
    theta,
    vega,
    rho,
  };
}

/**
 * Calculates total portfolio greeks for all legs combined
 */
export function calculatePortfolioGreeks(
  legs: OptionLeg[],
  spotPrice: number,
  iv: number = 0.28,
  interestRate: number = 0.1325
): PortfolioGreeks {
  let delta = 0;
  let gamma = 0;
  let theta = 0;
  let vega = 0;
  let rho = 0;
  let netDebitCredit = 0;

  legs.forEach((leg) => {
    const sign = leg.side === 'BUY' ? 1 : -1;
    const qty = leg.quantity;

    // Premium cashflow: SELL gives credit (+), BUY costs debit (-)
    netDebitCredit += (leg.side === 'SELL' ? 1 : -1) * leg.premium * qty;

    if (leg.type === 'STOCK') {
      // Stock has delta = 1, other greeks = 0
      delta += sign * qty;
      return;
    }

    const bs = calculateBlackScholes(
      spotPrice,
      leg.strike,
      leg.daysToExpiry,
      iv,
      interestRate,
      leg.type
    );

    delta += sign * bs.delta * qty;
    gamma += sign * bs.gamma * qty;
    theta += sign * bs.theta * qty;
    vega += sign * bs.vega * qty;
    rho += sign * bs.rho * qty;
  });

  return {
    delta,
    gamma,
    theta,
    vega,
    rho,
    netDebitCredit,
  };
}

/**
 * Calculates payoff at expiration for a given underlying price
 */
export function calculateExpiryPayoffAtPrice(
  legs: OptionLeg[],
  testPrice: number,
  initialSpotPrice: number
): number {
  let totalProfit = 0;

  legs.forEach((leg) => {
    const sign = leg.side === 'BUY' ? 1 : -1;
    const qty = leg.quantity;

    if (leg.type === 'STOCK') {
      // P&L of underlying stock relative to initial spot price
      totalProfit += sign * (testPrice - initialSpotPrice) * qty;
      return;
    }

    let payoffAtExpiry = 0;
    if (leg.type === 'CALL') {
      payoffAtExpiry = Math.max(0, testPrice - leg.strike);
    } else {
      payoffAtExpiry = Math.max(0, leg.strike - testPrice);
    }

    if (leg.side === 'BUY') {
      totalProfit += (payoffAtExpiry - leg.premium) * qty;
    } else {
      totalProfit += (leg.premium - payoffAtExpiry) * qty;
    }
  });

  return totalProfit;
}

/**
 * Calculates net strategy payoff at a simulated price
 */
export function calculateStrategyPayoff(
  legs: OptionLeg[],
  simSpot: number,
  initialSpot?: number
): { netProfitLoss: number } {
  return {
    netProfitLoss: calculateExpiryPayoffAtPrice(legs, simSpot, initialSpot ?? simSpot),
  };
}

/**
 * Calculates theoretical payoff TODAY (D-0) for a given underlying price
 */
export function calculateCurrentPayoffAtPrice(
  legs: OptionLeg[],
  testPrice: number,
  initialSpotPrice: number,
  iv: number = 0.28,
  interestRate: number = 0.1325,
  daysElapsed: number = 0
): number {
  let totalProfit = 0;

  legs.forEach((leg) => {
    const sign = leg.side === 'BUY' ? 1 : -1;
    const qty = leg.quantity;

    if (leg.type === 'STOCK') {
      totalProfit += sign * (testPrice - initialSpotPrice) * qty;
      return;
    }

    const remainingDays = Math.max(0, leg.daysToExpiry - daysElapsed);
    const bs = calculateBlackScholes(
      testPrice,
      leg.strike,
      remainingDays,
      iv,
      interestRate,
      leg.type
    );

    // Current value of the option minus initial premium paid/received
    if (leg.side === 'BUY') {
      totalProfit += (bs.price - leg.premium) * qty;
    } else {
      totalProfit += (leg.premium - bs.price) * qty;
    }
  });

  return totalProfit;
}

/**
 * Generates data points for the Payoff chart across a realistic price range
 */
export function generatePayoffCurve(
  legs: OptionLeg[],
  spotPrice: number,
  iv: number = 0.28,
  interestRate: number = 0.1325,
  rangePercent: number = 0.25, // +/- 25% around spot
  steps: number = 60
) {
  if (legs.length === 0) return [];

  const minPrice = Math.max(1, spotPrice * (1 - rangePercent));
  const maxPrice = spotPrice * (1 + rangePercent);
  const stepSize = (maxPrice - minPrice) / steps;

  const points = [];

  for (let p = minPrice; p <= maxPrice + 0.0001; p += stepSize) {
    const expiryPnL = calculateExpiryPayoffAtPrice(legs, p, spotPrice);
    const currentPnL = calculateCurrentPayoffAtPrice(legs, p, spotPrice, iv, interestRate, 0);
    const halfTermPnL = calculateCurrentPayoffAtPrice(legs, p, spotPrice, iv, interestRate, 15);

    points.push({
      price: Math.round(p * 100) / 100,
      expiryPnL: Math.round(expiryPnL * 100) / 100,
      currentPnL: Math.round(currentPnL * 100) / 100,
      halfTermPnL: Math.round(halfTermPnL * 100) / 100,
    });
  }

  return points;
}

/**
 * Identifies Break-Even points where expiryPnL crosses zero
 */
export function findBreakEvens(
  legs: OptionLeg[],
  spotPrice: number,
  rangePercent: number = 0.4
): number[] {
  if (legs.length === 0) return [];

  const minPrice = Math.max(0.5, spotPrice * (1 - rangePercent));
  const maxPrice = spotPrice * (1 + rangePercent);
  const steps = 300;
  const stepSize = (maxPrice - minPrice) / steps;

  const breakEvens: number[] = [];
  let prevPnL = calculateExpiryPayoffAtPrice(legs, minPrice, spotPrice);

  for (let p = minPrice + stepSize; p <= maxPrice; p += stepSize) {
    const currPnL = calculateExpiryPayoffAtPrice(legs, p, spotPrice);

    // Sign change detected
    if ((prevPnL <= 0 && currPnL >= 0) || (prevPnL >= 0 && currPnL <= 0)) {
      // Linear interpolation for higher accuracy
      const zeroPrice = p - stepSize + (stepSize * Math.abs(prevPnL)) / (Math.abs(prevPnL) + Math.abs(currPnL));
      // Only keep if not duplicate
      if (!breakEvens.some((be) => Math.abs(be - zeroPrice) < 0.15)) {
        breakEvens.push(Math.round(zeroPrice * 100) / 100);
      }
    }
    prevPnL = currPnL;
  }

  return breakEvens;
}

/**
 * Approximates B3 CORE Margin Requirements for the structure
 */
export function estimateB3Margin(
  legs: OptionLeg[],
  spotPrice: number
): MarginEstimate {
  if (legs.length === 0) {
    return {
      estimatedInitialMargin: 0,
      marginType: 'ISENTA_COBERTA',
      description: 'Nenhuma perna cadastrada.',
      riskScore: 'BAIXO',
      collateralRecommendations: [],
    };
  }

  // Count stock position
  const stockLeg = legs.find((l) => l.type === 'STOCK');
  const stockQty = stockLeg ? (stockLeg.side === 'BUY' ? stockLeg.quantity : -stockLeg.quantity) : 0;

  // Separate calls and puts
  const soldCalls = legs.filter((l) => l.type === 'CALL' && l.side === 'SELL');
  const boughtCalls = legs.filter((l) => l.type === 'CALL' && l.side === 'BUY');
  const soldPuts = legs.filter((l) => l.type === 'PUT' && l.side === 'SELL');
  const boughtPuts = legs.filter((l) => l.type === 'PUT' && l.side === 'BUY');

  const totalSoldCallQty = soldCalls.reduce((sum, l) => sum + l.quantity, 0);
  const totalBoughtCallQty = boughtCalls.reduce((sum, l) => sum + l.quantity, 0);
  const totalSoldPutQty = soldPuts.reduce((sum, l) => sum + l.quantity, 0);
  const totalBoughtPutQty = boughtPuts.reduce((sum, l) => sum + l.quantity, 0);

  // Check if fully covered call: stock is bought and covers all sold calls
  if (stockQty >= totalSoldCallQty && totalSoldCallQty > 0 && soldPuts.length === 0 && totalBoughtCallQty === 0) {
    return {
      estimatedInitialMargin: 0,
      marginType: 'ISENTA_COBERTA',
      description: 'Venda Coberta 100% garantida pelas ações em custódia. Não há chamada de margem financeira em dinheiro.',
      riskScore: 'BAIXO',
      collateralRecommendations: [
        'Ações do ativo em custódia na corretora como garantia estrita.',
        'Sem necessidade de alocação de caixa ou títulos públicos.',
      ],
    };
  }

  // Check if vertical spreads (Trava de Alta / Trava de Baixa)
  const isCallSpread = soldCalls.length === 1 && boughtCalls.length === 1 && soldPuts.length === 0 && stockQty === 0;
  const isPutSpread = soldPuts.length === 1 && boughtPuts.length === 1 && soldCalls.length === 0 && stockQty === 0;

  if (isCallSpread || isPutSpread) {
    const sold = isCallSpread ? soldCalls[0] : soldPuts[0];
    const bought = isCallSpread ? boughtCalls[0] : boughtPuts[0];
    const strikeDiff = Math.abs(sold.strike - bought.strike);
    const maxSpreadRisk = strikeDiff * Math.min(sold.quantity, bought.quantity);

    return {
      estimatedInitialMargin: maxSpreadRisk,
      marginType: 'TRAVADA',
      description: `Trava de Risco Limitado: A B3 exige como garantia a diferença máxima entre os strikes (R$ ${strikeDiff.toFixed(2)} por opção).`,
      riskScore: 'MODERADO',
      collateralRecommendations: [
        'Garantia travada na corretora no valor máximo da diferença entre strikes.',
        'Aceita CDB 100% CDI, Tesouro Selic ou saldo em conta corrente.',
      ],
    };
  }

  // Naked short calls or puts (Venda a Seco ou estruturas complexas)
  let totalMarginCORE = 0;
  let isNakedCall = false;

  // Uncovered calls
  const uncoveredCallQty = Math.max(0, totalSoldCallQty - Math.max(0, stockQty) - totalBoughtCallQty);
  if (uncoveredCallQty > 0) {
    isNakedCall = true;
    // B3 CORE typically requires ~20% to 25% of underlying spot price for naked short calls
    totalMarginCORE += uncoveredCallQty * spotPrice * 0.22;
  }

  // Uncovered puts
  const uncoveredPutQty = Math.max(0, totalSoldPutQty - totalBoughtPutQty);
  if (uncoveredPutQty > 0) {
    // For puts, strike value or ~15% - 20% of strike
    soldPuts.forEach((sp) => {
      totalMarginCORE += sp.quantity * sp.strike * 0.18;
    });
  }

  if (isNakedCall) {
    return {
      estimatedInitialMargin: Math.round(totalMarginCORE),
      marginType: 'RISCO_CORE_B3',
      description: 'Venda a Seco / Risco Indefinido: O sistema CORE da B3 calcula margem dinâmica com estresse de volatilidade e preço.',
      riskScore: 'CRITICO',
      collateralRecommendations: [
        '⚠️ Risco de Liquidação Compulsória caso ocorra gap de alta.',
        'Manter pelo menos 130% da margem exigida alocada em Tesouro Selic para evitar multas de margem da B3.',
        'Considere transformar em Trava de Baixa comprando uma ponta protetora OTM.',
      ],
    };
  }

  if (uncoveredPutQty > 0) {
    return {
      estimatedInitialMargin: Math.round(totalMarginCORE),
      marginType: 'RISCO_CORE_B3',
      description: 'Venda de PUT: A B3 exige margem correspondente ao risco de entrega do ativo no strike acordado.',
      riskScore: 'MODERADO',
      collateralRecommendations: [
        'Garantias aceitas: Tesouro Direto Selic (com deságio de ~1% a 2%), CDBs emitidos por bancos autorizados.',
        'Em caso de exercício, o investidor deverá honrar a compra do ativo no strike total.',
      ],
    };
  }

  // Net bought options (Debit position)
  const onlyBought = legs.every((l) => l.side === 'BUY');
  if (onlyBought) {
    const totalPremiumPaid = legs.reduce((sum, l) => sum + l.premium * l.quantity, 0);
    return {
      estimatedInitialMargin: totalPremiumPaid,
      marginType: 'ISENTA_COBERTA',
      description: 'Posição Titular Comprada: Risco limitado estritamente ao prêmio pago. Não há chamada de margem adicional pela B3.',
      riskScore: 'BAIXO',
      collateralRecommendations: [
        'Apenas o valor do débito no D+1 da compra das opções.',
        'Não há risco de chamada de garantia posterior.',
      ],
    };
  }

  return {
    estimatedInitialMargin: Math.round(totalMarginCORE || spotPrice * 100 * 0.15),
    marginType: 'RISCO_CORE_B3',
    description: 'Estrutura Mista B3: Margem calculada por compensação de pernas no modelo de risco CORE.',
    riskScore: 'MODERADO',
    collateralRecommendations: [
      'A B3 compensa pernas opostas reduzindo a exigência de garantia líquida.',
      'Garantias elegíveis: Tesouro Selic, CDBs com liquidez diária e Ações autorizadas com deságio regulamentar.',
    ],
  };
}
