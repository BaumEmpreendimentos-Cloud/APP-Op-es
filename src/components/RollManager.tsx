import React, { useState, useEffect } from 'react';
import { OptionLeg, PositionRecord, StrategyPerformancePoint } from '../types';
import { B3_EXPIRATION_LETTERS, IBOVESPA_ASSETS } from '../data/ibovAssets';
import { fetchQuotes } from '../utils/oplabApi';
import { analyzePositionProactively, ProactiveSuggestion } from '../utils/proactiveEngine';
import { RiskMarginPanel } from './RiskMarginPanel';
import {
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  ArrowRight,
  DollarSign,
  Calendar,
  Clock,
  Trash2,
  TrendingUp,
  Target,
  Shield,
  Layers,
  Sparkles,
  ExternalLink,
  ChevronRight,
  Activity,
  Zap,
  Play,
  Pause,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Lightbulb,
} from 'lucide-react';

interface RollManagerProps {
  legs: OptionLeg[];
  spotPrice: number;
  ticker: string;
  positions: PositionRecord[];
  setPositions: React.Dispatch<React.SetStateAction<PositionRecord[]>>;
  onLoadPositionToSimulator: (position: PositionRecord) => void;
  onApplyRolledLegsToSimulator?: (newLegs: OptionLeg[]) => void;
  interestRate?: number;
  iv?: number;
}

export interface MultiLegRollItem {
  id: string;
  originalLeg: OptionLeg;
  included: boolean;
  closePrice: number;
  quantity: number;
  newQuantity: number;
  newType: 'CALL' | 'PUT' | 'STOCK';
  newSide: 'BUY' | 'SELL';
  newMonthLetter: string;
  newStrike: number;
  newPremium: number;
  newTicker: string;
  daysToNewExpiry: number;
}

export function getNextB3MonthLetter(currentLetter: string, isCall: boolean): string {
  const callLetters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];
  const putLetters = ['M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X'];

  const clean = (currentLetter || '').toUpperCase();
  if (isCall) {
    const idx = callLetters.indexOf(clean);
    if (idx >= 0) return callLetters[(idx + 1) % 12];
    return 'K';
  } else {
    const idx = putLetters.indexOf(clean);
    if (idx >= 0) return putLetters[(idx + 1) % 12];
    return 'W';
  }
}

export function createLegRollItem(leg: OptionLeg, baseTicker: string): MultiLegRollItem {
  const isStock = leg.type === 'STOCK';
  const isCall = leg.type === 'CALL';

  let currentLetter = isCall ? 'J' : 'V';
  if (leg.ticker && leg.ticker.length >= 5 && !isStock) {
    currentLetter = leg.ticker[4].toUpperCase();
  }

  const nextLetter = isStock ? '' : getNextB3MonthLetter(currentLetter, isCall);
  const nextStrike = leg.strike;
  const currentP = leg.currentPrice ?? leg.premium;

  const estimatedNewPremium = isStock
    ? currentP
    : Math.round(currentP * (leg.side === 'SELL' ? 1.35 : 1.28) * 100) / 100 || 1.25;

  const strikeStr = Math.round(nextStrike).toString();
  const nextTicker = isStock ? (leg.ticker || baseTicker) : `${baseTicker}${nextLetter}${strikeStr}`;

  return {
    id: leg.id,
    originalLeg: leg,
    included: true,
    closePrice: currentP,
    quantity: leg.quantity,
    newQuantity: leg.quantity,
    newType: leg.type,
    newSide: leg.side,
    newMonthLetter: nextLetter,
    newStrike: nextStrike,
    newPremium: estimatedNewPremium,
    newTicker: nextTicker,
    daysToNewExpiry: isStock ? 0 : 44,
  };
}

