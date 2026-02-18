"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Fuel, Activity, Flame, TrendingUp, TrendingDown } from "lucide-react";

interface CategoryBreakdown {
  category: string;
  txCount: number;
  gasUsed: number;
  avaxBurned: number;
  gasShare: number;
  delta: number;
}

interface ChainStatsData {
  totalTransactions: number;
  totalGasUsed: number;
  totalAvaxBurned: number;
  categoryBreakdown: CategoryBreakdown[];
  coverage: {
    taggedGasPercent: number;
    taggedTxPercent: number;
    totalChainTxs: number;
    totalChainGas: number;
    totalChainBurned: number;
  };
}

type TimeRange = "1d" | "7d" | "30d" | "90d";

const TIME_RANGES: Record<TimeRange, { label: string; days: number }> = {
  "1d": { label: "1D", days: 1 },
  "7d": { label: "1W", days: 7 },
  "30d": { label: "1M", days: 30 },
  "90d": { label: "3M", days: 90 },
};

const CATEGORY_LABELS: Record<string, string> = {
  dex: "DEX",
  lending: "Lending",
  bridge: "Bridge",
  derivatives: "Derivatives",
  nft: "NFT",
  yield: "Yield",
  icm: "ICM",
  infrastructure: "Infrastructure",
  gaming: "Gaming",
  token: "Token",
  native: "Native Transfers",
  other: "Other",
};

function formatNumber(num: number): string {
  if (num >= 1e12) return `${(num / 1e12).toFixed(1)}T`;
  if (num >= 1e9) return `${(num / 1e9).toFixed(1)}B`;
  if (num >= 1e6) return `${(num / 1e6).toFixed(1)}M`;
  if (num >= 1e3) return `${(num / 1e3).toFixed(1)}K`;
  return num.toLocaleString();
}

// Finviz-style red/green color scale based on delta %
function getDeltaColor(delta: number): string {
  if (delta <= -10) return "#d12727";
  if (delta <= -5) return "#c93b3b";
  if (delta <= -2) return "#a94545";
  if (delta <= -0.5) return "#7a4a4a";
  if (delta < 0.5) return "#3d3d4a";
  if (delta < 2) return "#3a6e4e";
  if (delta < 5) return "#2d8e47";
  if (delta < 10) return "#28a745";
  return "#1db954";
}

function getDeltaTextColor(delta: number): string {
  const abs = Math.abs(delta);
  if (abs < 0.5) return "#9ca3af";
  if (delta > 0) return "#86efac";
  return "#fca5a5";
}

