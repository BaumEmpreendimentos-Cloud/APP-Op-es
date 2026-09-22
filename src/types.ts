export type OptionType = 'CALL' | 'PUT' | 'STOCK';
export type PositionSide = 'BUY' | 'SELL';
export type ExerciseStyle = 'AMERICAN' | 'EUROPEAN';

export interface OptionLeg {
  id: string;
  type: OptionType;
  side: PositionSide;
  strike: number;
  premium: number;
  quantity: number;
  daysToExpiry: number;
  ticker?: string;
  exerciseStyle?: ExerciseStyle;
  currentPrice?: number;
}

export type StrategyCategory =
  | 'RENDA_E_COBERTURA'
  | 'TRAVAS_DIRECIONAIS'
  | 'MERCADO_LATERAL_THETA'
  | 'VOLATILIDADE_EXPLOSIVA'
  | 'ESTRUTURAS_TEMPORAIS'
  | 'ASSIMETRICAS_E_RATIOS'
  | 'PROTECAO_E_HEDGE';

export type MarketSentiment = 'BULLISH' | 'BEARISH' | 'NEUTRAL' | 'VOLATILE';

export interface StrategyTemplate {
  id: string;
  name: string;
  namePt: string;
  category: StrategyCategory;
  sentiment: MarketSentiment;
  shortDescription: string;
  detailedDescription: string;
  maxProfit: string;
  maxLoss: string;
  breakEvenDescription: string;
  idealIV: string;
  difficulty: 'Iniciante' | 'Intermediário' | 'Avançado' | 'Profissional';
  marginRequirementB3: string;
  b3PracticalTips: string[];
  createDefaultLegs: (spotPrice: number, baseTicker: string) => OptionLeg[];
}

export interface StrategyPerformancePoint {
  date: string;
  spotPrice: number;
  strategyValue: number;
  unrealizedPnL: number;
  roiPercent: number;
}

export interface User {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

export interface PositionRecord {
  id: string;
  userId?: string;
  name: string;
  ticker: string;
  legs: OptionLeg[];
  createdAt: string;
  status: 'OPEN' | 'ROLLED' | 'CLOSED';
  notes?: string;
  spotPriceAtEntry: number;
  initialNetCashflow: number; // positive = credit received, negative = debit paid
  currentNetValue?: number;
  unrealizedPnL?: number;
  realizedPnL?: number;
  closedAt?: string;
  targetProfit?: number;
  stopLoss?: number;
  history?: StrategyPerformancePoint[];
  lastUpdated?: string;
}

export interface OpLabOptionDetail {
  symbol: string;
  name: string;
  parentSymbol: string;
  category: 'CALL' | 'PUT' | 'STOCK';
  maturityType: 'AMERICAN' | 'EUROPEAN';
  strike: number;
  spotPrice: number;
  close: number;
  bid: number;
  ask: number;
  daysToMaturity: number;
  dueDate: string | null;
  volume: number;
  financialVolume: number;
  variation: number;
}

export interface PortfolioGreeks {
  delta: number;
  gamma: number;
  theta: number; // R$ per business day
  vega: number;  // R$ per 1% IV change
  rho: number;   // R$ per 1% interest rate change
  netDebitCredit: number; // positive = credit received, negative = debit paid
}

export interface MarginEstimate {
  estimatedInitialMargin: number;
  marginType: 'ISENTA_COBERTA' | 'TRAVADA' | 'RISCO_CORE_B3';
  description: string;
  riskScore: 'BAIXO' | 'MODERADO' | 'ALTO' | 'CRITICO';
  collateralRecommendations: string[];
}

export interface SavedPosition {
  id: string;
  name: string;
  ticker: string;
  spotPriceAtEntry: number;
  legs: OptionLeg[];
  entryDate: string;
  notes?: string;
  status: 'OPEN' | 'ROLLED' | 'CLOSED';
  initialCreditDebit: number;
}

export interface RollOption {
  currentStrike: number;
  targetStrike: number;
  currentPremiumToClose: number;
  newPremiumToOpen: number;
  netFinancial: number; // positive = credit, negative = debit
  annualizedRate: number;
  recommendation: 'EXCELENTE' | 'MODERADA' | 'DESACONSELHADA';
  explanation: string;
}

export interface AssetData {
  ticker: string;
  companyName: string;
  sector: string;
  spotPrice: number;
  ivCurrent: number; // decimal (e.g. 0.28 for 28%)
  ivPercentile: number;
  defaultCallSeries: string;
  defaultPutSeries: string;
}

export interface AcademyArticle {
  id: string;
  category: string;
  title: string;
  readingMinutes: number;
  subtitle: string;
  keyTakeaways: string[];
  content: string;
  practicalExample?: string;
}
