import React, { useState } from 'react';
import { OptionLeg } from '../types';
import { calculateStrategyPayoff, calculateBlackScholes } from '../utils/blackScholes';
import { Cpu, AlertTriangle, Sparkles, TrendingUp, TrendingDown, ShieldAlert, ArrowRight, Loader2, CheckCircle2 } from 'lucide-react';

interface ScenarioAnalysisProps {
  legs: OptionLeg[];
  spotPrice: number;
  ticker: string;
  iv: number;
  interestRate: number;
  onNavigateToRoll: () => void;
}

export const ScenarioAnalysis: React.FC<ScenarioAnalysisProps> = ({
  legs,
  spotPrice,
  ticker,
  iv,
  interestRate,
  onNavigateToRoll,
}) => {
  const [ivShock, setIvShock] = useState(0); // in percentage points, e.g. -5 to +15
  const [customScenarioPrompt, setCustomScenarioPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<{
    executiveSummary: string;
    estimatedPnLImpact: string;
    b3MarginRisk: string;
    recommendedActions: string[];
  } | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  // Price shock points (-20% to +20%)
  const percentageSteps = [-20, -15, -10, -5, 0, 5, 10, 15, 20];

  // Helper to compute P&L at simulated spot price and remaining days
  const computePnLAtScenario = (priceMultiplier: number, daysRemaining: number) => {
    const simSpot = spotPrice * (1 + priceMultiplier / 100);
    const simIv = Math.max(0.05, iv + ivShock / 100);

    // Initial cashflow
    let initialNet = 0;
    legs.forEach((leg) => {
      const mult = leg.side === 'BUY' ? -1 : 1;
      initialNet += mult * leg.premium * leg.quantity;
    });

    if (daysRemaining <= 0) {
      // Expiry Payoff
      const { netProfitLoss } = calculateStrategyPayoff(legs, simSpot);
      return netProfitLoss;
    }

    // Theoretical BS P&L at daysRemaining
    let simValue = 0;
    legs.forEach((leg) => {
      const mult = leg.side === 'BUY' ? 1 : -1;
      if (leg.type === 'STOCK') {
        simValue += mult * (simSpot - leg.strike) * leg.quantity;
      } else {
        const bs = calculateBlackScholes(
          simSpot,
          leg.strike,
          daysRemaining / 252,
          simIv,
          interestRate,
          leg.type,
          leg.exerciseStyle
        );
        simValue += mult * bs.price * leg.quantity;
      }
    });

    return initialNet + simValue;
  };

  // AI Stress-Test trigger
  const handleTriggerAiScenario = async (scenarioText: string) => {
    setAiLoading(true);
    setAiError(null);
    try {
      const res = await fetch('/api/gemini/analyze-scenario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticker,
          spotPrice,
          scenarioDescription: scenarioText,
          legs,
          interestRate,
          iv,
        }),
      });

      if (!res.ok) {
        throw new Error('Falha ao processar análise com IA');
      }

      const data = await res.json();
      setAiAnalysis(data.analysis);
    } catch (err: any) {
      setAiError(err.message || 'Erro ao conectar com assistente de cenários.');
    } finally {
      setAiLoading(false);
    }
  };

  const presetScenarios = [
    {
      title: 'Copom Eleva Selic (+0.50%)',
      desc: 'Alta de juros surpreendente pelo Banco Central, pressionando ações e alterando o carrego do Rho.',
    },
    {
      title: 'Queda de 10% nas Commodities (Petróleo/Minério)',
      desc: 'Desaceleração global e queda brusca nos preços de commodities atingindo estatais e exportadoras.',
    },
    {
      title: 'Aversão a Risco Fiscal e Dólar R$ 6,00',
      desc: 'Estresse na curva de juros futuros (DI), abertura de prêmio de risco e disparada de IV.',
    },
    {
      title: 'Temporada de Balanços com IV Crush (-12% IV)',
      desc: 'Divulgação de resultados corporativos com queda acelerada da volatilidade implícita.',
    },
  ];

  return (
    <div id="scenario-analysis" className="space-y-6 pb-12">
      {/* Intro Header */}
      <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-black text-white flex items-center gap-2">
              <Cpu className="w-5 h-5 text-purple-400" />
              <span>Matriz de Cenários & Teste de Estresse B3</span>
            </h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20 font-mono">
              {ticker} @ R$ {spotPrice.toFixed(2)}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Simule variações simultâneas de preço do ativo, choque de volatilidade implícita e horizontes de tempo.
          </p>
        </div>

        {/* IV Shock Slider */}
        <div className="flex items-center gap-3 bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-xs w-full md:w-auto">
          <span className="text-slate-400 whitespace-nowrap">Choque de IV:</span>
          <input
            id="scenario-iv-shock-slider"
            aria-label="Choque de Volatilidade Implícita"
            type="range"
            min="-15"
            max="25"
            step="1"
            value={ivShock}
            onChange={(e) => setIvShock(parseInt(e.target.value, 10))}
            className="w-32 accent-purple-500 cursor-pointer"
          />
          <span
            className={`font-mono font-bold w-14 text-right ${
              ivShock > 0 ? 'text-purple-400' : ivShock < 0 ? 'text-amber-400' : 'text-slate-400'
            }`}
          >
            {ivShock > 0 ? `+${ivShock}%` : `${ivShock}%`}
          </span>
        </div>
      </div>

      {/* Stress Matrix Table */}
      <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <span>Matriz de Projeção de P&L (R$) por Horizonte Temporal</span>
          </h3>
          <span className="text-[11px] text-slate-400 font-mono">
            IV Efetiva: {((iv + ivShock / 100) * 100).toFixed(1)}%
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-center text-xs font-mono">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 text-[11px] uppercase tracking-wider font-semibold">
                <th className="py-2.5 px-3 text-left">Variação (%)</th>
                <th className="py-2.5 px-3 text-left">Preço Simulado</th>
                <th className="py-2.5 px-3">Hoje (D-0)</th>
                <th className="py-2.5 px-3">D+7 Dias</th>
                <th className="py-2.5 px-3">D+14 Dias</th>
                <th className="py-2.5 px-3 text-emerald-400 font-bold">No Vencimento</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {percentageSteps.map((pct) => {
                const simPrice = spotPrice * (1 + pct / 100);
                const pnlD0 = computePnLAtScenario(pct, 22);
                const pnlD7 = computePnLAtScenario(pct, 15);
                const pnlD14 = computePnLAtScenario(pct, 7);
                const pnlExpiry = computePnLAtScenario(pct, 0);

                const isCurrent = pct === 0;

                return (
                  <tr
                    key={pct}
                    className={`hover:bg-slate-800/40 transition ${
                      isCurrent ? 'bg-slate-800/60 font-semibold' : ''
                    }`}
                  >
                    {/* Percentage */}
                    <td className="py-2 px-3 text-left font-bold">
                      <span
                        className={`inline-flex items-center gap-1 ${
                          pct > 0 ? 'text-emerald-400' : pct < 0 ? 'text-rose-400' : 'text-slate-300'
                        }`}
                      >
                        {pct > 0 ? '+' : ''}
                        {pct}%
                        {isCurrent && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-700 text-slate-300 ml-1">
                            Atual
                          </span>
                        )}
                      </span>
                    </td>

                    {/* Sim Price */}
                    <td className="py-2 px-3 text-left text-slate-300 font-medium">
                      R$ {simPrice.toFixed(2)}
                    </td>

                    {/* D-0 */}
                    <td
                      className={`py-2 px-3 ${
                        pnlD0 >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {pnlD0 >= 0 ? '+' : ''}R$ {pnlD0.toFixed(2)}
                    </td>

                    {/* D+7 */}
                    <td
                      className={`py-2 px-3 ${
                        pnlD7 >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {pnlD7 >= 0 ? '+' : ''}R$ {pnlD7.toFixed(2)}
                    </td>

                    {/* D+14 */}
                    <td
                      className={`py-2 px-3 ${
                        pnlD14 >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {pnlD14 >= 0 ? '+' : ''}R$ {pnlD14.toFixed(2)}
                    </td>

                    {/* Expiry */}
                    <td
                      className={`py-2 px-3 font-bold ${
                        pnlExpiry >= 0 ? 'text-emerald-400 bg-emerald-950/20' : 'text-rose-400 bg-rose-950/20'
                      }`}
                    >
                      {pnlExpiry >= 0 ? '+' : ''}R$ {pnlExpiry.toFixed(2)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* AI Market Stress-Tester Section */}
      <div className="rounded-2xl bg-gradient-to-b from-purple-950/30 to-slate-900 border border-purple-800/40 p-5 space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-400" />
              <span>Assistente de Cenários AI para o Mercado Brasileiro</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Análise profunda via Gemini avaliando impactos na liquidez B3, risco de margem CORE e plano tático.
            </p>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-700/50">
            Gemini 2.5 Flash
          </span>
        </div>

        {/* Preset Brazilian Scenarios */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {presetScenarios.map((sc, i) => (
            <button
              key={i}
              onClick={() => handleTriggerAiScenario(sc.desc)}
              disabled={aiLoading}
              className="p-3 rounded-xl bg-slate-950/80 border border-purple-900/40 hover:border-purple-600 transition text-left space-y-1 group cursor-pointer disabled:opacity-50"
            >
              <span className="text-xs font-bold text-purple-300 group-hover:text-purple-200 block">
                {sc.title}
              </span>
              <p className="text-[11px] text-slate-400 line-clamp-2">{sc.desc}</p>
            </button>
          ))}
        </div>

        {/* Custom Prompt Box */}
        <div className="flex gap-2">
          <input
            type="text"
            value={customScenarioPrompt}
            onChange={(e) => setCustomScenarioPrompt(e.target.value)}
            placeholder="Ou descreva um cenário customizado (ex: greve dos caminhoneiros ou venda do controle acionário)..."
            className="flex-1 bg-slate-950 border border-purple-900/60 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
          />
          <button
            onClick={() => handleTriggerAiScenario(customScenarioPrompt)}
            disabled={aiLoading || !customScenarioPrompt.trim()}
            className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-md shadow-purple-600/30"
          >
            {aiLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            <span>Analisar</span>
          </button>
        </div>

        {/* Error message */}
        {aiError && (
          <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800/60 text-xs text-rose-300 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{aiError}</span>
          </div>
        )}

        {/* AI Output Card */}
        {aiAnalysis && (
          <div className="p-4 rounded-xl bg-slate-950 border border-purple-700/60 space-y-3.5 animate-fadeIn">
            <div className="border-b border-purple-900/50 pb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400">
                Diagnóstico de Cenário Gerado por IA
              </span>
              <p className="text-xs text-slate-200 mt-1 leading-relaxed">
                {aiAnalysis.executiveSummary}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800 space-y-1">
                <span className="font-bold text-slate-300 flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Impacto Estimado de P&L:</span>
                </span>
                <p className="text-slate-300 leading-relaxed">
                  {aiAnalysis.estimatedPnLImpact}
                </p>
              </div>

              <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800 space-y-1">
                <span className="font-bold text-amber-400 flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                  <span>Risco de Margem B3 (CORE):</span>
                </span>
                <p className="text-slate-300 leading-relaxed">
                  {aiAnalysis.b3MarginRisk}
                </p>
              </div>
            </div>

            {/* Action Recommendations */}
            <div className="space-y-1.5 pt-1">
              <span className="text-xs font-bold text-slate-200 block">
                Ações Táticas Recomendadas:
              </span>
              <div className="space-y-1">
                {aiAnalysis.recommendedActions.map((act, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-slate-300">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
                    <span>{act}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick jump to roll manager */}
            <div className="pt-2 flex justify-end">
              <button
                onClick={onNavigateToRoll}
                className="flex items-center gap-1.5 text-xs font-bold text-teal-400 hover:text-teal-300 transition cursor-pointer"
              >
                <span>Abrir Calculadora de Rolagem</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
