import React, { useState } from 'react';
import { OptionLeg } from '../types';
import {
  evaluateStrategyRisks,
  ComprehensiveRiskEvaluation,
  ScenarioPoint,
} from '../utils/riskEvaluation';
import {
  calculateExpiryPayoffAtPrice,
  calculateCurrentPayoffAtPrice,
  estimateB3Margin,
  calculateBlackScholes,
} from '../utils/blackScholes';
import {
  ShieldAlert,
  ShieldCheck,
  Activity,
  TrendingUp,
  TrendingDown,
  Clock,
  Zap,
  Flame,
  AlertTriangle,
  CheckCircle2,
  X,
  Sparkles,
  Sliders,
  Copy,
  Check,
  Cpu,
  BarChart2,
  Layers,
  ArrowRight,
  Info,
  Maximize2,
  Target,
  ArrowUpRight,
  ArrowDownRight,
  Compass,
} from 'lucide-react';

interface StrategyRiskEvaluatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  legs: OptionLeg[];
  spotPrice: number;
  ticker: string;
  iv: number;
  interestRate: number;
  strategyName: string;
  onNavigateToScenarios?: () => void;
  onNavigateToRoll?: () => void;
}

export const StrategyRiskEvaluatorModal: React.FC<StrategyRiskEvaluatorModalProps> = ({
  isOpen,
  onClose,
  legs,
  spotPrice,
  ticker,
  iv,
  interestRate,
  strategyName,
  onNavigateToScenarios,
  onNavigateToRoll,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<
    'overview' | 'shocks' | 'volatility' | 'greeks' | 'scenarios' | 'ai'
  >('overview');
  const [copied, setCopied] = useState(false);
  const [aiReport, setAiReport] = useState<string | null>(null);
  const [isLoadingAi, setIsLoadingAi] = useState(false);

  // Interactive Spot Shock Simulation Slider state (-20% to +20%)
  const [customShockPercent, setCustomShockPercent] = useState<number>(0);

  // Interactive VIX Shift Simulation Slider state (-15 to +15 pts from 32.77)
  const [customVixShift, setCustomVixShift] = useState<number>(0);

  // Filter for shock table
  const [shockFilter, setShockFilter] = useState<'all' | 'lateral' | 'moderate' | 'extreme'>('all');

  if (!isOpen) return null;

  // Compute comprehensive risk evaluation with official VIX anchored at 32.77
  const evaluation: ComprehensiveRiskEvaluation = evaluateStrategyRisks(
    legs,
    spotPrice,
    iv,
    interestRate,
    ticker,
    32.77
  );

  // Uncovered options count
  const shortCalls = legs.filter((l) => l.type === 'CALL' && l.side === 'SELL').reduce((s, l) => s + l.quantity, 0);
  const longCalls = legs.filter((l) => l.type === 'CALL' && l.side === 'BUY').reduce((s, l) => s + l.quantity, 0);
  const stockLeg = legs.find((l) => l.type === 'STOCK');
  const stockQty = stockLeg ? (stockLeg.side === 'BUY' ? stockLeg.quantity : -stockLeg.quantity) : 0;
  const uncoveredCalls = Math.max(0, shortCalls - Math.max(0, stockQty) - longCalls);
  const shortPuts = legs.filter((l) => l.type === 'PUT' && l.side === 'SELL').reduce((s, l) => s + l.quantity, 0);
  const longPuts = legs.filter((l) => l.type === 'PUT' && l.side === 'BUY').reduce((s, l) => s + l.quantity, 0);
  const uncoveredPuts = Math.max(0, shortPuts - longPuts);
  const hasUndefinedRisk = uncoveredCalls > 0 || uncoveredPuts > 0 || evaluation.margin.marginType === 'RISCO_CORE_B3';

  // Capital base for percentage calculations
  let initialCashflow = 0;
  legs.forEach((l) => {
    const sign = l.side === 'SELL' ? 1 : -1;
    initialCashflow += sign * l.premium * l.quantity;
  });
  const capitalBase = Math.max(1000, Math.abs(initialCashflow) || spotPrice * 100);
  const maxDays = Math.max(1, ...legs.map((l) => (l.type === 'STOCK' ? 30 : l.daysToExpiry)));

  // Interactive spot calculations
  const interactiveSpot = Number((spotPrice * (1 + customShockPercent / 100)).toFixed(2));
  const interactivePnlExpiry = Math.round(calculateExpiryPayoffAtPrice(legs, interactiveSpot, spotPrice));
  const interactivePnlToday = Math.round(
    calculateCurrentPayoffAtPrice(legs, interactiveSpot, spotPrice, iv, interestRate, 0)
  );
  const interactivePnlD7 = Math.round(
    calculateCurrentPayoffAtPrice(legs, interactiveSpot, spotPrice, iv, interestRate, Math.min(maxDays - 1, 7))
  );
  const interactiveMargin = Math.round(estimateB3Margin(legs, interactiveSpot).estimatedInitialMargin);
  const interactiveRoiExpiry = Number(((interactivePnlExpiry / capitalBase) * 100).toFixed(1));

  let interactiveDelta = 0;
  legs.forEach((leg) => {
    const sign = leg.side === 'BUY' ? 1 : -1;
    if (leg.type === 'STOCK') {
      interactiveDelta += sign * leg.quantity;
    } else {
      const bs = calculateBlackScholes(interactiveSpot, leg.strike, leg.daysToExpiry, iv, interestRate, leg.type);
      interactiveDelta += sign * bs.delta * leg.quantity;
    }
  });

  // Interactive VIX calculations
  const simulatedVixValue = Math.max(8, Number((32.77 + customVixShift).toFixed(2)));
  const simulatedVixPnlImpact = Math.round(evaluation.greeks.vega * customVixShift);

  // Consolidated scenario points list
  const allScenarioPoints: ScenarioPoint[] = [
    ...evaluation.lateralScenarios,
    ...evaluation.moderateScenarios,
    ...evaluation.extremeScenarios,
  ].sort((a, b) => a.changePercent - b.changePercent);

  // Max absolute PnL for scaling visual bars
  const maxPnlAbs = Math.max(
    ...allScenarioPoints.map((p) => Math.max(Math.abs(p.pnlExpiry), Math.abs(p.pnlToday))),
    Math.abs(interactivePnlExpiry),
    Math.abs(interactivePnlToday),
    1000
  );

  // Filtered scenario points
  const displayPoints = allScenarioPoints.filter((p) => {
    if (shockFilter === 'lateral') return Math.abs(p.changePercent) <= 1.5;
    if (shockFilter === 'moderate') return Math.abs(p.changePercent) >= 4 && Math.abs(p.changePercent) <= 6;
    if (shockFilter === 'extreme') return Math.abs(p.changePercent) >= 9;
    return true;
  });

  const handleCopySummary = () => {
    const text = `=== AVALIAÇÃO DE RISCOS B3 - ${strategyName} (${ticker}) ===
Spot: R$ ${spotPrice.toFixed(2)} | VIX B3 de Referência: 32,77 pts (Recorde B3)
Risco Global: ${evaluation.overallRiskLevel}
Delta: ${evaluation.greeks.delta} | Theta: R$ ${evaluation.greeks.theta}/dia | Vega: R$ ${evaluation.greeks.vega}/pt
Ganho Máx: ${typeof evaluation.maxProfit === 'number' ? `R$ ${evaluation.maxProfit}` : evaluation.maxProfit}
Perda Máx: ${typeof evaluation.maxLoss === 'number' ? `R$ ${evaluation.maxLoss}` : evaluation.maxLoss}
Probabilidade Estimada de Lucro: ${evaluation.winProbabilityEstimate}%
Exigência de Margem CORE B3: ~R$ ${evaluation.margin.estimatedInitialMargin.toLocaleString('pt-BR')}
Fatores Críticos: ${evaluation.keyRiskFactors.join('; ')}
Gerado pelo Opções B3 Pro.`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const handleRunAiAnalysis = async () => {
    setIsLoadingAi(true);
    setAiReport(null);
    try {
      const res = await fetch('/api/gemini/analyze-scenario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticker,
          spotPrice,
          strategyName,
          legs,
          interestRate,
          scenarioDescription: `Avaliação completa de risco com ancoragem no fechamento oficial do S&P/B3 IBOVESPA VIX a 32,77 pontos (Fear Zone) e choques de spot (0%, ±5%, ±10%, ±15%). Avaliar risco de cauda, margem CORE B3 e conduta de rolagem.`,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setAiReport(data.analysis || 'Análise concluída com sucesso.');
      } else {
        setAiReport(
          'Não foi possível conectar ao motor de IA no momento. Por favor verifique sua chave de API ou tente novamente.'
        );
      }
    } catch {
      setAiReport('Erro ao comunicar com o servidor de análise.');
    } finally {
      setIsLoadingAi(false);
    }
  };

  // Helper for dual-sided visual PnL Bar
  const renderVisualPnlBar = (pnl: number, maxVal: number, showLabel = true) => {
    const isPositive = pnl >= 0;
    const absVal = Math.abs(pnl);
    const widthPercent = Math.min(50, Math.round((absVal / maxVal) * 50));

    return (
      <div className="flex items-center gap-2 w-full min-w-[140px]">
        <div className="relative flex-1 h-3.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800 flex">
          {/* Left half (losses) */}
          <div className="w-1/2 h-full flex justify-end">
            {!isPositive && (
              <div
                className="h-full bg-gradient-to-l from-rose-500 to-rose-600 rounded-l-full transition-all duration-300"
                style={{ width: `${widthPercent * 2}%` }}
              />
            )}
          </div>
          {/* Center line (Zero mark) */}
          <div className="w-[1px] h-full bg-slate-500 z-10" />
          {/* Right half (profits) */}
          <div className="w-1/2 h-full flex justify-start">
            {isPositive && (
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-r-full transition-all duration-300"
                style={{ width: `${widthPercent * 2}%` }}
              />
            )}
          </div>
        </div>
        {showLabel && (
          <span
            className={`text-xs font-mono font-bold shrink-0 min-w-[75px] text-right ${
              isPositive ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {isPositive ? '+' : ''}R$ {pnl.toLocaleString('pt-BR')}
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-1 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-fadeIn overflow-y-auto">
      <div className="relative w-full max-w-5xl bg-slate-900 border border-slate-700/80 rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[96vh] sm:max-h-[94vh]">
        {/* Top Header */}
        <div className="p-3 sm:p-5 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border-b border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-rose-500/20 text-rose-400 border border-rose-500/40 flex items-center gap-1.5 shadow-sm">
                <ShieldAlert className="w-3.5 h-3.5" />
                Matriz de Risco B3 & VIX
              </span>

              <span className="text-xs font-mono text-slate-300">
                Ativo: <strong className="text-white">{ticker}</strong> (R$ {spotPrice.toFixed(2)})
              </span>

              <span className="text-xs font-mono text-slate-300 flex items-center gap-1">
                <Flame className="w-3.5 h-3.5 text-rose-400" />
                VIX B3: <strong className="text-rose-400 font-bold">32,77 pts</strong>
                <span className="text-[10px] px-1 py-0.2 rounded bg-rose-500/20 text-rose-300 font-sans uppercase">
                  Recorde
                </span>
              </span>

              <span
                className={`text-[11px] font-bold px-2 py-0.5 rounded-md border flex items-center gap-1 ${
                  evaluation.overallRiskLevel === 'CRITICO'
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                    : evaluation.overallRiskLevel === 'ALTO'
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                }`}
              >
                <Target className="w-3 h-3" />
                Risco: {evaluation.overallRiskLevel}
              </span>
            </div>

            <h2 className="text-base sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
              <span>{strategyName}</span>
              <span className="text-xs font-normal text-slate-400 font-sans">
                ({legs.length} {legs.length === 1 ? 'perna' : 'pernas'})
              </span>
            </h2>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 self-end sm:self-center">
            <button
              onClick={handleCopySummary}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition cursor-pointer"
              title="Copiar resumo completo de risco para a área de transferência"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copiado!' : 'Copiar Resumo'}</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700 transition cursor-pointer"
              title="Fechar avaliação"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Quick Diagnostic Pill Strip */}
        <div className="px-3 sm:px-4 py-2 bg-slate-950/70 border-b border-slate-800/80 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-xs font-mono">
          <div className="bg-slate-900/70 p-2 rounded-xl border border-slate-800/80">
            <span className="text-[10px] text-slate-400 uppercase font-sans">Saldo Montagem</span>
            <div
              className={`font-black text-xs sm:text-sm mt-0.5 ${
                evaluation.initialCashflow >= 0 ? 'text-emerald-400' : 'text-slate-200'
              }`}
            >
              {evaluation.initialCashflow >= 0 ? '+' : ''}R$ {evaluation.initialCashflow.toLocaleString('pt-BR')}
            </div>
            <span className="text-[9px] text-slate-500 font-sans">
              {evaluation.isCreditStrategy ? 'Crédito recebido' : 'Débito pago'}
            </span>
          </div>

          <div className="bg-slate-900/70 p-2 rounded-xl border border-slate-800/80">
            <span className="text-[10px] text-slate-400 uppercase font-sans">Retorno Máximo</span>
            <div className="font-black text-xs sm:text-sm text-emerald-400 mt-0.5">
              {typeof evaluation.maxProfit === 'number'
                ? `+R$ ${evaluation.maxProfit.toLocaleString('pt-BR')}`
                : evaluation.maxProfit}
            </div>
            <span className="text-[9px] text-slate-500 font-sans">Best Case</span>
          </div>

          <div className="bg-slate-900/70 p-2 rounded-xl border border-slate-800/80">
            <span className="text-[10px] text-slate-400 uppercase font-sans">Perda Máxima</span>
            <div
              className={`font-black text-xs sm:text-sm mt-0.5 ${
                evaluation.maxLoss === 'INDEFINIDO' ? 'text-rose-400' : 'text-slate-200'
              }`}
            >
              {typeof evaluation.maxLoss === 'number'
                ? `R$ ${evaluation.maxLoss.toLocaleString('pt-BR')}`
                : '⚠️ INDEFINIDA'}
            </div>
            <span className="text-[9px] text-slate-500 font-sans">Worst Case</span>
          </div>

          <div className="bg-slate-900/70 p-2 rounded-xl border border-slate-800/80">
            <span className="text-[10px] text-slate-400 uppercase font-sans">Margem CORE B3</span>
            <div className={`font-black text-xs sm:text-sm mt-0.5 ${hasUndefinedRisk ? 'text-rose-400' : 'text-amber-300'}`}>
              ~R$ {evaluation.margin.estimatedInitialMargin.toLocaleString('pt-BR')}
            </div>
            <span className="text-[9px] text-slate-500 font-sans">
              {hasUndefinedRisk ? 'Risco Aberto' : 'Trava Coberta'}
            </span>
          </div>

          <div className="bg-slate-900/70 p-2 rounded-xl border border-slate-800/80">
            <span className="text-[10px] text-slate-400 uppercase font-sans">Probabilidade Lucro</span>
            <div className="font-black text-xs sm:text-sm text-sky-400 mt-0.5">
              ~{evaluation.winProbabilityEstimate}%
            </div>
            <span className="text-[9px] text-slate-500 font-sans">Estatística Normal</span>
          </div>

          <div className="bg-slate-900/70 p-2 rounded-xl border border-slate-800/80">
            <span className="text-[10px] text-slate-400 uppercase font-sans">Theta Diário (DU)</span>
            <div
              className={`font-black text-xs sm:text-sm mt-0.5 ${
                evaluation.greeks.theta >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {evaluation.greeks.theta >= 0 ? '+' : ''}R$ {evaluation.greeks.theta.toFixed(1)}/dia
            </div>
            <span className="text-[9px] text-slate-500 font-sans">Efeito Tempo</span>
          </div>
        </div>

        {/* Sub Navigation Tabs */}
        <div className="px-2 sm:px-5 pt-2 border-b border-slate-800 bg-slate-950/50 flex items-center gap-1 sm:gap-1.5 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveSubTab('overview')}
            className={`px-2.5 sm:px-3 py-2 rounded-t-xl text-xs font-bold border-b-2 transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeSubTab === 'overview'
                ? 'border-emerald-500 text-emerald-400 bg-slate-800/60'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Compass className="w-3.5 h-3.5 text-emerald-400" />
            <span className="sm:hidden">⚡ Geral</span>
            <span className="hidden sm:inline">⚡ Visão Geral Executiva</span>
          </button>

          <button
            onClick={() => setActiveSubTab('shocks')}
            className={`px-2.5 sm:px-3 py-2 rounded-t-xl text-xs font-bold border-b-2 transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeSubTab === 'shocks'
                ? 'border-emerald-500 text-emerald-400 bg-slate-800/60'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span className="sm:hidden">1. Choques</span>
            <span className="hidden sm:inline">1. Choques de Preço (0%, ±5%, ±10%+)</span>
          </button>

          <button
            onClick={() => setActiveSubTab('volatility')}
            className={`px-2.5 sm:px-3 py-2 rounded-t-xl text-xs font-bold border-b-2 transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeSubTab === 'volatility'
                ? 'border-emerald-500 text-emerald-400 bg-slate-800/60'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Flame className="w-3.5 h-3.5 text-rose-400" />
            <span className="sm:hidden">2. VIX B3</span>
            <span className="hidden sm:inline">2. Volatilidade & VIX B3 (32,77 pts)</span>
          </button>

          <button
            onClick={() => setActiveSubTab('greeks')}
            className={`px-2.5 sm:px-3 py-2 rounded-t-xl text-xs font-bold border-b-2 transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeSubTab === 'greeks'
                ? 'border-emerald-500 text-emerald-400 bg-slate-800/60'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Activity className="w-3.5 h-3.5 text-purple-400" />
            <span className="sm:hidden">3. Gregas</span>
            <span className="hidden sm:inline">3. Gregas & Cenários Evolutivos</span>
          </button>

          <button
            onClick={() => setActiveSubTab('scenarios')}
            className={`px-2.5 sm:px-3 py-2 rounded-t-xl text-xs font-bold border-b-2 transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeSubTab === 'scenarios'
                ? 'border-emerald-500 text-emerald-400 bg-slate-800/60'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <BarChart2 className="w-3.5 h-3.5 text-sky-400" />
            <span className="sm:hidden">4. Cenários</span>
            <span className="hidden sm:inline">4. Cenários Positivos vs Negativos</span>
          </button>

          <button
            onClick={() => {
              setActiveSubTab('ai');
              if (!aiReport && !isLoadingAi) handleRunAiAnalysis();
            }}
            className={`px-2.5 sm:px-3 py-2 rounded-t-xl text-xs font-bold border-b-2 transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeSubTab === 'ai'
                ? 'border-purple-500 text-purple-400 bg-slate-800/60'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Cpu className="w-3.5 h-3.5 text-purple-400" />
            <span className="sm:hidden">5. Parecer IA</span>
            <span className="hidden sm:inline">5. Parecer IA Gemini</span>
            <span className="text-[9px] px-1 py-0.2 rounded bg-purple-500/20 text-purple-300 border border-purple-500/40">
              IA
            </span>
          </button>
        </div>

        {/* Modal Body Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* TAB 0: EXECUTIVE OVERVIEW DASHBOARD */}
          {activeSubTab === 'overview' && (
            <div className="space-y-6 animate-fadeIn">
              {/* Visual Risk Gauge & Key Metrics Hero */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Risk Gauge Card */}
                <div className="p-4 rounded-2xl bg-gradient-to-b from-slate-950 to-slate-900 border border-slate-800 flex flex-col justify-between space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Nível de Risco Geral
                    </span>
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded-full border ${
                        evaluation.overallRiskLevel === 'CRITICO'
                          ? 'bg-rose-500/20 text-rose-400 border-rose-500/40'
                          : evaluation.overallRiskLevel === 'ALTO'
                          ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                          : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                      }`}
                    >
                      {evaluation.overallRiskLevel}
                    </span>
                  </div>

                  {/* Visual 4-Segment Risk Meter */}
                  <div className="space-y-1.5 py-1">
                    <div className="grid grid-cols-4 gap-1.5 h-3 rounded-full overflow-hidden bg-slate-950 p-0.5 border border-slate-800">
                      <div
                        className={`rounded-full transition-all ${
                          ['BAIXO', 'MODERADO', 'ALTO', 'CRITICO'].includes(evaluation.overallRiskLevel)
                            ? 'bg-emerald-500 shadow-sm shadow-emerald-500/50'
                            : 'bg-slate-800'
                        }`}
                      />
                      <div
                        className={`rounded-full transition-all ${
                          ['MODERADO', 'ALTO', 'CRITICO'].includes(evaluation.overallRiskLevel)
                            ? 'bg-amber-500 shadow-sm shadow-amber-500/50'
                            : 'bg-slate-800'
                        }`}
                      />
                      <div
                        className={`rounded-full transition-all ${
                          ['ALTO', 'CRITICO'].includes(evaluation.overallRiskLevel)
                            ? 'bg-orange-500 shadow-sm shadow-orange-500/50'
                            : 'bg-slate-800'
                        }`}
                      />
                      <div
                        className={`rounded-full transition-all ${
                          evaluation.overallRiskLevel === 'CRITICO'
                            ? 'bg-rose-500 shadow-sm shadow-rose-500/50 animate-pulse'
                            : 'bg-slate-800'
                        }`}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                      <span>Baixo</span>
                      <span>Moderado</span>
                      <span>Alto</span>
                      <span>Crítico</span>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    {hasUndefinedRisk
                      ? '⚠️ Operação com pernas a seco: exige estrita disciplina de margem CORE B3 e stop-loss.'
                      : '✅ Estrutura travada com risco delimitado e margem requerida estável.'}
                  </p>
                </div>

                {/* Probability & Payoff Range Card */}
                <div className="p-4 rounded-2xl bg-gradient-to-b from-slate-950 to-slate-900 border border-slate-800 flex flex-col justify-between space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Probabilidade Estatística
                    </span>
                    <span className="text-xs font-mono font-bold text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded-full border border-sky-500/20">
                      1-Sigma (68,2%)
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="relative w-16 h-16 shrink-0 flex items-center justify-center">
                      <svg className="w-16 h-16 transform -rotate-90" viewBox="0 0 36 36">
                        <path
                          className="text-slate-800"
                          strokeWidth="3.5"
                          stroke="currentColor"
                          fill="none"
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        />
                        <path
                          className="text-sky-400"
                          strokeDasharray={`${evaluation.winProbabilityEstimate}, 100`}
                          strokeWidth="3.5"
                          strokeLinecap="round"
                          stroke="currentColor"
                          fill="none"
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        />
                      </svg>
                      <span className="absolute text-xs font-mono font-black text-white">
                        {evaluation.winProbabilityEstimate}%
                      </span>
                    </div>

                    <div className="space-y-1 text-xs">
                      <div className="text-slate-300 font-semibold">Chance de Sucesso no Vencimento</div>
                      <div className="text-[11px] text-slate-400">
                        {evaluation.winProbabilityEstimate >= 60
                          ? 'Probabilidade estatística favorável pela distribuição normal.'
                          : 'Operação assimétrica: menor probabilidade compensada por retorno potencial.'}
                      </div>
                    </div>
                  </div>

                  <div className="text-[11px] text-slate-400 font-mono flex items-center justify-between border-t border-slate-800/80 pt-2">
                    <span>Faixa Lucro Máximo:</span>
                    <strong className="text-emerald-400">{evaluation.bestCaseRange}</strong>
                  </div>
                </div>

                {/* VIX Impact Summary Card */}
                <div className="p-4 rounded-2xl bg-gradient-to-b from-slate-950 to-slate-900 border border-slate-800 flex flex-col justify-between space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Ancoragem VIX B3
                    </span>
                    <span className="text-xs font-mono font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20">
                      32,77 pts
                    </span>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-baseline justify-between">
                      <span className="text-xs text-slate-300">Sensibilidade (Vega):</span>
                      <span
                        className={`text-base font-mono font-black ${
                          evaluation.greeks.vega >= 0 ? 'text-emerald-400' : 'text-purple-400'
                        }`}
                      >
                        {evaluation.greeks.vega >= 0 ? '+' : ''}R$ {evaluation.greeks.vega.toFixed(1)} / pt
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      {evaluation.greeks.vega < 0
                        ? '🔥 Posição Vega Negativa: LUCRA com desinflação de volatilidade (IV Crush) e normalização do VIX.'
                        : '📈 Posição Vega Positiva: LUCRA se a volatilidade e o pânico continuarem subindo.'}
                    </p>
                  </div>

                  <div className="text-[11px] text-slate-400 font-mono flex items-center justify-between border-t border-slate-800/80 pt-2">
                    <span>Impacto se VIX cair 5 pts:</span>
                    <strong
                      className={
                        -5 * evaluation.greeks.vega >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }
                    >
                      {-5 * evaluation.greeks.vega >= 0 ? '+' : ''}R${' '}
                      {Math.round(-5 * evaluation.greeks.vega).toLocaleString('pt-BR')}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Visual Scenario Spectrum Bar Chart */}
              <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                  <div>
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                      <BarChart2 className="w-4 h-4 text-emerald-400" />
                      <span>Espectro Visual de Payoff por Choque de Preço</span>
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Comparação imediata de P&L projetado no Vencimento (verde = lucro / vermelho = prejuízo)
                    </p>
                  </div>

                  <button
                    onClick={() => setActiveSubTab('shocks')}
                    className="text-xs text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1 self-start sm:self-center cursor-pointer"
                  >
                    <span>Ver tabela detalhada</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Horizontal Spectrum Bar Graphic */}
                <div className="space-y-2.5">
                  {allScenarioPoints.map((point, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-xl bg-slate-900/60 hover:bg-slate-900 border border-slate-800/60 transition flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-3 sm:w-1/3 min-w-[200px]">
                        <span
                          className={`text-xs font-mono font-black px-2 py-0.5 rounded ${
                            point.changePercent === 0
                              ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                              : Math.abs(point.changePercent) <= 5
                              ? 'bg-slate-800 text-slate-200'
                              : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                          }`}
                        >
                          {point.changePercent >= 0 ? `+${point.changePercent}%` : `${point.changePercent}%`}
                        </span>

                        <div className="text-xs">
                          <span className="font-bold text-white">{point.label}</span>
                          <span className="text-slate-400 font-mono block text-[11px]">
                            R$ {point.simulatedSpot.toFixed(2)}
                          </span>
                        </div>
                      </div>

                      {/* Visual PnL Waterfall Bar */}
                      <div className="flex-1 max-w-md">
                        {renderVisualPnlBar(point.pnlExpiry, maxPnlAbs, true)}
                      </div>

                      <div className="sm:w-1/4 text-right flex items-center justify-end gap-2 text-xs font-mono">
                        <span className="text-[11px] text-slate-400 font-sans">Hoje:</span>
                        <span
                          className={`font-semibold ${
                            point.pnlToday >= 0 ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {point.pnlToday >= 0 ? '+' : ''}R$ {point.pnlToday.toLocaleString('pt-BR')}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Interactive Spot Shock Simulator Slider Card */}
              <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border border-slate-800 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                      <Sliders className="w-4 h-4 text-sky-400" />
                      <span>Simulador Interativo em Tempo Real de Choque no Ativo</span>
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Arraste o slider para testar instantaneamente qualquer oscilação percentual no {ticker}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    {[-15, -10, -5, 0, 5, 10, 15].map((preset) => (
                      <button
                        key={preset}
                        onClick={() => setCustomShockPercent(preset)}
                        className={`text-xs px-2.5 py-1 rounded-lg font-mono font-bold transition cursor-pointer ${
                          customShockPercent === preset
                            ? 'bg-sky-500 text-slate-950'
                            : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                        }`}
                      >
                        {preset >= 0 ? `+${preset}%` : `${preset}%`}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Slider Input */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs font-mono">
                    <span className="text-slate-400">-25% (Queda Forte)</span>
                    <span className="text-base font-black text-sky-400 px-3 py-0.5 rounded-full bg-sky-500/10 border border-sky-500/30">
                      Choque: {customShockPercent >= 0 ? `+${customShockPercent}%` : `${customShockPercent}%`} (R${' '}
                      {interactiveSpot.toFixed(2)})
                    </span>
                    <span className="text-slate-400">+25% (Alta Forte)</span>
                  </div>

                  <input
                    type="range"
                    min="-25"
                    max="25"
                    step="0.5"
                    value={customShockPercent}
                    onChange={(e) => setCustomShockPercent(parseFloat(e.target.value))}
                    className="w-full h-2.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-500"
                  />
                </div>

                {/* Dynamic Result Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono pt-1">
                  <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                    <span className="text-[10px] text-slate-400 font-sans uppercase">P&L no Vencimento</span>
                    <div
                      className={`text-base font-black mt-0.5 ${
                        interactivePnlExpiry >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {interactivePnlExpiry >= 0 ? '+' : ''}R$ {interactivePnlExpiry.toLocaleString('pt-BR')}
                    </div>
                    <span className="text-[10px] text-slate-400 font-sans">
                      Retorno: {interactiveRoiExpiry >= 0 ? `+${interactiveRoiExpiry}%` : `${interactiveRoiExpiry}%`}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                    <span className="text-[10px] text-slate-400 font-sans uppercase">P&L Imediato (Hoje D+0)</span>
                    <div
                      className={`text-base font-black mt-0.5 ${
                        interactivePnlToday >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {interactivePnlToday >= 0 ? '+' : ''}R$ {interactivePnlToday.toLocaleString('pt-BR')}
                    </div>
                    <span className="text-[10px] text-slate-400 font-sans">Marcação a Mercado</span>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                    <span className="text-[10px] text-slate-400 font-sans uppercase">Margem CORE B3</span>
                    <div className="text-base font-black text-amber-300 mt-0.5">
                      ~R$ {interactiveMargin.toLocaleString('pt-BR')}
                    </div>
                    <span className="text-[10px] text-slate-400 font-sans">Exigência Estimada</span>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                    <span className="text-[10px] text-slate-400 font-sans uppercase">Delta no Preço</span>
                    <div className="text-base font-black text-white mt-0.5">
                      {interactiveDelta >= 0 ? `+${interactiveDelta.toFixed(1)}` : interactiveDelta.toFixed(1)}
                    </div>
                    <span className="text-[10px] text-slate-400 font-sans">Equiv. em Ações</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 1: SPOT PRICE SHOCKS (0%, ±5%, ±10%, ±15%) */}
          {activeSubTab === 'shocks' && (
            <div className="space-y-6 animate-fadeIn">
              {/* Filter Pills */}
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-slate-400 font-medium mr-1">Filtrar Cenários:</span>
                  <button
                    onClick={() => setShockFilter('all')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                      shockFilter === 'all'
                        ? 'bg-slate-700 text-white'
                        : 'bg-slate-800/60 text-slate-400 hover:text-white'
                    }`}
                  >
                    Todos ({allScenarioPoints.length})
                  </button>

                  <button
                    onClick={() => setShockFilter('lateral')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                      shockFilter === 'lateral'
                        ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                        : 'bg-slate-800/60 text-slate-400 hover:text-white'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-sky-400" />
                    <span>Lateral (0% a ±1,5%)</span>
                  </button>

                  <button
                    onClick={() => setShockFilter('moderate')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                      shockFilter === 'moderate'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        : 'bg-slate-800/60 text-slate-400 hover:text-white'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-amber-400" />
                    <span>Moderado (±5%)</span>
                  </button>

                  <button
                    onClick={() => setShockFilter('extreme')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                      shockFilter === 'extreme'
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                        : 'bg-slate-800/60 text-slate-400 hover:text-white'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                    <span>Estresse / Cauda (±10%+)</span>
                  </button>
                </div>

                <span className="text-xs font-mono text-slate-400">Spot Base: R$ {spotPrice.toFixed(2)}</span>
              </div>

              {/* Main Visual Matrix Table */}
              <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950/70 shadow-xl">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-900/90 text-slate-400 uppercase font-mono text-[10px] border-b border-slate-800">
                    <tr>
                      <th className="p-3.5">Cenário / Choque</th>
                      <th className="p-3.5">Preço Simulado</th>
                      <th className="p-3.5 min-w-[180px]">Barra Visual P&L (Vencimento)</th>
                      <th className="p-3.5">P&L Hoje (D+0)</th>
                      <th className="p-3.5">P&L D+7</th>
                      <th className="p-3.5">Margem CORE</th>
                      <th className="p-3.5">Delta</th>
                      <th className="p-3.5 min-w-[200px]">Diagnóstico B3</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 font-mono">
                    {displayPoints.map((s, idx) => (
                      <tr key={idx} className="hover:bg-slate-900/50 transition">
                        <td className="p-3.5">
                          <div className="flex items-center gap-2">
                            <span
                              className={`px-2 py-0.5 rounded text-[11px] font-black ${
                                s.changePercent === 0
                                  ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                                  : s.changePercent > 0
                                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                  : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                              }`}
                            >
                              {s.changePercent >= 0 ? `+${s.changePercent}%` : `${s.changePercent}%`}
                            </span>
                            <span className="font-bold text-white font-sans">{s.label}</span>
                          </div>
                        </td>

                        <td className="p-3.5 text-sky-400 font-bold">R$ {s.simulatedSpot.toFixed(2)}</td>

                        {/* Visual PnL Bar Cell */}
                        <td className="p-3.5">{renderVisualPnlBar(s.pnlExpiry, maxPnlAbs, true)}</td>

                        <td
                          className={`p-3.5 font-semibold ${
                            s.pnlToday >= 0 ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {s.pnlToday >= 0 ? '+' : ''}R$ {s.pnlToday.toLocaleString('pt-BR')}
                        </td>

                        <td
                          className={`p-3.5 font-semibold ${s.pnlD7 >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}
                        >
                          {s.pnlD7 >= 0 ? '+' : ''}R$ {s.pnlD7.toLocaleString('pt-BR')}
                        </td>

                        <td className="p-3.5 text-amber-300 font-bold">
                          ~R$ {s.marginStressEstimate.toLocaleString('pt-BR')}
                        </td>

                        <td className="p-3.5 text-slate-300">{s.deltaAtPrice}</td>

                        <td className="p-3.5 font-sans text-[11px]">
                          {hasUndefinedRisk && Math.abs(s.changePercent) >= 10 ? (
                            <span className="text-rose-400 font-bold flex items-center gap-1.5">
                              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                              Risco Crítico de Liquidação Compulsória!
                            </span>
                          ) : (
                            <span className="text-slate-300">{s.riskNote}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Explanatory Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 space-y-1.5">
                  <div className="font-bold text-white flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-sky-400" />
                    <span>Impacto do Decaimento Temporal na Lateralidade:</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Se o ativo ficar estável, a posição ganha/perde{' '}
                    <strong className="text-white">R$ {evaluation.greeks.theta.toFixed(1)}</strong> por dia útil.
                    {evaluation.greeks.theta > 0
                      ? ' Como o Theta da posição é positivo, o tempo corre diretamente a favor da sua estratégia!'
                      : ' Como o Theta da posição é negativo, cada pregão de estabilidade corrói o valor do prêmio pago.'}
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 space-y-1.5">
                  <div className="font-bold text-white flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4 text-amber-400" />
                    <span>Alavancagem e Risco de Margem CORE B3:</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Em choques de cauda (±10% a ±15%), a B3 estressa as volatilidades e amplia as chamadas de
                    garantia. Certifique-se de manter pelo menos o dobro da margem exigida em garantias aceitas (Tesouro
                    Selic ou CDB de liquidez diária).
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: VOLATILITY & VIX B3 ANCHORING (32.77) */}
          {activeSubTab === 'volatility' && (
            <div className="space-y-6 animate-fadeIn">
              {/* VIX Official Anchoring Banner */}
              <div className="p-5 rounded-2xl bg-gradient-to-r from-rose-950/40 via-slate-900 to-slate-950 border border-rose-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Flame className="w-5 h-5 text-rose-400" />
                    <span className="text-xs font-bold uppercase tracking-wider text-rose-400">
                      Ancoragem Oficial: S&P/B3 IBOVESPA VIX
                    </span>
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 font-mono font-bold">
                      32,77 pts (Recorde Histórico Fechamento)
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
                    O VIX B3 fechou em <strong>32,77 pontos</strong> no último pregão (regime de extrema aversão ao
                    risco / Fear Zone). A volatilidade implícita (IV) média das opções na B3 está com prêmios
                    inflacionados.
                  </p>
                </div>

                <div className="text-right shrink-0 bg-slate-950/80 p-3.5 rounded-xl border border-slate-800 font-mono text-xs">
                  <span className="text-slate-400 text-[10px] uppercase font-sans">Vega Total da Carteira</span>
                  <div
                    className={`text-lg font-black ${
                      evaluation.greeks.vega >= 0 ? 'text-emerald-400' : 'text-purple-400'
                    }`}
                  >
                    {evaluation.greeks.vega >= 0 ? '+' : ''}R$ {evaluation.greeks.vega.toFixed(1)} / pt de VIX
                  </div>
                </div>
              </div>

              {/* VIX Visual Regime Gauge */}
              <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    Termômetro de Regimes de Volatilidade B3
                  </span>
                  <span className="text-xs font-mono font-bold text-rose-400">
                    VIX Atual: 32,77 pts (Regime 4)
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-2 text-xs">
                  <div className="p-3 rounded-xl bg-slate-900/50 border border-slate-800 text-slate-400">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-bold text-slate-300">1. Calmaria</span>
                      <span className="font-mono text-[10px]">&lt; 18 pts</span>
                    </div>
                    <p className="text-[10px] text-slate-500">Prêmios baratos; favorável para compra a seco.</p>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-900/50 border border-slate-800 text-slate-400">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-bold text-slate-300">2. Normal</span>
                      <span className="font-mono text-[10px]">18 - 24 pts</span>
                    </div>
                    <p className="text-[10px] text-slate-500">Média histórica da B3; travas verticais.</p>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-900/50 border border-slate-800 text-slate-400">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-bold text-slate-300">3. Elevada</span>
                      <span className="font-mono text-[10px]">24 - 30 pts</span>
                    </div>
                    <p className="text-[10px] text-slate-500">Incerteza política/fiscal; venda coberta.</p>
                  </div>

                  <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/40 text-rose-300 shadow-lg shadow-rose-950/20">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-black text-rose-300 flex items-center gap-1">
                        <Flame className="w-3.5 h-3.5 text-rose-400" />
                        4. Pânico / Recorde
                      </span>
                      <span className="font-mono font-black text-xs text-rose-400">&gt; 30 pts</span>
                    </div>
                    <p className="text-[10px] text-rose-300/80 font-medium">
                      Recorde em 32,77 pts! Prêmios no ápice; alto risco de IV Crush.
                    </p>
                  </div>
                </div>
              </div>

              {/* Interactive VIX Sensitivity Shock Slider */}
              <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border border-slate-800 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                      <Sliders className="w-4 h-4 text-purple-400" />
                      <span>Simulador Interativo de Sensibilidade ao VIX</span>
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Simule o que acontece se o VIX B3 subir ou desinflar a partir dos 32,77 pontos atuais
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    {[-10, -5, 0, 5, 10].map((shift) => (
                      <button
                        key={shift}
                        onClick={() => setCustomVixShift(shift)}
                        className={`text-xs px-2.5 py-1 rounded-lg font-mono font-bold transition cursor-pointer ${
                          customVixShift === shift
                            ? 'bg-purple-500 text-white'
                            : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                        }`}
                      >
                        {shift >= 0 ? `+${shift} pts` : `${shift} pts`}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs font-mono">
                    <span className="text-slate-400">-15 pts (VIX 17,77 - Calmaria)</span>
                    <span className="text-base font-black text-purple-400 px-3 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/30">
                      VIX Simulado: {simulatedVixValue} pts ({customVixShift >= 0 ? `+${customVixShift}` : customVixShift}{' '}
                      pts)
                    </span>
                    <span className="text-slate-400">+15 pts (VIX 47,77 - Choque Severo)</span>
                  </div>

                  <input
                    type="range"
                    min="-15"
                    max="15"
                    step="0.5"
                    value={customVixShift}
                    onChange={(e) => setCustomVixShift(parseFloat(e.target.value))}
                    className="w-full h-2.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
                  />
                </div>

                {/* Live VIX Shock Metric Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono pt-1">
                  <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                    <span className="text-[10px] text-slate-400 font-sans uppercase">
                      Impacto Imediato no P&L da Carteira
                    </span>
                    <div
                      className={`text-base font-black mt-0.5 ${
                        simulatedVixPnlImpact >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {simulatedVixPnlImpact >= 0 ? '+' : ''}R$ {simulatedVixPnlImpact.toLocaleString('pt-BR')}
                    </div>
                    <span className="text-[10px] text-slate-400 font-sans">Efeito Vega puro</span>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                    <span className="text-[10px] text-slate-400 font-sans uppercase">Diagnóstico do Efeito</span>
                    <div className="text-xs font-bold text-white mt-1 font-sans">
                      {evaluation.greeks.vega < 0 && customVixShift < 0
                        ? '🎉 Lucro com IV Crush (Desinflação)'
                        : evaluation.greeks.vega > 0 && customVixShift > 0
                        ? '🚀 Lucro com Expansão de Volatilidade'
                        : evaluation.greeks.vega < 0 && customVixShift > 0
                        ? '⚠️ Perda por Elevação de Volatilidade'
                        : '⚠️ Perda por Desinflação de Volatilidade'}
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                    <span className="text-[10px] text-slate-400 font-sans uppercase">Impacto na Margem B3</span>
                    <div className="text-xs font-bold text-amber-300 mt-1 font-sans">
                      {customVixShift > 5
                        ? 'Exigência de Margem CORE SOBE em até +40%'
                        : customVixShift < -5
                        ? 'Exigência de Margem CORE REDUZ em ~20%'
                        : 'Margem CORE estável'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Volatility Scenarios Side-by-Side Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {evaluation.volatilityShocks.map((vShock, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-2xl bg-slate-950 border border-slate-800 hover:border-slate-700 transition space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white font-sans">{vShock.label}</span>
                      <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-slate-900 text-slate-300 border border-slate-800">
                        VIX: {vShock.simulatedVix} pts ({vShock.vixShiftPts >= 0 ? `+${vShock.vixShiftPts}` : vShock.vixShiftPts} pts)
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                      <div className="bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
                        <span className="text-[10px] text-slate-400 font-sans">Impacto no P&L Hoje:</span>
                        <div
                          className={`text-sm font-bold mt-1 ${
                            vShock.pnlImpactToday >= 0 ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {vShock.pnlImpactToday >= 0 ? '+' : ''}R$ {vShock.pnlImpactToday.toLocaleString('pt-BR')}
                        </div>
                      </div>

                      <div className="bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
                        <span className="text-[10px] text-slate-400 font-sans">Efeito Vega:</span>
                        <div className="text-xs text-slate-300 font-sans mt-1">
                          {evaluation.greeks.vega < 0 && vShock.vixShiftPts < 0
                            ? 'Lucro com IV Crush'
                            : 'Sensibilidade Direta'}
                        </div>
                      </div>
                    </div>

                    <div className="text-[11px] text-slate-300 space-y-1">
                      <p className="text-amber-300 font-medium">
                        <strong>Margem B3 CORE:</strong> {vShock.b3MarginImpactText}
                      </p>
                      <p className="text-slate-400">
                        <strong>Conduta:</strong> {vShock.recommendation}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: GREEKS & EVOLUTION THROUGH TIME */}
          {activeSubTab === 'greeks' && (
            <div className="space-y-6 animate-fadeIn">
              {/* Initial Greeks Cards */}
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <Activity className="w-4 h-4 text-purple-400" />
                  <span>1. Gregas na Montagem (Posição Atual Hoje)</span>
                </h3>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs font-mono">
                  <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col justify-between">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-sans">Delta Direcional</span>
                      <div className="text-lg font-black text-white mt-1">
                        {evaluation.greeks.delta >= 0 ? `+${evaluation.greeks.delta}` : evaluation.greeks.delta}
                      </div>
                    </div>
                    <span className="text-[10px] text-slate-500 font-sans mt-2">
                      Equivalente a {Math.round(evaluation.greeks.delta * 100)} ações
                    </span>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col justify-between">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-sans">Gamma (Aceleração)</span>
                      <div className="text-lg font-black text-sky-400 mt-1">
                        {evaluation.greeks.gamma >= 0 ? `+${evaluation.greeks.gamma}` : evaluation.greeks.gamma}
                      </div>
                    </div>
                    <span className="text-[10px] text-slate-500 font-sans mt-2">Curvatura por R$ 1</span>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col justify-between">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-sans">Theta Diário (DU 252)</span>
                      <div
                        className={`text-lg font-black mt-1 ${
                          evaluation.greeks.theta >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {evaluation.greeks.theta >= 0
                          ? `+R$ ${evaluation.greeks.theta.toFixed(1)}`
                          : `R$ ${evaluation.greeks.theta.toFixed(1)}`}
                      </div>
                    </div>
                    <span className="text-[10px] text-slate-500 font-sans mt-2">Ganho/Perda por dia útil</span>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col justify-between">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-sans">Vega (Sensibilidade IV)</span>
                      <div
                        className={`text-lg font-black mt-1 ${
                          evaluation.greeks.vega >= 0 ? 'text-emerald-400' : 'text-purple-400'
                        }`}
                      >
                        {evaluation.greeks.vega >= 0
                          ? `+R$ ${evaluation.greeks.vega.toFixed(1)}`
                          : `R$ ${evaluation.greeks.vega.toFixed(1)}`}
                      </div>
                    </div>
                    <span className="text-[10px] text-slate-500 font-sans mt-2">Impacto por 1% IV</span>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col justify-between">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-sans">Rho (Selic / Juros)</span>
                      <div className="text-lg font-black text-slate-200 mt-1">
                        {evaluation.greeks.rho >= 0
                          ? `+R$ ${evaluation.greeks.rho.toFixed(1)}`
                          : `R$ ${evaluation.greeks.rho.toFixed(1)}`}
                      </div>
                    </div>
                    <span className="text-[10px] text-slate-500 font-sans mt-2">Impacto por 1% Selic</span>
                  </div>
                </div>
              </div>

              {/* Visual Evolutionary Timeline Stepper */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <Clock className="w-4 h-4 text-sky-400" />
                    <span>2. Cenários Evolutivos das Gregas com a Passagem do Tempo</span>
                  </h3>
                  <span className="text-xs text-slate-400 font-mono">D-0 até o Vencimento B3</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                  {evaluation.greeksEvolution.map((evo, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col justify-between space-y-3"
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="px-2.5 py-0.5 rounded-full bg-slate-900 text-white font-mono font-black text-xs border border-slate-800">
                            {evo.timeLabel}
                          </span>
                          <span className="text-slate-400 font-mono text-[11px]">
                            {evo.daysRemaining} DU restantes
                          </span>
                        </div>
                        <p className="text-slate-300 text-[11px] leading-relaxed font-sans">{evo.explanation}</p>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs font-mono border-t border-slate-800/80 pt-2.5">
                        <div>
                          <span className="text-[9px] text-slate-500 block uppercase font-sans">Delta</span>
                          <span className="font-bold text-white">{evo.delta}</span>
                        </div>
                        <div>
                          <span className="text-[9px] text-slate-500 block uppercase font-sans">Gamma</span>
                          <span className="font-bold text-sky-400">{evo.gamma}</span>
                        </div>
                        <div>
                          <span className="text-[9px] text-slate-500 block uppercase font-sans">Theta</span>
                          <span
                            className={`font-bold ${evo.theta >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}
                          >
                            {evo.theta >= 0 ? '+' : ''}R$ {evo.theta}
                          </span>
                        </div>
                        <div>
                          <span className="text-[9px] text-slate-500 block uppercase font-sans">Vega</span>
                          <span className="font-bold text-purple-400">R$ {evo.vega}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: POSITIVE VS NEGATIVE SCENARIOS & PROTOCOLS */}
          {activeSubTab === 'scenarios' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Best Case Card */}
                <div className="p-5 rounded-2xl bg-gradient-to-b from-emerald-950/30 to-slate-950 border border-emerald-500/30 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
                      <TrendingUp className="w-3.5 h-3.5" />
                      Cenário Mais Favorável (Best Case)
                    </span>
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  </div>

                  <div>
                    <span className="text-xs text-slate-400">Retorno Máximo Projetado:</span>
                    <div className="text-2xl font-black font-mono text-emerald-400 mt-0.5">
                      {typeof evaluation.maxProfit === 'number'
                        ? `+R$ ${evaluation.maxProfit.toLocaleString('pt-BR')}`
                        : evaluation.maxProfit}
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 text-xs text-slate-300 space-y-1">
                    <strong className="text-white block font-sans">Condição de Lucro Máximo:</strong>
                    <p className="text-[11px] leading-relaxed text-slate-300 font-sans">
                      Ocorre com o {ticker} em: <strong className="text-emerald-300">{evaluation.bestCaseRange}</strong> no
                      dia do vencimento.
                    </p>
                  </div>
                </div>

                {/* Worst Case Card */}
                <div className="p-5 rounded-2xl bg-gradient-to-b from-rose-950/30 to-slate-950 border border-rose-500/30 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center gap-1.5">
                      <TrendingDown className="w-3.5 h-3.5" />
                      Cenário Mais Desfavorável (Worst Case)
                    </span>
                    <AlertTriangle className="w-5 h-5 text-rose-400" />
                  </div>

                  <div>
                    <span className="text-xs text-slate-400">Perda Máxima Possível:</span>
                    <div className="text-2xl font-black font-mono text-rose-400 mt-0.5">
                      {typeof evaluation.maxLoss === 'number'
                        ? `R$ ${evaluation.maxLoss.toLocaleString('pt-BR')}`
                        : '⚠️ RISCO INDEFINIDO'}
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 text-xs text-slate-300 space-y-1">
                    <strong className="text-white block font-sans">Condição de Prejuízo Máximo:</strong>
                    <p className="text-[11px] leading-relaxed text-slate-300 font-sans">
                      {evaluation.worstCaseRange}.
                    </p>
                  </div>
                </div>
              </div>

              {/* Break Evens Visual Bar */}
              <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                    <Target className="w-4 h-4 text-sky-400" />
                    <span>Pontos de Equilíbrio (Break-Evens)</span>
                  </span>
                  <span className="text-xs font-mono text-slate-400">Spot Atual: R$ {spotPrice.toFixed(2)}</span>
                </div>

                {evaluation.breakEvens.length > 0 ? (
                  <div className="flex items-center gap-3 flex-wrap font-mono text-xs">
                    {evaluation.breakEvens.map((be, idx) => (
                      <div
                        key={idx}
                        className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center gap-2"
                      >
                        <span className="text-slate-400">BE #{idx + 1}:</span>
                        <span className="font-bold text-sky-400">R$ {be.toFixed(2)}</span>
                        <span className="text-[10px] text-slate-500">
                          ({(((be - spotPrice) / spotPrice) * 100).toFixed(1)}%)
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-slate-400">Nenhum break-even finito detectado nesta estrutura.</div>
                )}
              </div>

              {/* Golden Rules & Protocols */}
              <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-400" />
                  <span>Protocolos de Manejo & Regras de Ouro B3</span>
                </h4>

                <div className="space-y-2">
                  {evaluation.recommendedProtocols.map((prot, idx) => (
                    <div key={idx} className="flex items-start gap-2.5 text-xs text-slate-300">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <span>{prot}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: AI GEMINI B3 REPORT */}
          {activeSubTab === 'ai' && (
            <div className="space-y-4 animate-fadeIn">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Cpu className="w-5 h-5 text-purple-400" />
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                    Parecer Especializado de Risco (IA Gemini & Motor Quantitativo B3)
                  </h3>
                </div>

                <button
                  onClick={handleRunAiAnalysis}
                  disabled={isLoadingAi}
                  className="px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs transition cursor-pointer disabled:opacity-50 flex items-center gap-1.5 shadow-md shadow-purple-950/40"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{isLoadingAi ? 'Analisando...' : 'Reanalisar com IA'}</span>
                </button>
              </div>

              {isLoadingAi ? (
                <div className="p-10 rounded-2xl bg-slate-950 border border-slate-800 text-center space-y-3">
                  <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-xs text-slate-300 font-medium">
                    Avaliando estresse de mercado, regras B3 (Americanas vs Europeias), margem CORE e VIX em 32,77 pts...
                  </p>
                </div>
              ) : aiReport ? (
                <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 text-xs text-slate-300 leading-relaxed whitespace-pre-wrap font-sans space-y-2 max-h-[50vh] overflow-y-auto">
                  {aiReport}
                </div>
              ) : null}
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="p-4 bg-slate-950/90 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-slate-400 text-[11px]">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Convenção B3: 252 dias úteis, precificação com Selic/CDI e margem CORE estocástica.</span>
          </div>

          <div className="flex items-center gap-2">
            {onNavigateToRoll && (
              <button
                onClick={() => {
                  onClose();
                  onNavigateToRoll();
                }}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 font-medium transition cursor-pointer"
              >
                Simular Rolagem
              </button>
            )}

            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition cursor-pointer"
            >
              Concluir Avaliação
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
