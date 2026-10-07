import React, { useState, useMemo, useRef } from 'react';
import {
  VIX_SPECIFICATIONS,
  VIX_HISTORICAL_MILESTONES,
  VIX_FAQ,
  VIX_REGIMES,
  generateVixHistoricalSeries,
  generateVixIntradaySeries,
  calculateExpectedMoves,
  VixHistoricalMilestone,
} from '../data/vixData';
import { STRATEGIES_CATALOG } from '../data/strategiesCatalog';
import { StrategyTemplate } from '../types';
import {
  Activity,
  Gauge,
  TrendingDown,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Info,
  ExternalLink,
  ShieldAlert,
  Flame,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Calculator,
  Sliders,
  Sparkles,
  Zap,
  Globe,
  Layers,
  CheckCircle2,
} from 'lucide-react';

interface IbovespaVixProps {
  spotPrice?: number;
  selectedTicker?: string;
  onSelectStrategy?: (template: StrategyTemplate) => void;
  onNavigateToSimulator?: () => void;
}

export const IbovespaVix: React.FC<IbovespaVixProps> = ({
  spotPrice = 184.2,
  selectedTicker = 'BOVA11',
  onSelectStrategy,
  onNavigateToSimulator,
}) => {
  // Timeframe selector: 1D (Intraday), 1M, 3M, 6M, 1A, 3A, ALL
  const [timeframe, setTimeframe] = useState<'1D' | '1M' | '3M' | '6M' | '1A' | '3A' | 'ALL'>('1A');

  // Chart view mode: 'VIX_ONLY' | 'VIX_VS_IBOV' | 'VIX_VS_US'
  const [chartMode, setChartMode] = useState<'VIX_ONLY' | 'VIX_VS_IBOV' | 'VIX_VS_US'>('VIX_VS_IBOV');

  // Dynamic simulation shift (e.g. user tests shocks: +5 pts, +10 pts, -3 pts)
  const [vixShock, setVixShock] = useState<number>(0);

  // Live simulation tick state
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string>('Agora mesmo');

  // Active accordion FAQ
  const [expandedFaqIndex, setExpandedFaqIndex] = useState<number | null>(0);

  // Selected milestone popup modal or highlight
  const [selectedMilestone, setSelectedMilestone] = useState<VixHistoricalMilestone | null>(null);

  // Expected move custom calculator spot input
  const [calcIbovSpot, setCalcIbovSpot] = useState<number>(138450);

  // Hover state for interactive SVG chart
  const [hoveredPointIndex, setHoveredPointIndex] = useState<number | null>(null);
  const chartSvgRef = useRef<SVGSVGElement>(null);

  // Historical and Intraday datasets
  const rawHistoricalData = useMemo(() => generateVixHistoricalSeries(), []);
  const rawIntradayData = useMemo(() => generateVixIntradaySeries(), []);

  // Filtered dataset according to timeframe
  const chartData = useMemo(() => {
    if (timeframe === '1D') {
      return rawIntradayData.map((d, idx) => ({
        label: d.time,
        vix: Math.max(8, Number((d.vix + vixShock).toFixed(2))),
        ibov: d.ibov - vixShock * 450,
        cboeUsVix: 14.1,
        event: undefined,
        rawIndex: idx,
      }));
    }

    let daysSlice = 365;
    if (timeframe === '1M') daysSlice = 30;
    else if (timeframe === '3M') daysSlice = 90;
    else if (timeframe === '6M') daysSlice = 180;
    else if (timeframe === '1A') daysSlice = 365;
    else if (timeframe === '3A') daysSlice = 365 * 3;
    else if (timeframe === 'ALL') daysSlice = rawHistoricalData.length;

    const sliced = rawHistoricalData.slice(-daysSlice);
    return sliced.map((d, idx) => ({
      label: d.date,
      vix: Math.max(8, Number((d.vix + vixShock).toFixed(2))),
      ibov: d.ibov - vixShock * 450,
      cboeUsVix: d.cboeUsVix,
      event: d.event,
      description: d.description,
      rawIndex: idx,
    }));
  }, [timeframe, rawHistoricalData, rawIntradayData, vixShock]);

  // Active official S&P/B3 IBOVESPA VIX close from 02/10/2026
  const [baseVix, setBaseVix] = useState<number>(32.77);

  // Current values
  const currentVix = Math.max(8, Number((baseVix + vixShock).toFixed(2)));
  const currentIbov = Math.round(132450 - vixShock * 450);
  const currentCboeUs = 19.10;
  const brazilSpread = Number((currentVix - currentCboeUs).toFixed(2));

  // Determine current VIX regime
  const currentRegime = useMemo(() => {
    if (currentVix < 16) return VIX_REGIMES[0];
    if (currentVix <= 22) return VIX_REGIMES[1];
    if (currentVix <= 30) return VIX_REGIMES[2];
    return VIX_REGIMES[3];
  }, [currentVix]);

  // Expected moves calculated
  const expectedMoves = useMemo(() => {
    return calculateExpectedMoves(currentVix, calcIbovSpot);
  }, [currentVix, calcIbovSpot]);

  // Chart Dimensions & Math
  const chartHeight = 360;
  const chartWidth = 920;
  const padding = { top: 35, right: 65, bottom: 45, left: 60 };
  const innerWidth = chartWidth - padding.left - padding.right;
  const innerHeight = chartHeight - padding.top - padding.bottom;

  // Min / Max for VIX scale (left axis)
  const minVix = useMemo(() => {
    const min = Math.min(...chartData.map((d) => d.vix));
    return Math.max(0, Math.floor(min - 2));
  }, [chartData]);

  const maxVix = useMemo(() => {
    const max = Math.max(...chartData.map((d) => d.vix));
    return Math.ceil(max + 3);
  }, [chartData]);

  // Min / Max for Ibovespa scale (right axis)
  const minIbov = useMemo(() => {
    const min = Math.min(...chartData.map((d) => d.ibov));
    return Math.floor(min / 1000) * 1000 - 2000;
  }, [chartData]);

  const maxIbov = useMemo(() => {
    const max = Math.max(...chartData.map((d) => d.ibov));
    return Math.ceil(max / 1000) * 1000 + 2000;
  }, [chartData]);

  // Coordinate scales
  const getX = (index: number) => {
    if (chartData.length <= 1) return padding.left;
    return padding.left + (index / (chartData.length - 1)) * innerWidth;
  };

  const getYVix = (val: number) => {
    const ratio = (val - minVix) / (maxVix - minVix || 1);
    return padding.top + innerHeight - ratio * innerHeight;
  };

  const getYIbov = (val: number) => {
    const ratio = (val - minIbov) / (maxIbov - minIbov || 1);
    return padding.top + innerHeight - ratio * innerHeight;
  };

  // Generate SVG Path for VIX line & area
  const { vixPathD, vixAreaD, ibovPathD } = useMemo(() => {
    if (chartData.length === 0) return { vixPathD: '', vixAreaD: '', ibovPathD: '' };

    let pVix = `M ${getX(0)} ${getYVix(chartData[0].vix)}`;
    let pIbov = `M ${getX(0)} ${getYIbov(chartData[0].ibov)}`;

    for (let i = 1; i < chartData.length; i++) {
      pVix += ` L ${getX(i)} ${getYVix(chartData[i].vix)}`;
      pIbov += ` L ${getX(i)} ${getYIbov(chartData[i].ibov)}`;
    }

    const firstX = getX(0);
    const lastX = getX(chartData.length - 1);
    const bottomY = padding.top + innerHeight;
    const pArea = `${pVix} L ${lastX} ${bottomY} L ${firstX} ${bottomY} Z`;

    return { vixPathD: pVix, vixAreaD: pArea, ibovPathD: pIbov };
  }, [chartData, minVix, maxVix, minIbov, maxIbov]);

  // Handle Chart Mouse Move
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!chartSvgRef.current) return;
    const rect = chartSvgRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const relativeX = (mouseX / rect.width) * chartWidth;

    if (relativeX < padding.left || relativeX > chartWidth - padding.right) {
      setHoveredPointIndex(null);
      return;
    }

    const fraction = (relativeX - padding.left) / innerWidth;
    const idx = Math.round(fraction * (chartData.length - 1));
    if (idx >= 0 && idx < chartData.length) {
      setHoveredPointIndex(idx);
    }
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
      setLastRefreshedAt(new Date().toLocaleTimeString('pt-BR'));
    }, 600);
  };

  const handleLoadStrategy = (strategyId: string) => {
    const template = STRATEGIES_CATALOG.find((s) => s.id === strategyId);
    if (template && onSelectStrategy) {
      onSelectStrategy(template);
    } else if (onNavigateToSimulator) {
      onNavigateToSimulator();
    }
  };

  // Hovered item helper
  const hoveredItem = hoveredPointIndex !== null ? chartData[hoveredPointIndex] : null;

  return (
    <div className="space-y-6 pb-12 animate-fadeIn">
      {/* 1. Header Banner & Live Quote Overview */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900/95 to-slate-950 border border-slate-800 rounded-2xl p-5 shadow-2xl relative overflow-hidden">
        {/* Ambient background glow */}
        <div
          className={`absolute -right-20 -top-20 w-80 h-80 rounded-full blur-3xl opacity-20 pointer-events-none ${
            currentVix > 30 ? 'bg-rose-500' : currentVix > 22 ? 'bg-amber-500' : 'bg-emerald-500'
          }`}
        />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center gap-1.5 shadow-sm">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
                OFICIAL B3 & S&P DJI
              </span>

              <span className="text-xs text-slate-400 font-mono">
                Ticker Oficial: <strong className="text-white">SPB3VIX</strong> (Bloomberg: SPB3VIX | Futuro: VIX)
              </span>

              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <span>•</span>
                <span>Atualizado: {lastRefreshedAt}</span>
              </div>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-2.5">
              <span>S&P/B3 IBOVESPA VIX</span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700">
                Índice do Medo B3
              </span>
            </h1>

            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
              Termômetro oficial de volatilidade implícita esperada para o Ibovespa nos próximos 30 dias corridos.
              Calculado em tempo real pela <strong>B3</strong> em parceria com a <strong>S&P Dow Jones Indices</strong> com base nas opções de compra e venda de IBOV.
            </p>
          </div>

          {/* Big Live Metric Card */}
          <div className="flex items-center gap-3 sm:gap-4 flex-wrap sm:flex-nowrap bg-slate-950/80 p-3.5 rounded-xl border border-slate-800/80 shadow-inner">
            <div className="space-y-1">
              <div className="text-[10px] text-slate-400 uppercase tracking-wider font-bold flex items-center justify-between gap-2">
                <span>Cotação Oficial B3 (Pts / %)</span>
                <span className="text-[9px] px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 font-bold">
                  Fechamento 02/10
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span
                  className={`text-3xl sm:text-4xl font-black font-mono tracking-tight ${
                    currentVix > 30 ? 'text-rose-400' : currentVix > 22 ? 'text-amber-400' : 'text-emerald-400'
                  }`}
                >
                  {currentVix.toFixed(2)}
                </span>
                <span className="text-xs font-semibold text-slate-400">pts</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-400">
                <ArrowUpRight className="w-3.5 h-3.5" />
                <span>+0.38 (+1.17%) Máxima Histórica</span>
              </div>
            </div>

            <div className="h-12 w-[1px] bg-slate-800 hidden sm:block" />

            {/* Current Regime Pill */}
            <div className="space-y-1.5 text-xs">
              <div className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">
                Status do Mercado
              </div>
              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold border text-xs ${currentRegime.badgeClass}`}>
                <Flame className="w-3.5 h-3.5 text-rose-400 animate-pulse" />
                {currentRegime.title.split('(')[0].trim()}
              </span>
              <div className="text-[11px] text-slate-400 font-mono">
                Spread Brasil vs EUA: <strong className="text-rose-400">+{brazilSpread.toFixed(2)} pts</strong>
              </div>
            </div>

            {/* Quick Refresh / Restore Button */}
            <button
              onClick={() => {
                setBaseVix(32.77);
                setVixShock(0);
                handleRefresh();
              }}
              disabled={isRefreshing}
              className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/80 transition cursor-pointer self-center"
              title="Restaurar cotação oficial B3 de 02/10/2026 (32,77 pts)"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-rose-400' : ''}`} />
            </button>
          </div>
        </div>

        {/* Shock Simulation Controller Bar */}
        <div className="mt-4 pt-3.5 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-slate-300">
            <Sliders className="w-3.5 h-3.5 text-purple-400" />
            <span className="font-semibold text-slate-200">Simulador de Estresse de Volatilidade:</span>
            <span className="text-slate-400 hidden sm:inline">Teste como um choque no VIX altera as métricas e o Ibovespa:</span>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => setVixShock(0)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                vixShock === 0 ? 'bg-emerald-500 text-slate-950 font-bold' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              Cotação Real (0)
            </button>
            <button
              onClick={() => setVixShock(5)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                vixShock === 5 ? 'bg-amber-500 text-slate-950 font-bold' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              Choque +5 pts (Alerta)
            </button>
            <button
              onClick={() => setVixShock(12)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                vixShock === 12 ? 'bg-rose-500 text-slate-950 font-bold' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              Choque +12 pts (Crise)
            </button>
            <button
              onClick={() => setVixShock(-3)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                vixShock === -3 ? 'bg-sky-500 text-slate-950 font-bold' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              Queda -3 pts (Calmaria)
            </button>
          </div>
        </div>
      </div>

      {/* 2. Thermometer Visual Gauge & Market Regime Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Visual Gauge Component */}
        <div className="lg:col-span-2 bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Gauge className="w-5 h-5 text-emerald-400" />
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                Termômetro de Risco B3
              </h2>
            </div>
            <span className="text-xs font-mono text-slate-400">
              0 a 80+ pontos
            </span>
          </div>

          {/* Segmented Color Bar Gauge */}
          <div className="space-y-3 py-3">
            <div className="relative h-6 w-full rounded-full overflow-hidden bg-slate-950 flex border border-slate-700/80 shadow-inner">
              <div className="w-[20%] bg-gradient-to-r from-emerald-600 to-emerald-400 h-full relative" title="0 a 16: Baixa Volatilidade" />
              <div className="w-[15%] bg-gradient-to-r from-sky-500 to-cyan-400 h-full relative" title="16 a 22: Média Histórica" />
              <div className="w-[25%] bg-gradient-to-r from-amber-500 to-orange-500 h-full relative" title="22 a 30: Volatilidade Elevada" />
              <div className="w-[40%] bg-gradient-to-r from-rose-600 to-red-500 h-full relative" title="30+: Alta Volatilidade / Pânico" />

              {/* Dynamic Needle Indicator */}
              <div
                className="absolute top-0 bottom-0 w-2.5 bg-white rounded shadow-2xl transition-all duration-500 -ml-1 border border-slate-950 flex items-center justify-center"
                style={{
                  left: `${Math.min(98, Math.max(2, (currentVix / 50) * 100))}%`,
                }}
              >
                <div className="w-1 h-3 bg-slate-950 rounded-sm" />
              </div>
            </div>

            {/* Labels beneath gauge */}
            <div className="flex justify-between text-[10px] text-slate-400 font-mono">
              <span className="text-emerald-400 font-bold">0 pts</span>
              <span>16 pts (Baixa)</span>
              <span className="text-sky-400 font-bold">22 pts (Média)</span>
              <span className="text-amber-400 font-bold">30 pts (Alerta)</span>
              <span className="text-rose-400 font-bold">50+ pts (Pânico)</span>
            </div>
          </div>

          {/* Current Regime Explanation */}
          <div className={`p-3.5 rounded-xl border text-xs space-y-1 ${currentRegime.badgeClass}`}>
            <div className="font-bold flex items-center gap-1.5 text-sm">
              <Flame className="w-4 h-4" />
              <span>Zona Atual: {currentRegime.title}</span>
            </div>
            <p className="text-slate-200 leading-relaxed text-[11px]">
              {currentRegime.description} <strong>Conduta recomendada:</strong> {currentRegime.actionGuidance}
            </p>
          </div>
        </div>

        {/* Key Statistics Cards */}
        <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 flex flex-col justify-between">
            <span className="text-[10px] uppercase font-bold text-slate-400">Mín / Máx 52 Semanas</span>
            <div className="text-sm font-mono font-bold text-rose-400 mt-1">
              14.20 - 32.77
            </div>
            <span className="text-[10px] text-slate-500">Recorde Histórico</span>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 flex flex-col justify-between">
            <span className="text-[10px] uppercase font-bold text-slate-400">Média Histórica B3</span>
            <div className="text-sm font-mono font-bold text-sky-400 mt-1">
              18.60 pts
            </div>
            <span className="text-[10px] text-slate-500">Desde 2011</span>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 flex flex-col justify-between">
            <span className="text-[10px] uppercase font-bold text-slate-400">Correlação c/ Ibov</span>
            <div className="text-sm font-mono font-bold text-rose-400 mt-1">
              -0.74 (Inversa)
            </div>
            <span className="text-[10px] text-slate-500">Bolsa Cai = VIX Sobe</span>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 flex flex-col justify-between">
            <span className="text-[10px] uppercase font-bold text-slate-400">Máxima Histórica</span>
            <div className="text-sm font-mono font-bold text-rose-500 mt-1">
              81.60 pts
            </div>
            <span className="text-[10px] text-slate-500">Covid Mar/2020</span>
          </div>
        </div>
      </div>

      {/* 3. Main Interactive Chart Section */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-2xl space-y-4">
        {/* Chart Header Bar: View Modes & Timeframes */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-400" />
              <h2 className="text-base font-bold text-white tracking-tight">
                Gráfico Histórico & Intradiário do S&P/B3 IBOVESPA VIX
              </h2>
            </div>
            <p className="text-xs text-slate-400">
              Passe o mouse sobre as curvas para inspecionar cotações, variações e eventos históricos.
            </p>
          </div>

          {/* Controls: Chart Mode & Timeframe */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Mode Switcher */}
            <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
              <button
                onClick={() => setChartMode('VIX_ONLY')}
                className={`px-2.5 py-1 rounded-lg font-semibold transition cursor-pointer ${
                  chartMode === 'VIX_ONLY' ? 'bg-emerald-500 text-slate-950 font-bold' : 'text-slate-300 hover:text-white'
                }`}
              >
                Apenas VIX
              </button>
              <button
                onClick={() => setChartMode('VIX_VS_IBOV')}
                className={`px-2.5 py-1 rounded-lg font-semibold transition cursor-pointer ${
                  chartMode === 'VIX_VS_IBOV' ? 'bg-emerald-500 text-slate-950 font-bold' : 'text-slate-300 hover:text-white'
                }`}
              >
                VIX vs Ibovespa
              </button>
              <button
                onClick={() => setChartMode('VIX_VS_US')}
                className={`px-2.5 py-1 rounded-lg font-semibold transition cursor-pointer ${
                  chartMode === 'VIX_VS_US' ? 'bg-emerald-500 text-slate-950 font-bold' : 'text-slate-300 hover:text-white'
                }`}
              >
                VIX Brasil vs EUA
              </button>
            </div>

            {/* Timeframe Switcher */}
            <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-mono">
              {(['1D', '1M', '3M', '6M', '1A', '3A', 'ALL'] as const).map((tf) => (
                <button
                  key={tf}
                  onClick={() => setTimeframe(tf)}
                  className={`px-2 py-1 rounded-lg font-bold transition cursor-pointer ${
                    timeframe === tf ? 'bg-slate-800 text-emerald-400 shadow' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {tf}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Legend & Hover Data Banner */}
        <div className="flex flex-wrap items-center justify-between text-xs py-1 px-3 rounded-xl bg-slate-950/60 border border-slate-800/60 font-mono">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-emerald-400 inline-block shadow-sm shadow-emerald-400" />
              <span className="text-slate-300 font-sans font-semibold">VIX B3:</span>
              <strong className="text-emerald-400 font-mono">
                {hoveredItem ? `${hoveredItem.vix.toFixed(2)} pts` : `${currentVix.toFixed(2)} pts`}
              </strong>
            </div>

            {chartMode === 'VIX_VS_IBOV' && (
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-indigo-400 inline-block shadow-sm shadow-indigo-400" />
                <span className="text-slate-300 font-sans font-semibold">Ibovespa (IBOV):</span>
                <strong className="text-indigo-300 font-mono">
                  {hoveredItem ? `${hoveredItem.ibov.toLocaleString('pt-BR')} pts` : `${currentIbov.toLocaleString('pt-BR')} pts`}
                </strong>
              </div>
            )}

            {chartMode === 'VIX_VS_US' && (
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-purple-400 inline-block shadow-sm shadow-purple-400" />
                <span className="text-slate-300 font-sans font-semibold">Cboe VIX (EUA):</span>
                <strong className="text-purple-300 font-mono">
                  {hoveredItem ? `${hoveredItem.cboeUsVix.toFixed(2)} pts` : `${currentCboeUs.toFixed(2)} pts`}
                </strong>
              </div>
            )}
          </div>

          <div className="text-slate-400 text-[11px] font-sans">
            {hoveredItem ? (
              <span>Data/Hora: <strong className="text-slate-200">{hoveredItem.label}</strong></span>
            ) : (
              <span>Mostrando {chartData.length} registros ({timeframe})</span>
            )}
          </div>
        </div>

        {/* Interactive SVG Chart Container */}
        <div className="relative w-full overflow-hidden select-none bg-slate-950/40 rounded-xl border border-slate-800/40">
          <svg
            ref={chartSvgRef}
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            className="w-full h-auto block cursor-crosshair"
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setHoveredPointIndex(null)}
          >
            <defs>
              <linearGradient id="vixGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#10b981" stopOpacity="0.35" />
                <stop offset="70%" stopColor="#10b981" stopOpacity="0.05" />
                <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
              </linearGradient>

              <linearGradient id="vixStrokeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#34d399" />
                <stop offset="50%" stopColor="#10b981" />
                <stop offset="100%" stopColor="#059669" />
              </linearGradient>
            </defs>

            {/* Horizontal Grid lines (VIX Axis) */}
            {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
              const y = padding.top + innerHeight * ratio;
              const val = maxVix - ratio * (maxVix - minVix);
              const ibovVal = maxIbov - ratio * (maxIbov - minIbov);

              return (
                <g key={ratio}>
                  <line
                    x1={padding.left}
                    y1={y}
                    x2={chartWidth - padding.right}
                    y2={y}
                    stroke="#1e293b"
                    strokeDasharray="4 4"
                  />
                  {/* Left Label (VIX) */}
                  <text
                    x={padding.left - 8}
                    y={y + 4}
                    textAnchor="end"
                    fill="#64748b"
                    fontSize="11"
                    fontFamily="monospace"
                  >
                    {val.toFixed(1)}
                  </text>

                  {/* Right Label (Ibovespa if dual-axis mode) */}
                  {chartMode === 'VIX_VS_IBOV' && (
                    <text
                      x={chartWidth - padding.right + 8}
                      y={y + 4}
                      textAnchor="start"
                      fill="#818cf8"
                      fontSize="10"
                      fontFamily="monospace"
                    >
                      {Math.round(ibovVal).toLocaleString('pt-BR')}
                    </text>
                  )}
                </g>
              );
            })}

            {/* Area Fill for VIX */}
            <path d={vixAreaD} fill="url(#vixGradient)" />

            {/* Ibovespa Line (if mode is VIX_VS_IBOV) */}
            {chartMode === 'VIX_VS_IBOV' && (
              <path
                d={ibovPathD}
                fill="none"
                stroke="#6366f1"
                strokeWidth="2"
                strokeDasharray="3 3"
                opacity="0.85"
              />
            )}

            {/* VIX Main Stroke Line */}
            <path
              d={vixPathD}
              fill="none"
              stroke="url(#vixStrokeGradient)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Historical Milestone Markers on the chart */}
            {chartData.map((d, index) => {
              if (!d.event) return null;
              const cx = getX(index);
              const cy = getYVix(d.vix);

              return (
                <g
                  key={`event-${index}`}
                  className="cursor-pointer"
                  onClick={() => {
                    const match = VIX_HISTORICAL_MILESTONES.find((m) =>
                      d.event?.toLowerCase().includes(m.event.toLowerCase().slice(0, 8))
                    );
                    if (match) setSelectedMilestone(match);
                  }}
                >
                  <circle cx={cx} cy={cy} r="6" fill="#f43f5e" stroke="#ffffff" strokeWidth="2" />
                  <circle cx={cx} cy={cy} r="10" fill="#f43f5e" opacity="0.25" className="animate-ping" />
                  <text
                    x={cx}
                    y={cy - 12}
                    textAnchor="middle"
                    fill="#fda4af"
                    fontSize="9"
                    fontWeight="bold"
                    className="drop-shadow"
                  >
                    📍 {d.event.slice(0, 16)}
                  </text>
                </g>
              );
            })}

            {/* Interactive Crosshair & Hover Tooltip */}
            {hoveredPointIndex !== null && hoveredItem && (
              <g>
                {/* Vertical Crosshair Line */}
                <line
                  x1={getX(hoveredPointIndex)}
                  y1={padding.top}
                  x2={getX(hoveredPointIndex)}
                  y2={padding.top + innerHeight}
                  stroke="#38bdf8"
                  strokeWidth="1.5"
                  strokeDasharray="3 3"
                />

                {/* VIX Target Dot */}
                <circle
                  cx={getX(hoveredPointIndex)}
                  cy={getYVix(hoveredItem.vix)}
                  r="5.5"
                  fill="#10b981"
                  stroke="#ffffff"
                  strokeWidth="2"
                  className="shadow-lg"
                />

                {/* Ibovespa Target Dot */}
                {chartMode === 'VIX_VS_IBOV' && (
                  <circle
                    cx={getX(hoveredPointIndex)}
                    cy={getYIbov(hoveredItem.ibov)}
                    r="4.5"
                    fill="#6366f1"
                    stroke="#ffffff"
                    strokeWidth="1.5"
                  />
                )}
              </g>
            )}
          </svg>
        </div>

        {/* Milestone Detail Popup Card if an event is clicked */}
        {selectedMilestone && (
          <div className="p-4 rounded-xl bg-slate-950 border border-rose-500/40 shadow-xl flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">
                  {selectedMilestone.date}
                </span>
                <strong className="text-sm text-white">{selectedMilestone.event}</strong>
                <span className="text-xs font-mono font-bold text-rose-400">
                  VIX: {selectedMilestone.vixValue} pts ({selectedMilestone.ibovChange})
                </span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                {selectedMilestone.description}
              </p>
            </div>
            <button
              onClick={() => setSelectedMilestone(null)}
              className="text-xs text-slate-400 hover:text-white px-2 py-1 bg-slate-900 rounded border border-slate-800"
            >
              Fechar
            </button>
          </div>
        )}
      </div>

      {/* 4. Expected Move Calculator & Historical Crises Table */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Expected Move Calculator */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calculator className="w-5 h-5 text-sky-400" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Calculadora de Movimento Esperado (Expected Move)
              </h3>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-sky-500/20 text-sky-400 border border-sky-500/30">
              Regra da Raiz do Tempo B3
            </span>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed">
            Como o VIX reflete a volatilidade anualizada, usamos a convenção de dias úteis da B3 (252 DU) para calcular as faixas de oscilação estatística esperada para o Ibovespa (1 desvio padrão = 68,2% de probabilidade):
          </p>

          {/* Spot Ibovespa Input */}
          <div className="flex items-center justify-between gap-4 bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs">
            <span className="text-slate-300 font-semibold">Cotação Base do Ibovespa:</span>
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="500"
                value={calcIbovSpot}
                onChange={(e) => setCalcIbovSpot(Math.max(10000, parseFloat(e.target.value) || 0))}
                className="w-28 bg-slate-900 text-sky-400 font-mono font-bold px-2 py-1 rounded border border-slate-700 text-right focus:outline-none focus:border-sky-500"
              />
              <span className="text-slate-400 font-mono">pts</span>
            </div>
          </div>

          {/* Expected Move Grid */}
          <div className="grid grid-cols-3 gap-3 text-xs">
            {/* Daily Move */}
            <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800/80 space-y-1 text-center">
              <span className="text-[10px] uppercase font-bold text-slate-400">1 Dia Útil</span>
              <div className="text-base font-bold font-mono text-white">
                ±{expectedMoves.daily.percent.toFixed(2)}%
              </div>
              <div className="text-[11px] font-mono text-emerald-400">
                ±{expectedMoves.daily.points.toLocaleString('pt-BR')} pts
              </div>
              <div className="text-[9px] text-slate-400 font-mono pt-1 border-t border-slate-800">
                {expectedMoves.daily.lowerRange.toLocaleString('pt-BR')} - {expectedMoves.daily.upperRange.toLocaleString('pt-BR')}
              </div>
            </div>

            {/* Weekly Move */}
            <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800/80 space-y-1 text-center">
              <span className="text-[10px] uppercase font-bold text-slate-400">1 Semana (5 DU)</span>
              <div className="text-base font-bold font-mono text-white">
                ±{expectedMoves.weekly.percent.toFixed(2)}%
              </div>
              <div className="text-[11px] font-mono text-sky-400">
                ±{expectedMoves.weekly.points.toLocaleString('pt-BR')} pts
              </div>
              <div className="text-[9px] text-slate-400 font-mono pt-1 border-t border-slate-800">
                {expectedMoves.weekly.lowerRange.toLocaleString('pt-BR')} - {expectedMoves.weekly.upperRange.toLocaleString('pt-BR')}
              </div>
            </div>

            {/* Monthly Move (30 dias) */}
            <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800/80 space-y-1 text-center">
              <span className="text-[10px] uppercase font-bold text-slate-400">30 Dias (1 Mês)</span>
              <div className="text-base font-bold font-mono text-white">
                ±{expectedMoves.monthly.percent.toFixed(2)}%
              </div>
              <div className="text-[11px] font-mono text-purple-400">
                ±{expectedMoves.monthly.points.toLocaleString('pt-BR')} pts
              </div>
              <div className="text-[9px] text-slate-400 font-mono pt-1 border-t border-slate-800">
                {expectedMoves.monthly.lowerRange.toLocaleString('pt-BR')} - {expectedMoves.monthly.upperRange.toLocaleString('pt-BR')}
              </div>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/90 border border-slate-800/80 text-[11px] text-slate-300 space-y-1">
            <strong className="text-white flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              Aplicação Prática para Venda de Opções:
            </strong>
            <p>
              Ao montar <strong>Iron Condor</strong> ou <strong>Travas de Crédito</strong> em BOVA11 / Ibovespa, posicionar os strikes vendidos além de 1 desvio padrão (fora de <strong>{expectedMoves.monthly.lowerRange.toLocaleString('pt-BR')}</strong> e <strong>{expectedMoves.monthly.upperRange.toLocaleString('pt-BR')}</strong>) oferece estatisticamente mais de <strong>68,2%</strong> de probabilidade de lucro no vencimento.
            </p>
          </div>
        </div>

        {/* Historical Crises & Extreme Milestones Table */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-rose-400" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Maiores Picos Históricos do VIX B3 (2011 - 2026)
              </h3>
            </div>
            <span className="text-[10px] text-slate-400">Eventos de Estresse</span>
          </div>

          <div className="space-y-2 max-h-80 overflow-y-auto pr-1 no-scrollbar">
            {VIX_HISTORICAL_MILESTONES.map((m, idx) => (
              <div
                key={idx}
                onClick={() => setSelectedMilestone(m)}
                className="p-2.5 rounded-xl bg-slate-950/70 hover:bg-slate-950 border border-slate-800/80 hover:border-slate-700 transition cursor-pointer flex items-center justify-between gap-3 text-xs"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white">{m.event}</span>
                    <span className="text-[10px] font-mono text-slate-400">{m.date}</span>
                  </div>
                  <p className="text-[11px] text-slate-400 line-clamp-1">{m.description}</p>
                </div>

                <div className="text-right shrink-0">
                  <div className="font-mono font-black text-rose-400 text-sm">
                    {m.vixValue.toFixed(1)} pts
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono">{m.ibovChange}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 5. Recommended Strategies for Current Regime */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-emerald-400" />
              <h3 className="text-base font-bold text-white tracking-tight">
                Estratégias Recomendadas para o Regime Atual ({currentRegime.title.split('(')[0].trim()})
              </h3>
            </div>
            <p className="text-xs text-slate-400">
              Derivadas das melhores práticas de mercado na B3 para a faixa atual de {currentVix.toFixed(2)} pontos.
            </p>
          </div>

          <span className={`px-3 py-1 rounded-xl text-xs font-bold border ${currentRegime.badgeClass}`}>
            VIX: {currentVix.toFixed(2)} pts
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {currentRegime.strategies.map((strat, idx) => (
            <div
              key={idx}
              className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-col justify-between space-y-3 hover:border-emerald-500/50 transition shadow"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-slate-900 text-slate-300 border border-slate-800">
                    {strat.bias === 'ALTA_VOL' ? 'Venda de Vol' : strat.bias === 'BAIXA_VOL' ? 'Compra de Vol' : 'Neutro / Renda'}
                  </span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                </div>

                <h4 className="text-sm font-bold text-white">{strat.name}</h4>
                <p className="text-xs text-slate-400 leading-relaxed">{strat.description}</p>

                <div className="space-y-1 pt-2 border-t border-slate-800/80 text-[11px]">
                  <div className="text-emerald-400 font-medium">
                    <strong>Por que funciona:</strong> {strat.whyItWorks}
                  </div>
                  <div className="text-amber-400/90">
                    <strong>Margem B3 CORE:</strong> {strat.b3MarginImpact}
                  </div>
                </div>
              </div>

              <button
                onClick={() => handleLoadStrategy(strat.strategyId)}
                className="w-full mt-2 py-2 px-3 rounded-lg bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white border border-emerald-500/40 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>Simular Estrutura no App</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* 6. Technical Specifications & Methodology (S&P DJI & B3) */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Info className="w-5 h-5 text-purple-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Especificações Técnicas e Metodologia Oficial
            </h3>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <a
              href={VIX_SPECIFICATIONS.b3Url}
              target="_blank"
              rel="noreferrer"
              className="text-emerald-400 hover:underline flex items-center gap-1"
            >
              <span>Site B3</span>
              <ExternalLink className="w-3 h-3" />
            </a>
            <span>•</span>
            <a
              href={VIX_SPECIFICATIONS.spGlobalUrl}
              target="_blank"
              rel="noreferrer"
              className="text-purple-400 hover:underline flex items-center gap-1"
            >
              <span>S&P DJI Overview</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80 space-y-1">
            <span className="text-slate-400 text-[10px] uppercase font-bold">Fórmula de Cálculo</span>
            <div className="text-slate-200 font-semibold">Model-Free Implied Volatility</div>
            <p className="text-[11px] text-slate-400">
              Não depende de Black-Scholes para o agregado; integra os preços médios (bid-ask) de opções OTM de compra e venda.
            </p>
          </div>

          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80 space-y-1">
            <span className="text-slate-400 text-[10px] uppercase font-bold">Horizonte Temporal</span>
            <div className="text-slate-200 font-semibold">30 Dias Corridos Constantes</div>
            <p className="text-[11px] text-slate-400">
              Interpolação ponderada entre a série de curto prazo e a série seguinte para manter prazo fixo de 30 dias.
            </p>
          </div>

          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80 space-y-1">
            <span className="text-slate-400 text-[10px] uppercase font-bold">Regra de Rolagem B3</span>
            <div className="text-slate-200 font-semibold">Corte em 6 Dias Úteis</div>
            <p className="text-[11px] text-slate-400">
              Quando a primeira série tem menos de 6 dias úteis para expirar, o cálculo rola automaticamente para evitar ruído.
            </p>
          </div>

          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80 space-y-1">
            <span className="text-slate-400 text-[10px] uppercase font-bold">Filtros de Estabilidade (2026)</span>
            <div className="text-slate-200 font-semibold">Piso de 5% & 8 Ciclos (2 min)</div>
            <p className="text-[11px] text-slate-400">
              Mecanismos automáticos da S&P Dow Jones para suavizar picos atípicos decorrentes de spreads anômalos.
            </p>
          </div>

          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80 space-y-1">
            <span className="text-slate-400 text-[10px] uppercase font-bold">Contratos Futuros na B3</span>
            <div className="text-slate-200 font-semibold">Código: VIX / VXBR</div>
            <p className="text-[11px] text-slate-400">
              Permite a negociação direta de volatilidade no mercado futuro da B3 para hedge de cauda e diversificação.
            </p>
          </div>

          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80 space-y-1">
            <span className="text-slate-400 text-[10px] uppercase font-bold">Taxa Livre de Risco Utilizada</span>
            <div className="text-slate-200 font-semibold">Curva de Juros DI / Selic B3</div>
            <p className="text-[11px] text-slate-400">
              Taxa de juros oficial correspondente às datas de vencimento obtida diretamente da B3.
            </p>
          </div>
        </div>
      </div>

      {/* 7. Official FAQ Accordion Section */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
          <HelpCircle className="w-5 h-5 text-amber-400" />
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">
            Perguntas Frequentes Oficiais (FAQ B3 & S&P Dow Jones)
          </h3>
        </div>

        <div className="space-y-2">
          {VIX_FAQ.map((faq, index) => {
            const isExpanded = expandedFaqIndex === index;
            return (
              <div
                key={index}
                className="rounded-xl border border-slate-800 bg-slate-950/70 overflow-hidden transition"
              >
                <button
                  onClick={() => setExpandedFaqIndex(isExpanded ? null : index)}
                  className="w-full p-3.5 text-left flex items-center justify-between gap-3 text-xs sm:text-sm font-bold text-slate-200 hover:text-white transition cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <span className="text-emerald-400 font-mono">{index + 1}.</span>
                    <span>{faq.question}</span>
                  </span>
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" />
                  )}
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 pt-1 text-xs text-slate-300 leading-relaxed border-t border-slate-800/60 bg-slate-950">
                    <p>{faq.answer}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 8. Official Links & Disclaimers Footer Bar */}
      <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
        <div className="flex items-center gap-2 text-center sm:text-left">
          <Globe className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>
            Fontes Oficiais: B3 Brasil, Bolsa, Balcão & S&P Dow Jones Indices LLC. Marca licenciada pela Cboe.
          </span>
        </div>

        <div className="flex items-center gap-3">
          <a
            href="https://content.b3.com.br/ibovespa-vix/"
            target="_blank"
            rel="noreferrer"
            className="px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white border border-emerald-500/30 transition text-xs font-semibold flex items-center gap-1.5"
          >
            <span>Portal Oficial B3</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
          <a
            href="https://www.spglobal.com/spdji/pt/indices/indicators/sp-b3-ibovespa-vix/#overview"
            target="_blank"
            rel="noreferrer"
            className="px-3 py-1.5 rounded-lg bg-purple-600/20 hover:bg-purple-600 text-purple-400 hover:text-white border border-purple-500/30 transition text-xs font-semibold flex items-center gap-1.5"
          >
            <span>Portal S&P Global</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    </div>
  );
};