export const RollManager: React.FC<RollManagerProps> = ({
  legs,
  spotPrice,
  ticker,
  positions,
  setPositions,
  onLoadPositionToSimulator,
  onApplyRolledLegsToSimulator,
  interestRate = 0.1325,
  iv = 0.28,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'portfolio' | 'rollCalculator'>('portfolio');

  // Expanded card sections state
  const [expandedSuggestionsPosId, setExpandedSuggestionsPosId] = useState<string | null>(null);
  const [expandedRiskPosId, setExpandedRiskPosId] = useState<string | null>(null);

  // 5-Minute Auto-Refresh Timer State (Requirement 1)
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const [countdownSeconds, setCountdownSeconds] = useState(300); // 300s = 5 min
  const [isRefreshingQuotes, setIsRefreshingQuotes] = useState(false);
  const [lastQuotesUpdate, setLastQuotesUpdate] = useState<string | null>(null);
  const [refreshNotification, setRefreshNotification] = useState<string | null>(null);

  // Multi-Leg Rollover Calculator State (Simula TODAS as pernas da estratégia)
  const [rollStrategyTitle, setRollStrategyTitle] = useState<string>('Rolagem Consolidada da Estrutura');
  const [rollTicker, setRollTicker] = useState<string>(ticker);
  const [multiLegs, setMultiLegs] = useState<MultiLegRollItem[]>(() =>
    legs.map((l) => createLegRollItem(l, ticker))
  );

  // Synchronize when legs change if currently matching
  useEffect(() => {
    if (multiLegs.length === 0 && legs.length > 0) {
      setMultiLegs(legs.map((l) => createLegRollItem(l, ticker)));
      setRollTicker(ticker);
    }
  }, [legs, ticker]);

  // Close position modal
  const [closingPositionId, setClosingPositionId] = useState<string | null>(null);
  const [closePnLInput, setClosePnLInput] = useState<number>(0);

  // Multi-Leg Financial Flow Calculations
  const legCalculations = multiLegs.map((item) => {
    if (!item.included) {
      return {
        closeFlow: 0,
        openFlow: 0,
        netFlow: 0,
        actionClose: 'Ignorada',
        actionOpen: 'Ignorada',
      };
    }

    // Fechamento da perna atual:
    // Perna VENDIDA (SELL) -> Recompra (Débito/Saída): -closePrice * quantity
    // Perna COMPRADA (BUY) -> Venda a mercado (Crédito/Entrada): +closePrice * quantity
    const isSell = item.originalLeg.side === 'SELL';
    const closeFlow = isSell
      ? -item.closePrice * item.quantity
      : item.closePrice * item.quantity;
    const actionClose = isSell ? 'Recompra' : 'Venda Liq.';

    // Abertura da perna na nova série (com suporte a rebalanceamento de quantidade!):
    // Nova VENDIDA (SELL) -> Venda na nova série (Crédito/Entrada): +newPremium * newQuantity
    // Nova COMPRADA (BUY) -> Compra na nova série (Débito/Saída): -newPremium * newQuantity
    const isNewSell = item.newSide === 'SELL';
    const openQty = item.newQuantity ?? item.quantity;
    const openFlow = isNewSell
      ? item.newPremium * openQty
      : -item.newPremium * openQty;
    const actionOpen = isNewSell ? 'Venda Nova' : 'Compra Nova';

    const netFlow = closeFlow + openFlow;

    return {
      closeFlow,
      openFlow,
      netFlow,
      actionClose,
      actionOpen,
    };
  });

  const totalCloseFlow = legCalculations.reduce((acc, c) => acc + c.closeFlow, 0);
  const totalOpenFlow = legCalculations.reduce((acc, c) => acc + c.openFlow, 0);
  const consolidatedNetCashFlow = totalCloseFlow + totalOpenFlow;

  const totalIncludedLegs = multiLegs.filter((l) => l.included).length;
  const maxQuantity = multiLegs
    .filter((l) => l.included)
    .reduce((acc, l) => Math.max(acc, l.newQuantity ?? l.quantity, l.quantity), 0) || 1000;
  const netPerShare = maxQuantity > 0 ? consolidatedNetCashFlow / maxQuantity : 0;
  const isConsolidatedCredit = consolidatedNetCashFlow >= 0;

  // Feasibility assessment for the consolidated structure
  let feasibilityBadge = {
    label: 'EXCELENTE (CRÉDITO LÍQUIDO)',
    bg: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    desc: 'A rolagem multi-pernas gera crédito líquido consolidado no caixa, postergando o risco e remunerando o capital.',
  };

  if (!isConsolidatedCredit && Math.abs(netPerShare) < 0.40) {
    feasibilityBadge = {
      label: 'MODERADA (PEQUENO DÉBITO)',
      bg: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
      desc: 'Rolagem a pequeno débito aceitável se o ajuste de strikes aumentar a probabilidade de lucro ou proteger o capital.',
    };
  } else if (!isConsolidatedCredit) {
    feasibilityBadge = {
      label: 'DESACONSELHADA (DÉBITO ELEVADO)',
      bg: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
      desc: 'Pagar débito líquido expressivo na estrutura consome margem e drena capital sem garantia estatística.',
    };
  }

  // Live Market Quotes refresh for all open positions (Requirement 1)
  const handleRefreshLiveQuotes = async () => {
    setIsRefreshingQuotes(true);
    try {
      const tickersToFetch = new Set<string>();
      positions
        .filter((p) => p.status === 'OPEN')
        .forEach((p) => {
          tickersToFetch.add(p.ticker);
          p.legs.forEach((l) => {
            if (l.ticker) tickersToFetch.add(l.ticker);
          });
        });

      if (tickersToFetch.size === 0) {
        setIsRefreshingQuotes(false);
        return;
      }

      const res = await fetchQuotes(Array.from(tickersToFetch));
      const quoteMap = new Map<string, number>();
      res.data.forEach((q) => {
        quoteMap.set(q.symbol, q.close);
      });

      setPositions((prev) =>
        prev.map((pos) => {
          if (pos.status !== 'OPEN') return pos;

          const updatedLegs = pos.legs.map((leg) => {
            const currentLegPrice =
              leg.ticker && quoteMap.has(leg.ticker)
                ? quoteMap.get(leg.ticker)!
                : leg.currentPrice || leg.premium;
            return { ...leg, currentPrice: currentLegPrice };
          });

          // Liquidation cash value:
          // Long legs can be sold at current price (+)
          // Short legs must be bought back at current price (-)
          const currentLiquidationValue = updatedLegs.reduce((acc, leg) => {
            const sign = leg.side === 'BUY' ? 1 : -1;
            const p = leg.currentPrice ?? leg.premium;
            return acc + sign * p * leg.quantity;
          }, 0);

          const initialCash = pos.initialNetCashflow;
          const currentUnrealized = initialCash + currentLiquidationValue;
          const roiPercent = initialCash !== 0 ? (currentUnrealized / Math.abs(initialCash)) * 100 : 0;
          const currentSpot = quoteMap.get(pos.ticker) || pos.spotPriceAtEntry;

          const newPoint: StrategyPerformancePoint = {
            date: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
            spotPrice: currentSpot,
            strategyValue: currentUnrealized,
            unrealizedPnL: currentUnrealized,
            roiPercent: Math.round(roiPercent * 10) / 10,
          };

          const history = [...(pos.history || []), newPoint];

          return {
            ...pos,
            legs: updatedLegs,
            currentNetValue: currentLiquidationValue,
            unrealizedPnL: currentUnrealized,
            history,
            lastUpdated: new Date().toISOString(),
          };
        })
      );

      const timeStr = new Date().toLocaleTimeString('pt-BR');
      setLastQuotesUpdate(timeStr);
      setRefreshNotification(`Cotações atualizadas com sucesso às ${timeStr}`);
      setTimeout(() => setRefreshNotification(null), 4000);
    } catch (err) {
      console.error('Erro ao atualizar cotações das posições:', err);
    } finally {
      setIsRefreshingQuotes(false);
    }
  };

  // 5-Minute Auto-Refresh Timer Effect (Requirement 1)
  useEffect(() => {
    if (!autoRefreshEnabled) return;

    const timer = setInterval(() => {
      setCountdownSeconds((prev) => {
        if (prev <= 1) {
          handleRefreshLiveQuotes();
          return 300; // Reset to 5 minutes
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [autoRefreshEnabled, positions]);

  // Format countdown seconds into mm:ss
  const formatCountdown = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Close Position handler
  const handleConfirmClose = () => {
    if (!closingPositionId) return;
    setPositions(
      positions.map((p) =>
        p.id === closingPositionId
          ? {
              ...p,
              status: 'CLOSED',
              realizedPnL: closePnLInput,
              closedAt: new Date().toISOString(),
            }
          : p
      )
    );
    setClosingPositionId(null);
  };

  const handleDeletePosition = (id: string) => {
    setPositions(positions.filter((p) => p.id !== id));
  };

  // Apply a proactive suggestion to the rollover calculator
  const handleApplySuggestionToRoll = (sug: ProactiveSuggestion, targetPos?: PositionRecord) => {
    const pos = targetPos || positions[0];
    if (pos) {
      setRollStrategyTitle(pos.name);
      setRollTicker(pos.ticker);
      const items = pos.legs.map((l) => {
        const item = createLegRollItem(l, pos.ticker);
        if (sug.suggestedAction.legToClose && l.id === sug.suggestedAction.legToClose.id) {
          if (sug.suggestedAction.targetStrike) item.newStrike = sug.suggestedAction.targetStrike;
          if (sug.suggestedAction.targetLetter) item.newMonthLetter = sug.suggestedAction.targetLetter;
          if (sug.suggestedAction.targetPremium) item.newPremium = sug.suggestedAction.targetPremium;
          if (sug.suggestedAction.targetDays) item.daysToNewExpiry = sug.suggestedAction.targetDays;
          const strikeStr = Math.round(item.newStrike).toString();
          item.newTicker = `${pos.ticker}${item.newMonthLetter}${strikeStr}`;
        }
        return item;
      });
      setMultiLegs(items);
    } else if (sug.suggestedAction.legToClose) {
      setMultiLegs((prev) =>
        prev.map((item) => {
          if (item.originalLeg.id === sug.suggestedAction.legToClose?.id) {
            const updated = { ...item };
            if (sug.suggestedAction.targetStrike) updated.newStrike = sug.suggestedAction.targetStrike;
            if (sug.suggestedAction.targetLetter) updated.newMonthLetter = sug.suggestedAction.targetLetter;
            if (sug.suggestedAction.targetPremium) updated.newPremium = sug.suggestedAction.targetPremium;
            if (sug.suggestedAction.targetDays) updated.daysToNewExpiry = sug.suggestedAction.targetDays;
            return updated;
          }
          return item;
        })
      );
    }
    setActiveSubTab('rollCalculator');
  };

  // Load ALL LEGS of a position into the Rollover Calculator
  const handleLoadToRollCalculator = (pos: PositionRecord) => {
    setRollStrategyTitle(pos.name);
    setRollTicker(pos.ticker);
    setMultiLegs(pos.legs.map((l) => createLegRollItem(l, pos.ticker)));
    setActiveSubTab('rollCalculator');
  };

  // Batch actions for multi-leg roll
  const handleAdvanceAllMonths = () => {
    setMultiLegs((prev) =>
      prev.map((item) => {
        if (item.newType === 'STOCK') return item;
        const isCall = item.newType === 'CALL';
        const nextLetter = getNextB3MonthLetter(item.newMonthLetter, isCall);
        const strikeStr = Math.round(item.newStrike).toString();
        return {
          ...item,
          newMonthLetter: nextLetter,
          newTicker: `${rollTicker}${nextLetter}${strikeStr}`,
          daysToNewExpiry: 44,
          newPremium: Math.round(item.newPremium * 1.15 * 100) / 100,
        };
      })
    );
  };

  const handleKeepSameStrikes = () => {
    setMultiLegs((prev) =>
      prev.map((item) => {
        const strikeStr = Math.round(item.originalLeg.strike).toString();
        return {
          ...item,
          newStrike: item.originalLeg.strike,
          newTicker: item.newType === 'STOCK' ? item.newTicker : `${rollTicker}${item.newMonthLetter}${strikeStr}`,
        };
      })
    );
  };

  const handleShiftAllStrikes = (percent: number) => {
    setMultiLegs((prev) =>
      prev.map((item) => {
        if (item.newType === 'STOCK') return item;
        const shifted = Math.round(item.newStrike * (1 + percent / 100) * 100) / 100;
        const strikeStr = Math.round(shifted).toString();
        return {
          ...item,
          newStrike: shifted,
          newTicker: `${rollTicker}${item.newMonthLetter}${strikeStr}`,
        };
      })
    );
  };

  const handleToggleAllLegs = (include: boolean) => {
    setMultiLegs((prev) => prev.map((item) => ({ ...item, included: include })));
  };

  // Rebalancing batch helpers
  const handleResetQuantities = () => {
    setMultiLegs((prev) =>
      prev.map((item) => ({
        ...item,
        newQuantity: item.quantity,
      }))
    );
  };

  const handleScaleNewQuantities = (factor: number) => {
    setMultiLegs((prev) =>
      prev.map((item) => {
        const raw = item.newQuantity * factor;
        const scaled = raw >= 100 ? Math.max(100, Math.round(raw / 100) * 100) : Math.max(1, Math.round(raw));
        return {
          ...item,
          newQuantity: scaled,
        };
      })
    );
  };

  const handleResetToCurrentLegs = () => {
    setRollStrategyTitle('Rolagem da Estrutura Ativa');
    setRollTicker(ticker);
    setMultiLegs(legs.map((l) => createLegRollItem(l, ticker)));
  };

  // Apply rolled structure to Payoff Simulator
  const handleApplyToSimulator = () => {
    if (!onApplyRolledLegsToSimulator) return;
    const rolledLegs: OptionLeg[] = multiLegs
      .filter((l) => l.included)
      .map((l) => ({
        id: `leg-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        type: l.newType,
        side: l.newSide,
        strike: l.newStrike,
        premium: l.newPremium,
        quantity: l.newQuantity ?? l.quantity,
        daysToExpiry: l.daysToNewExpiry,
        ticker: l.newTicker,
        exerciseStyle: l.newType === 'CALL' ? 'AMERICAN' : 'EUROPEAN',
      }));
    onApplyRolledLegsToSimulator(rolledLegs);
  };

  // Save rolled structure as a new position in Portfolio
  const handleSaveRolledPosition = () => {
    const rolledLegs: OptionLeg[] = multiLegs
      .filter((l) => l.included)
      .map((l) => ({
        id: `leg-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        type: l.newType,
        side: l.newSide,
        strike: l.newStrike,
        premium: l.newPremium,
        currentPrice: l.newPremium,
        quantity: l.newQuantity ?? l.quantity,
        daysToExpiry: l.daysToNewExpiry,
        ticker: l.newTicker,
        exerciseStyle: l.newType === 'CALL' ? 'AMERICAN' : 'EUROPEAN',
      }));

    const newPos: PositionRecord = {
      id: `pos-${Date.now()}`,
      name: `${rollStrategyTitle} [Rolada]`,
      ticker: rollTicker,
      createdAt: new Date().toISOString(),
      spotPriceAtEntry: spotPrice,
      initialNetCashflow: consolidatedNetCashFlow,
      status: 'OPEN',
      legs: rolledLegs,
      notes: `Rolagem multi-pernas executada. Saldo líquido consolidado: R$ ${consolidatedNetCashFlow.toFixed(2)} (${consolidatedNetCashFlow >= 0 ? 'Crédito' : 'Débito'}).`,
      history: [
        {
          date: new Date().toISOString().split('T')[0],
          spotPrice,
          strategyValue: Math.abs(consolidatedNetCashFlow),
          unrealizedPnL: 0,
          roiPercent: 0,
        },
      ],
    };

    setPositions((prev) => [newPos, ...prev]);
    setActiveSubTab('portfolio');
    setRefreshNotification(`Nova operação "${newPos.name}" cadastrada com sucesso no portfólio!`);
    setTimeout(() => setRefreshNotification(null), 5000);
  };

  // Portfolio Totals
  const activePositions = positions.filter((p) => p.status === 'OPEN');
  const totalUnrealizedPnL = activePositions.reduce((acc, p) => acc + (p.unrealizedPnL || 0), 0);
  const totalRealizedPnL = positions
    .filter((p) => p.status === 'CLOSED' && p.realizedPnL !== undefined)
    .reduce((acc, p) => acc + (p.realizedPnL || 0), 0);
  const totalNotional = activePositions.reduce((acc, p) => {
    return (
      acc +
      p.legs.reduce((lAcc, l) => lAcc + (l.strike || p.spotPriceAtEntry) * l.quantity, 0)
    );
  }, 0);

  return (
    <div id="roll-manager" className="space-y-6 pb-12">
      {/* 5-Min Notification Toast */}
      {refreshNotification && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-emerald-600 text-white px-4 py-2.5 rounded-xl shadow-2xl border border-emerald-400/40 text-xs font-bold animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{refreshNotification}</span>
        </div>
      )}

      {/* Sub Navigation & 5-Minute Auto-Refresh Controls */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 bg-slate-900/90 border border-slate-800 p-3 rounded-2xl shadow-lg">
        <div className="flex items-center gap-1.5 p-1 bg-slate-950 rounded-xl border border-slate-800/80 w-full lg:w-auto">
          <button
            onClick={() => setActiveSubTab('portfolio')}
            className={`flex-1 lg:flex-initial flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeSubTab === 'portfolio'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Acompanhamento & Sugestões Proativas ({positions.length})</span>
          </button>

          <button
            onClick={() => setActiveSubTab('rollCalculator')}
            className={`flex-1 lg:flex-initial flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeSubTab === 'rollCalculator'
                ? 'bg-teal-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Calculadora Tática de Rolagem B3</span>
          </button>
        </div>

        {/* 5-Minute Auto-Refresh Timer Bar (Requirement 1) */}
        <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto justify-between lg:justify-end bg-slate-950/80 p-2 rounded-xl border border-slate-800">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setAutoRefreshEnabled(!autoRefreshEnabled)}
              className={`p-1.5 rounded-lg text-xs transition cursor-pointer flex items-center gap-1.5 ${
                autoRefreshEnabled
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold'
                  : 'bg-slate-800 text-slate-400'
              }`}
              title={autoRefreshEnabled ? 'Pausar atualização automática' : 'Ativar atualização automática de 5 min'}
            >
              {autoRefreshEnabled ? <Play className="w-3 h-3 fill-emerald-400" /> : <Pause className="w-3 h-3" />}
              <span className="text-[11px]">
                {autoRefreshEnabled ? 'Auto 5m: Ativo' : 'Auto 5m: Pausado'}
              </span>
            </button>

            {autoRefreshEnabled && (
              <div className="flex items-center gap-1.5 text-xs text-slate-300 font-mono">
                <Clock className="w-3.5 h-3.5 text-sky-400" />
                <span className="text-[11px] font-bold text-sky-400">{formatCountdown(countdownSeconds)}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {lastQuotesUpdate && (
              <span className="text-[10px] text-slate-400 font-mono hidden sm:inline">
                Última: {lastQuotesUpdate}
              </span>
            )}

            <button
              onClick={() => {
                handleRefreshLiveQuotes();
                setCountdownSeconds(300);
              }}
              disabled={isRefreshingQuotes || activePositions.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold transition cursor-pointer shadow"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingQuotes ? 'animate-spin' : ''}`} />
              <span>{isRefreshingQuotes ? 'Atualizando...' : 'Atualizar Agora'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* VIEW 1: Acompanhamento de Estratégias (Portfolio & Performance Tracker) */}
      {activeSubTab === 'portfolio' && (
        <div className="space-y-6">
          {/* Portfolio Metric Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-1">
              <span className="text-xs text-slate-400 font-medium block">Estratégias Ativas</span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black font-mono text-white">
                  {activePositions.length}
                </span>
                <span className="text-xs text-slate-400">de {positions.length} salvas</span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-1">
              <span className="text-xs text-slate-400 font-medium block">Nocional em Risco B3</span>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-black font-mono text-sky-400">
                  R$ {(totalNotional / 1000).toFixed(1)}k
                </span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-1">
              <span className="text-xs text-slate-400 font-medium block">P&L Atual Não Realizado</span>
              <div className="flex items-baseline gap-1">
                <span
                  className={`text-2xl font-black font-mono ${
                    totalUnrealizedPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {totalUnrealizedPnL >= 0 ? '+' : ''}R$ {totalUnrealizedPnL.toFixed(2)}
                </span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-1">
              <span className="text-xs text-slate-400 font-medium block">P&L Realizado Total</span>
              <div className="flex items-baseline gap-1">
                <span
                  className={`text-2xl font-black font-mono ${
                    totalRealizedPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {totalRealizedPnL >= 0 ? '+' : ''}R$ {totalRealizedPnL.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* List of Saved Positions with Live Performance & Proactive Engine */}
          {positions.length === 0 ? (
            <div className="p-12 text-center rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto">
                <Calendar className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-white">Nenhuma estratégia salva ainda</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Monte ou selecione uma operação no <strong>Simulador & Payoff</strong> e clique em <em>"Salvar Estratégia"</em> para acompanhar seu desempenho, alertas e sugestões proativas de rolagem.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {positions.map((pos) => {
                const isOpen = pos.status === 'OPEN';
                const pnl = isOpen ? pos.unrealizedPnL ?? 0 : pos.realizedPnL ?? 0;
                const hasTarget = pos.targetProfit && pos.targetProfit > 0;
                const targetPercent = hasTarget
                  ? Math.min(100, Math.max(0, (pnl / pos.targetProfit!) * 100))
                  : 0;

                const daysSinceCreation = Math.max(
                  1,
                  Math.floor((Date.now() - new Date(pos.createdAt).getTime()) / (1000 * 3600 * 24))
                );
                const nearestExpiry = Math.min(
                  ...pos.legs.map((l) => (l.type === 'STOCK' ? 999 : l.daysToExpiry || 22))
                );

                // Run Proactive Engine diagnosis on this position (Requirement 3)
                const asset = IBOVESPA_ASSETS.find((a) => a.ticker === pos.ticker);
                const currentAssetSpot = asset ? asset.spotPrice : pos.spotPriceAtEntry;
                const diagnosis = analyzePositionProactively(pos, currentAssetSpot, iv, interestRate);

                const hasCriticalAlert = diagnosis.suggestions.some((s) => s.priority === 'CRITICAL');
                const hasHighAlert = diagnosis.suggestions.some((s) => s.priority === 'HIGH');
                const isSuggestionsExpanded = expandedSuggestionsPosId === pos.id;
                const isRiskExpanded = expandedRiskPosId === pos.id;

                return (
                  <div
                    key={pos.id}
                    className={`rounded-2xl bg-slate-900/90 border p-5 space-y-4 shadow-xl transition ${
                      hasCriticalAlert
                        ? 'border-rose-500/50 shadow-rose-950/20'
                        : hasHighAlert
                        ? 'border-amber-500/40 shadow-amber-950/20'
                        : 'border-slate-800 hover:border-slate-700/80'
                    }`}
                  >
                    {/* Header Row */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-base font-black text-white">{pos.name}</span>
                          <span className="px-2 py-0.5 rounded-full font-mono text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            {pos.ticker}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                              pos.status === 'OPEN'
                                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                : pos.status === 'ROLLED'
                                ? 'bg-sky-500/15 text-sky-400 border border-sky-500/30'
                                : 'bg-slate-800 text-slate-400 border border-slate-700'
                            }`}
                          >
                            {pos.status === 'OPEN' ? 'ABERTA' : pos.status === 'ROLLED' ? 'ROLADA' : 'ENCERRADA'}
                          </span>

                          {/* Trigger notification pills */}
                          {hasCriticalAlert && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" />
                              <span>AÇÃO RECOMENDADA</span>
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-1">
                          <span>
                            Entrada: {new Date(pos.createdAt).toLocaleDateString('pt-BR')} ({daysSinceCreation}d atrás)
                          </span>
                          <span>•</span>
                          <span>Spot Inicial: R$ {pos.spotPriceAtEntry?.toFixed(2) || '-'}</span>
                          {nearestExpiry < 900 && (
                            <>
                              <span>•</span>
                              <span
                                className={`font-mono font-bold ${
                                  nearestExpiry <= 5 ? 'text-rose-400' : 'text-amber-400'
                                }`}
                              >
                                Vencimento: ~{nearestExpiry}d úteis
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Current P&L Badge */}
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <span className="text-[11px] text-slate-400 block">
                            {isOpen ? 'P&L Não Realizado (Atual)' : 'P&L Final Realizado'}
                          </span>
                          <span
                            className={`text-xl font-black font-mono ${
                              pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
                            }`}
                          >
                            {pnl >= 0 ? '+' : ''}R$ {pnl.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Target Profit and Stop Loss Progress Bar */}
                    {hasTarget && isOpen && (
                      <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800/80 space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-1.5 text-slate-300">
                            <Target className="w-3.5 h-3.5 text-emerald-400" />
                            <span className="font-semibold">
                              Meta de Lucro: R$ {pos.targetProfit?.toFixed(2)}
                            </span>
                          </div>
                          <span className="font-mono text-emerald-400 font-bold">
                            {targetPercent.toFixed(1)}% atingido
                          </span>
                        </div>
                        <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-teal-500 to-emerald-400 transition-all duration-500 rounded-full"
                            style={{ width: `${targetPercent}%` }}
                          />
                        </div>
                        {pos.stopLoss && (
                          <div className="flex items-center justify-between text-[11px] text-slate-400 pt-0.5">
                            <span className="flex items-center gap-1">
                              <Shield className="w-3 h-3 text-rose-400" />
                              <span>Stop Loss definido: R$ {pos.stopLoss.toFixed(2)}</span>
                            </span>
                            <span>Tolerância de risco</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Historical Performance Line (Mini Sparkline) */}
                    {pos.history && pos.history.length > 1 && (
                      <div className="bg-slate-950/50 p-3 rounded-xl border border-slate-800/60 space-y-2">
                        <div className="flex items-center justify-between text-xs text-slate-400">
                          <span className="flex items-center gap-1.5 font-semibold text-slate-300">
                            <Activity className="w-3.5 h-3.5 text-sky-400" />
                            <span>Evolução do Resultado ao Longo do Tempo</span>
                          </span>
                          <span className="font-mono text-[11px]">
                            {pos.history.length} registros no histórico
                          </span>
                        </div>

                        {/* Visual SVG Curve */}
                        <div className="h-16 w-full flex items-end pt-2">
                          <svg className="w-full h-full overflow-visible" preserveAspectRatio="none">
                            {(() => {
                              const values = pos.history.map((h) => h.unrealizedPnL);
                              const min = Math.min(0, ...values);
                              const max = Math.max(10, ...values);
                              const range = max - min || 1;

                              const points = pos.history
                                .map((h, idx) => {
                                  const x = (idx / (pos.history!.length - 1)) * 100;
                                  const y = 100 - ((h.unrealizedPnL - min) / range) * 85;
                                  return `${x}%,${y}%`;
                                })
                                .join(' ');

                              return (
                                <polyline
                                  fill="none"
                                  stroke={pnl >= 0 ? '#10b981' : '#f43f5e'}
                                  strokeWidth="2.5"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  points={points}
                                />
                              );
                            })()}
                          </svg>
                        </div>

                        {/* History Labels */}
                        <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono border-t border-slate-800/60 pt-1">
                          <span>{pos.history[0].date}</span>
                          <span className="text-center font-bold text-slate-300">
                            Preço Atual: R$ {pos.history[pos.history.length - 1].spotPrice.toFixed(2)}
                          </span>
                          <span>{pos.history[pos.history.length - 1].date}</span>
                        </div>
                      </div>
                    )}

                    {/* Legs Breakdown Table */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-slate-800 text-slate-400 text-[11px] uppercase tracking-wider font-semibold">
                            <th className="py-2 px-2.5">Perna / Sentido</th>
                            <th className="py-2 px-2.5">Código B3</th>
                            <th className="py-2 px-2.5">Strike</th>
                            <th className="py-2 px-2.5">Qtd</th>
                            <th className="py-2 px-2.5">Preço Entrada</th>
                            <th className="py-2 px-2.5">Cotação Atual</th>
                            <th className="py-2 px-2.5 text-right">P&L da Perna</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/40 font-mono">
                          {pos.legs.map((leg) => {
                            const isStock = leg.type === 'STOCK';
                            const currentP = leg.currentPrice ?? leg.premium;
                            const diff = leg.side === 'BUY' ? currentP - leg.premium : leg.premium - currentP;
                            const legPnL = diff * leg.quantity;

                            return (
                              <tr key={leg.id} className="hover:bg-slate-800/20">
                                <td className="py-2 px-2.5">
                                  <span
                                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                      leg.side === 'BUY'
                                        ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-700/60'
                                        : 'bg-rose-950/80 text-rose-400 border border-rose-700/60'
                                    }`}
                                  >
                                    {leg.side === 'BUY' ? 'COMPRA' : 'VENDA'} {leg.type}
                                  </span>
                                </td>
                                <td className="py-2 px-2.5 font-bold text-white">
                                  {leg.ticker || pos.ticker}
                                </td>
                                <td className="py-2 px-2.5 text-slate-300">
                                  {isStock ? '-' : `R$ ${leg.strike.toFixed(2)}`}
                                </td>
                                <td className="py-2 px-2.5 text-slate-300">{leg.quantity}</td>
                                <td className="py-2 px-2.5 text-slate-400">R$ {leg.premium.toFixed(2)}</td>
                                <td className="py-2 px-2.5 font-bold text-emerald-300">
                                  R$ {currentP.toFixed(2)}
                                </td>
                                <td
                                  className={`py-2 px-2.5 text-right font-bold ${
                                    legPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'
                                  }`}
                                >
                                  {legPnL >= 0 ? '+' : ''}R$ {legPnL.toFixed(2)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Operational Notes */}
                    {pos.notes && (
                      <p className="text-xs text-slate-400 italic bg-slate-950/40 p-2 rounded-lg border border-slate-800/50">
                        "{pos.notes}"
                      </p>
                    )}

                    {/* REQUIREMENT 3: Proactive Suggestions & Tactical Rollover Section */}
                    {isOpen && (
                      <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-4 space-y-3">
                        <div
                          className="flex items-center justify-between cursor-pointer"
                          onClick={() => setExpandedSuggestionsPosId(isSuggestionsExpanded ? null : pos.id)}
                        >
                          <div className="flex items-center gap-2">
                            <Lightbulb className="w-4 h-4 text-amber-400" />
                            <span className="text-xs font-bold text-white uppercase tracking-wider">
                              Sugestões Proativas & Diagnóstico B3 ({diagnosis.suggestions.length})
                            </span>
                            {hasCriticalAlert && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                                Urgente
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 text-xs text-slate-400">
                            <span>{isSuggestionsExpanded ? 'Ocultar detalhes' : 'Ver alternativas e custos'}</span>
                            {isSuggestionsExpanded ? (
                              <ChevronUp className="w-4 h-4" />
                            ) : (
                              <ChevronDown className="w-4 h-4" />
                            )}
                          </div>
                        </div>

                        {/* Top Proactive Summary Badge if collapsed */}
                        {!isSuggestionsExpanded && diagnosis.suggestions.length > 0 && (
                          <div className="text-xs text-slate-300 bg-slate-900/90 p-2.5 rounded-lg border border-slate-800 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-amber-400 font-bold">•</span>
                              <span>{diagnosis.suggestions[0].title}</span>
                            </div>
                            <span className="text-[11px] text-teal-400 font-semibold cursor-pointer">
                              Analisar & Rolar →
                            </span>
                          </div>
                        )}

                        {/* Expanded Proactive Suggestions Cards */}
                        {isSuggestionsExpanded && (
                          <div className="space-y-3 pt-2">
                            {diagnosis.suggestions.map((sug) => (
                              <div
                                key={sug.id}
                                className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-3"
                              >
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-slate-800 pb-2">
                                  <div className="flex items-center gap-2">
                                    <span
                                      className={`text-[10px] font-black px-2 py-0.5 rounded ${
                                        sug.priority === 'CRITICAL'
                                          ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                                          : sug.priority === 'HIGH'
                                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                                          : 'bg-teal-500/20 text-teal-400 border border-teal-500/40'
                                      }`}
                                    >
                                      {sug.priority}
                                    </span>
                                    <h4 className="text-xs font-bold text-white">{sug.title}</h4>
                                  </div>

                                  <span className="text-[10px] text-slate-400 font-mono">
                                    {sug.triggerReason}
                                  </span>
                                </div>

                                <p className="text-xs text-slate-300 leading-relaxed">{sug.explanation}</p>

                                {/* Financial Impact Banner */}
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs bg-slate-950 p-2.5 rounded-lg border border-slate-800 font-mono">
                                  <div>
                                    <span className="text-[10px] text-slate-400 block font-sans">
                                      Fluxo Financeiro:
                                    </span>
                                    <span
                                      className={`font-bold ${
                                        sug.financialImpact.netCashflow >= 0 ? 'text-emerald-400' : 'text-rose-400'
                                      }`}
                                    >
                                      {sug.financialImpact.netCashflow >= 0 ? '+ R$ ' : '- R$ '}
                                      {Math.abs(sug.financialImpact.netCashflow).toFixed(2)}
                                    </span>
                                  </div>

                                  <div>
                                    <span className="text-[10px] text-slate-400 block font-sans">
                                      Impacto em Margem:
                                    </span>
                                    <span className="text-slate-300 text-[11px]">
                                      {sug.financialImpact.marginImpact}
                                    </span>
                                  </div>

                                  <div>
                                    <span className="text-[10px] text-slate-400 block font-sans">
                                      Melhora das Gregas:
                                    </span>
                                    <span className="text-sky-400 text-[11px]">
                                      {sug.financialImpact.greeksImprovement}
                                    </span>
                                  </div>
                                </div>

                                {/* Costs and Benefits Breakdown */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                                  <div className="bg-rose-950/20 p-2.5 rounded-lg border border-rose-900/30 space-y-1">
                                    <span className="text-[11px] font-bold text-rose-400 flex items-center gap-1">
                                      <span>⚠️ Custos & Desembolsos:</span>
                                    </span>
                                    <ul className="text-[11px] text-slate-300 space-y-0.5 list-disc list-inside">
                                      {sug.costs.map((c, i) => (
                                        <li key={i}>{c}</li>
                                      ))}
                                    </ul>
                                  </div>

                                  <div className="bg-emerald-950/20 p-2.5 rounded-lg border border-emerald-900/30 space-y-1">
                                    <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1">
                                      <span>✓ Benefícios Esperados:</span>
                                    </span>
                                    <ul className="text-[11px] text-slate-300 space-y-0.5 list-disc list-inside">
                                      {sug.benefits.map((b, i) => (
                                        <li key={i}>{b}</li>
                                      ))}
                                    </ul>
                                  </div>
                                </div>

                                {/* Suggested Action Button */}
                                <div className="flex justify-end pt-1">
                                  {sug.type === 'CLOSE' ? (
                                    <button
                                      onClick={() => {
                                        setClosingPositionId(pos.id);
                                        setClosePnLInput(pos.unrealizedPnL || 0);
                                      }}
                                      className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition cursor-pointer shadow"
                                    >
                                      {sug.suggestedAction.label}
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => handleApplySuggestionToRoll(sug, pos)}
                                      className="px-3.5 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold transition cursor-pointer shadow flex items-center gap-1.5"
                                    >
                                      <RefreshCw className="w-3.5 h-3.5" />
                                      <span>{sug.suggestedAction.label}</span>
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* REQUIREMENT 2: Risk & Margin Panel (Expandable) */}
                    {isRiskExpanded && (
                      <div className="pt-2 animate-fadeIn">
                        <RiskMarginPanel
                          legs={pos.legs}
                          spotPrice={pos.spotPriceAtEntry}
                          ticker={pos.ticker}
                          interestRate={interestRate}
                          iv={iv}
                          title={`Gerenciador de Risco & Margem B3: ${pos.name}`}
                        />
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-800/60">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => onLoadPositionToSimulator(pos)}
                          className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition cursor-pointer flex items-center gap-1.5"
                        >
                          <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Simular no Payoff</span>
                        </button>

                        {isOpen && pos.legs.some((l) => l.side === 'SELL') && (
                          <button
                            onClick={() => handleLoadToRollCalculator(pos)}
                            className="px-3 py-1.5 rounded-lg bg-teal-900/60 hover:bg-teal-800 text-teal-300 border border-teal-700/60 text-xs font-semibold transition cursor-pointer flex items-center gap-1.5"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                            <span>Simular Rolagem</span>
                          </button>
                        )}

                        <button
                          onClick={() => setExpandedRiskPosId(isRiskExpanded ? null : pos.id)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                            isRiskExpanded
                              ? 'bg-emerald-600 text-white shadow'
                              : 'bg-slate-800/80 hover:bg-slate-700 text-emerald-400 border border-emerald-500/30'
                          }`}
                        >
                          <Shield className="w-3.5 h-3.5" />
                          <span>{isRiskExpanded ? 'Ocultar Margem B3' : 'Risco & Margem B3'}</span>
                        </button>
                      </div>

                      <div className="flex items-center gap-2">
                        {isOpen && (
                          <button
                            onClick={() => {
                              setClosingPositionId(pos.id);
                              setClosePnLInput(pos.unrealizedPnL || 0);
                            }}
                            className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition cursor-pointer shadow"
                          >
                            Encerrar Operação
                          </button>
                        )}

                        <button
                          onClick={() => handleDeletePosition(pos.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 transition cursor-pointer"
                          title="Excluir posição"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* VIEW 2: Calculadora Tática de Rolagem B3 (Multi-Pernas) */}
      {activeSubTab === 'rollCalculator' && (
        <div className="space-y-6">
          {/* Header & Context */}
          <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-black text-white flex items-center gap-2">
                  <RefreshCw className="w-5 h-5 text-teal-400" />
                  <span>Calculadora Tática de Rolagem B3 (Multi-Pernas)</span>
                </h2>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-teal-500/10 text-teal-400 border border-teal-500/20 font-mono font-bold">
                  {multiLegs.length} {multiLegs.length === 1 ? 'Perna' : 'Pernas na Estrutura'}
                </span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">
                  {rollTicker} | Spot: R$ {spotPrice.toFixed(2)}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Simula simultaneamente o fechamento (recompra/venda) e abertura (venda/compra na nova série) de <strong>todas as pernas</strong> da operação ({rollStrategyTitle}).
              </p>
            </div>

            <div className="flex items-center gap-2 bg-slate-950 px-3 py-2 rounded-xl border border-slate-800 text-xs">
              <span className="text-slate-400">Diretriz B3:</span>
              <strong className="text-emerald-400 font-semibold">Crédito Líquido Consolidado</strong>
            </div>
          </div>

          {/* Quick Batch Actions Toolbar */}
          <div className="bg-slate-900/60 border border-slate-800/80 p-3.5 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-slate-400 font-semibold mr-1">Ações Rápidas em Lote:</span>
              <button
                onClick={handleAdvanceAllMonths}
                className="px-2.5 py-1.5 rounded-lg bg-teal-950/80 hover:bg-teal-900 text-teal-300 border border-teal-700/60 font-medium transition cursor-pointer flex items-center gap-1"
                title="Avança a letra de vencimento de todas as opções para o próximo mês B3"
              >
                <Calendar className="w-3.5 h-3.5 text-teal-400" />
                <span>+1 Mês (Próxima Série)</span>
              </button>

              <button
                onClick={handleKeepSameStrikes}
                className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-medium transition cursor-pointer"
                title="Restaura os mesmos strikes das pernas atuais para rolagem pura de tempo"
              >
                Manter Mesmos Strikes
              </button>

              <button
                onClick={() => handleShiftAllStrikes(2)}
                className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-medium transition cursor-pointer"
                title="Ajusta todos os strikes em +2%"
              >
                Subir Strikes (+2%)
              </button>

              <button
                onClick={() => handleShiftAllStrikes(-2)}
                className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-medium transition cursor-pointer"
                title="Ajusta todos os strikes em -2%"
              >
                Descer Strikes (-2%)
              </button>

              <span className="text-slate-700 hidden sm:inline">|</span>

              <button
                onClick={handleResetQuantities}
                className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-medium transition cursor-pointer"
                title="Restaura todas as quantidades novas para 1:1 com as pernas atuais"
              >
                Qtds 1:1
              </button>

              <button
                onClick={() => handleScaleNewQuantities(0.8)}
                className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 font-medium transition cursor-pointer"
                title="Reduz as quantidades das novas séries em 20% (desalavancagem)"
              >
                Qtds -20%
              </button>

              <button
                onClick={() => handleScaleNewQuantities(1.2)}
                className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-slate-700 font-medium transition cursor-pointer"
                title="Aumenta as quantidades das novas séries em 20% (alavancagem)"
              >
                Qtds +20%
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleToggleAllLegs(true)}
                className="px-2 py-1 rounded text-slate-400 hover:text-white transition cursor-pointer"
              >
                Marcar Todas
              </button>
              <span className="text-slate-600">|</span>
              <button
                onClick={handleResetToCurrentLegs}
                className="px-2.5 py-1 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-300 transition cursor-pointer flex items-center gap-1"
                title="Recarregar pernas do simulador de payoff"
              >
                <RefreshCw className="w-3 h-3 text-slate-400" />
                <span>Recarregar do Simulador</span>
              </button>
            </div>
          </div>

          {/* Multi-Leg Grid / Cards */}
          <div className="space-y-4">
            {multiLegs.length === 0 ? (
              <div className="p-8 text-center bg-slate-900/60 border border-slate-800 rounded-2xl space-y-3">
                <Layers className="w-8 h-8 text-slate-500 mx-auto" />
                <p className="text-sm text-slate-400">Nenhuma perna carregada para rolagem.</p>
                <button
                  onClick={handleResetToCurrentLegs}
                  className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold transition cursor-pointer"
                >
                  Importar Pernas do Simulador Ativo
                </button>
              </div>
            ) : (
              multiLegs.map((item, idx) => {
                const calc = legCalculations[idx];
                const isSell = item.originalLeg.side === 'SELL';
                const isCall = item.newType === 'CALL';

                return (
                  <div
                    key={item.id}
                    className={`rounded-2xl border p-4 transition ${
                      item.included
                        ? 'bg-slate-900/90 border-slate-800 hover:border-slate-700'
                        : 'bg-slate-950/40 border-slate-900 opacity-60'
                    }`}
                  >
                    {/* Leg Header */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800/70">
                      <div className="flex items-center gap-3">
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={item.included}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setMultiLegs((prev) =>
                                prev.map((l, i) => (i === idx ? { ...l, included: checked } : l))
                              );
                            }}
                            className="w-4 h-4 rounded text-teal-600 bg-slate-950 border-slate-700 focus:ring-0 cursor-pointer"
                          />
                          <span className="text-xs font-bold text-white">
                            Perna {idx + 1}:
                          </span>
                        </label>

                        <span
                          className={`text-xs px-2 py-0.5 rounded font-black ${
                            isSell ? 'bg-rose-500/20 text-rose-300' : 'bg-emerald-500/20 text-emerald-300'
                          }`}
                        >
                          {item.originalLeg.side === 'SELL' ? 'VENDIDA' : 'COMPRADA'}
                        </span>

                        <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-200 font-mono font-bold">
                          {item.originalLeg.type}
                        </span>

                        <span className="text-xs text-slate-300 font-mono">
                          {item.originalLeg.ticker || `${rollTicker} (K=${item.originalLeg.strike.toFixed(2)})`}
                        </span>

                        <div className="flex items-center gap-1.5 text-xs font-mono">
                          <span className="text-slate-400">Fechar: {item.quantity.toLocaleString('pt-BR')} un</span>
                          <ArrowRight className="w-3 h-3 text-teal-500" />
                          <span className={item.newQuantity !== item.quantity ? 'text-amber-300 font-bold' : 'text-slate-300'}>
                            Nova: {item.newQuantity.toLocaleString('pt-BR')} un
                          </span>
                          {item.newQuantity !== item.quantity && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                              {item.newQuantity > item.quantity
                                ? `+${(item.newQuantity - item.quantity).toLocaleString('pt-BR')}`
                                : `${(item.newQuantity - item.quantity).toLocaleString('pt-BR')}`}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Leg Net Result Tag */}
                      {item.included && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-400">Saldo da Perna:</span>
                          <span
                            className={`text-xs font-mono font-black px-2.5 py-1 rounded-lg border ${
                              calc.netFlow >= 0
                                ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60'
                                : 'bg-rose-950/60 text-rose-300 border-rose-800/60'
                            }`}
                          >
                            {calc.netFlow >= 0 ? '+ CRÉDITO: ' : '- DÉBITO: '}
                            R$ {Math.abs(calc.netFlow).toFixed(2)}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Leg Detail Columns (Close vs Open) */}
                    {item.included && (
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 pt-3.5 text-xs">
                        {/* Step A: Close Current Leg (5 cols) */}
                        <div className="md:col-span-5 bg-slate-950/60 p-3 rounded-xl border border-slate-800/80 space-y-2.5">
                          <div className="flex items-center justify-between text-[11px] font-bold text-rose-400">
                            <span className="flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                              1. Fechamento Atual ({calc.actionClose})
                            </span>
                            <span className="font-mono text-slate-400">Série Atual</span>
                          </div>

                          <div className="grid grid-cols-3 gap-2">
                            <div>
                              <label className="text-[10px] text-slate-400 block mb-1">
                                Strike Original:
                              </label>
                              <div className="bg-slate-900 px-2 py-1.5 rounded-lg border border-slate-800 text-white font-mono font-bold text-center">
                                R$ {item.originalLeg.strike.toFixed(2)}
                              </div>
                            </div>

                            <div>
                              <label className="text-[10px] text-slate-400 block mb-1">
                                Qtd a Fechar:
                              </label>
                              <input
                                type="number"
                                step="100"
                                min="1"
                                value={item.quantity}
                                onChange={(e) => {
                                  const val = Math.max(1, parseInt(e.target.value, 10) || 0);
                                  setMultiLegs((prev) =>
                                    prev.map((l, i) => (i === idx ? { ...l, quantity: val } : l))
                                  );
                                }}
                                className="w-full bg-slate-900 text-slate-200 font-mono font-bold px-1.5 py-1.5 rounded-lg border border-slate-700/80 text-center"
                                title="Quantidade de opções a encerrar nesta perna"
                              />
                            </div>

                            <div>
                              <label className="text-[10px] text-slate-400 block mb-1">
                                Preço Fechamento:
                              </label>
                              <input
                                type="number"
                                step="0.05"
                                value={item.closePrice}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value) || 0;
                                  setMultiLegs((prev) =>
                                    prev.map((l, i) => (i === idx ? { ...l, closePrice: val } : l))
                                  );
                                }}
                                className="w-full bg-slate-900 text-rose-300 font-mono font-bold px-1.5 py-1.5 rounded-lg border border-slate-700/80 text-center"
                              />
                            </div>
                          </div>

                          <div className="flex items-center justify-between pt-1 text-[11px] text-slate-400 border-t border-slate-900">
                            <span className="font-mono text-[10px]">
                              {item.quantity.toLocaleString('pt-BR')} un × R$ {item.closePrice.toFixed(2)}
                            </span>
                            <span
                              className={`font-mono font-bold ${
                                calc.closeFlow >= 0 ? 'text-emerald-400' : 'text-rose-400'
                              }`}
                            >
                              {calc.closeFlow >= 0 ? '+' : ''}R$ {calc.closeFlow.toFixed(2)}
                            </span>
                          </div>
                        </div>

                        {/* Transition Indicator (1 col) */}
                        <div className="md:col-span-1 hidden md:flex items-center justify-center">
                          <div className="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center text-teal-400 border border-slate-700">
                            <ArrowRight className="w-3.5 h-3.5" />
                          </div>
                        </div>

                        {/* Step B: Open New Leg (6 cols) */}
                        <div className="md:col-span-6 bg-slate-950/60 p-3 rounded-xl border border-slate-800/80 space-y-2.5">
                          <div className="flex items-center justify-between text-[11px] font-bold text-emerald-400">
                            <span className="flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              2. Nova Série & Rebalanceamento ({calc.actionOpen})
                            </span>
                            <span className="font-mono text-teal-400">
                              Ticker: {item.newTicker || `${rollTicker}${item.newMonthLetter}`}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            <div>
                              <label className="text-[10px] text-slate-400 block mb-1">
                                Série (Mês):
                              </label>
                              <select
                                value={item.newMonthLetter}
                                onChange={(e) => {
                                  const letter = e.target.value;
                                  const strikeStr = Math.round(item.newStrike).toString();
                                  setMultiLegs((prev) =>
                                    prev.map((l, i) =>
                                      i === idx
                                        ? {
                                            ...l,
                                            newMonthLetter: letter,
                                            newTicker: `${rollTicker}${letter}${strikeStr}`,
                                          }
                                        : l
                                    )
                                  );
                                }}
                                className="w-full bg-slate-900 text-emerald-400 font-mono font-bold px-2 py-1.5 rounded-lg border border-slate-700/80 cursor-pointer"
                              >
                                {B3_EXPIRATION_LETTERS.map((b) => (
                                  <option
                                    key={isCall ? b.callLetter : b.putLetter}
                                    value={isCall ? b.callLetter : b.putLetter}
                                  >
                                    {isCall ? b.callLetter : b.putLetter} ({b.monthName})
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div>
                              <label className="text-[10px] text-slate-400 block mb-1">
                                Novo Strike (R$):
                              </label>
                              <input
                                type="number"
                                step="0.25"
                                value={item.newStrike}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value) || 0;
                                  const strikeStr = Math.round(val).toString();
                                  setMultiLegs((prev) =>
                                    prev.map((l, i) =>
                                      i === idx
                                        ? {
                                            ...l,
                                            newStrike: val,
                                            newTicker: `${rollTicker}${item.newMonthLetter}${strikeStr}`,
                                          }
                                        : l
                                    )
                                  );
                                }}
                                className="w-full bg-slate-900 text-white font-mono font-bold px-1.5 py-1.5 rounded-lg border border-slate-700/80 text-center"
                              />
                            </div>

                            <div>
                              <label className="text-[10px] text-slate-400 block mb-1">
                                Prêmio Novo (R$):
                              </label>
                              <input
                                type="number"
                                step="0.05"
                                value={item.newPremium}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value) || 0;
                                  setMultiLegs((prev) =>
                                    prev.map((l, i) => (i === idx ? { ...l, newPremium: val } : l))
                                  );
                                }}
                                className="w-full bg-slate-900 text-emerald-400 font-mono font-bold px-1.5 py-1.5 rounded-lg border border-slate-700/80 text-center"
                              />
                            </div>

                            <div>
                              <label className="text-[10px] text-slate-400 block mb-1">
                                Dias Úteis:
                              </label>
                              <input
                                type="number"
                                step="1"
                                value={item.daysToNewExpiry}
                                onChange={(e) => {
                                  const val = parseInt(e.target.value, 10) || 22;
                                  setMultiLegs((prev) =>
                                    prev.map((l, i) => (i === idx ? { ...l, daysToNewExpiry: val } : l))
                                  );
                                }}
                                className="w-full bg-slate-900 text-slate-300 font-mono px-1.5 py-1.5 rounded-lg border border-slate-700/80 text-center"
                              />
                            </div>
                          </div>

                          {/* Rebalancing: Nova Quantidade no Strike */}
                          <div className="bg-slate-900/90 p-2.5 rounded-xl border border-teal-500/30 space-y-2">
                            <div className="flex flex-wrap items-center justify-between gap-1.5">
                              <span className="text-[10px] font-bold text-teal-300 flex items-center gap-1">
                                <span>⚖️ Quantidade no Novo Strike:</span>
                              </span>

                              {/* Dynamic ratio badge */}
                              {(() => {
                                const diff = item.newQuantity - item.quantity;
                                if (diff === 0) {
                                  return (
                                    <span className="text-[9px] font-mono font-semibold text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                                      1:1 (Mesma Quantidade)
                                    </span>
                                  );
                                } else if (diff < 0) {
                                  const pct = Math.round((Math.abs(diff) / item.quantity) * 100);
                                  return (
                                    <span className="text-[9px] font-mono font-bold text-amber-300 bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded">
                                      ↓ Desalavancagem (-{Math.abs(diff).toLocaleString('pt-BR')} un | -{pct}%)
                                    </span>
                                  );
                                } else {
                                  const pct = Math.round((diff / item.quantity) * 100);
                                  return (
                                    <span className="text-[9px] font-mono font-bold text-emerald-300 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded">
                                      ↑ Aumento / Ratio (+{diff.toLocaleString('pt-BR')} un | +{pct}%)
                                    </span>
                                  );
                                }
                              })()}
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                              <div className="relative w-32 sm:w-36">
                                <input
                                  type="number"
                                  step="100"
                                  min="1"
                                  value={item.newQuantity}
                                  onChange={(e) => {
                                    const val = Math.max(1, parseInt(e.target.value, 10) || 0);
                                    setMultiLegs((prev) =>
                                      prev.map((l, i) => (i === idx ? { ...l, newQuantity: val } : l))
                                    );
                                  }}
                                  className="w-full bg-slate-950 text-emerald-300 font-mono font-black text-sm px-3 py-1.5 rounded-lg border border-teal-500/50 text-center focus:border-teal-400 focus:outline-none"
                                  title="Altere a quantidade de contratos a serem comprados ou vendidos no novo strike"
                                />
                                <span className="absolute right-2 top-2 text-[10px] text-slate-500 pointer-events-none font-mono">
                                  un
                                </span>
                              </div>

                              {/* Quick Step Buttons */}
                              <div className="flex items-center gap-1 flex-wrap">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setMultiLegs((prev) =>
                                      prev.map((l, i) => (i === idx ? { ...l, newQuantity: l.quantity } : l))
                                    );
                                  }}
                                  className={`px-2 py-1 rounded text-[10px] font-mono font-semibold transition cursor-pointer border ${
                                    item.newQuantity === item.quantity
                                      ? 'bg-teal-500/20 text-teal-300 border-teal-500/40'
                                      : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 border-slate-700'
                                  }`}
                                  title="Restaurar mesma quantidade (1:1)"
                                >
                                  1:1
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    const nextVal = Math.max(1, item.newQuantity - 100);
                                    setMultiLegs((prev) =>
                                      prev.map((l, i) => (i === idx ? { ...l, newQuantity: nextVal } : l))
                                    );
                                  }}
                                  className="px-2 py-1 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700 text-[10px] font-mono transition cursor-pointer"
                                  title="Diminuir 100 opções (-1 lote padrão)"
                                >
                                  -100
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    const nextVal = item.newQuantity + 100;
                                    setMultiLegs((prev) =>
                                      prev.map((l, i) => (i === idx ? { ...l, newQuantity: nextVal } : l))
                                    );
                                  }}
                                  className="px-2 py-1 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700 text-[10px] font-mono transition cursor-pointer"
                                  title="Aumentar 100 opções (+1 lote padrão)"
                                >
                                  +100
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    const nextVal = Math.max(1, Math.round((item.quantity * 0.5) / 100) * 100 || 50);
                                    setMultiLegs((prev) =>
                                      prev.map((l, i) => (i === idx ? { ...l, newQuantity: nextVal } : l))
                                    );
                                  }}
                                  className="px-2 py-1 rounded bg-slate-800/80 hover:bg-slate-700 text-amber-300 border border-slate-700 text-[10px] font-mono transition cursor-pointer"
                                  title="Reduzir em 50% (desmonte parcial)"
                                >
                                  -50%
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    const nextVal = item.quantity * 2;
                                    setMultiLegs((prev) =>
                                      prev.map((l, i) => (i === idx ? { ...l, newQuantity: nextVal } : l))
                                    );
                                  }}
                                  className="px-2 py-1 rounded bg-slate-800/80 hover:bg-slate-700 text-emerald-300 border border-slate-700 text-[10px] font-mono transition cursor-pointer"
                                  title="Dobrar quantidade (2x / Ratio)"
                                >
                                  2x
                                </button>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center justify-between pt-1 text-[11px] text-slate-400 border-t border-slate-900">
                            <span className="font-mono text-[10px]">
                              {item.newQuantity.toLocaleString('pt-BR')} un × R$ {item.newPremium.toFixed(2)}
                            </span>
                            <span
                              className={`font-mono font-bold ${
                                calc.openFlow >= 0 ? 'text-emerald-400' : 'text-rose-400'
                              }`}
                            >
                              {calc.openFlow >= 0 ? '+' : ''}R$ {calc.openFlow.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Consolidated Financial Balance & Action Suite */}
          <div className="rounded-2xl bg-slate-900/95 border border-slate-800 p-5 md:p-6 space-y-5">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-black text-white flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-teal-400" />
                  <span>Balanço Financeiro Consolidado da Estrutura Rolada</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Resultado líquido somando simultaneamente todas as {totalIncludedLegs} pernas ativas selecionadas.
                </p>
              </div>

              <div className="flex items-center gap-2">
                {multiLegs.some((l) => l.included && l.newQuantity !== l.quantity) && (
                  <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1">
                    <span>⚖️ Rebalanceamento Ativo</span>
                  </span>
                )}
                <span className={`text-xs font-black px-3 py-1 rounded-lg border ${feasibilityBadge.bg}`}>
                  {feasibilityBadge.label}
                </span>
              </div>
            </div>

            {/* Financial Summary Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              {/* Box 1: Total Fechamento */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <span className="text-slate-400 block font-medium">1. Fechamento das Pernas Atuais:</span>
                <div
                  className={`text-lg font-bold font-mono ${
                    totalCloseFlow >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {totalCloseFlow >= 0 ? '+ Entrada: ' : '- Saída: '}
                  R$ {Math.abs(totalCloseFlow).toFixed(2)}
                </div>
                <span className="text-[11px] text-slate-400">Recompras e Liquidações</span>
              </div>

              {/* Box 2: Total Abertura */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <span className="text-slate-400 block font-medium">2. Abertura das Novas Séries:</span>
                <div
                  className={`text-lg font-bold font-mono ${
                    totalOpenFlow >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {totalOpenFlow >= 0 ? '+ Entrada: ' : '- Saída: '}
                  R$ {Math.abs(totalOpenFlow).toFixed(2)}
                </div>
                <span className="text-[11px] text-slate-400">Vendas e Compras nova série</span>
              </div>

              {/* Box 3: Saldo Líquido Consolidado (Grande Destaque) */}
              <div className="p-4 rounded-xl bg-slate-950 border border-teal-500/40 space-y-1 shadow-lg shadow-teal-950/20">
                <span className="text-slate-300 block font-bold">Saldo Financeiro Líquido:</span>
                <div
                  className={`text-xl font-black font-mono ${
                    consolidatedNetCashFlow >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {consolidatedNetCashFlow >= 0 ? '+ CRÉDITO: ' : '- DÉBITO: '}
                  R$ {Math.abs(consolidatedNetCashFlow).toFixed(2)}
                </div>
                <span className="text-[11px] text-slate-400 font-mono block">
                  ({netPerShare >= 0 ? '+' : ''}R$ {netPerShare.toFixed(2)} / unidade)
                </span>
              </div>
            </div>

            {/* Practical Advice Note */}
            <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-300 flex items-start gap-2.5">
              <Lightbulb className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-slate-200 block mb-0.5">Diagnóstico Tático B3:</strong>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  {feasibilityBadge.desc}
                </p>
              </div>
            </div>

            {/* Action Buttons to Apply or Save */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-800">
              <div className="flex items-center gap-2">
                <button
                  onClick={handleResetToCurrentLegs}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition cursor-pointer flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
                  <span>Descartar Alterações</span>
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={handleApplyToSimulator}
                  className="px-4 py-2.5 rounded-xl bg-teal-900/60 hover:bg-teal-800 text-teal-300 border border-teal-600/60 text-xs font-bold transition cursor-pointer flex items-center gap-2 shadow"
                >
                  <TrendingUp className="w-4 h-4 text-teal-400" />
                  <span>Carregar Estrutura no Simulador de Payoff</span>
                </button>

                <button
                  onClick={handleSaveRolledPosition}
                  className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black transition cursor-pointer flex items-center gap-2 shadow-lg shadow-emerald-950/30"
                >
                  <CheckCircle2 className="w-4 h-4 text-white" />
                  <span>Salvar Nova Operação no Portfólio</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Close Position Modal */}
      {closingPositionId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 max-w-md w-full space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-teal-400" />
              <span>Registrar Encerramento de Posição</span>
            </h3>
            <p className="text-xs text-slate-400">
              Informe o resultado financeiro líquido apurado na liquidação ou recompra da operação para atualizar o histórico.
            </p>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Resultado Líquido Final (R$):
              </label>
              <input
                type="number"
                step="10"
                value={closePnLInput}
                onChange={(e) => setClosePnLInput(parseFloat(e.target.value) || 0)}
                placeholder="Ex: 450.00 ou -120.00"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-emerald-400 font-mono font-bold focus:outline-none focus:border-teal-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setClosingPositionId(null)}
                className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-400 hover:bg-slate-800 transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmClose}
                className="px-4 py-1.5 rounded-xl text-xs font-bold bg-teal-600 hover:bg-teal-500 text-white transition shadow cursor-pointer"
              >
                Confirmar Fechamento
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
