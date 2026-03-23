"use client";

import { useState, useMemo } from "react";
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Brush,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  CATEGORY_LABELS,
  CATEGORY_COLORS,
  formatAvax,
  type DailyCategoryStat,
} from "./gas-treemap-utils";
import {
  calculateDateRangeDays,
  formatXAxisLabel,
  generateXAxisTicks,
} from "./chart-axis-utils";

interface GasCategoryTimelineProps {
  data: DailyCategoryStat[];
  isDark: boolean;
}

export function GasCategoryTimeline({ data, isDark }: GasCategoryTimelineProps) {
  const [hiddenCategories, setHiddenCategories] = useState<Set<string>>(new Set());

  // Detect all categories present in data, sorted by total AVAX burned desc
  const sortedCategories = useMemo(() => {
    const totals = new Map<string, number>();
    for (const point of data) {
      for (const [key, value] of Object.entries(point)) {
        if (key === "date" || key === "avgGasPriceGwei") continue;
        if (typeof value === "number") {
          totals.set(key, (totals.get(key) || 0) + value);
        }
      }
    }
    return Array.from(totals.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([cat]) => cat);
  }, [data]);

  const visibleCategories = useMemo(
    () => sortedCategories.filter((c) => !hiddenCategories.has(c)),
    [sortedCategories, hiddenCategories]
  );

  const rangeDays = useMemo(() => calculateDateRangeDays(data, "date"), [data]);
  const xAxisTicks = useMemo(() => generateXAxisTicks(data, rangeDays, "date"), [data, rangeDays]);

  if (data.length < 2) {
    return (
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6">
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">
          Gas Burn by Category
        </h3>
        <div className="flex items-center justify-center h-[200px] text-sm text-zinc-400 dark:text-zinc-500">
          Not enough data to display timeline
        </div>
      </div>
    );
  }

  const toggleCategory = (category: string) => {
    setHiddenCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  const getColor = (category: string) => {
    const colors = CATEGORY_COLORS[category] || CATEGORY_COLORS.other;
    return isDark ? colors.dark : colors.light;
  };

  const formatGasPrice = (value: number) => {
    if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
    if (value >= 1) return value.toFixed(1);
    return value.toFixed(2);
  };

  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">
            Gas Burn by Category
          </h3>
          <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">
            AVAX burned per day by protocol category — gas price overlay (nAVAX)
          </p>
        </div>
      </div>

      {/* Chart */}
      <div className="h-[350px] sm:h-[400px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={isDark ? "#27272a" : "#e4e4e7"}
              vertical={false}
            />
            <XAxis
              dataKey="date"
              tickFormatter={(v) => formatXAxisLabel(v, rangeDays)}
              ticks={xAxisTicks}
              interval={0}
              tick={{ fontSize: 11, fill: isDark ? "#71717a" : "#a1a1aa" }}
              axisLine={{ stroke: isDark ? "#3f3f46" : "#d4d4d8" }}
              tickLine={false}
            />
            <YAxis
              yAxisId="left"
              tickFormatter={(v) => {
                if (v >= 1000) return `${(v / 1000).toFixed(0)}K`;
                if (v >= 1) return v.toFixed(0);
                return v.toFixed(2);
              }}
              tick={{ fontSize: 11, fill: isDark ? "#71717a" : "#a1a1aa" }}
              axisLine={false}
              tickLine={false}
              label={{
                value: "AVAX Burned",
                angle: -90,
                position: "insideLeft",
                offset: 10,
                style: { fontSize: 10, fill: isDark ? "#52525b" : "#a1a1aa" },
              }}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tickFormatter={(v) => formatGasPrice(v)}
              tick={{ fontSize: 11, fill: isDark ? "#fbbf24" : "#d97706" }}
              axisLine={false}
              tickLine={false}
              label={{
                value: "Gas Price (nAVAX)",
                angle: 90,
                position: "insideRight",
                offset: 10,
                style: { fontSize: 10, fill: isDark ? "#fbbf2480" : "#d9770680" },
              }}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                // Separate area entries from gas price line
                const areas = payload.filter((p: any) => p.dataKey !== "avgGasPriceGwei");
                const gasPriceEntry = payload.find((p: any) => p.dataKey === "avgGasPriceGwei");
                // Sort by value desc
                const sorted = [...areas].sort((a: any, b: any) => (b.value || 0) - (a.value || 0));

                return (
                  <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-3 shadow-lg text-xs max-w-[240px]">
                    <div className="font-medium text-zinc-900 dark:text-white mb-2">
                      {formatXAxisLabel(label, rangeDays)}
                    </div>
                    {sorted.map((entry: any, i: number) => (
                      <div key={i} className="flex items-center justify-between gap-3 mb-0.5">
                        <div className="flex items-center gap-1.5">
                          <div
                            className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                            style={{ backgroundColor: entry.color }}
                          />
                          <span className="text-zinc-600 dark:text-zinc-400 truncate">
                            {entry.name}
                          </span>
                        </div>
                        <span className="font-mono text-zinc-900 dark:text-white">
                          {formatAvax(entry.value || 0)}
                        </span>
                      </div>
                    ))}
                    {gasPriceEntry && (
                      <div className="flex items-center justify-between gap-3 mt-1.5 pt-1.5 border-t border-zinc-200 dark:border-zinc-700">
                        <span className="text-amber-600 dark:text-amber-400">Gas Price</span>
                        <span className="font-mono text-amber-600 dark:text-amber-400">
                          {formatGasPrice(gasPriceEntry.value as number)} nAVAX
                        </span>
                      </div>
                    )}
                  </div>
                );
              }}
            />

            {/* Stacked areas — heaviest category at bottom */}
            {[...visibleCategories].reverse().map((category) => (
              <Area
                key={category}
                yAxisId="left"
                type="monotone"
                dataKey={category}
                stackId="1"
                name={CATEGORY_LABELS[category] || category}
                stroke={getColor(category)}
                fill={getColor(category)}
                fillOpacity={0.6}
                strokeWidth={0}
              />
            ))}

            {/* Gas price overlay line */}
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="avgGasPriceGwei"
              name="Avg Gas Price"
              stroke={isDark ? "#fbbf24" : "#d97706"}
              strokeWidth={2}
              dot={false}
              strokeDasharray="4 2"
            />

            {/* Brush range selector — hidden on mobile via CSS */}
            <Brush
              dataKey="date"
              height={28}
              stroke={isDark ? "#3f3f46" : "#d4d4d8"}
              fill={isDark ? "#18181b" : "#fafafa"}
              tickFormatter={(v) => formatXAxisLabel(v, rangeDays)}
              className="hidden sm:block"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Interactive legend */}
      <div className="flex flex-wrap gap-x-3 gap-y-1.5 mt-3 justify-center">
        {sortedCategories.map((category) => {
          const isHidden = hiddenCategories.has(category);
          return (
            <button
              key={category}
              onClick={() => toggleCategory(category)}
              className={`flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full transition-all ${
                isHidden
                  ? "opacity-40 hover:opacity-60"
                  : "opacity-100 hover:opacity-80"
              }`}
            >
              <div
                className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                style={{
                  backgroundColor: isHidden
                    ? (isDark ? "#52525b" : "#a1a1aa")
                    : getColor(category),
                }}
              />
              <span className="text-zinc-600 dark:text-zinc-400">
                {CATEGORY_LABELS[category] || category}
              </span>
            </button>
          );
        })}
        {/* Gas price legend entry */}
        <div className="flex items-center gap-1.5 text-xs px-2 py-0.5">
          <div
            className="w-4 h-0.5 flex-shrink-0"
            style={{
              backgroundColor: isDark ? "#fbbf24" : "#d97706",
              borderTop: "1px dashed",
              borderColor: isDark ? "#fbbf24" : "#d97706",
            }}
          />
          <span className="text-amber-600 dark:text-amber-400">Gas Price</span>
        </div>
      </div>
    </div>
  );
}
