"use client";

import { useState, useMemo } from "react";
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

export function GasBurnBars({ protocols, isDark }: GasBurnBarsProps) {
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [hovered, setHovered] = useState<ProtocolBreakdown | null>(null);

  // Get all categories present, sorted by total AVAX burned
  const categories = useMemo(() => {
    const totals = new Map<string, number>();
    for (const p of protocols) {
      totals.set(p.category, (totals.get(p.category) || 0) + p.avaxBurned);
    }
    return Array.from(totals.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([cat]) => cat);
  }, [protocols]);

  // Filter + sort by delta desc (highest growth first)
  const sorted = useMemo(() => {
    let filtered = protocols.filter((p) => p.avaxBurned > 0);
    if (categoryFilter) {
      filtered = filtered.filter((p) => p.category === categoryFilter);
    }
    return filtered.sort((a, b) => b.delta - a.delta);
  }, [protocols, categoryFilter]);

  // Compute scales
  const maxDelta = useMemo(() => {
    if (sorted.length === 0) return 100;
    const maxAbs = Math.max(...sorted.map((p) => Math.abs(p.delta)));
    return Math.max(maxAbs, 10); // minimum scale
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

  // Chart layout
  const chartHeight = 350;
  const zeroY = chartHeight / 2; // midpoint — positive above, negative below

  return (
    <div>
      {/* Category filter pills */}
      <div className="flex flex-wrap gap-1.5 mb-4">
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

      {/* Chart */}
      <div className="relative overflow-x-auto">
        <div
          className="relative"
          style={{
            height: chartHeight + 40, // extra for labels
            minWidth: Math.max(sorted.length * 20, 300),
          }}
        >
          {/* Zero line */}
          <div
            className="absolute left-0 right-0 border-t border-zinc-300 dark:border-zinc-600"
            style={{ top: zeroY }}
          />
          {/* Zero label */}
          <div
            className="absolute -left-1 text-[10px] text-zinc-400 dark:text-zinc-500 -translate-y-1/2"
            style={{ top: zeroY }}
          >
            0%
          </div>

          {/* Y-axis labels */}
          <div
            className="absolute -left-1 text-[10px] text-zinc-400 dark:text-zinc-500"
            style={{ top: 4 }}
          >
            +{maxDelta.toFixed(0)}%
          </div>
          <div
            className="absolute -left-1 text-[10px] text-zinc-400 dark:text-zinc-500"
            style={{ bottom: 44 }}
          >
            -{maxDelta.toFixed(0)}%
          </div>

          {/* Bars */}
          <div className="absolute left-8 right-0 top-0 flex items-end" style={{ height: chartHeight }}>
            {sorted.map((p, i) => {
              // Width proportional to AVAX burned share
              const widthPercent = totalBurned > 0 ? (p.avaxBurned / totalBurned) * 100 : 0;
              const minWidthPx = 6;

              // Height proportional to delta (growth %)
              const clampedDelta = Math.max(-maxDelta, Math.min(maxDelta, p.delta));
              const barHeightFrac = Math.abs(clampedDelta) / maxDelta;
              const maxBarHeight = zeroY - 4; // leave some padding
              const barHeight = Math.max(2, barHeightFrac * maxBarHeight);

              const isPositive = p.delta >= 0;
              const color = getColor(p.category);
              const isHovered = hovered?.protocol === p.protocol;

              return (
                <div
                  key={p.protocol}
                  className="relative flex-shrink-0 group cursor-pointer"
                  style={{
                    width: `max(${widthPercent}%, ${minWidthPx}px)`,
                    height: chartHeight,
                  }}
                  onMouseEnter={() => setHovered(p)}
                  onMouseLeave={() => setHovered(null)}
                >
                  {/* The bar */}
                  <div
                    className="absolute left-[1px] right-[1px] rounded-sm transition-opacity"
                    style={{
                      backgroundColor: color,
                      opacity: isHovered ? 1 : 0.8,
                      height: barHeight,
                      ...(isPositive
                        ? { bottom: chartHeight - zeroY }
                        : { top: zeroY }),
                    }}
                  />

                  {/* Hover tooltip */}
                  {isHovered && (
                    <div
                      className="absolute z-50 pointer-events-none w-56 p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg text-xs"
                      style={{
                        left: "50%",
                        transform: "translateX(-50%)",
                        ...(isPositive
                          ? { bottom: chartHeight - zeroY + barHeight + 8 }
                          : { top: zeroY + barHeight + 8 }),
                      }}
                    >
                      <div className="font-semibold text-zinc-900 dark:text-white truncate">{p.protocol}</div>
                      <div className="text-zinc-400 dark:text-zinc-500 text-[10px] uppercase mt-0.5">
                        {CATEGORY_LABELS[p.category] || p.category}
                      </div>
                      <div className="grid grid-cols-2 gap-1.5 mt-1.5">
                        <div>
                          <div className="text-zinc-400 dark:text-zinc-500 text-[10px]">AVAX Burned</div>
                          <div className="font-mono text-zinc-900 dark:text-white">{formatAvax(p.avaxBurned)}</div>
                        </div>
                        <div>
                          <div className="text-zinc-400 dark:text-zinc-500 text-[10px]">Growth</div>
                          <div className={`font-mono font-semibold ${p.delta >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                            {p.delta >= 0 ? "+" : ""}{p.delta.toFixed(1)}%
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Legend: protocol count */}
        <div className="text-xs text-zinc-400 dark:text-zinc-500 mt-2 text-center">
          {sorted.length} protocol{sorted.length !== 1 ? "s" : ""} — bar width = AVAX burned share, bar height = period growth %
        </div>
      </div>
    </div>
  );
}
