"use client";

import { useState, useMemo, useRef } from "react";
import { ArrowUpDown } from "lucide-react";
import {
  CATEGORY_LABELS,
  CATEGORY_COLORS,
  formatAvax,
  type ProtocolBreakdown,
} from "./gas-treemap-utils";

interface GasBurnBarsProps {
  protocols: ProtocolBreakdown[];
  isDark: boolean;
}

type SortMode = "growth" | "burned";

export function GasBurnBars({ protocols, isDark }: GasBurnBarsProps) {
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [hovered, setHovered] = useState<ProtocolBreakdown | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>("growth");
  const chartRef = useRef<HTMLDivElement>(null);

  const categories = useMemo(() => {
    const totals = new Map<string, number>();
    for (const p of protocols) {
      totals.set(p.category, (totals.get(p.category) || 0) + p.avaxBurned);
    }
    return Array.from(totals.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([cat]) => cat);
  }, [protocols]);

  const sorted = useMemo(() => {
    let filtered = protocols.filter((p) => p.avaxBurned > 0);
    if (categoryFilter) {
      filtered = filtered.filter((p) => p.category === categoryFilter);
    }
    return sortMode === "growth"
      ? filtered.sort((a, b) => b.delta - a.delta)
      : filtered.sort((a, b) => b.avaxBurned - a.avaxBurned);
  }, [protocols, categoryFilter, sortMode]);

  const maxDelta = useMemo(() => {
    if (sorted.length === 0) return 100;
    const maxAbs = Math.max(...sorted.map((p) => Math.abs(p.delta)));
    return Math.max(maxAbs, 10);
  }, [sorted]);

  const totalBurned = useMemo(
    () => sorted.reduce((s, p) => s + p.avaxBurned, 0),
    [sorted]
  );

  const getColor = (category: string) => {
    const colors = CATEGORY_COLORS[category] || CATEGORY_COLORS.other;
    return isDark ? colors.dark : colors.light;
  };

  if (sorted.length === 0) {
    return (
      <div className="flex items-center justify-center h-[300px] text-sm text-zinc-400 dark:text-zinc-500">
        No protocols to display
      </div>
    );
  }

  const MARGIN = { top: 30, right: 16, bottom: 50, left: 56 };
  const chartHeight = 360;
  const plotHeight = chartHeight - MARGIN.top - MARGIN.bottom;
  const zeroY = MARGIN.top + plotHeight / 2;
  const axisColor = isDark ? "#a1a1aa" : "#3f3f46";
  const gridColor = isDark ? "#27272a" : "#e4e4e7";

  return (
    <div>
      {/* Controls row */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        {/* Category filter pills */}
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setCategoryFilter(null)}
            className={`px-2.5 py-1 text-xs font-medium rounded-full transition-colors ${
              !categoryFilter
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"
            }`}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(categoryFilter === cat ? null : cat)}
              className={`px-2.5 py-1 text-xs font-medium rounded-full transition-colors ${
                categoryFilter === cat
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"
              }`}
            >
              {CATEGORY_LABELS[cat] || cat}
            </button>
          ))}
        </div>

        {/* Sort toggle */}
        <div className="flex items-center bg-zinc-100 dark:bg-zinc-900 rounded-md overflow-hidden border border-zinc-300 dark:border-zinc-700">
          <button
            onClick={() => setSortMode("growth")}
            className={`px-2.5 py-1 text-xs font-medium transition-colors flex items-center gap-1 ${
              sortMode === "growth"
                ? "bg-zinc-300 dark:bg-zinc-700 text-zinc-900 dark:text-white"
                : "text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"
            }`}
          >
            <ArrowUpDown className="w-3 h-3" />
            Growth %
          </button>
          <button
            onClick={() => setSortMode("burned")}
            className={`px-2.5 py-1 text-xs font-medium transition-colors flex items-center gap-1 ${
              sortMode === "burned"
                ? "bg-zinc-300 dark:bg-zinc-700 text-zinc-900 dark:text-white"
                : "text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"
            }`}
          >
            <ArrowUpDown className="w-3 h-3" />
            AVAX Burned
          </button>
        </div>
      </div>

      {/* Chart */}
      <div ref={chartRef} className="relative overflow-x-auto" style={{ minHeight: chartHeight + 60 }}>
        <div
          className="relative"
          style={{
            height: chartHeight,
            minWidth: Math.max(sorted.length * 16 + MARGIN.left + MARGIN.right, 300),
          }}
        >
          {/* SVG axes with arrows */}
          <svg
            className="absolute inset-0 pointer-events-none"
            width="100%"
            height={chartHeight}
            style={{ overflow: "visible" }}
          >
            <defs>
              <marker id="arrowY" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto">
                <path d="M0,8 L4,0 L8,8" fill="none" stroke={axisColor} strokeWidth="1.5" />
              </marker>
              <marker id="arrowX" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto">
                <path d="M0,8 L4,0 L8,8" fill="none" stroke={axisColor} strokeWidth="1.5" />
              </marker>
            </defs>

            {/* Grid lines */}
            <line x1={MARGIN.left} y1={MARGIN.top} x2="100%" y2={MARGIN.top} stroke={gridColor} strokeDasharray="3 3" />
            <line x1={MARGIN.left} y1={zeroY} x2="100%" y2={zeroY} stroke={axisColor} strokeWidth="0.5" />
            <line x1={MARGIN.left} y1={MARGIN.top + plotHeight} x2="100%" y2={MARGIN.top + plotHeight} stroke={gridColor} strokeDasharray="3 3" />

            {/* Y-axis (growth %) — vertical line with arrow */}
            <line
              x1={MARGIN.left}
              y1={MARGIN.top + plotHeight}
              x2={MARGIN.left}
              y2={MARGIN.top - 4}
              stroke={axisColor}
              strokeWidth="1.5"
              markerEnd="url(#arrowY)"
            />
            {/* Y-axis label */}
            <text
              x={14}
              y={chartHeight / 2}
              textAnchor="middle"
              dominantBaseline="central"
              fill={axisColor}
              fontSize="10"
              fontWeight="600"
              transform={`rotate(-90, 14, ${chartHeight / 2})`}
            >
              Growth %
            </text>
            {/* Y-axis tick labels */}
            <text x={MARGIN.left - 6} y={MARGIN.top + 2} textAnchor="end" fill={axisColor} fontSize="9">
              +{maxDelta.toFixed(0)}%
            </text>
            <text x={MARGIN.left - 6} y={zeroY + 1} textAnchor="end" dominantBaseline="central" fill={axisColor} fontSize="9">
              0%
            </text>
            <text x={MARGIN.left - 6} y={MARGIN.top + plotHeight - 2} textAnchor="end" fill={axisColor} fontSize="9">
              -{maxDelta.toFixed(0)}%
            </text>

            {/* X-axis (AVAX burned) — horizontal line with arrow */}
            <line
              x1={MARGIN.left}
              y1={MARGIN.top + plotHeight + 1}
              x2="calc(100% - 4px)"
              y2={MARGIN.top + plotHeight + 1}
              stroke={axisColor}
              strokeWidth="1.5"
              markerEnd="url(#arrowX)"
            />
            {/* X-axis label */}
            <text
              x="50%"
              y={chartHeight - 4}
              textAnchor="middle"
              fill={axisColor}
              fontSize="10"
              fontWeight="600"
            >
              AVAX Burned (bar width = share) — sorted by {sortMode === "growth" ? "highest growth" : "most burned"} first
            </text>
          </svg>

          {/* Bars container */}
          <div
            className="absolute flex"
            style={{
              left: MARGIN.left + 1,
              right: MARGIN.right,
              top: 0,
              height: chartHeight,
            }}
          >
            {sorted.map((p) => {
              const widthPercent = totalBurned > 0 ? (p.avaxBurned / totalBurned) * 100 : 0;
              const minWidthPx = 4;

              const clampedDelta = Math.max(-maxDelta, Math.min(maxDelta, p.delta));
              const barHeightFrac = Math.abs(clampedDelta) / maxDelta;
              const halfPlot = plotHeight / 2;
              const barHeight = Math.max(2, barHeightFrac * halfPlot);

              const isPositive = p.delta >= 0;
              const color = getColor(p.category);
              const isHovered = hovered?.protocol === p.protocol;

              return (
                <div
                  key={p.protocol}
                  className="relative flex-shrink-0 cursor-pointer"
                  style={{
                    width: `max(${widthPercent}%, ${minWidthPx}px)`,
                    height: chartHeight,
                  }}
                  onMouseEnter={() => setHovered(p)}
                  onMouseLeave={() => setHovered(null)}
                >
                  <div
                    className="absolute left-[1px] right-[1px] rounded-sm transition-opacity"
                    style={{
                      backgroundColor: color,
                      opacity: isHovered ? 1 : 0.75,
                      height: barHeight,
                      ...(isPositive
                        ? { top: zeroY - barHeight }
                        : { top: zeroY }),
                    }}
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* Floating tooltip — positioned outside bars to avoid clipping */}
        {hovered && (
          <div className="absolute z-50 pointer-events-none w-60 p-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-xl text-xs"
            style={{ top: 8, right: 8 }}
          >
            <div className="font-semibold text-zinc-900 dark:text-white truncate text-sm">{hovered.protocol}</div>
            <div className="text-zinc-400 dark:text-zinc-500 text-[10px] uppercase mt-0.5">
              {CATEGORY_LABELS[hovered.category] || hovered.category}
            </div>
            <div className="grid grid-cols-2 gap-2 mt-2">
              <div>
                <div className="text-zinc-400 dark:text-zinc-500 text-[10px] uppercase">AVAX Burned</div>
                <div className="font-mono text-zinc-900 dark:text-white">{formatAvax(hovered.avaxBurned)}</div>
              </div>
              <div>
                <div className="text-zinc-400 dark:text-zinc-500 text-[10px] uppercase">Growth</div>
                <div className={`font-mono font-bold ${hovered.delta >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                  {hovered.delta >= 0 ? "+" : ""}{hovered.delta.toFixed(1)}%
                </div>
              </div>
              <div>
                <div className="text-zinc-400 dark:text-zinc-500 text-[10px] uppercase">Burn Share</div>
                <div className="font-mono text-zinc-900 dark:text-white">
                  {totalBurned > 0 ? ((hovered.avaxBurned / totalBurned) * 100).toFixed(2) : "0"}%
                </div>
              </div>
              <div>
                <div className="text-zinc-400 dark:text-zinc-500 text-[10px] uppercase">Gas Share</div>
                <div className="font-mono text-zinc-900 dark:text-white">{hovered.gasShare.toFixed(2)}%</div>
              </div>
            </div>
          </div>
        )}

        {/* Legend */}
        <div className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-3 text-center">
          {sorted.length} protocol{sorted.length !== 1 ? "s" : ""} — bar width = AVAX burned share, bar height = period growth %
        </div>
      </div>
    </div>
  );
}
