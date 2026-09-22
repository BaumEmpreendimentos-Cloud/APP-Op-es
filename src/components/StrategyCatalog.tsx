import React, { useState, useMemo } from 'react';
import { STRATEGIES_CATALOG } from '../data/strategiesCatalog';
import { StrategyTemplate, StrategyCategory, MarketSentiment } from '../types';
import { Search, Layers, Play, CheckCircle2, AlertTriangle, ShieldCheck, ArrowRight, X } from 'lucide-react';

interface StrategyCatalogProps {
  spotPrice: number;
  ticker: string;
  onSelectStrategy: (strategy: StrategyTemplate) => void;
}

export const StrategyCatalog: React.FC<StrategyCatalogProps> = ({
  spotPrice,
  ticker,
  onSelectStrategy,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedSentiment, setSelectedSentiment] = useState<string>('ALL');
  const [selectedStrategyModal, setSelectedStrategyModal] = useState<StrategyTemplate | null>(null);

  const categories = [
    { id: 'ALL', label: 'Todas as Estratégias' },
    { id: 'RENDA_E_COBERTURA', label: 'Renda & Cobertura' },
    { id: 'TRAVAS_DIRECIONAIS', label: 'Travas Direcionais' },
    { id: 'MERCADO_LATERAL_THETA', label: 'Mercado Lateral & Theta' },
    { id: 'VOLATILIDADE_EXPLOSIVA', label: 'Volatilidade Explosiva' },
    { id: 'ESTRUTURAS_TEMPORAIS', label: 'Estruturas Temporais' },
    { id: 'ASSIMETRICAS_E_RATIOS', label: 'Assimétricas & Ratios' },
    { id: 'PROTECAO_E_HEDGE', label: 'Proteção & Hedge' },
  ];

  const filteredStrategies = useMemo(() => {
    return STRATEGIES_CATALOG.filter((strat) => {
      const matchSearch =
        strat.namePt.toLowerCase().includes(searchTerm.toLowerCase()) ||
        strat.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        strat.shortDescription.toLowerCase().includes(searchTerm.toLowerCase());

      const matchCat = selectedCategory === 'ALL' || strat.category === selectedCategory;
      const matchSent = selectedSentiment === 'ALL' || strat.sentiment === selectedSentiment;

      return matchSearch && matchCat && matchSent;
    });
  }, [searchTerm, selectedCategory, selectedSentiment]);

  return (
    <div id="strategy-catalog" className="space-y-6 pb-12">
      {/* Search and Category Filters */}
      <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl space-y-4">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-black text-white flex items-center gap-2">
              <Layers className="w-5 h-5 text-emerald-400" />
              <span>Catálogo Completo de Estratégias B3</span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-mono border border-emerald-500/20">
                {STRATEGIES_CATALOG.length} Estruturas
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Maior catálogo de estratégias de opções adaptado às peculiaridades da B3 (estilo de exercício, Selic e margem CORE).
            </p>
          </div>

          {/* Search Input */}
          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por nome, trava, ratio..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`text-xs px-3 py-1.5 rounded-xl font-medium whitespace-nowrap transition cursor-pointer ${
                selectedCategory === cat.id
                  ? 'bg-emerald-500 text-slate-950 font-bold shadow-md shadow-emerald-500/20'
                  : 'bg-slate-950 text-slate-300 border border-slate-800 hover:bg-slate-800'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Sentiment Filter */}
        <div className="flex items-center gap-2 text-xs text-slate-400 pt-1 border-t border-slate-800/60">
          <span className="font-semibold text-slate-300">Viés de Mercado:</span>
          {['ALL', 'BULLISH', 'BEARISH', 'NEUTRAL', 'VOLATILE'].map((sent) => (
            <button
              key={sent}
              onClick={() => setSelectedSentiment(sent)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer ${
                selectedSentiment === sent
                  ? 'bg-slate-700 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {sent === 'ALL'
                ? 'Todos'
                : sent === 'BULLISH'
                ? '🟢 Alta'
                : sent === 'BEARISH'
                ? '🔴 Baixa'
                : sent === 'NEUTRAL'
                ? '⚪ Neutro / Lateral'
                : '🟣 Volatilidade'}
            </button>
          ))}
        </div>
      </div>

      {/* Strategies Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredStrategies.map((strat) => (
          <div
            key={strat.id}
            className="flex flex-col justify-between rounded-2xl bg-slate-900/90 border border-slate-800/90 p-4 hover:border-slate-700 transition shadow-lg group"
          >
            <div className="space-y-3">
              {/* Header Badges */}
              <div className="flex items-center justify-between gap-2">
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                    strat.sentiment === 'BULLISH'
                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                      : strat.sentiment === 'BEARISH'
                      ? 'bg-rose-500/15 text-rose-400 border border-rose-500/20'
                      : strat.sentiment === 'NEUTRAL'
                      ? 'bg-sky-500/15 text-sky-400 border border-sky-500/20'
                      : 'bg-purple-500/15 text-purple-400 border border-purple-500/20'
                  }`}
                >
                  {strat.sentiment === 'BULLISH'
                    ? 'Alta (Bullish)'
                    : strat.sentiment === 'BEARISH'
                    ? 'Baixa (Bearish)'
                    : strat.sentiment === 'NEUTRAL'
                    ? 'Neutro / Theta'
                    : 'Explosão / Vol'}
                </span>

                <span className="text-[10px] text-slate-400 font-mono font-medium">
                  {strat.difficulty}
                </span>
              </div>

              {/* Title & Short Desc */}
              <div>
                <h3 className="text-sm font-bold text-white group-hover:text-emerald-400 transition leading-snug">
                  {strat.namePt}
                </h3>
                <span className="text-[11px] font-mono text-slate-400">{strat.name}</span>
                <p className="text-xs text-slate-300 mt-2 line-clamp-3 leading-relaxed">
                  {strat.shortDescription}
                </p>
              </div>

              {/* Metrics Box */}
              <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800/80 space-y-1.5 text-[11px]">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Lucro Máximo:</span>
                  <span className="text-emerald-400 font-semibold font-mono truncate max-w-[170px] text-right">
                    {strat.maxProfit}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Risco Máximo:</span>
                  <span className="text-rose-400 font-semibold font-mono truncate max-w-[170px] text-right">
                    {strat.maxLoss}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">IV Ideal:</span>
                  <span className="text-amber-400 font-mono font-medium">{strat.idealIV}</span>
                </div>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="flex items-center gap-2 pt-4 mt-2 border-t border-slate-800/60">
              <button
                onClick={() => setSelectedStrategyModal(strat)}
                className="flex-1 py-1.5 px-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition text-center cursor-pointer"
              >
                Detalhes & Dicas B3
              </button>

              <button
                onClick={() => onSelectStrategy(strat)}
                className="py-1.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center gap-1 cursor-pointer shadow-md shadow-emerald-600/20"
                title={`Carregar ${strat.namePt} com ${ticker} a R$ ${spotPrice.toFixed(2)}`}
              >
                <Play className="w-3 h-3 fill-white" />
                <span>Simular</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal with Detailed Strategy Guide */}
      {selectedStrategyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-2xl w-full space-y-4 shadow-2xl relative my-8">
            <button
              onClick={() => setSelectedStrategyModal(null)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-1">
              <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                Guia Estratégico B3
              </span>
              <h3 className="text-xl font-black text-white">
                {selectedStrategyModal.namePt}
              </h3>
              <p className="text-xs font-mono text-slate-400">
                {selectedStrategyModal.name} | Perfil: {selectedStrategyModal.difficulty}
              </p>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed bg-slate-950 p-3.5 rounded-xl border border-slate-800">
              {selectedStrategyModal.detailedDescription}
            </p>

            {/* Risk / Reward Box */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-slate-400 font-semibold block mb-1">Lucro Máximo:</span>
                <span className="text-emerald-400 font-medium leading-relaxed block">
                  {selectedStrategyModal.maxProfit}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-slate-400 font-semibold block mb-1">Risco Máximo:</span>
                <span className="text-rose-400 font-medium leading-relaxed block">
                  {selectedStrategyModal.maxLoss}
                </span>
              </div>
            </div>

            {/* B3 Margin info */}
            <div className="p-3.5 rounded-xl bg-amber-950/20 border border-amber-800/40 text-xs space-y-1">
              <span className="font-bold text-amber-400 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4" />
                <span>Exigência de Margem no Sistema CORE B3</span>
              </span>
              <p className="text-slate-300 leading-relaxed">
                {selectedStrategyModal.marginRequirementB3}
              </p>
            </div>

            {/* Practical B3 Tips */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-white uppercase tracking-wider block">
                Dicas Práticas para o Mercado Brasileiro (B3):
              </span>
              <div className="space-y-1.5">
                {selectedStrategyModal.b3PracticalTips.map((tip, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-slate-300">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
                    <span>{tip}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                onClick={() => setSelectedStrategyModal(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:bg-slate-800 transition cursor-pointer"
              >
                Fechar
              </button>
              <button
                onClick={() => {
                  onSelectStrategy(selectedStrategyModal);
                  setSelectedStrategyModal(null);
                }}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition flex items-center gap-1.5 shadow-lg shadow-emerald-600/30 cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 fill-white" />
                <span>Carregar e Simular no Gráfico</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
