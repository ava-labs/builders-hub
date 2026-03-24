"use client";

import { useState, useMemo, useRef } from "react";
import { ArrowUpDown, AlertTriangle } from "lucide-react";
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

// Threshold: categories with more entries than this get aggregated into one bar
const AGGREGATE_THRESHOLD = 5;

interface BarEntry {
  key: string;
  label: string;
  category: string;
  avaxBurned: number;
  delta: number;
  gasShare: number;
  count: number; // 1 for individual protocols, N for aggregated
}

export function GasBurnBars({ protocols, isDark }: GasBurnBarsProps) {
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [hovered, setHovered] = useState<BarEntry | null>(null);
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

  // Build bar entries: aggregate categories with many small protocols (like MEV)
  const barEntries = useMemo(() => {
    const filtered = protocols.filter((p) => p.avaxBurned > 0);

    // Count protocols per category
    const catCounts = new Map<string, number>();
    for (const p of filtered) {
      catCounts.set(p.category, (catCounts.get(p.category) || 0) + 1);
    }

    const entries: BarEntry[] = [];
    const aggregated = new Map<string, ProtocolBreakdown[]>();

    for (const p of filtered) {
      const count = catCounts.get(p.category) || 0;
      // Aggregate if category has many entries AND we're not filtering to that specific category
      if (count > AGGREGATE_THRESHOLD && categoryFilter !== p.category) {
        const list = aggregated.get(p.category) || [];
        list.push(p);
        aggregated.set(p.category, list);
      } else {
        entries.push({
          key: p.protocol,
          label: p.protocol,
          category: p.category,
          avaxBurned: p.avaxBurned,
          delta: p.delta,
          gasShare: p.gasShare,
          count: 1,
        });
      }
    }

    // Create aggregated entries
    for (const [cat, protos] of aggregated) {
      const totalBurned = protos.reduce((s, p) => s + p.avaxBurned, 0);
      const totalGas = protos.reduce((s, p) => s + p.gasUsed, 0);
      // Weighted average delta by gas used
      const weightedDelta = totalGas > 0
        ? protos.reduce((s, p) => s + p.delta * p.gasUsed, 0) / totalGas
        : 0;
      const totalGasShare = protos.reduce((s, p) => s + p.gasShare, 0);

      const catLabel = CATEGORY_LABELS[cat] || cat;
      entries.push({
        key: `agg:${cat}`,
        label: `${catLabel} (${protos.length})`,
        category: cat,
        avaxBurned: totalBurned,
        delta: weightedDelta,
        gasShare: totalGasShare,
        count: protos.length,
      });
    }

    return entries;
  }, [protocols, categoryFilter]);

  // Apply category filter + sort
  const sorted = useMemo(() => {
    let filtered = barEntries;
    if (categoryFilter) {
      filtered = filtered.filter((e) => e.category === categoryFilter);
    }
    return sortMode === "growth"
      ? [...filtered].sort((a, b) => b.delta - a.delta)
      : [...filtered].sort((a, b) => b.avaxBurned - a.avaxBurned);
  }, [barEntries, categoryFilter, sortMode]);

  // Soft-cap Y-axis at P90 to prevent outlier compression
  const { capDelta, outliers } = useMemo(() => {
    if (sorted.length === 0) return { capDelta: 100, outliers: [] as BarEntry[] };
    const absDeltasSorted = [...sorted].map((p) => Math.abs(p.delta)).sort((a, b) => a - b);
    const p90Index = Math.floor(absDeltasSorted.length * 0.9);
    const p90 = absDeltasSorted[p90Index] || absDeltasSorted[absDeltasSorted.length - 1];
    const cap = Math.max(p90 * 1.2, 20); // 20% headroom above P90, min 20%
    const out = sorted.filter((p) => Math.abs(p.delta) > cap);
    return { capDelta: cap, outliers: out };
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
          {/* SVG axes */}
          <svg
            className="absolute inset-0 pointer-events-none"
            width="100%"
            height={chartHeight}
            style={{ overflow: "visible" }}
          >
            {/* Grid */}
            <line x1={MARGIN.left} y1={MARGIN.top} x2="100%" y2={MARGIN.top} stroke={gridColor} strokeDasharray="3 3" />
            <line x1={MARGIN.left} y1={zeroY} x2="100%" y2={zeroY} stroke={axisColor} strokeWidth="0.5" />
            <line x1={MARGIN.left} y1={MARGIN.top + plotHeight} x2="100%" y2={MARGIN.top + plotHeight} stroke={gridColor} strokeDasharray="3 3" />

            {/* Y-axis */}
            <line x1={MARGIN.left} y1={MARGIN.top + plotHeight} x2={MARGIN.left} y2={MARGIN.top} stroke={axisColor} strokeWidth="1.5" />
            <text x={14} y={chartHeight / 2} textAnchor="middle" dominantBaseline="central" fill={axisColor} fontSize="10" fontWeight="600" transform={`rotate(-90, 14, ${chartHeight / 2})`}>
              Growth %
            </text>
            <text x={MARGIN.left - 6} y={MARGIN.top + 2} textAnchor="end" fill={axisColor} fontSize="9">+{capDelta.toFixed(0)}%</text>
            <text x={MARGIN.left - 6} y={zeroY + 1} textAnchor="end" dominantBaseline="central" fill={axisColor} fontSize="9">0%</text>
            <text x={MARGIN.left - 6} y={MARGIN.top + plotHeight - 2} textAnchor="end" fill={axisColor} fontSize="9">-{capDelta.toFixed(0)}%</text>

            {/* X-axis */}
            <line x1={MARGIN.left} y1={MARGIN.top + plotHeight + 1} x2="100%" y2={MARGIN.top + plotHeight + 1} stroke={axisColor} strokeWidth="1.5" />
            <text x="50%" y={chartHeight - 4} textAnchor="middle" fill={axisColor} fontSize="10" fontWeight="600">
              AVAX Burned (bar width = share) — sorted by {sortMode === "growth" ? "highest growth" : "most burned"} first
            </text>
          </svg>

          {/* Bars */}
          <div
            className="absolute flex"
            style={{ left: MARGIN.left + 1, right: MARGIN.right, top: 0, height: chartHeight }}
          >
            {sorted.map((p) => {
              const widthPercent = totalBurned > 0 ? (p.avaxBurned / totalBurned) * 100 : 0;
              const minWidthPx = 4;

              // Clamp delta to cap for visual height
              const clampedDelta = Math.max(-capDelta, Math.min(capDelta, p.delta));
              const barHeightFrac = Math.abs(clampedDelta) / capDelta;
              const halfPlot = plotHeight / 2;
              const barHeight = Math.max(2, barHeightFrac * halfPlot);
              const isCapped = Math.abs(p.delta) > capDelta;

              const isPositive = p.delta >= 0;
              const color = getColor(p.category);
              const isHovered = hovered?.key === p.key;
              const isAggregated = p.count > 1;

              return (
                <div
                  key={p.key}
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
                      // Dashed border for aggregated entries
                      ...(isAggregated ? { border: `1px dashed ${isDark ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.2)"}` } : {}),
                    }}
                  />
                  {/* Capped indicator — small triangle at top/bottom edge */}
                  {isCapped && (
                    <div
                      className="absolute left-1/2 -translate-x-1/2 text-amber-500 text-[8px]"
                      style={isPositive ? { top: MARGIN.top - 2 } : { top: MARGIN.top + plotHeight + 2 }}
                    >
                      &#9650;
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Floating tooltip */}
        {hovered && (
          <div
            className="absolute z-50 pointer-events-none w-60 p-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-xl text-xs"
            style={{ top: 8, right: 8 }}
          >
            <div className="font-semibold text-zinc-900 dark:text-white truncate text-sm">{hovered.label}</div>
            <div className="text-zinc-400 dark:text-zinc-500 text-[10px] uppercase mt-0.5">
              {CATEGORY_LABELS[hovered.category] || hovered.category}
              {hovered.count > 1 && ` — ${hovered.count} protocols aggregated`}
            </div>
            <div className="grid grid-cols-2 gap-2 mt-2">
              <div>
                <div className="text-zinc-400 dark:text-zinc-500 text-[10px] uppercase">AVAX Burned</div>
                <div className="font-mono text-zinc-900 dark:text-white">{formatAvax(hovered.avaxBurned)}</div>
              </div>
              <div>
                <div className="text-zinc-400 dark:text-zinc-500 text-[10px] uppercase">
                  {hovered.count > 1 ? "Avg Growth" : "Growth"}
                </div>
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

        {/* Outlier disclaimer */}
        {outliers.length > 0 && (
          <div className="mt-3 flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 text-xs text-amber-700 dark:text-amber-400">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-medium">{outliers.length} outlier{outliers.length !== 1 ? "s" : ""} capped</span>
              <span className="text-amber-600 dark:text-amber-500"> — Y-axis capped at {capDelta.toFixed(0)}% for readability. </span>
              {outliers.slice(0, 5).map((o, i) => (
                <span key={o.key}>
                  {i > 0 && ", "}
                  <span className="font-medium">{o.label}</span>
                  <span className="opacity-75"> ({o.delta >= 0 ? "+" : ""}{o.delta.toFixed(0)}%, {formatAvax(o.avaxBurned)})</span>
                </span>
              ))}
              {outliers.length > 5 && <span className="opacity-75"> and {outliers.length - 5} more</span>}
            </div>
          </div>
        )}

        {/* Legend */}
        <div className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-3 text-center">
          {sorted.length} entr{sorted.length !== 1 ? "ies" : "y"}
          {sorted.some((s) => s.count > 1) && " (categories with 5+ protocols are aggregated)"}
          {" — "}bar width = AVAX burned share, bar height = period growth %
        </div>
      </div>
    </div>
  );
}