// Squarified treemap layout algorithm
interface TreemapRect {
  category: string;
  label: string;
  gasShare: number;
  delta: number;
  txCount: number;
  gasUsed: number;
  avaxBurned: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

function squarify(
  items: { category: string; label: string; gasShare: number; delta: number; txCount: number; gasUsed: number; avaxBurned: number; value: number }[],
  containerW: number,
  containerH: number
): TreemapRect[] {
  if (items.length === 0) return [];

  const totalValue = items.reduce((sum, item) => sum + item.value, 0);
  if (totalValue === 0) return [];

  const sorted = [...items].sort((a, b) => b.value - a.value);
  const rects: TreemapRect[] = [];

  function layoutRow(
    row: typeof sorted,
    x: number,
    y: number,
    w: number,
    h: number,
    isHorizontal: boolean
  ): { x: number; y: number; w: number; h: number } {
    const rowTotal = row.reduce((sum, item) => sum + item.value, 0);

    if (isHorizontal) {
      const rowH = h * (rowTotal / totalValue) * (containerW * containerH) / (w * h) || 0;
      const clampedH = Math.min(rowH, h);
      let cx = x;

      for (const item of row) {
        const cellW = rowTotal > 0 ? (item.value / rowTotal) * w : 0;
        rects.push({
          category: item.category,
          label: item.label,
          gasShare: item.gasShare,
          delta: item.delta,
          txCount: item.txCount,
          gasUsed: item.gasUsed,
          avaxBurned: item.avaxBurned,
          x: cx,
          y,
          w: cellW,
          h: clampedH,
        });
        cx += cellW;
      }

      return { x, y: y + clampedH, w, h: h - clampedH };
    } else {
      const rowW = w * (rowTotal / totalValue) * (containerW * containerH) / (w * h) || 0;
      const clampedW = Math.min(rowW, w);
      let cy = y;

      for (const item of row) {
        const cellH = rowTotal > 0 ? (item.value / rowTotal) * h : 0;
        rects.push({
          category: item.category,
          label: item.label,
          gasShare: item.gasShare,
          delta: item.delta,
          txCount: item.txCount,
          gasUsed: item.gasUsed,
          avaxBurned: item.avaxBurned,
          x,
          y: cy,
          w: clampedW,
          h: cellH,
        });
        cy += cellH;
      }

      return { x: x + clampedW, y, w: w - clampedW, h };
    }
  }

  // Simple slice-and-dice with aspect ratio optimization
  let remaining = [...sorted];
  let bounds = { x: 0, y: 0, w: containerW, h: containerH };

  while (remaining.length > 0) {
    const isHorizontal = bounds.w >= bounds.h;
    let bestRow: typeof sorted = [remaining[0]];
    let bestAspect = Infinity;

    for (let i = 1; i <= remaining.length; i++) {
      const row = remaining.slice(0, i);
      const rowTotal = row.reduce((sum, item) => sum + item.value, 0);
      const fraction = rowTotal / totalValue;

      // Calculate worst aspect ratio in this row
      let worstAspect = 0;
      for (const item of row) {
        const itemFraction = item.value / rowTotal;
        let cellW: number, cellH: number;
        if (isHorizontal) {
          cellW = itemFraction * bounds.w;
          cellH = fraction * (containerW * containerH / bounds.w);
        } else {
          cellW = fraction * (containerW * containerH / bounds.h);
          cellH = itemFraction * bounds.h;
        }
        const aspect = cellW > 0 && cellH > 0 ? Math.max(cellW / cellH, cellH / cellW) : Infinity;
        worstAspect = Math.max(worstAspect, aspect);
      }

      if (worstAspect <= bestAspect) {
        bestAspect = worstAspect;
        bestRow = row;
      } else {
        break;
      }
    }

    bounds = layoutRow(bestRow, bounds.x, bounds.y, bounds.w, bounds.h, isHorizontal);
    remaining = remaining.slice(bestRow.length);
  }

  return rects;
}

export default function GasTreemap() {
  const [data, setData] = useState<ChainStatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<TimeRange>("30d");
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState({ width: 900, height: 500 });

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const days = TIME_RANGES[timeRange].days;
        const response = await fetch(`/api/dapps/chain-stats?days=${days}`);
        if (response.ok) {
          setData(await response.json());
        }
      } catch (err) {
        console.error("Error fetching treemap data:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [timeRange]);

  // Responsive container
  const containerRef = useCallback((node: HTMLDivElement | null) => {
    if (!node) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setDimensions({
          width: entry.contentRect.width,
          height: Math.max(400, Math.min(600, entry.contentRect.width * 0.55)),
        });
      }
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const rects = useMemo(() => {
    if (!data?.categoryBreakdown) return [];

    const items = data.categoryBreakdown
      .filter((c) => c.gasShare > 0.1)
      .map((c) => ({
        category: c.category,
        label: CATEGORY_LABELS[c.category] || c.category,
        gasShare: c.gasShare,
        delta: c.delta,
        txCount: c.txCount,
        gasUsed: c.gasUsed,
        avaxBurned: c.avaxBurned,
        value: c.gasUsed,
      }));

    // Add unclassified block
    if (data.coverage) {
      const unclassifiedPercent = Math.max(0, 100 - data.coverage.taggedGasPercent);
      if (unclassifiedPercent > 0.5) {
        items.push({
          category: "unclassified",
          label: "Unclassified",
          gasShare: unclassifiedPercent,
          delta: 0,
          txCount: Math.max(data.coverage.totalChainTxs - data.totalTransactions, 0),
          gasUsed: Math.max(data.coverage.totalChainGas - data.totalGasUsed, 0),
          avaxBurned: Math.max(data.coverage.totalChainBurned - data.totalAvaxBurned, 0),
          value: Math.max(data.coverage.totalChainGas - data.totalGasUsed, 0),
        });
      }
    }

    return squarify(items, dimensions.width, dimensions.height);
  }, [data, dimensions]);

  const hoveredData = useMemo(() => {
    if (!hoveredCategory) return null;
    return rects.find((r) => r.category === hoveredCategory) || null;
  }, [hoveredCategory, rects]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse">
          <div className="h-8 w-48 bg-zinc-200 dark:bg-zinc-800 rounded mb-4" />
          <div className="h-[500px] bg-zinc-200 dark:bg-zinc-800 rounded-lg" />
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
            C-Chain Gas Map
          </h2>
          <span className="text-xs text-zinc-400 dark:text-zinc-500">
            {data.coverage?.taggedGasPercent.toFixed(1)}% classified
          </span>
        </div>

        {/* Time range pills */}
        <div className="flex items-center bg-zinc-900 rounded-md overflow-hidden border border-zinc-700">
          {(Object.keys(TIME_RANGES) as TimeRange[]).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                timeRange === range
                  ? "bg-zinc-700 text-white"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
              }`}
            >
              {TIME_RANGES[range].label}
            </button>
          ))}
        </div>
      </div>

      {/* Treemap */}
      <div
        ref={containerRef}
        className="relative rounded-lg overflow-hidden bg-zinc-950 border border-zinc-800"
        style={{ height: dimensions.height }}
      >
        <svg
          width={dimensions.width}
          height={dimensions.height}
          viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
        >
          {rects.map((rect) => {
            const isHovered = hoveredCategory === rect.category;
            const bgColor =
              rect.category === "unclassified"
                ? "#1c1c24"
                : getDeltaColor(rect.delta);

            const showLabel = rect.w > 60 && rect.h > 35;
            const showDelta = rect.w > 45 && rect.h > 50;
            const showGasShare = rect.w > 80 && rect.h > 65;

            // Font sizing based on cell size
            const labelSize = Math.min(16, Math.max(10, Math.min(rect.w, rect.h) / 5));
            const deltaSize = Math.min(22, Math.max(12, Math.min(rect.w, rect.h) / 4));
            const shareSize = Math.min(11, Math.max(8, Math.min(rect.w, rect.h) / 7));

            return (
              <g
                key={rect.category}
                onMouseEnter={() => setHoveredCategory(rect.category)}
                onMouseLeave={() => setHoveredCategory(null)}
                className="cursor-pointer"
              >
                <rect
                  x={rect.x + 1}
                  y={rect.y + 1}
                  width={Math.max(0, rect.w - 2)}
                  height={Math.max(0, rect.h - 2)}
                  fill={bgColor}
                  rx={3}
                  opacity={isHovered ? 0.85 : 1}
                  stroke={isHovered ? "#fff" : "rgba(0,0,0,0.4)"}
                  strokeWidth={isHovered ? 2 : 1}
                />
                {showLabel && (
                  <text
                    x={rect.x + rect.w / 2}
                    y={rect.y + (showDelta ? rect.h * 0.3 : rect.h / 2)}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill="rgba(255,255,255,0.9)"
                    fontSize={labelSize}
                    fontWeight="600"
                    style={{ pointerEvents: "none" }}
                  >
                    {rect.label.length > Math.floor(rect.w / (labelSize * 0.6))
                      ? `${rect.label.slice(0, Math.floor(rect.w / (labelSize * 0.6)))}...`
                      : rect.label}
                  </text>
                )}
                {showDelta && (
                  <text
                    x={rect.x + rect.w / 2}
                    y={rect.y + rect.h * 0.55}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill={
                      rect.category === "unclassified"
                        ? "#6b7280"
                        : getDeltaTextColor(rect.delta)
                    }
                    fontSize={deltaSize}
                    fontWeight="700"
                    style={{ pointerEvents: "none" }}
                  >
                    {rect.category === "unclassified"
                      ? `${rect.gasShare.toFixed(1)}%`
                      : `${rect.delta >= 0 ? "+" : ""}${rect.delta.toFixed(1)}%`}
                  </text>
                )}
                {showGasShare && rect.category !== "unclassified" && (
                  <text
                    x={rect.x + rect.w / 2}
                    y={rect.y + rect.h * 0.75}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill="rgba(255,255,255,0.45)"
                    fontSize={shareSize}
                    fontWeight="400"
                    style={{ pointerEvents: "none" }}
                  >
                    {rect.gasShare.toFixed(1)}% of gas
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {/* Hover tooltip */}
        {hoveredData && (
          <div className="absolute top-3 right-3 bg-zinc-900/95 backdrop-blur-sm border border-zinc-700 rounded-lg px-4 py-3 shadow-2xl text-sm pointer-events-none z-10 min-w-[200px]">
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-white">{hoveredData.label}</span>
              <span
                className="flex items-center gap-1 text-sm font-bold"
                style={{ color: getDeltaTextColor(hoveredData.delta) }}
              >
                {hoveredData.delta >= 0 ? (
                  <TrendingUp className="w-3.5 h-3.5" />
                ) : (
                  <TrendingDown className="w-3.5 h-3.5" />
                )}
                {hoveredData.delta >= 0 ? "+" : ""}
                {hoveredData.delta.toFixed(2)}%
              </span>
            </div>
            <div className="space-y-1 text-zinc-400 text-xs">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Fuel className="w-3 h-3 text-amber-400" /> Gas Share
                </span>
                <span className="text-zinc-200 font-medium">
                  {hoveredData.gasShare.toFixed(2)}%
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Activity className="w-3 h-3 text-blue-400" /> Transactions
                </span>
                <span className="text-zinc-200 font-medium">
                  {formatNumber(hoveredData.txCount)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Flame className="w-3 h-3 text-orange-400" /> AVAX Burned
                </span>
                <span className="text-zinc-200 font-medium">
                  {hoveredData.avaxBurned.toFixed(2)}
                </span>
              </div>
            </div>
            <div className="mt-2 pt-2 border-t border-zinc-700/50 text-[10px] text-zinc-500">
              vs previous {TIME_RANGES[timeRange].label} period
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
