import React, { useState, useMemo, useRef } from 'react';
import { OptionLeg } from '../types';
import { generatePayoffCurve, findBreakEvens } from '../utils/blackScholes';

interface PayoffChartProps {
  legs: OptionLeg[];
  spotPrice: number;
  iv: number;
  interestRate: number;
  ticker: string;
}

export const PayoffChart: React.FC<PayoffChartProps> = ({
  legs,
  spotPrice,
  iv,
  interestRate,
  ticker,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoverData, setHoverData] = useState<{
    price: number;
    expiryPnL: number;
    currentPnL: number;
    x: number;
    y: number;
  } | null>(null);

  const curveData = useMemo(() => {
    return generatePayoffCurve(legs, spotPrice, iv, interestRate, 0.28, 90);
  }, [legs, spotPrice, iv, interestRate]);

  const breakEvens = useMemo(() => {
    return findBreakEvens(legs, spotPrice, 0.35);
  }, [legs, spotPrice]);

  const strikes = useMemo(() => {
    const list = legs.filter((l) => l.type !== 'STOCK').map((l) => l.strike);
    return Array.from(new Set(list)).sort((a, b) => a - b);
  }, [legs]);

  // Chart dimensions & coordinates
  const width = 800;
  const height = 380;
  const padding = { top: 25, right: 35, bottom: 45, left: 65 };

  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const { minPrice, maxPrice, minPnL, maxPnL } = useMemo(() => {
    if (curveData.length === 0) {
      return { minPrice: spotPrice * 0.8, maxPrice: spotPrice * 1.2, minPnL: -500, maxPnL: 500 };
    }

    const prices = curveData.map((d) => d.price);
    const pnls = curveData.flatMap((d) => [d.expiryPnL, d.currentPnL]);

    let minP = Math.min(...prices);
    let maxP = Math.max(...prices);
    let minL = Math.min(...pnls);
    let maxL = Math.max(...pnls);

    // Padding for zero line visibility
    if (minL > 0) minL = 0;
    if (maxL < 0) maxL = 0;

    const pnlRange = Math.max(10, maxL - minL);
    minL -= pnlRange * 0.1;
    maxL += pnlRange * 0.1;

    return { minPrice: minP, maxPrice: maxP, minPnL: minL, maxPnL: maxL };
  }, [curveData, spotPrice]);

  const scaleX = (price: number) => {
    return padding.left + ((price - minPrice) / (maxPrice - minPrice)) * chartWidth;
  };

  const scaleY = (pnl: number) => {
    return padding.top + chartHeight - ((pnl - minPnL) / (maxPnL - minPnL)) * chartHeight;
  };

  const zeroY = scaleY(0);
  const spotX = scaleX(spotPrice);

  // SVG Paths
  const expiryPath = useMemo(() => {
    if (curveData.length === 0) return '';
    return curveData
      .map((d, i) => `${i === 0 ? 'M' : 'L'} ${scaleX(d.price).toFixed(1)} ${scaleY(d.expiryPnL).toFixed(1)}`)
      .join(' ');
  }, [curveData, minPrice, maxPrice, minPnL, maxPnL]);

  const currentPath = useMemo(() => {
    if (curveData.length === 0) return '';
    return curveData
      .map((d, i) => `${i === 0 ? 'M' : 'L'} ${scaleX(d.price).toFixed(1)} ${scaleY(d.currentPnL).toFixed(1)}`)
      .join(' ');
  }, [curveData, minPrice, maxPrice, minPnL, maxPnL]);

  // Shaded positive and negative areas
  const profitAreaPath = useMemo(() => {
    if (curveData.length === 0) return '';
    let path = `M ${scaleX(curveData[0].price)} ${zeroY}`;
    curveData.forEach((d) => {
      const y = Math.min(zeroY, scaleY(d.expiryPnL));
      path += ` L ${scaleX(d.price).toFixed(1)} ${y.toFixed(1)}`;
    });
    path += ` L ${scaleX(curveData[curveData.length - 1].price)} ${zeroY} Z`;
    return path;
  }, [curveData, zeroY, minPrice, maxPrice, minPnL, maxPnL]);

  const lossAreaPath = useMemo(() => {
    if (curveData.length === 0) return '';
    let path = `M ${scaleX(curveData[0].price)} ${zeroY}`;
    curveData.forEach((d) => {
      const y = Math.max(zeroY, scaleY(d.expiryPnL));
      path += ` L ${scaleX(d.price).toFixed(1)} ${y.toFixed(1)}`;
    });
    path += ` L ${scaleX(curveData[curveData.length - 1].price)} ${zeroY} Z`;
    return path;
  }, [curveData, zeroY, minPrice, maxPrice, minPnL, maxPnL]);

  // Mouse interaction
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!containerRef.current || curveData.length === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const svgX = (mouseX / rect.width) * width;

    if (svgX < padding.left || svgX > width - padding.right) {
      setHoverData(null);
      return;
    }

    const priceAtMouse = minPrice + ((svgX - padding.left) / chartWidth) * (maxPrice - minPrice);

    // Find closest curve point
    let closest = curveData[0];
    let minDiff = Math.abs(curveData[0].price - priceAtMouse);
    for (let i = 1; i < curveData.length; i++) {
      const diff = Math.abs(curveData[i].price - priceAtMouse);
      if (diff < minDiff) {
        minDiff = diff;
        closest = curveData[i];
      }
    }

    setHoverData({
      price: closest.price,
      expiryPnL: closest.expiryPnL,
      currentPnL: closest.currentPnL,
      x: scaleX(closest.price),
      y: scaleY(closest.expiryPnL),
    });
  };

  const handleMouseLeave = () => {
    setHoverData(null);
  };

  // Horizontal grid lines (PnL)
  const yTicks = useMemo(() => {
    const ticks = [];
    const count = 5;
    const step = (maxPnL - minPnL) / count;
    for (let i = 0; i <= count; i++) {
      ticks.push(minPnL + i * step);
    }
    return ticks;
  }, [minPnL, maxPnL]);

  // Vertical grid lines (Price)
  const xTicks = useMemo(() => {
    const ticks = [];
    const count = 6;
    const step = (maxPrice - minPrice) / count;
    for (let i = 0; i <= count; i++) {
      ticks.push(minPrice + i * step);
    }
    return ticks;
  }, [minPrice, maxPrice]);

  return (
    <div id="payoff-chart-container" ref={containerRef} className="relative w-full rounded-2xl bg-slate-900/90 border border-slate-800/80 p-4 shadow-xl backdrop-blur-md">
      {/* Top Legend and Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3 px-2">
        <div className="flex items-center gap-2">
          <span className="font-bold text-slate-100 text-sm tracking-wide">
            Curva de Payoff Interativa
          </span>
          <span className="px-2 py-0.5 text-xs font-semibold rounded bg-slate-800 text-slate-300 border border-slate-700/60">
            {ticker} @ R$ {spotPrice.toFixed(2)}
          </span>
        </div>

        <div className="flex items-center gap-4 text-xs font-medium">
          <div className="flex items-center gap-1.5 text-emerald-400">
            <span className="inline-block w-3.5 h-1 bg-emerald-400 rounded-full" />
            <span>No Vencimento (D+N)</span>
          </div>
          <div className="flex items-center gap-1.5 text-amber-400">
            <span className="inline-block w-3.5 h-1 border-b-2 border-dashed border-amber-400" />
            <span>Hoje (D-0 Teórico)</span>
          </div>
          <div className="flex items-center gap-1.5 text-blue-400">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-blue-500/20 border border-blue-400" />
            <span>Break-Even</span>
          </div>
        </div>
      </div>

      {/* SVG Canvas */}
      <div className="w-full overflow-hidden select-none">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto overflow-visible"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          <defs>
            <linearGradient id="profitGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.28" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.02" />
            </linearGradient>
            <linearGradient id="lossGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ef4444" stopOpacity="0.02" />
              <stop offset="100%" stopColor="#ef4444" stopOpacity="0.25" />
            </linearGradient>
          </defs>

          {/* Background Grid */}
          {yTicks.map((pnl, idx) => (
            <g key={`y-${idx}`}>
              <line
                x1={padding.left}
                y1={scaleY(pnl)}
                x2={width - padding.right}
                y2={scaleY(pnl)}
                stroke="#1e293b"
                strokeWidth="1"
                strokeDasharray="3 3"
              />
              <text
                x={padding.left - 8}
                y={scaleY(pnl) + 4}
                textAnchor="end"
                className="text-[10px] fill-slate-400 font-mono"
              >
                {pnl >= 0 ? `+R$ ${Math.round(pnl)}` : `-R$ ${Math.round(Math.abs(pnl))}`}
              </text>
            </g>
          ))}

          {xTicks.map((price, idx) => (
            <g key={`x-${idx}`}>
              <line
                x1={scaleX(price)}
                y1={padding.top}
                x2={scaleX(price)}
                y2={height - padding.bottom}
                stroke="#1e293b"
                strokeWidth="1"
                strokeDasharray="3 3"
              />
              <text
                x={scaleX(price)}
                y={height - padding.bottom + 18}
                textAnchor="middle"
                className="text-[10px] fill-slate-400 font-mono"
              >
                R$ {price.toFixed(2)}
              </text>
            </g>
          ))}

          {/* Shaded Profit & Loss Areas */}
          <path d={profitAreaPath} fill="url(#profitGrad)" />
          <path d={lossAreaPath} fill="url(#lossGrad)" />

          {/* Zero Axis (Neutral PnL) */}
          <line
            x1={padding.left}
            y1={zeroY}
            x2={width - padding.right}
            y2={zeroY}
            stroke="#64748b"
            strokeWidth="1.5"
          />

          {/* Current Spot Price Vertical Marker */}
          <line
            x1={spotX}
            y1={padding.top}
            x2={spotX}
            y2={height - padding.bottom}
            stroke="#38bdf8"
            strokeWidth="1.5"
            strokeDasharray="4 4"
          />
          <g transform={`translate(${spotX}, ${padding.top - 6})`}>
            <rect x="-34" y="-14" width="68" height="16" rx="4" fill="#0284c7" />
            <text x="0" y="-3" textAnchor="middle" className="text-[9px] fill-white font-bold font-mono">
              Spot {spotPrice.toFixed(2)}
            </text>
          </g>

          {/* Strikes Vertical Dashed Lines */}
          {strikes.map((strike) => {
            const sx = scaleX(strike);
            if (sx < padding.left || sx > width - padding.right) return null;
            return (
              <g key={`strike-${strike}`}>
                <line
                  x1={sx}
                  y1={padding.top}
                  x2={sx}
                  y2={height - padding.bottom}
                  stroke="#475569"
                  strokeWidth="1"
                  strokeDasharray="2 2"
                />
                <text
                  x={sx}
                  y={height - padding.bottom + 32}
                  textAnchor="middle"
                  className="text-[9px] fill-slate-300 font-mono font-medium"
                >
                  K: {strike.toFixed(2)}
                </text>
              </g>
            );
          })}

          {/* Payoff Curves */}
          {/* Current Theoretical D-0 Curve */}
          <path
            d={currentPath}
            fill="none"
            stroke="#f59e0b"
            strokeWidth="2"
            strokeDasharray="4 3"
            strokeLinecap="round"
          />

          {/* Expiry Payoff Curve */}
          <path
            d={expiryPath}
            fill="none"
            stroke="#10b981"
            strokeWidth="2.5"
            strokeLinecap="round"
          />

          {/* Break-Even Points Markers */}
          {breakEvens.map((be, idx) => {
            const bx = scaleX(be);
            if (bx < padding.left || bx > width - padding.right) return null;
            return (
              <g key={`be-${idx}`}>
                <circle cx={bx} cy={zeroY} r="4.5" fill="#3b82f6" stroke="#ffffff" strokeWidth="1.5" />
                <rect x={bx - 28} y={zeroY + 6} width="56" height="15" rx="3" fill="#1e3a8a" />
                <text x={bx} y={zeroY + 17} textAnchor="middle" className="text-[9px] fill-sky-200 font-bold font-mono">
                  BE {be.toFixed(2)}
                </text>
              </g>
            );
          })}

          {/* Hover Crosshair & Details */}
          {hoverData && (
            <g>
              <line
                x1={hoverData.x}
                y1={padding.top}
                x2={hoverData.x}
                y2={height - padding.bottom}
                stroke="#cbd5e1"
                strokeWidth="1"
                strokeDasharray="2 2"
              />
              <circle
                cx={hoverData.x}
                cy={scaleY(hoverData.expiryPnL)}
                r="5"
                fill={hoverData.expiryPnL >= 0 ? '#10b981' : '#ef4444'}
                stroke="#ffffff"
                strokeWidth="1.5"
              />
              <circle
                cx={hoverData.x}
                cy={scaleY(hoverData.currentPnL)}
                r="4"
                fill="#f59e0b"
                stroke="#ffffff"
                strokeWidth="1"
              />
            </g>
          )}
        </svg>
      </div>

      {/* Hover Floating Tooltip */}
      {hoverData && (
        <div
          id="payoff-tooltip"
          className="absolute pointer-events-none z-20 bg-slate-950/95 border border-slate-700 p-2.5 rounded-xl shadow-2xl text-xs space-y-1 backdrop-blur-lg"
          style={{
            left: `${Math.min(75, Math.max(10, (hoverData.x / width) * 100))}%`,
            top: '18%',
          }}
        >
          <div className="font-semibold text-slate-200 border-b border-slate-800 pb-1 flex items-center justify-between gap-3">
            <span>Preço Simulado:</span>
            <span className="font-mono text-sky-400 font-bold">R$ {hoverData.price.toFixed(2)}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-slate-400">P&L Vencimento (D+N):</span>
            <span
              className={`font-mono font-bold ${
                hoverData.expiryPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {hoverData.expiryPnL >= 0 ? '+' : ''}R$ {hoverData.expiryPnL.toFixed(2)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-slate-400">P&L Teórico Hoje (D-0):</span>
            <span
              className={`font-mono font-bold ${
                hoverData.currentPnL >= 0 ? 'text-amber-400' : 'text-orange-400'
              }`}
            >
              {hoverData.currentPnL >= 0 ? '+' : ''}R$ {hoverData.currentPnL.toFixed(2)}
            </span>
          </div>
        </div>
      )}

      {/* Break-evens and summary footer */}
      <div className="mt-3 pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between text-xs text-slate-400 gap-2">
        <div className="flex items-center gap-2">
          <span className="text-slate-500 font-medium">Pontos de Equilíbrio (Break-Even):</span>
          {breakEvens.length > 0 ? (
            <div className="flex gap-1.5 flex-wrap">
              {breakEvens.map((be, i) => (
                <span
                  key={i}
                  className="px-2 py-0.5 rounded bg-blue-950/80 text-blue-300 font-mono font-bold border border-blue-800/50"
                >
                  R$ {be.toFixed(2)}
                </span>
              ))}
            </div>
          ) : (
            <span className="text-slate-400 italic">Sem ponto de cruzamento no intervalo</span>
          )}
        </div>

        <div className="text-[11px] text-slate-400">
          Convenção B3: 252 Dias Úteis | Selic {(interestRate * 100).toFixed(2)}% | IV {(iv * 100).toFixed(1)}%
        </div>
      </div>
    </div>
  );
};
