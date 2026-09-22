import React, { useState, useEffect, useRef } from 'react';
import { OptionLeg, StrategyTemplate } from '../types';
import { PayoffChart } from './PayoffChart';
import { calculatePortfolioGreeks, estimateB3Margin } from '../utils/blackScholes';
import { STRATEGIES_CATALOG } from '../data/strategiesCatalog';
import { fetchOptionDetails, searchInstruments, fetchQuotes, OpLabSearchItem } from '../utils/oplabApi';
import { RiskMarginPanel } from './RiskMarginPanel';
import {
  Plus,
  Trash2,
  ShieldAlert,
  Sparkles,
  Bookmark,
  ArrowRight,
  Info,
  AlertTriangle,
  Search,
  CheckCircle2,
  Target,
  Shield,
  Clock,
  Zap,
  RefreshCw,
} from 'lucide-react';

interface StrategySimulatorProps {
  legs: OptionLeg[];
  setLegs: React.Dispatch<React.SetStateAction<OptionLeg[]>>;
  spotPrice: number;
  ticker: string;
  iv: number;
  interestRate: number;
  onSavePosition: (positionName: string, notes?: string, targetProfit?: number, stopLoss?: number) => void;
  onNavigateToScenarios: () => void;
  onNavigateToRoll: () => void;
}

