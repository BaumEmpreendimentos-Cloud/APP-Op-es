import React, { useState } from 'react';
import { IBOVESPA_ASSETS } from '../data/ibovAssets';
import { OpLabQuote } from '../utils/oplabApi';
import { useAuth } from '../contexts/AuthContext';
import {
  TrendingUp,
  BookOpen,
  Layers,
  RefreshCw,
  Cpu,
  Calendar,
  CheckCircle2,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  User,
  Shield,
} from 'lucide-react';

interface HeaderProps {
  activeTab: 'simulator' | 'catalog' | 'scenarios' | 'roll' | 'academy';
  setActiveTab: (tab: 'simulator' | 'catalog' | 'scenarios' | 'roll' | 'academy') => void;
  selectedTicker: string;
  setSelectedTicker: (ticker: string) => void;
  spotPrice: number;
  setSpotPrice: (price: number) => void;
  interestRate: number;
  setInterestRate: (rate: number) => void;
  iv: number;
  setIv: (iv: number) => void;
  isFetchingQuote?: boolean;
  liveQuoteData?: OpLabQuote | null;
  onRefreshQuote?: () => void;
  onTickerChange?: (ticker: string) => void;
  onOpenAuthModal?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  selectedTicker,
  setSelectedTicker,
  spotPrice,
  setSpotPrice,
  interestRate,
  setInterestRate,
  iv,
  setIv,
  isFetchingQuote = false,
  liveQuoteData = null,
  onRefreshQuote,
  onTickerChange,
  onOpenAuthModal,
}) => {
  const { user } = useAuth();
  const [customTickerInput, setCustomTickerInput] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);

  const handleTickerSelect = (ticker: string) => {
    if (ticker === 'CUSTOM') {
      setShowCustomInput(true);
      return;
    }
    setShowCustomInput(false);
    if (onTickerChange) {
      onTickerChange(ticker);
    } else {
      setSelectedTicker(ticker);
      const asset = IBOVESPA_ASSETS.find((a) => a.ticker === ticker);
      if (asset) {
        setSpotPrice(asset.spotPrice);
        setIv(asset.ivCurrent);
      }
    }
  };

  const handleCustomTickerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = customTickerInput.trim().toUpperCase();
    if (!clean) return;
    if (onTickerChange) {
      onTickerChange(clean);
    } else {
      setSelectedTicker(clean);
    }
    setShowCustomInput(false);
  };

  const isPriceDifferentFromMarket =
    liveQuoteData &&
    liveQuoteData.close > 0 &&
    Math.abs(spotPrice - liveQuoteData.close) > 0.04;

  const formattedTime = liveQuoteData?.time
    ? new Date(liveQuoteData.time).toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : null;

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-xl shadow-lg">
      {/* Top Brand & Quick Market Status */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row items-center justify-between py-3 gap-3">
          {/* Logo & Platform Title */}
          <div className="flex items-center gap-3 w-full lg:w-auto justify-between lg:justify-start">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 via-teal-500 to-sky-500 flex items-center justify-center shadow-lg shadow-emerald-500/20 text-white font-black text-xl">
                θ
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-base sm:text-lg font-black tracking-tight text-white flex items-center gap-1.5">
                    OPÇÕES <span className="text-emerald-400">B3</span>
                  </h1>
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase tracking-wider flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Mercado B3
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Live Quote Badge on Mobile */}
            {liveQuoteData && (
              <div className="flex items-center gap-1.5 lg:hidden">
                <span className="text-xs font-mono font-bold text-white">
                  R$ {spotPrice.toFixed(2)}
                </span>
                {liveQuoteData.variation !== undefined && (
                  <span
                    className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                      liveQuoteData.variation >= 0
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'bg-rose-500/20 text-rose-400'
                    }`}
                  >
                    {liveQuoteData.variation >= 0 ? '+' : ''}
                    {liveQuoteData.variation.toFixed(2)}%
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Asset & Parameters Bar */}
          <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto justify-start lg:justify-end">
            {/* Ticker Selector */}
            <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-xl p-1 text-xs shadow-inner">
              <span className="text-slate-400 font-semibold px-2">Ativo:</span>
              {!showCustomInput ? (
                <div className="flex items-center gap-1">
                  <select
                    id="header-ticker-select"
                    aria-label="Selecionar Ativo da B3"
                    value={selectedTicker}
                    onChange={(e) => handleTickerSelect(e.target.value)}
                    className="bg-slate-950 text-white font-bold font-mono px-2.5 py-1.5 rounded-lg border border-slate-700/80 focus:outline-none focus:border-emerald-500 cursor-pointer"
                  >
                    {IBOVESPA_ASSETS.map((a) => (
                      <option key={a.ticker} value={a.ticker}>
                        {a.ticker} - {a.companyName}
                      </option>
                    ))}
                    <option value="CUSTOM">+ Outro Ativo B3...</option>
                  </select>
                </div>
              ) : (
                <form onSubmit={handleCustomTickerSubmit} className="flex items-center gap-1">
                  <input
                    id="header-custom-ticker-input"
                    type="text"
                    placeholder="Ex: B3SA3"
                    value={customTickerInput}
                    onChange={(e) => setCustomTickerInput(e.target.value.toUpperCase())}
                    className="w-24 bg-slate-950 text-emerald-400 font-mono font-bold px-2 py-1 rounded-lg border border-emerald-500 text-xs focus:outline-none uppercase"
                    autoFocus
                  />
                  <button
                    type="submit"
                    className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-xs"
                  >
                    OK
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCustomInput(false)}
                    className="px-1.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-400 text-xs rounded-lg"
                  >
                    ✕
                  </button>
                </form>
              )}
            </div>

            {/* Market Variation & Status Tag */}
            {liveQuoteData && (
              <div
                className="hidden sm:flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs shadow-inner"
                title={`Última cotação de mercado recebida às ${formattedTime || 'agora'}`}
              >
                <span className="flex items-center gap-1 text-[11px] font-semibold text-slate-300">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      isFetchingQuote ? 'bg-amber-400 animate-ping' : 'bg-emerald-400 animate-pulse'
                    }`}
                  />
                  <span className="text-slate-400 font-mono text-[10px]">Mercado</span>
                </span>
                {liveQuoteData.variation !== undefined && (
                  <span
                    className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[11px] font-bold font-mono ${
                      liveQuoteData.variation >= 0
                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                        : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                    }`}
                  >
                    {liveQuoteData.variation >= 0 ? (
                      <ArrowUpRight className="w-3 h-3 text-emerald-400" />
                    ) : (
                      <ArrowDownRight className="w-3 h-3 text-rose-400" />
                    )}
                    {liveQuoteData.variation >= 0 ? '+' : ''}
                    {liveQuoteData.variation.toFixed(2)}%
                  </span>
                )}
              </div>
            )}

            {/* Spot Price Input with Real-time Refresh Button */}
            <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1 text-xs shadow-inner">
              <span className="text-slate-400 font-semibold">Spot:</span>
              <span className="text-slate-500 font-mono">R$</span>
              <input
                id="header-spot-price-input"
                aria-label="Preço Spot do Ativo"
                type="number"
                step="0.05"
                value={spotPrice}
                onChange={(e) => setSpotPrice(Math.max(0.1, parseFloat(e.target.value) || 0))}
                className="w-20 bg-slate-950 text-emerald-400 font-mono font-bold px-1.5 py-1 rounded border border-slate-700/80 focus:outline-none focus:border-emerald-500 text-center"
              />

              {/* Botão de Atualização Instantânea */}
              <button
                id="header-refresh-quote-btn"
                onClick={onRefreshQuote}
                disabled={isFetchingQuote}
                title="Buscar cotação em tempo real deste ativo"
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white border border-emerald-500/30 transition text-xs font-semibold cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isFetchingQuote ? 'animate-spin text-amber-400' : ''}`} />
                <span className="hidden xl:inline text-[11px]">
                  {isFetchingQuote ? 'Buscando...' : 'Atualizar Cotação'}
                </span>
              </button>
            </div>

            {/* Quick button to restore to actual market price if user typed custom hypothetical spot */}
            {isPriceDifferentFromMarket && (
              <button
                id="header-restore-market-price-btn"
                onClick={() => setSpotPrice(liveQuoteData!.close)}
                title="Restaurar simulação para a cotação oficial do mercado"
                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-500/15 text-amber-400 hover:bg-amber-500/25 border border-amber-500/30 text-[11px] font-mono font-semibold transition cursor-pointer"
              >
                <span>Usar Mercado: R$ {liveQuoteData!.close.toFixed(2)}</span>
              </button>
            )}

            {/* Implied Volatility (IV) */}
            <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1 text-xs shadow-inner">
              <span className="text-slate-400">IV:</span>
              <input
                id="header-iv-input"
                aria-label="Volatilidade Implícita (IV)"
                type="number"
                step="1"
                min="5"
                max="200"
                value={Math.round(iv * 100)}
                onChange={(e) => setIv((parseFloat(e.target.value) || 28) / 100)}
                className="w-14 bg-slate-950 text-amber-400 font-mono font-bold px-1.5 py-1 rounded border border-slate-700/80 focus:outline-none focus:border-amber-500 text-center"
              />
              <span className="text-slate-400 font-mono">%</span>
            </div>

            {/* Selic Rate Input */}
            <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1 text-xs hidden lg:flex shadow-inner">
              <span className="text-slate-400">Selic:</span>
              <input
                id="header-selic-input"
                aria-label="Taxa Selic Anual"
                type="number"
                step="0.25"
                min="2"
                max="25"
                value={(interestRate * 100).toFixed(2)}
                onChange={(e) => setInterestRate((parseFloat(e.target.value) || 13.25) / 100)}
                className="w-16 bg-slate-950 text-sky-400 font-mono font-bold px-1.5 py-1 rounded border border-slate-700/80 focus:outline-none focus:border-sky-500 text-center"
              />
              <span className="text-slate-400 font-mono">%</span>
            </div>

            {/* Account Button */}
            <button
              id="header-auth-btn"
              onClick={onOpenAuthModal}
              className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 border border-slate-700/80 hover:border-emerald-500/60 rounded-xl px-2.5 py-1.5 text-xs text-white transition cursor-pointer shadow-inner ml-1"
              title="Acessar conta ou fazer login"
            >
              <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center text-slate-950 font-black text-[11px] shadow">
                {user ? user.name.charAt(0).toUpperCase() : <User className="w-3.5 h-3.5 text-slate-950" />}
              </div>
              <div className="flex flex-col text-left leading-tight hidden sm:flex">
                <span className="font-bold text-[11px] text-white truncate max-w-[110px]">
                  {user ? user.name.split(' ')[0] : 'Entrar'}
                </span>
                <span className="text-[9px] text-emerald-400 font-medium">
                  {user ? 'Conectado' : 'Login / Cadastro'}
                </span>
              </div>
            </button>
          </div>
        </div>

        {/* Live Market Intraday Strip (if quote data is available) */}
        {liveQuoteData && (liveQuoteData.high || liveQuoteData.volume) && (
          <div className="hidden md:flex items-center justify-between py-1.5 px-3 mb-2 rounded-lg bg-slate-900/60 border border-slate-800/60 text-[11px] font-mono text-slate-400">
            <div className="flex items-center gap-4 flex-wrap">
              <span className="flex items-center gap-1 text-slate-300">
                <span className="text-slate-500 font-sans">Ativo:</span>
                <strong className="text-white font-bold">{selectedTicker}</strong>
              </span>
              {liveQuoteData.open !== undefined && (
                <span>
                  <span className="text-slate-500 font-sans">Abertura:</span>{' '}
                  <span className="text-slate-200">R$ {liveQuoteData.open.toFixed(2)}</span>
                </span>
              )}
              {liveQuoteData.low !== undefined && liveQuoteData.high !== undefined && (
                <span>
                  <span className="text-slate-500 font-sans">Mín / Máx Dia:</span>{' '}
                  <span className="text-slate-200">
                    R$ {liveQuoteData.low.toFixed(2)} - R$ {liveQuoteData.high.toFixed(2)}
                  </span>
                </span>
              )}
              {liveQuoteData.bid !== undefined && liveQuoteData.ask !== undefined && liveQuoteData.bid > 0 && (
                <span>
                  <span className="text-slate-500 font-sans">Book:</span>{' '}
                  <span className="text-emerald-400">R$ {liveQuoteData.bid.toFixed(2)}</span> /{' '}
                  <span className="text-rose-400">R$ {liveQuoteData.ask.toFixed(2)}</span>
                </span>
              )}
              {(liveQuoteData.financial_volume || liveQuoteData.financialVolume) && (
                <span>
                  <span className="text-slate-500 font-sans">Volume Financeiro:</span>{' '}
                  <span className="text-slate-200">
                    R${' '}
                    {(
                      ((liveQuoteData.financial_volume || liveQuoteData.financialVolume || 0) /
                        1000000)
                    ).toFixed(1)}
                    M
                  </span>
                </span>
              )}
            </div>
            {formattedTime && (
              <span className="text-[10px] text-slate-500 font-sans flex items-center gap-1">
                Sincronizado às <strong className="text-slate-400">{formattedTime}</strong>
              </span>
            )}
          </div>
        )}

        {/* Navigation Tabs Bar */}
        <nav className="flex items-center gap-1 sm:gap-2 overflow-x-auto py-2 border-t border-slate-800/60 no-scrollbar">
          {/* 1. Acompanhamento & Rolagem */}
          <button
            id="tab-btn-roll"
            onClick={() => setActiveTab('roll')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'roll'
                ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/25 font-bold'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>Acompanhamento & Rolagem</span>
          </button>

          {/* 2. Simulador & Payoff */}
          <button
            id="tab-btn-simulator"
            onClick={() => setActiveTab('simulator')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'simulator'
                ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/25 font-bold'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            <span>Simulador & Payoff</span>
          </button>

          {/* 3. Cenários B3 & AI Stress-Test */}
          <button
            id="tab-btn-scenarios"
            onClick={() => setActiveTab('scenarios')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'scenarios'
                ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/25 font-bold'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Cpu className="w-4 h-4 text-purple-400" />
            <span>Cenários B3 & AI Stress-Test</span>
          </button>

          {/* 4. Catálogo de Estratégias */}
          <button
            id="tab-btn-catalog"
            onClick={() => setActiveTab('catalog')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'catalog'
                ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/25 font-bold'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Catálogo de Estratégias (28+)</span>
          </button>

          {/* 5. Opções ACADEMY */}
          <button
            id="tab-btn-academy"
            onClick={() => setActiveTab('academy')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'academy'
                ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/25 font-bold'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <BookOpen className="w-4 h-4 text-amber-400" />
            <span>Opções ACADEMY</span>
          </button>
        </nav>
      </div>
    </header>
  );
};
