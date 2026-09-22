import React from 'react';
import { OptionLeg, MarginEstimate, PortfolioGreeks } from '../types';
import { estimateB3Margin, calculatePortfolioGreeks, calculateExpiryPayoffAtPrice, calculateCurrentPayoffAtPrice } from '../utils/blackScholes';
import { Shield, AlertTriangle, CheckCircle2, TrendingUp, Clock, Zap, Percent, HelpCircle, Layers, DollarSign } from 'lucide-react';

interface RiskMarginPanelProps {
  legs: OptionLeg[];
  spotPrice: number;
  ticker: string;
  interestRate?: number;
  iv?: number;
  title?: string;
  isCompact?: boolean;
}

export const RiskMarginPanel: React.FC<RiskMarginPanelProps> = ({
  legs,
  spotPrice,
  ticker,
  interestRate = 0.1325,
  iv = 0.28,
  title = 'Gerenciador de Risco & Margem de Garantia B3',
  isCompact = false,
}) => {
  const marginEst = estimateB3Margin(legs, spotPrice);
  const greeks = calculatePortfolioGreeks(legs, spotPrice, iv, interestRate);

  // Calculate Max Profit & Max Loss
  const shortCalls = legs.filter((l) => l.type === 'CALL' && l.side === 'SELL');
  const longCalls = legs.filter((l) => l.type === 'CALL' && l.side === 'BUY');
  const stockLeg = legs.find((l) => l.type === 'STOCK');
  const stockQty = stockLeg ? (stockLeg.side === 'BUY' ? stockLeg.quantity : -stockLeg.quantity) : 0;
  const totalSoldCallQty = shortCalls.reduce((sum, l) => sum + l.quantity, 0);
  const totalBoughtCallQty = longCalls.reduce((sum, l) => sum + l.quantity, 0);

  const uncoveredCalls = Math.max(0, totalSoldCallQty - Math.max(0, stockQty) - totalBoughtCallQty);

  // Compute test prices to find max profit and max loss
  const testP = [
    0.01,
    spotPrice * 0.4,
    spotPrice * 0.6,
    spotPrice * 0.75,
    spotPrice * 0.9,
    spotPrice,
    spotPrice * 1.1,
    spotPrice * 1.25,
    spotPrice * 1.4,
    spotPrice * 1.7,
    spotPrice * 2.2,
  ];

  legs.forEach((l) => {
    if (l.strike) {
      testP.push(l.strike - 0.05, l.strike, l.strike + 0.05);
    }
  });

  const pnlList = testP.map((p) => calculateExpiryPayoffAtPrice(legs, p, spotPrice));
  const minPnL = Math.min(...pnlList);
  const maxPnL = Math.max(...pnlList);

  const maxLossDisplay = uncoveredCalls > 0 ? 'ILIMITADA' : minPnL >= 0 ? `R$ 0.00 (Sem Perda)` : `- R$ ${Math.abs(minPnL).toFixed(2)}`;
  const maxProfitDisplay = longCalls.some((l) => l.quantity > totalSoldCallQty)
    ? 'ILIMITADO'
    : maxPnL <= 0
    ? `R$ 0.00`
    : `+ R$ ${maxPnL.toFixed(2)}`;

  // Stress scenarios
  const stressShocks = [-0.1, -0.05, -0.02, 0, 0.02, 0.05, 0.1];

  const badgeColor =
    marginEst.riskScore === 'BAIXO'
      ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
      : marginEst.riskScore === 'MODERADO'
      ? 'bg-sky-500/15 text-sky-400 border-sky-500/30'
      : marginEst.riskScore === 'ALTO'
      ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
      : 'bg-rose-500/15 text-rose-400 border-rose-500/30';

  return (
    <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-5 space-y-5 shadow-xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-emerald-400" />
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">{title}</h3>
          <span className="text-xs font-mono text-slate-400">({ticker})</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-slate-400">Enquadramento B3:</span>
          <span className={`text-xs font-bold px-2.5 py-0.5 rounded border ${badgeColor}`}>
            RISCO {marginEst.riskScore}
          </span>
        </div>
      </div>

      {/* Grid of 3 Main Pillars: Margin Requirement, Max Risk/Profit, Greeks Sensitivity */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Pillar 1: Margem de Garantia B3 */}
        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <DollarSign className="w-4 h-4 text-emerald-400" />
              <span>Margem Exigida B3</span>
            </span>
            <span className="text-[10px] text-slate-400 font-mono">Câmara CORE</span>
          </div>

          <div>
            <span className="text-2xl font-black font-mono text-emerald-400 block">
              {marginEst.estimatedInitialMargin === 0
                ? 'R$ 0.00 (Isenta)'
                : `R$ ${marginEst.estimatedInitialMargin.toFixed(2)}`}
            </span>
            <p className="text-[11px] text-slate-400 mt-1 leading-snug">{marginEst.description}</p>
          </div>

          <div className="pt-2 border-t border-slate-800/60 space-y-1 text-[11px]">
            <span className="text-slate-400 font-semibold block">Garantias Aceitas B3:</span>
            <div className="text-[10px] space-y-0.5 text-slate-400">
              <div className="flex justify-between">
                <span>• Tesouro Selic (LFT):</span>
                <span className="text-emerald-400 font-mono">Deságio 0% - 2%</span>
              </div>
              <div className="flex justify-between">
                <span>• CDB 100% CDI:</span>
                <span className="text-emerald-400 font-mono">100% aceitação</span>
              </div>
              <div className="flex justify-between">
                <span>• Ações {ticker}:</span>
                <span className="text-amber-400 font-mono">Deságio 15% - 25%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Pillar 2: Lucro e Perda Máxima Potencial */}
        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-sky-400" />
              <span>Risco vs Retorno</span>
            </span>
            <span className="text-[10px] text-slate-400 font-mono">No Vencimento</span>
          </div>

          <div className="space-y-2">
            <div>
              <span className="text-[11px] text-slate-400 block">Lucro Máximo Potencial:</span>
              <span className="text-lg font-black font-mono text-emerald-400">{maxProfitDisplay}</span>
            </div>

            <div>
              <span className="text-[11px] text-slate-400 block">Perda Máxima Potencial:</span>
              <span
                className={`text-lg font-black font-mono ${
                  maxLossDisplay === 'ILIMITADA' ? 'text-rose-400 animate-pulse' : 'text-slate-200'
                }`}
              >
                {maxLossDisplay}
              </span>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-800/60 text-[11px] text-slate-400">
            {uncoveredCalls > 0 ? (
              <span className="text-rose-400 font-bold flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Risco ilimitado na alta (CALL descoberta).</span>
              </span>
            ) : (
              <span>Risco financeiramente limitado pela estrutura de travas ou custódia.</span>
            )}
          </div>
        </div>

        {/* Pillar 3: Sensibilidade Temporal e Direcional (Gregas) */}
        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-amber-400" />
              <span>Sensibilidade (Gregas)</span>
            </span>
            <span className="text-[10px] text-slate-400 font-mono">B3 252 DU</span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs font-mono">
            <div className="p-2 rounded bg-slate-900/80 border border-slate-800">
              <span className="text-[10px] text-slate-400 block font-sans">Delta Total:</span>
              <span className="font-bold text-white">
                {greeks.delta >= 0 ? '+' : ''}
                {greeks.delta.toFixed(2)}
              </span>
              <span className="text-[9px] text-slate-400 block font-sans">R$/R$1 no spot</span>
            </div>

            <div className="p-2 rounded bg-slate-900/80 border border-slate-800">
              <span className="text-[10px] text-slate-400 block font-sans">Theta Diário:</span>
              <span
                className={`font-bold ${
                  greeks.theta >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {greeks.theta >= 0 ? '+' : ''}R$ {greeks.theta.toFixed(2)}
              </span>
              <span className="text-[9px] text-slate-400 block font-sans">por dia útil</span>
            </div>

            <div className="p-2 rounded bg-slate-900/80 border border-slate-800">
              <span className="text-[10px] text-slate-400 block font-sans">Gamma:</span>
              <span className="font-bold text-slate-300">{greeks.gamma.toFixed(4)}</span>
              <span className="text-[9px] text-slate-400 block font-sans">aceleração</span>
            </div>

            <div className="p-2 rounded bg-slate-900/80 border border-slate-800">
              <span className="text-[10px] text-slate-400 block font-sans">Vega:</span>
              <span className="font-bold text-sky-400">
                {greeks.vega >= 0 ? '+' : ''}R$ {greeks.vega.toFixed(2)}
              </span>
              <span className="text-[9px] text-slate-400 block font-sans">por 1% IV</span>
            </div>
          </div>

          <div className="pt-1 text-[10px] text-slate-400">
            {greeks.theta > 0 ? (
              <span className="text-emerald-400 font-semibold">
                ✓ Passagem do tempo gera retorno positivo (venda de volatilidade).
              </span>
            ) : (
              <span className="text-amber-400">
                ⚠️ Posição perde valor a cada dia que passa (titular comprada).
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Stress Matrix: Shock Test on Spot and Time */}
      {!isCompact && (
        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-teal-400" />
              <span className="text-xs font-bold text-slate-300">
                Matriz de Estresse: Simulação de Choques de Preço e Passagem de Tempo
              </span>
            </div>
            <span className="text-[10px] text-slate-400">Resultados estimados em R$</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-center text-xs font-mono">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 text-[10px] uppercase">
                  <th className="py-1.5 px-2 text-left font-sans">Cenário Temporal</th>
                  {stressShocks.map((s) => (
                    <th key={s} className="py-1.5 px-2">
                      <span className={s > 0 ? 'text-emerald-400' : s < 0 ? 'text-rose-400' : 'text-slate-300'}>
                        {s > 0 ? '+' : ''}
                        {(s * 100).toFixed(0)}%
                      </span>
                      <span className="block text-[9px] text-slate-400">
                        R$ {(spotPrice * (1 + s)).toFixed(2)}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {/* D-0 (Hoje) */}
                <tr className="hover:bg-slate-800/20">
                  <td className="py-2 px-2 text-left text-slate-300 font-sans font-semibold">
                    Hoje (D-0)
                  </td>
                  {stressShocks.map((s) => {
                    const simP = spotPrice * (1 + s);
                    const val = calculateCurrentPayoffAtPrice(legs, simP, spotPrice, iv, interestRate, 0);
                    return (
                      <td
                        key={s}
                        className={`py-2 px-2 font-bold ${
                          val >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {val >= 0 ? '+' : ''}R$ {val.toFixed(0)}
                      </td>
                    );
                  })}
                </tr>

                {/* D-11 (Meio do Período) */}
                <tr className="hover:bg-slate-800/20">
                  <td className="py-2 px-2 text-left text-slate-300 font-sans font-semibold">
                    Em 10 Dias Úteis
                  </td>
                  {stressShocks.map((s) => {
                    const simP = spotPrice * (1 + s);
                    const val = calculateCurrentPayoffAtPrice(legs, simP, spotPrice, iv, interestRate, 10);
                    return (
                      <td
                        key={s}
                        className={`py-2 px-2 font-bold ${
                          val >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {val >= 0 ? '+' : ''}R$ {val.toFixed(0)}
                      </td>
                    );
                  })}
                </tr>

                {/* Vencimento */}
                <tr className="hover:bg-slate-800/20">
                  <td className="py-2 px-2 text-left text-teal-300 font-sans font-semibold">
                    No Vencimento
                  </td>
                  {stressShocks.map((s) => {
                    const simP = spotPrice * (1 + s);
                    const val = calculateExpiryPayoffAtPrice(legs, simP, spotPrice);
                    return (
                      <td
                        key={s}
                        className={`py-2 px-2 font-bold ${
                          val >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {val >= 0 ? '+' : ''}R$ {val.toFixed(0)}
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