export const StrategySimulator: React.FC<StrategySimulatorProps> = ({
  legs,
  setLegs,
  spotPrice,
  ticker,
  iv,
  interestRate,
  onSavePosition,
  onNavigateToScenarios,
  onNavigateToRoll,
}) => {
  const [strategyName, setStrategyName] = useState('Estratégia Personalizada');
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [positionLabel, setPositionLabel] = useState('');
  const [positionNotes, setPositionNotes] = useState('');
  const [targetProfitInput, setTargetProfitInput] = useState<number>(0);
  const [stopLossInput, setStopLossInput] = useState<number>(0);

  // Quick Option Search state
  const [quickSymbol, setQuickSymbol] = useState('');
  const [quickSide, setQuickSide] = useState<'BUY' | 'SELL'>('BUY');
  const [quickQty, setQuickQty] = useState<number>(100);
  const [isSearching, setIsSearching] = useState(false);
  const [searchSuggestions, setSearchSuggestions] = useState<OpLabSearchItem[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loadingLegId, setLoadingLegId] = useState<string | null>(null);
  const [quickSearchFeedback, setQuickSearchFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Greeks and margin calculations
  const greeks = calculatePortfolioGreeks(legs, spotPrice, iv, interestRate);
  const marginEst = estimateB3Margin(legs, spotPrice);

  // Debounced search suggestions
  useEffect(() => {
    if (quickSymbol.trim().length < 2) {
      setSearchSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await searchInstruments(quickSymbol);
        if (res.success && res.data) {
          setSearchSuggestions(res.data);
        }
      } catch (err) {
        console.error('Error searching instruments:', err);
      }
    }, 280);

    return () => clearTimeout(timer);
  }, [quickSymbol]);

  // Click outside to close suggestions
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Lookup and add option via OpLab API (Instant Optimistic Addition + Background Live Refine)
  const handleLookupAndAddOption = async (symbolToLookup?: string) => {
    const symbol = (symbolToLookup || quickSymbol).trim().toUpperCase();
    if (!symbol) return;

    setShowSuggestions(false);
    setQuickSymbol('');

    // Instant local estimation so UI updates with 0ms lag
    const isStockCode = /^[A-Z]{4}\d{1,2}$/.test(symbol);
    const letter = symbol.length >= 5 ? symbol[4] : '';
    const isCall = !isStockCode && letter >= 'A' && letter <= 'L';
    const guessedType: 'CALL' | 'PUT' | 'STOCK' = isStockCode ? 'STOCK' : isCall ? 'CALL' : 'PUT';
    
    // Quick strike guess from trailing digits
    const digits = symbol.slice(5);
    let guessedStrike = spotPrice;
    if (digits && !isNaN(Number(digits))) {
      const dNum = Number(digits);
      guessedStrike = dNum > 100 && spotPrice < 50 ? dNum / 10 : dNum;
    }

    const tempLegId = `leg-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
    const optimisticLeg: OptionLeg = {
      id: tempLegId,
      type: guessedType,
      side: quickSide,
      strike: isStockCode ? spotPrice : guessedStrike,
      premium: isStockCode ? spotPrice : Math.round(spotPrice * 0.025 * 100) / 100,
      quantity: quickQty,
      daysToExpiry: isStockCode ? 0 : 22,
      ticker: symbol,
      exerciseStyle: guessedType === 'CALL' ? 'AMERICAN' : 'EUROPEAN',
    };

    // Add immediately to legs!
    setLegs((prev) => [...prev, optimisticLeg]);
    setQuickSearchFeedback({
      type: 'success',
      message: `${symbol} adicionado instantaneamente. Sincronizando cotação de mercado...`,
    });

    setIsSearching(true);
    try {
      const result = await fetchOptionDetails(symbol);
      const data = result.data;

      const premium = quickSide === 'BUY'
        ? (data.ask > 0 ? data.ask : data.close || optimisticLeg.premium)
        : (data.bid > 0 ? data.bid : data.close || optimisticLeg.premium);

      const isStock = data.category === 'STOCK';

      setLegs((prev) =>
        prev.map((l) =>
          l.id === tempLegId
            ? {
                ...l,
                type: isStock ? 'STOCK' : data.category,
                strike: data.strike || l.strike,
                premium: Math.round(premium * 100) / 100,
                daysToExpiry: data.daysToMaturity,
                ticker: data.symbol,
                exerciseStyle: data.maturityType || (data.category === 'CALL' ? 'AMERICAN' : 'EUROPEAN'),
              }
            : l
        )
      );

      setQuickSearchFeedback({
        type: 'success',
        message: `${data.symbol}: ${data.category} K=R$ ${(data.strike || guessedStrike).toFixed(2)} (Prêmio: R$ ${premium.toFixed(2)}) atualizado com cotação da B3.`,
      });

      setTimeout(() => setQuickSearchFeedback(null), 4000);
    } catch (err: any) {
      // If network fails, optimistic leg is already in place
      console.warn('Busca de detalhes em background:', err);
    } finally {
      setIsSearching(false);
    }
  };

  // Lookup data for an existing leg when user types its ticker
  const handleLookupLegTicker = async (legId: string, tickerCode: string, currentSide: 'BUY' | 'SELL') => {
    const clean = tickerCode.trim().toUpperCase();
    if (!clean) return;

    setLoadingLegId(legId);
    try {
      const result = await fetchOptionDetails(clean);
      const data = result.data;
      const isStock = data.category === 'STOCK';
      const premium = currentSide === 'BUY'
        ? (data.ask > 0 ? data.ask : data.close || 0.5)
        : (data.bid > 0 ? data.bid : data.close || 0.5);

      setLegs((prev) =>
        prev.map((l) =>
          l.id === legId
            ? {
                ...l,
                ticker: data.symbol,
                strike: data.strike || l.strike,
                premium: Math.round(premium * 100) / 100,
                type: isStock ? 'STOCK' : data.category,
                exerciseStyle: data.maturityType || (data.category === 'CALL' ? 'AMERICAN' : 'EUROPEAN'),
                daysToExpiry: data.daysToMaturity,
              }
            : l
        )
      );

      setQuickSearchFeedback({
        type: 'success',
        message: `Perna atualizada via B3: Strike R$ ${data.strike.toFixed(2)}, Prêmio R$ ${premium.toFixed(2)}.`,
      });
      setTimeout(() => setQuickSearchFeedback(null), 4000);
    } catch (err: any) {
      setQuickSearchFeedback({
        type: 'error',
        message: `Falha ao buscar ticker ${clean}: ${err?.message}`,
      });
      setTimeout(() => setQuickSearchFeedback(null), 4000);
    } finally {
      setLoadingLegId(null);
    }
  };

  // Add new leg manually
  const handleAddLeg = (type: 'CALL' | 'PUT' | 'STOCK', side: 'BUY' | 'SELL') => {
    const isStock = type === 'STOCK';
    const strike = isStock ? spotPrice : Math.round(spotPrice * (type === 'CALL' ? 1.04 : 0.96) * 2) / 2;
    const premium = isStock ? spotPrice : Math.round(spotPrice * 0.025 * 100) / 100;

    const newLeg: OptionLeg = {
      id: `leg-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      type,
      side,
      strike,
      premium,
      quantity: 100,
      daysToExpiry: isStock ? 0 : 22,
      ticker: isStock ? ticker : `${ticker}${type === 'CALL' ? 'J' : 'V'}${Math.round(strike)}`,
      exerciseStyle: type === 'CALL' ? 'AMERICAN' : 'EUROPEAN',
    };

    setLegs([...legs, newLeg]);
  };

  const handleUpdateLeg = (id: string, updates: Partial<OptionLeg>) => {
    setLegs(legs.map((l) => (l.id === id ? { ...l, ...updates } : l)));
  };

  const handleRemoveLeg = (id: string) => {
    setLegs(legs.filter((l) => l.id !== id));
  };

  const handleApplyPreset = (template: StrategyTemplate) => {
    const generated = template.createDefaultLegs(spotPrice, ticker);
    setLegs(generated);
    setStrategyName(template.namePt);
  };

  const handleOpenSaveModal = () => {
    setPositionLabel(`${strategyName} em ${ticker}`);
    setPositionNotes('Montagem simulada com acompanhamento de desempenho ao longo do tempo.');
    // Estimate default target profit (50% do crédito ou 100% do débito)
    let netCash = 0;
    legs.forEach((l) => {
      const sign = l.side === 'SELL' ? 1 : -1;
      netCash += sign * l.premium * l.quantity;
    });
    setTargetProfitInput(netCash > 0 ? Math.round(netCash * 0.7) : Math.round(Math.abs(netCash) * 1.5));
    setStopLossInput(netCash > 0 ? -Math.round(netCash * 1.5) : -Math.round(Math.abs(netCash) * 0.5));
    setSaveModalOpen(true);
  };

  const handleConfirmSave = () => {
    if (!positionLabel.trim()) return;
    onSavePosition(positionLabel, positionNotes, targetProfitInput, stopLossInput);
    setPositionLabel('');
    setPositionNotes('');
    setSaveModalOpen(false);
  };

  // OpLab live quotes sync for all active legs in the simulator
  const [isSyncingLegs, setIsSyncingLegs] = useState(false);
  const [syncLegsMessage, setSyncLegsMessage] = useState<string | null>(null);

  const handleSyncAllLegsWithOpLab = async () => {
    setIsSyncingLegs(true);
    setSyncLegsMessage(null);
    try {
      const tickersToFetch = legs
        .map((l) => (l.type === 'STOCK' ? ticker : l.ticker))
        .filter((t): t is string => Boolean(t && t.trim()));

      if (tickersToFetch.length === 0) {
        setSyncLegsMessage('Nenhum código de ativo/opção configurado para consulta.');
        setIsSyncingLegs(false);
        return;
      }

      const res = await fetchQuotes(tickersToFetch);
      if (res.success && res.data && res.data.length > 0) {
        const quoteMap = new Map<string, any>();
        res.data.forEach((q) => {
          quoteMap.set(q.symbol.toUpperCase(), q);
        });

        let updatedCount = 0;
        setLegs((prev) =>
          prev.map((leg) => {
            const sym = (leg.type === 'STOCK' ? ticker : leg.ticker || '').toUpperCase();
            const quote = quoteMap.get(sym);
            if (quote) {
              const livePrice = quote.close || quote.bid || quote.ask || leg.premium;
              updatedCount++;
              return {
                ...leg,
                premium: livePrice,
                currentPrice: livePrice,
                strike: quote.strike && quote.strike > 0 ? quote.strike : leg.strike,
              };
            }
            return leg;
          })
        );
        setSyncLegsMessage(`${updatedCount} perna(s) atualizada(s) com cotações em tempo real da B3!`);
        setTimeout(() => setSyncLegsMessage(null), 4000);
      } else {
        setSyncLegsMessage('Não foram encontradas cotações recentes para estes códigos.');
      }
    } catch (err: any) {
      setSyncLegsMessage('Erro ao atualizar cotações de mercado.');
    } finally {
      setIsSyncingLegs(false);
    }
  };

  // Check if option strikes severely deviate from the current spot price
  const hasSevereStrikeDeviation = legs.some(
    (l) => l.type !== 'STOCK' && (l.strike < spotPrice * 0.45 || l.strike > spotPrice * 2.2)
  );

  const handleRealignStrikesToSpot = () => {
    setLegs((prev) =>
      prev.map((leg, idx) => {
        if (leg.type === 'STOCK') {
          return { ...leg, strike: spotPrice, premium: spotPrice, ticker };
        }
        const offsetPercent = leg.type === 'CALL' ? (idx === 0 ? 0.03 : 0.06) : -0.03;
        const newStrike = Math.round(spotPrice * (1 + offsetPercent) * 10) / 10;
        return {
          ...leg,
          strike: newStrike,
          ticker: `${ticker}${leg.type === 'CALL' ? 'J' : 'V'}${Math.round(newStrike)}`,
        };
      })
    );
  };

  return (
    <div id="strategy-simulator" className="space-y-6 pb-12">
      {/* Top Header & Strategy Presets */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 bg-slate-900/80 border border-slate-800 p-4 rounded-2xl">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-black text-white">{strategyName}</h2>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-emerald-400 font-mono border border-slate-700">
              {legs.length} {legs.length === 1 ? 'perna' : 'pernas'}
            </span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-mono border border-emerald-500/20">
              {ticker} @ R$ {spotPrice.toFixed(2)}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Simulador de Payoff com Black-Scholes para dias úteis (DU 252) e estimativa de margem B3.
          </p>
        </div>

        {/* Quick Presets Dropdown & Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-slate-400 font-medium hidden sm:inline">Modelos Rápidos:</span>
          <div className="flex items-center gap-1.5 flex-wrap">
            {STRATEGIES_CATALOG.slice(0, 4).map((strat) => (
              <button
                key={strat.id}
                onClick={() => handleApplyPreset(strat)}
                className="text-xs px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/60 font-medium transition cursor-pointer"
              >
                {strat.namePt.split('(')[0].trim()}
              </button>
            ))}
          </div>

          {/* Sync All Legs with Real-time Quotes Button */}
          <button
            id="simulator-sync-legs-btn"
            onClick={handleSyncAllLegsWithOpLab}
            disabled={isSyncingLegs}
            title="Atualizar cotações e prêmios de todas as opções desta estratégia em tempo real"
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-emerald-500/30 font-semibold transition shadow cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncingLegs ? 'animate-spin' : ''}`} />
            <span>{isSyncingLegs ? 'Sincronizando...' : 'Atualizar Cotações'}</span>
          </button>

          <button
            id="simulator-save-position-btn"
            onClick={handleOpenSaveModal}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition shadow cursor-pointer ml-auto"
          >
            <Bookmark className="w-3.5 h-3.5" />
            <span>Salvar Estratégia</span>
          </button>
        </div>
      </div>

      {/* Sync Legs Status Message */}
      {syncLegsMessage && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
          <span>{syncLegsMessage}</span>
        </div>
      )}

      {/* Severe Strike Deviation Alert Banner */}
      {hasSevereStrikeDeviation && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              Atenção: Os strikes configurados (
              {legs
                .filter((l) => l.type !== 'STOCK')
                .map((l) => `R$ ${l.strike.toFixed(2)}`)
                .join(', ')}
              ) divergem fortemente da cotação spot de {ticker} (R$ {spotPrice.toFixed(2)}).
            </span>
          </div>
          <button
            onClick={handleRealignStrikesToSpot}
            className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg transition shrink-0 cursor-pointer text-xs"
          >
            Ajustar Strikes para Spot Atual
          </button>
        </div>
      )}

      {/* Main Grid: Payoff Chart + Greeks / Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Interactive Payoff SVG Chart (7 cols) */}
        <div className="lg:col-span-8 space-y-4">
          <PayoffChart
            legs={legs}
            spotPrice={spotPrice}
            iv={iv}
            interestRate={interestRate}
            ticker={ticker}
          />

          {/* Quick Action Navigation Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              id="simulator-goto-scenarios-btn"
              onClick={onNavigateToScenarios}
              className="flex items-center justify-between p-3.5 rounded-xl bg-gradient-to-r from-purple-950/60 to-slate-900 border border-purple-800/40 hover:border-purple-600 transition text-left cursor-pointer group"
            >
              <div>
                <div className="flex items-center gap-1.5 text-xs font-bold text-purple-300">
                  <Sparkles className="w-4 h-4 text-purple-400" />
                  <span>Análise de Estresse & Cenários AI</span>
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  Simular choques de mercado brasileiro e decisão do Copom.
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-purple-400 group-hover:translate-x-1 transition" />
            </button>

            <button
              id="simulator-goto-roll-btn"
              onClick={onNavigateToRoll}
              className="flex items-center justify-between p-3.5 rounded-xl bg-gradient-to-r from-teal-950/60 to-slate-900 border border-teal-800/40 hover:border-teal-600 transition text-left cursor-pointer group"
            >
              <div>
                <div className="flex items-center gap-1.5 text-xs font-bold text-teal-300">
                  <ShieldAlert className="w-4 h-4 text-teal-400" />
                  <span>Calculadora de Rolagem B3</span>
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  Estimar crédito da rolagem para a próxima série mensal.
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-teal-400 group-hover:translate-x-1 transition" />
            </button>
          </div>
        </div>

        {/* Right Column: Greeks & Margem B3 Cards (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          {/* Key Financial Cashflow */}
          <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center justify-between">
              <span>Fluxo Financeiro Inicial</span>
              <span className="text-[10px] text-slate-400 font-mono font-normal">D+1 Corretora</span>
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80">
                <span className="text-[11px] text-slate-400 block">Saldo Líquido</span>
                <span
                  className={`text-base font-black font-mono mt-0.5 block ${
                    greeks.netDebitCredit >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {greeks.netDebitCredit >= 0 ? '+R$ ' : '-R$ '}
                  {Math.abs(greeks.netDebitCredit).toFixed(2)}
                </span>
                <span className="text-[10px] text-slate-400">
                  {greeks.netDebitCredit >= 0 ? 'Crédito recebido na conta' : 'Débito desembolsado'}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80">
                <span className="text-[11px] text-slate-400 block">Pernas Ativas</span>
                <span className="text-base font-black font-mono text-white mt-0.5 block">
                  {legs.length}
                </span>
                <span className="text-[10px] text-slate-400">
                  Lote padrão B3: 100 un.
                </span>
              </div>
            </div>
          </div>

          {/* Portfolio Greeks Card */}
          <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Gregas da Posição
              </h3>
              <span className="text-[10px] text-slate-400 font-mono">B3 DU 252</span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                <div className="flex justify-between items-center text-slate-400">
                  <span>Delta (Δ)</span>
                  <span className="text-[10px] text-slate-400">Direcional</span>
                </div>
                <div
                  className={`text-sm font-bold font-mono mt-1 ${
                    greeks.delta > 0.1 ? 'text-emerald-400' : greeks.delta < -0.1 ? 'text-rose-400' : 'text-slate-300'
                  }`}
                >
                  {greeks.delta >= 0 ? '+' : ''}
                  {greeks.delta.toFixed(2)}
                </div>
                <span className="text-[10px] text-slate-400 block">
                  {greeks.delta > 20 ? 'Altista' : greeks.delta < -20 ? 'Baixista' : 'Neutro'}
                </span>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                <div className="flex justify-between items-center text-slate-400">
                  <span>Gamma (Γ)</span>
                  <span className="text-[10px] text-slate-400">Aceleração</span>
                </div>
                <div className="text-sm font-bold font-mono text-slate-200 mt-1">
                  {greeks.gamma.toFixed(4)}
                </div>
                <span className="text-[10px] text-slate-400 block">Variação do Delta</span>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                <div className="flex justify-between items-center text-slate-400">
                  <span>Theta (Θ)</span>
                  <span className="text-[10px] text-emerald-400">R$/Dia Útil</span>
                </div>
                <div
                  className={`text-sm font-bold font-mono mt-1 ${
                    greeks.theta >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {greeks.theta >= 0 ? '+' : ''}R$ {greeks.theta.toFixed(2)}
                </div>
                <span className="text-[10px] text-slate-400 block">Erosão de tempo/dia</span>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                <div className="flex justify-between items-center text-slate-400">
                  <span>Vega (ν)</span>
                  <span className="text-[10px] text-slate-400">R$/1% IV</span>
                </div>
                <div
                  className={`text-sm font-bold font-mono mt-1 ${
                    greeks.vega >= 0 ? 'text-sky-400' : 'text-amber-400'
                  }`}
                >
                  {greeks.vega >= 0 ? '+' : ''}R$ {greeks.vega.toFixed(2)}
                </div>
                <span className="text-[10px] text-slate-400 block">Sensibilidade à vol</span>
              </div>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-xs flex items-center justify-between">
              <div>
                <span className="text-slate-400 font-medium">Rho (ρ) - Selic B3:</span>
                <span className="text-[10px] text-slate-400 block">Impacto de +1% na taxa básica</span>
              </div>
              <span className="font-mono font-bold text-slate-300">
                {greeks.rho >= 0 ? '+' : ''}R$ {greeks.rho.toFixed(2)}
              </span>
            </div>
          </div>

          {/* B3 Margin Requirement Card */}
          <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                <span>Margem Estimada B3 (CORE)</span>
              </h3>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                  marginEst.riskScore === 'BAIXO'
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : marginEst.riskScore === 'MODERADO'
                    ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                    : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                }`}
              >
                Risco {marginEst.riskScore}
              </span>
            </div>

            <div className="flex items-baseline justify-between">
              <span className="text-xs text-slate-400">Exigência de Garantia:</span>
              <span className="text-base font-black font-mono text-amber-400">
                {marginEst.estimatedInitialMargin === 0
                  ? 'Isenta (Coberta)'
                  : `~ R$ ${marginEst.estimatedInitialMargin.toLocaleString('pt-BR')}`}
              </span>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed bg-slate-950 p-2.5 rounded-xl border border-slate-800/80">
              {marginEst.description}
            </p>

            {marginEst.collateralRecommendations.length > 0 && (
              <div className="space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Garantias Recomendadas B3:
                </span>
                {marginEst.collateralRecommendations.map((rec, i) => (
                  <div key={i} className="text-[11px] text-slate-400 flex items-start gap-1.5">
                    <span className="text-emerald-400 font-bold">•</span>
                    <span>{rec}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Legs Table Section */}
      <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-5 space-y-4">
        {/* OpLab API Live Quick Search & Auto-fill Bar */}
        <div className="bg-slate-950/80 border border-emerald-500/30 rounded-xl p-3.5 space-y-2.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                <Search className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs font-bold text-white">
                Buscar Opção na B3
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                <Zap className="w-2.5 h-2.5" />
                Auto-Preenchimento Inteligente
              </span>
            </div>
            <span className="text-[11px] text-slate-400">
              Digite o código para carregar automaticamente Strike, Prêmio, Vencimento e Estilo
            </span>
          </div>

          <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2.5" ref={searchContainerRef}>
            {/* Symbol Input with Autocomplete */}
            <div className="relative flex-1">
              <input
                type="text"
                value={quickSymbol}
                onChange={(e) => {
                  setQuickSymbol(e.target.value.toUpperCase());
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleLookupAndAddOption();
                  }
                }}
                placeholder="Ex: PETRJ390, VALEV600, BOVAK130, ITUBJ360..."
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono font-bold text-emerald-400 placeholder:text-slate-400 focus:outline-none focus:border-emerald-400 transition"
              />

              {/* Suggestions Dropdown */}
              {showSuggestions && searchSuggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 z-30 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden max-h-56 overflow-y-auto divide-y divide-slate-800">
                  {searchSuggestions.map((item, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setQuickSymbol(item.symbol);
                        handleLookupAndAddOption(item.symbol);
                      }}
                      className="w-full px-3 py-2 text-left text-xs hover:bg-slate-800/80 flex items-center justify-between transition cursor-pointer"
                    >
                      <div>
                        <span className="font-bold font-mono text-emerald-400">{item.symbol}</span>
                        <span className="text-[11px] text-slate-400 ml-2">
                          {item.description || item.full_name}
                        </span>
                      </div>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                        {item.type}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Side Selection */}
            <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-700 shrink-0">
              <button
                type="button"
                onClick={() => setQuickSide('BUY')}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition cursor-pointer ${
                  quickSide === 'BUY'
                    ? 'bg-emerald-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                COMPRA
              </button>
              <button
                type="button"
                onClick={() => setQuickSide('SELL')}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition cursor-pointer ${
                  quickSide === 'SELL'
                    ? 'bg-rose-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                VENDA
              </button>
            </div>

            {/* Quantity */}
            <div className="flex items-center gap-1.5 bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-700 shrink-0">
              <span className="text-[11px] text-slate-400 font-medium">Qtd:</span>
              <input
                type="number"
                step="100"
                min="1"
                value={quickQty}
                onChange={(e) => setQuickQty(parseInt(e.target.value, 10) || 100)}
                className="w-16 bg-transparent text-white font-mono font-bold text-xs text-center focus:outline-none"
              />
            </div>

            {/* Action Button */}
            <button
              type="button"
              onClick={() => handleLookupAndAddOption()}
              disabled={isSearching || !quickSymbol.trim()}
              className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs shadow-lg shadow-emerald-600/20 transition cursor-pointer shrink-0"
            >
              {isSearching ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Buscando...</span>
                </>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5" />
                  <span>Buscar & Adicionar</span>
                </>
              )}
            </button>
          </div>

          {/* Feedback banner */}
          {quickSearchFeedback && (
            <div
              className={`text-xs px-3 py-2 rounded-lg flex items-center gap-2 ${
                quickSearchFeedback.type === 'success'
                  ? 'bg-emerald-950/70 text-emerald-300 border border-emerald-800/60'
                  : 'bg-rose-950/70 text-rose-300 border border-rose-800/60'
              }`}
            >
              {quickSearchFeedback.type === 'success' ? (
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              ) : (
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              )}
              <span>{quickSearchFeedback.message}</span>
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <span>Pernas Ativas no Simulador</span>
              <span className="text-xs text-slate-400 font-normal">
                (Edite o ticker e pressione Enter ou clique na lupa para puxar dados atualizados)
              </span>
            </h3>
          </div>

          {/* Quick Add Buttons */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => handleAddLeg('CALL', 'BUY')}
              className="text-xs px-2.5 py-1 rounded-lg bg-emerald-950/80 text-emerald-300 border border-emerald-800/60 hover:bg-emerald-900 transition flex items-center gap-1 cursor-pointer font-medium"
            >
              <Plus className="w-3 h-3" /> + Call Compra
            </button>
            <button
              onClick={() => handleAddLeg('CALL', 'SELL')}
              className="text-xs px-2.5 py-1 rounded-lg bg-rose-950/80 text-rose-300 border border-rose-800/60 hover:bg-rose-900 transition flex items-center gap-1 cursor-pointer font-medium"
            >
              <Plus className="w-3 h-3" /> + Call Venda
            </button>
            <button
              onClick={() => handleAddLeg('PUT', 'BUY')}
              className="text-xs px-2.5 py-1 rounded-lg bg-emerald-950/80 text-emerald-300 border border-emerald-800/60 hover:bg-emerald-900 transition flex items-center gap-1 cursor-pointer font-medium"
            >
              <Plus className="w-3 h-3" /> + Put Compra
            </button>
            <button
              onClick={() => handleAddLeg('PUT', 'SELL')}
              className="text-xs px-2.5 py-1 rounded-lg bg-rose-950/80 text-rose-300 border border-rose-800/60 hover:bg-rose-900 transition flex items-center gap-1 cursor-pointer font-medium"
            >
              <Plus className="w-3 h-3" /> + Put Venda
            </button>
            <button
              onClick={() => handleAddLeg('STOCK', 'BUY')}
              className="text-xs px-2.5 py-1 rounded-lg bg-blue-950/80 text-blue-300 border border-blue-800/60 hover:bg-blue-900 transition flex items-center gap-1 cursor-pointer font-medium"
            >
              <Plus className="w-3 h-3" /> + Ação (Spot)
            </button>
          </div>
        </div>

        {/* Legs List */}
        {legs.length === 0 ? (
          <div className="py-8 text-center text-slate-400 text-xs">
            Nenhuma perna cadastrada. Digite o código da opção na busca acima ou selecione um modelo do catálogo.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 text-[11px] uppercase tracking-wider font-semibold">
                  <th className="py-2.5 px-3">Sentido</th>
                  <th className="py-2.5 px-3">Tipo</th>
                  <th className="py-2.5 px-3">Ticker / Código B3</th>
                  <th className="py-2.5 px-3">Strike (R$)</th>
                  <th className="py-2.5 px-3">Prêmio (R$)</th>
                  <th className="py-2.5 px-3">Quantidade</th>
                  <th className="py-2.5 px-3">Venc. (Dias Úteis)</th>
                  <th className="py-2.5 px-3">Estilo B3</th>
                  <th className="py-2.5 px-3 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {legs.map((leg) => {
                  const isStock = leg.type === 'STOCK';
                  return (
                    <tr key={leg.id} className="hover:bg-slate-800/30 transition">
                      {/* Side BUY / SELL */}
                      <td className="py-2.5 px-3">
                        <select
                          value={leg.side}
                          onChange={(e) => handleUpdateLeg(leg.id, { side: e.target.value as 'BUY' | 'SELL' })}
                          className={`font-bold font-mono px-2 py-1 rounded border text-xs cursor-pointer ${
                            leg.side === 'BUY'
                              ? 'bg-emerald-950/90 text-emerald-400 border-emerald-700/60'
                              : 'bg-rose-950/90 text-rose-400 border-rose-700/60'
                          }`}
                        >
                          <option value="BUY">COMPRA</option>
                          <option value="SELL">VENDA</option>
                        </select>
                      </td>

                      {/* Type CALL / PUT / STOCK */}
                      <td className="py-2.5 px-3">
                        <select
                          value={leg.type}
                          onChange={(e) => handleUpdateLeg(leg.id, { type: e.target.value as any })}
                          className="bg-slate-950 text-slate-200 font-semibold px-2 py-1 rounded border border-slate-700/80 text-xs"
                        >
                          <option value="CALL">CALL</option>
                          <option value="PUT">PUT</option>
                          <option value="STOCK">AÇÃO</option>
                        </select>
                      </td>

                      {/* Ticker with OpLab Fetch Button */}
                      <td className="py-2.5 px-3">
                        <div className="relative inline-flex items-center">
                          <input
                            type="text"
                            value={leg.ticker || ''}
                            onChange={(e) => handleUpdateLeg(leg.id, { ticker: e.target.value.toUpperCase() })}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleLookupLegTicker(leg.id, leg.ticker || '', leg.side);
                              }
                            }}
                            placeholder="PETRJ390"
                            className="w-32 bg-slate-950 text-emerald-400 font-mono font-bold px-2 py-1 pr-7 rounded border border-slate-700/80 text-xs focus:border-emerald-500 focus:outline-none uppercase"
                          />
                          <button
                            type="button"
                            onClick={() => handleLookupLegTicker(leg.id, leg.ticker || '', leg.side)}
                            title="Buscar cotação e dados atualizados na B3"
                            className="absolute right-1 text-slate-400 hover:text-emerald-400 p-0.5 transition cursor-pointer"
                          >
                            {loadingLegId === leg.id ? (
                              <div className="w-3 h-3 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <Search className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                      </td>

                      {/* Strike */}
                      <td className="py-2.5 px-3">
                        {isStock ? (
                          <span className="text-slate-400 font-mono">-</span>
                        ) : (
                          <input
                            type="number"
                            step="0.25"
                            value={leg.strike}
                            onChange={(e) => handleUpdateLeg(leg.id, { strike: parseFloat(e.target.value) || 0 })}
                            className="w-20 bg-slate-950 text-white font-mono font-bold px-2 py-1 rounded border border-slate-700/80 text-xs text-center"
                          />
                        )}
                      </td>

                      {/* Premium */}
                      <td className="py-2.5 px-3">
                        <input
                          type="number"
                          step="0.05"
                          value={leg.premium}
                          onChange={(e) => handleUpdateLeg(leg.id, { premium: parseFloat(e.target.value) || 0 })}
                          className="w-20 bg-slate-950 text-amber-400 font-mono font-bold px-2 py-1 rounded border border-slate-700/80 text-xs text-center"
                        />
                      </td>

                      {/* Quantity */}
                      <td className="py-2.5 px-3">
                        <input
                          type="number"
                          step="100"
                          min="1"
                          value={leg.quantity}
                          onChange={(e) => handleUpdateLeg(leg.id, { quantity: parseInt(e.target.value, 10) || 100 })}
                          className="w-20 bg-slate-950 text-slate-200 font-mono px-2 py-1 rounded border border-slate-700/80 text-xs text-center"
                        />
                      </td>

                      {/* Days to Expiry */}
                      <td className="py-2.5 px-3">
                        {isStock ? (
                          <span className="text-slate-400 font-mono">Contínuo</span>
                        ) : (
                          <input
                            type="number"
                            step="1"
                            min="0"
                            value={leg.daysToExpiry}
                            onChange={(e) => handleUpdateLeg(leg.id, { daysToExpiry: parseInt(e.target.value, 10) || 0 })}
                            className="w-16 bg-slate-950 text-slate-300 font-mono px-2 py-1 rounded border border-slate-700/80 text-xs text-center"
                          />
                        )}
                      </td>

                      {/* Exercise Style */}
                      <td className="py-2.5 px-3">
                        {isStock ? (
                          <span className="text-slate-400 font-mono">-</span>
                        ) : (
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              leg.exerciseStyle === 'AMERICAN'
                                ? 'bg-amber-950/60 text-amber-300 border border-amber-800/50'
                                : 'bg-sky-950/60 text-sky-300 border border-sky-800/50'
                            }`}
                          >
                            {leg.exerciseStyle === 'AMERICAN' ? 'Americana' : 'Européia'}
                          </span>
                        )}
                      </td>

                      {/* Action */}
                      <td className="py-2.5 px-3 text-right">
                        <button
                          onClick={() => handleRemoveLeg(leg.id)}
                          className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 transition cursor-pointer"
                          title="Remover perna"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Gerenciador Robusto de Risco & Margem de Garantia B3 */}
      {legs.length > 0 && (
        <RiskMarginPanel
          legs={legs}
          spotPrice={spotPrice}
          ticker={ticker}
          interestRate={interestRate}
          iv={iv}
        />
      )}

      {/* Modal to Save Position */}
      {saveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 max-w-md w-full space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Bookmark className="w-4 h-4 text-emerald-400" />
              <span>Salvar Operação para Acompanhamento</span>
            </h3>
            <p className="text-xs text-slate-400">
              Esta estratégia será salva na sua carteira de acompanhamento para monitorar o decaimento do tempo, simular rolagens e registrar o fechamento.
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Nome de Identificação da Posição:
                </label>
                <input
                  type="text"
                  value={positionLabel}
                  onChange={(e) => setPositionLabel(e.target.value)}
                  placeholder="Ex: Trava de Alta PETR4 Outubro K38/K40"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1 flex items-center gap-1">
                    <Target className="w-3 h-3 text-emerald-400" />
                    <span>Meta de Lucro (R$):</span>
                  </label>
                  <input
                    type="number"
                    step="50"
                    value={targetProfitInput}
                    onChange={(e) => setTargetProfitInput(parseFloat(e.target.value) || 0)}
                    placeholder="Ex: 500.00"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-emerald-400 font-mono font-bold focus:outline-none focus:border-emerald-500"
                  />
                  <span className="text-[10px] text-slate-400 block mt-0.5">Alvo para realização parcial/total</span>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1 flex items-center gap-1">
                    <Shield className="w-3 h-3 text-rose-400" />
                    <span>Stop Loss (R$):</span>
                  </label>
                  <input
                    type="number"
                    step="50"
                    value={stopLossInput}
                    onChange={(e) => setStopLossInput(parseFloat(e.target.value) || 0)}
                    placeholder="Ex: -300.00"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-rose-400 font-mono font-bold focus:outline-none focus:border-rose-500"
                  />
                  <span className="text-[10px] text-slate-400 block mt-0.5">Limite de perda tolerada</span>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Tese Operacional & Notas:
                </label>
                <textarea
                  rows={2}
                  value={positionNotes}
                  onChange={(e) => setPositionNotes(e.target.value)}
                  placeholder="Ex: Estratégia montada buscando decaimento teta e proteção em caso de correção moderada..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-emerald-500 resize-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setSaveModalOpen(false)}
                className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-400 hover:bg-slate-800 transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmSave}
                className="px-4 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition shadow cursor-pointer"
              >
                Salvar na Carteira
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
