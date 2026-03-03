"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Fuel,
  Activity,
  Flame,
  Users,
  TrendingUp,
  TrendingDown,
  Zap,
  BarChart3,
  Info,
  ArrowUpRight,
  ArrowDownRight
} from "lucide-react";

interface CategoryBreakdown {
  category: string;
  txCount: number;
  gasUsed: number;
  avaxBurned: number;
  gasCostUsd: number;
  avaxBurnedUsd: number;
  uniqueSenders: number;
  gasShare: number;
  delta: number;
}

interface ProtocolBreakdown {
  protocol: string;
  slug: string | null;
  category: string;
  txCount: number;
  gasUsed: number;
  avaxBurned: number;
  gasCostUsd: number;
  avaxBurnedUsd: number;
  uniqueSenders: number;
  gasShare: number;
  delta: number;
}

interface ChainStatsData {
  totalTransactions: number;
  totalGasUsed: number;
  totalAvaxBurned: number;
  categoryBreakdown: CategoryBreakdown[];
  protocolBreakdown: ProtocolBreakdown[];
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
  mev: "MEV Bots",
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

function formatUsd(num: number): string {
  if (num >= 1e6) return `$${(num / 1e6).toFixed(1)}M`;
  if (num >= 1e3) return `$${(num / 1e3).toFixed(1)}K`;
  if (num >= 1) return `$${num.toFixed(2)}`;
  return `$${num.toFixed(4)}`;
}

function formatGas(num: number): string {
  if (num >= 1e12) return `${(num / 1e12).toFixed(2)}T`;
  if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B`;
  if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
  if (num >= 1e3) return `${(num / 1e3).toFixed(2)}K`;
  return num.toFixed(2);
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

function getDeltaBgClass(delta: number): string {
  if (delta >= 5) return "bg-emerald-500/20 text-emerald-400";
  if (delta >= 1) return "bg-emerald-500/10 text-emerald-400";
  if (delta <= -5) return "bg-red-500/20 text-red-400";
  if (delta <= -1) return "bg-red-500/10 text-red-400";
  return "bg-zinc-500/10 text-zinc-400";
}

// Generic squarify layout - places items into a bounding box
interface SquarifyItem {
  key: string;
  value: number;
  [k: string]: unknown;
}

interface SquarifyRect<T extends SquarifyItem> {
  item: T;
  x: number;
  y: number;
  w: number;
  h: number;
}

function squarify<T extends SquarifyItem>(
  items: T[],
  x0: number,
  y0: number,
  containerW: number,
  containerH: number
): SquarifyRect<T>[] {
  if (items.length === 0) return [];

  const totalValue = items.reduce((sum, item) => sum + item.value, 0);
  if (totalValue === 0) return [];

  const sorted = [...items].sort((a, b) => b.value - a.value);
  const rects: SquarifyRect<T>[] = [];
  const totalArea = containerW * containerH;

  function layoutRow(
    row: T[],
    x: number,
    y: number,
    w: number,
    h: number,
    isHorizontal: boolean
  ): { x: number; y: number; w: number; h: number } {
    const rowTotal = row.reduce((sum, item) => sum + item.value, 0);

    if (isHorizontal) {
      const rowH =
        h * (rowTotal / totalValue) * (totalArea / (w * h)) || 0;
      const clampedH = Math.min(rowH, h);
      let cx = x;

      for (const item of row) {
        const cellW = rowTotal > 0 ? (item.value / rowTotal) * w : 0;
        rects.push({ item, x: cx, y, w: cellW, h: clampedH });
        cx += cellW;
      }

      return { x, y: y + clampedH, w, h: h - clampedH };
    } else {
      const rowW =
        w * (rowTotal / totalValue) * (totalArea / (w * h)) || 0;
      const clampedW = Math.min(rowW, w);
      let cy = y;

      for (const item of row) {
        const cellH = rowTotal > 0 ? (item.value / rowTotal) * h : 0;
        rects.push({ item, x, y: cy, w: clampedW, h: cellH });
        cy += cellH;
      }

      return { x: x + clampedW, y, w: w - clampedW, h };
    }
  }

  let remaining = [...sorted];
  let bounds = { x: x0, y: y0, w: containerW, h: containerH };

  while (remaining.length > 0) {
    const isHorizontal = bounds.w >= bounds.h;
    let bestRow: T[] = [remaining[0]];
    let bestAspect = Infinity;

    for (let i = 1; i <= remaining.length; i++) {
      const row = remaining.slice(0, i);
      const rowTotal = row.reduce((sum, item) => sum + item.value, 0);
      const fraction = rowTotal / totalValue;

      let worstAspect = 0;
      for (const item of row) {
        const itemFraction = item.value / rowTotal;
        let cellW: number, cellH: number;
        if (isHorizontal) {
          cellW = itemFraction * bounds.w;
          cellH = fraction * (totalArea / bounds.w);
        } else {
          cellW = fraction * (totalArea / bounds.h);
          cellH = itemFraction * bounds.h;
        }
        const aspect =
          cellW > 0 && cellH > 0
            ? Math.max(cellW / cellH, cellH / cellW)
            : Infinity;
        worstAspect = Math.max(worstAspect, aspect);
      }

      if (worstAspect <= bestAspect) {
        bestAspect = worstAspect;
        bestRow = row;
      } else {
        break;
      }
    }

    bounds = layoutRow(
      bestRow,
      bounds.x,
      bounds.y,
      bounds.w,
      bounds.h,
      isHorizontal
    );
    remaining = remaining.slice(bestRow.length);
  }

  return rects;
}

// --- Nested treemap data structures ---

interface CategoryItem extends SquarifyItem {
  key: string;
  value: number;
  category: string;
  label: string;
  gasShare: number;
  delta: number;
  txCount: number;
  gasUsed: number;
  avaxBurned: number;
  gasCostUsd: number;
  avaxBurnedUsd: number;
  uniqueSenders: number;
}

interface ProtocolItem extends SquarifyItem {
  key: string;
  value: number;
  protocol: string;
  category: string;
  gasShare: number;
  delta: number;
  txCount: number;
  gasUsed: number;
  avaxBurned: number;
  gasCostUsd: number;
  avaxBurnedUsd: number;
  uniqueSenders: number;
}

type HoveredInfo =
  | {
      type: "category";
      label: string;
      delta: number;
      gasShare: number;
      txCount: number;
      gasUsed: number;
      avaxBurned: number;
      gasCostUsd: number;
      avaxBurnedUsd: number;
      uniqueSenders: number;
      category: string;
    }
  | {
      type: "protocol";
      label: string;
      categoryLabel: string;
      delta: number;
      gasShare: number;
      txCount: number;
      gasUsed: number;
      avaxBurned: number;
      gasCostUsd: number;
      avaxBurnedUsd: number;
      uniqueSenders: number;
      category: string;
    };

const HEADER_HEIGHT = 18;
const MIN_NEST_HEIGHT = 50;
const PROTOCOL_OTHERS_THRESHOLD = 0.03; // 3% of category gas

// --- Trend insight generation ---

interface Insight {
  title: string;
  description: string;
  delta: number;
  deltaDirection: "up" | "down" | "neutral";
  icon: "trending" | "fire" | "zap" | "info";
  metric?: string;
}

function generateInsights(data: ChainStatsData): Insight[] {
  const insights: Insight[] = [];
  const cats = data.categoryBreakdown.filter((c) => Math.abs(c.delta) >= 1);
  const protos = data.protocolBreakdown.filter((p) => Math.abs(p.delta) >= 1);

  const catsUp = [...cats].sort((a, b) => b.delta - a.delta);
  const catsDown = [...cats].sort((a, b) => a.delta - b.delta);

  const coveredProtocols = new Set<string>();

  // 1. Top category mover (up)
  if (catsUp.length > 0 && catsUp[0].delta > 0) {
    const top = catsUp[0];
    const catLabel = CATEGORY_LABELS[top.category] || top.category;
    const catProtos = protos
      .filter((p) => p.category === top.category && p.delta > 0)
      .sort((a, b) => b.delta - a.delta);
    const driver = catProtos[0];

    insights.push({
      title: `${catLabel} Surging`,
      description: driver
        ? `Led by ${driver.protocol} with +${driver.delta.toFixed(1)}% gas increase`
        : `Category seeing strong growth in gas usage`,
      delta: top.delta,
      deltaDirection: "up",
      icon: "trending",
      metric: `${top.gasShare.toFixed(1)}% of total gas`,
    });
    if (driver) coveredProtocols.add(driver.protocol);
  }

  // 2. Top category mover (down)
  if (catsDown.length > 0 && catsDown[0].delta < 0) {
    const bottom = catsDown[0];
    const catLabel = CATEGORY_LABELS[bottom.category] || bottom.category;
    insights.push({
      title: `${catLabel} Declining`,
      description: `Largest category decline this period`,
      delta: bottom.delta,
      deltaDirection: "down",
      icon: "trending",
      metric: `${bottom.gasShare.toFixed(1)}% of total gas`,
    });
  }

  // 3. Biggest protocol mover (if not already covered)
  if (protos.length > 0) {
    const sorted = [...protos].sort(
      (a, b) => Math.abs(b.delta) - Math.abs(a.delta)
    );
    const biggest = sorted.find((p) => !coveredProtocols.has(p.protocol));
    if (biggest) {
      insights.push({
        title: `${biggest.protocol}`,
        description:
          biggest.delta >= 0
            ? `Biggest gainer among all protocols`
            : `Largest protocol decline this period`,
        delta: biggest.delta,
        deltaDirection: biggest.delta >= 0 ? "up" : "down",
        icon: "zap",
        metric: `${formatNumber(biggest.txCount)} txs`,
      });
    }
  }

  // 4. Coverage line
  if (data.coverage) {
    const pct = data.coverage.taggedGasPercent;
    insights.push({
      title: "Classification Coverage",
      description: `${(100 - pct).toFixed(1)}% of gas remains unclassified`,
      delta: pct,
      deltaDirection: "neutral",
      icon: "info",
      metric: `${pct.toFixed(1)}% classified`,
    });
  }

  return insights.slice(0, 4);
}

// --- Hover helpers (reduces repeated object construction) ---

function buildCategoryHover(cat: CategoryItem): HoveredInfo {
  return {
    type: "category",
    label: cat.label,
    delta: cat.delta,
    gasShare: cat.gasShare,
    txCount: cat.txCount,
    gasUsed: cat.gasUsed,
    avaxBurned: cat.avaxBurned,
    gasCostUsd: cat.gasCostUsd,
    avaxBurnedUsd: cat.avaxBurnedUsd,
    uniqueSenders: cat.uniqueSenders,
    category: cat.category,
  };
}

function buildProtocolHover(p: ProtocolItem, catLabel: string): HoveredInfo {
  return {
    type: "protocol",
    label: p.protocol,
    categoryLabel: catLabel,
    delta: p.delta,
    gasShare: p.gasShare,
    txCount: p.txCount,
    gasUsed: p.gasUsed,
    avaxBurned: p.avaxBurned,
    gasCostUsd: p.gasCostUsd,
    avaxBurnedUsd: p.avaxBurnedUsd,
    uniqueSenders: p.uniqueSenders,
    category: p.category,
  };
}

export default function GasTreemap() {
  const [data, setData] = useState<ChainStatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<TimeRange>("30d");
  const [hovered, setHovered] = useState<HoveredInfo | null>(null);
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

  // Build protocol lookup by category
  const protocolsByCategory = useMemo(() => {
    if (!data?.protocolBreakdown) return new Map<string, ProtocolBreakdown[]>();
    const map = new Map<string, ProtocolBreakdown[]>();
    for (const p of data.protocolBreakdown) {
      const list = map.get(p.category) || [];
      list.push(p);
      map.set(p.category, list);
    }
    return map;
  }, [data]);

  // Outer pass: category-level squarify
  const categoryRects = useMemo(() => {
    if (!data?.categoryBreakdown) return [];

    const items: CategoryItem[] = data.categoryBreakdown
      .filter((c) => c.gasShare > 0.1)
      .map((c) => ({
        key: c.category,
        value: c.gasUsed,
        category: c.category,
        label: CATEGORY_LABELS[c.category] || c.category,
        gasShare: c.gasShare,
        delta: c.delta,
        txCount: c.txCount,
        gasUsed: c.gasUsed,
        avaxBurned: c.avaxBurned,
        gasCostUsd: c.gasCostUsd,
        avaxBurnedUsd: c.avaxBurnedUsd,
        uniqueSenders: c.uniqueSenders,
      }));

    // Add unclassified block
    if (data.coverage) {
      const unclassifiedGas = Math.max(
        data.coverage.totalChainGas - data.totalGasUsed,
        0
      );
      const unclassifiedPercent = Math.max(
        0,
        100 - data.coverage.taggedGasPercent
      );
      if (unclassifiedPercent > 0.5) {
        items.push({
          key: "unclassified",
          value: unclassifiedGas,
          category: "unclassified",
          label: "Unclassified",
          gasShare: unclassifiedPercent,
          delta: 0,
          txCount: Math.max(
            data.coverage.totalChainTxs - data.totalTransactions,
            0
          ),
          gasUsed: unclassifiedGas,
          avaxBurned: Math.max(
            data.coverage.totalChainBurned - data.totalAvaxBurned,
            0
          ),
          gasCostUsd: 0,
          avaxBurnedUsd: 0,
          uniqueSenders: 0,
        });
      }
    }

    return squarify(items, 0, 0, dimensions.width, dimensions.height);
  }, [data, dimensions]);

  // Inner pass: protocol sub-rects within each category
  const nestedLayout = useMemo(() => {
    const result: {
      catRect: SquarifyRect<CategoryItem>;
      headerHeight: number;
      protocolRects: SquarifyRect<ProtocolItem>[];
      isFlat: boolean; // no nesting, render category label centered
    }[] = [];

    for (const catRect of categoryRects) {
      const cat = catRect.item;

      // Unclassified: always flat
      if (cat.category === "unclassified") {
        result.push({
          catRect,
          headerHeight: 0,
          protocolRects: [],
          isFlat: true,
        });
        continue;
      }

      const protocols = protocolsByCategory.get(cat.category) || [];

      // Too small to nest or only one protocol
      if (catRect.h < MIN_NEST_HEIGHT || catRect.w < 60 || protocols.length <= 1) {
        result.push({
          catRect,
          headerHeight: 0,
          protocolRects: [],
          isFlat: true,
        });
        continue;
      }

      // Aggregate small protocols into "Others"
      const catTotalGas = protocols.reduce((s, p) => s + p.gasUsed, 0);
      const significant: ProtocolItem[] = [];
      let othersGas = 0;
      let othersTx = 0;
      let othersBurned = 0;
      let othersShare = 0;
      let othersGasCostUsd = 0;
      let othersBurnedUsd = 0;
      let othersSenders = 0;

      for (const p of protocols) {
        if (catTotalGas > 0 && p.gasUsed / catTotalGas < PROTOCOL_OTHERS_THRESHOLD) {
          othersGas += p.gasUsed;
          othersTx += p.txCount;
          othersBurned += p.avaxBurned;
          othersShare += p.gasShare;
          othersGasCostUsd += p.gasCostUsd;
          othersBurnedUsd += p.avaxBurnedUsd;
          othersSenders += p.uniqueSenders;
        } else {
          significant.push({
            key: `${cat.category}:${p.protocol}`,
            value: p.gasUsed,
            protocol: p.protocol,
            category: cat.category,
            gasShare: p.gasShare,
            delta: p.delta,
            txCount: p.txCount,
            gasUsed: p.gasUsed,
            avaxBurned: p.avaxBurned,
            gasCostUsd: p.gasCostUsd,
            avaxBurnedUsd: p.avaxBurnedUsd,
            uniqueSenders: p.uniqueSenders,
          });
        }
      }

      if (othersGas > 0) {
        significant.push({
          key: `${cat.category}:others`,
          value: othersGas,
          protocol: "Others",
          category: cat.category,
          gasShare: othersShare,
          delta: 0,
          txCount: othersTx,
          gasUsed: othersGas,
          avaxBurned: othersBurned,
          gasCostUsd: othersGasCostUsd,
          avaxBurnedUsd: othersBurnedUsd,
          uniqueSenders: othersSenders,
        });
      }

      if (significant.length === 0) {
        result.push({
          catRect,
          headerHeight: 0,
          protocolRects: [],
          isFlat: true,
        });
        continue;
      }

      const hdr = HEADER_HEIGHT;
      const innerX = catRect.x + 1;
      const innerY = catRect.y + hdr + 1;
      const innerW = Math.max(0, catRect.w - 2);
      const innerH = Math.max(0, catRect.h - hdr - 2);

      const pRects = squarify(significant, innerX, innerY, innerW, innerH);

      result.push({
        catRect,
        headerHeight: hdr,
        protocolRects: pRects,
        isFlat: false,
      });
    }

    return result;
  }, [categoryRects, protocolsByCategory]);

  const insights = useMemo(() => {
    if (!data) return [];
    return generateInsights(data);
  }, [data]);

  const hoveredCategoryProtocols = useMemo(() => {
    if (!hovered || hovered.type !== "category") return [];
    const protocols = protocolsByCategory.get(hovered.category) || [];
    return [...protocols]
      .sort((a, b) => b.gasUsed - a.gasUsed)
      .slice(0, 12);
  }, [hovered, protocolsByCategory]);

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
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
            C-Chain Gas Map
          </h2>
          <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400">
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
          <defs>
            {nestedLayout.map(({ catRect }) => (
              <clipPath
                key={`clip-${catRect.item.category}`}
                id={`clip-${catRect.item.category}`}
              >
                <rect
                  x={catRect.x + 1}
                  y={catRect.y + 1}
                  width={Math.max(0, catRect.w - 2)}
                  height={Math.max(0, catRect.h - 2)}
                  rx={3}
                />
              </clipPath>
            ))}
          </defs>

          {nestedLayout.map(({ catRect, headerHeight, protocolRects, isFlat }) => {
            const cat = catRect.item;
            const isUnclassified = cat.category === "unclassified";
            const isHoveredCategory =
              hovered?.category === cat.category && hovered.type === "category";
            const isHoveredAny = hovered?.category === cat.category;

            // --- FLAT category rendering (unclassified, small, or single-protocol) ---
            if (isFlat) {
              const bgColor = isUnclassified
                ? "#1c1c24"
                : getDeltaColor(cat.delta);
              const showLabel = catRect.w > 60 && catRect.h > 35;
              const showDelta = catRect.w > 45 && catRect.h > 50;
              const showGasShare = catRect.w > 80 && catRect.h > 65;
              const labelSize = Math.min(
                16,
                Math.max(10, Math.min(catRect.w, catRect.h) / 5)
              );
              const deltaSize = Math.min(
                22,
                Math.max(12, Math.min(catRect.w, catRect.h) / 4)
              );
              const shareSize = Math.min(
                11,
                Math.max(8, Math.min(catRect.w, catRect.h) / 7)
              );

              return (
                <g
                  key={cat.category}
                  onMouseEnter={() => setHovered(buildCategoryHover(cat))}
                  onMouseLeave={() => setHovered(null)}
                  className="cursor-pointer"
                >
                  <rect
                    x={catRect.x + 1}
                    y={catRect.y + 1}
                    width={Math.max(0, catRect.w - 2)}
                    height={Math.max(0, catRect.h - 2)}
                    fill={bgColor}
                    rx={3}
                    opacity={isHoveredCategory ? 0.85 : 1}
                    stroke={isHoveredCategory ? "#fff" : "rgba(0,0,0,0.4)"}
                    strokeWidth={isHoveredCategory ? 2 : 1}
                  />
                  {showLabel && (
                    <text
                      x={catRect.x + catRect.w / 2}
                      y={
                        catRect.y +
                        (showDelta ? catRect.h * 0.3 : catRect.h / 2)
                      }
                      textAnchor="middle"
                      dominantBaseline="central"
                      fill="rgba(255,255,255,0.9)"
                      fontSize={labelSize}
                      fontWeight="600"
                      style={{ pointerEvents: "none" }}
                    >
                      {cat.label.length >
                      Math.floor(catRect.w / (labelSize * 0.6))
                        ? `${cat.label.slice(0, Math.floor(catRect.w / (labelSize * 0.6)))}...`
                        : cat.label}
                    </text>
                  )}
                  {showDelta && (
                    <text
                      x={catRect.x + catRect.w / 2}
                      y={catRect.y + catRect.h * 0.55}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fill={
                        isUnclassified
                          ? "#6b7280"
                          : getDeltaTextColor(cat.delta)
                      }
                      fontSize={deltaSize}
                      fontWeight="700"
                      style={{ pointerEvents: "none" }}
                    >
                      {isUnclassified
                        ? `${cat.gasShare.toFixed(1)}%`
                        : `${cat.delta >= 0 ? "+" : ""}${cat.delta.toFixed(1)}%`}
                    </text>
                  )}
                  {showGasShare && !isUnclassified && (
                    <text
                      x={catRect.x + catRect.w / 2}
                      y={catRect.y + catRect.h * 0.75}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fill="rgba(255,255,255,0.45)"
                      fontSize={shareSize}
                      fontWeight="400"
                      style={{ pointerEvents: "none" }}
                    >
                      {cat.gasShare.toFixed(1)}% of gas
                    </text>
                  )}
                </g>
              );
            }

            // --- NESTED category rendering ---
            const catLabel = cat.label;
            const headerFontSize = Math.min(
              11,
              Math.max(8, catRect.w / 15)
            );

            return (
              <g key={cat.category}>
                {/* Category border */}
                <rect
                  x={catRect.x + 1}
                  y={catRect.y + 1}
                  width={Math.max(0, catRect.w - 2)}
                  height={Math.max(0, catRect.h - 2)}
                  fill="none"
                  rx={3}
                  stroke={isHoveredAny ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.5)"}
                  strokeWidth={1}
                />

                {/* Category header strip */}
                <g
                  onMouseEnter={() => setHovered(buildCategoryHover(cat))}
                  onMouseLeave={() => setHovered(null)}
                  className="cursor-pointer"
                >
                  <rect
                    x={catRect.x + 1}
                    y={catRect.y + 1}
                    width={Math.max(0, catRect.w - 2)}
                    height={headerHeight}
                    fill="rgba(0,0,0,0.6)"
                    rx={0}
                    clipPath={`url(#clip-${cat.category})`}
                  />
                  {catRect.w > 40 && (
                    <text
                      x={catRect.x + 6}
                      y={catRect.y + 1 + headerHeight / 2}
                      textAnchor="start"
                      dominantBaseline="central"
                      fill="rgba(255,255,255,0.8)"
                      fontSize={headerFontSize}
                      fontWeight="600"
                      style={{ pointerEvents: "none" }}
                    >
                      {catLabel}
                      <tspan fill="rgba(255,255,255,0.35)" fontWeight="400">
                        {" "}
                        {cat.gasShare.toFixed(1)}%
                      </tspan>
                    </text>
                  )}
                  {catRect.w > 120 && (
                    <text
                      x={catRect.x + catRect.w - 6}
                      y={catRect.y + 1 + headerHeight / 2}
                      textAnchor="end"
                      dominantBaseline="central"
                      fill={getDeltaTextColor(cat.delta)}
                      fontSize={headerFontSize}
                      fontWeight="600"
                      style={{ pointerEvents: "none" }}
                    >
                      {cat.delta >= 0 ? "+" : ""}
                      {cat.delta.toFixed(1)}%
                    </text>
                  )}
                </g>

                {/* Protocol sub-boxes */}
                <g clipPath={`url(#clip-${cat.category})`}>
                  {protocolRects.map((pRect) => {
                    const p = pRect.item;
                    const isOthers = p.protocol === "Others";
                    const bgColor = isOthers
                      ? "#2a2a35"
                      : getDeltaColor(p.delta);

                    const isHoveredProto =
                      hovered?.type === "protocol" &&
                      hovered.category === cat.category &&
                      hovered.label === p.protocol;

                    const showLabel = pRect.w > 40 && pRect.h > 22;
                    const showDelta = pRect.w > 35 && pRect.h > 36;
                    const labelSize = Math.min(
                      12,
                      Math.max(8, Math.min(pRect.w, pRect.h) / 5)
                    );
                    const deltaSize = Math.min(
                      16,
                      Math.max(10, Math.min(pRect.w, pRect.h) / 4)
                    );
                    const maxChars = Math.floor(pRect.w / (labelSize * 0.55));

                    return (
                      <g
                        key={p.key}
                        onMouseEnter={() =>
                          setHovered(buildProtocolHover(p, cat.label))
                        }
                        onMouseLeave={() => setHovered(null)}
                        className="cursor-pointer"
                      >
                        <rect
                          x={pRect.x + 0.5}
                          y={pRect.y + 0.5}
                          width={Math.max(0, pRect.w - 1)}
                          height={Math.max(0, pRect.h - 1)}
                          fill={bgColor}
                          opacity={isHoveredProto ? 0.8 : 1}
                          stroke={
                            isHoveredProto
                              ? "rgba(255,255,255,0.6)"
                              : "rgba(0,0,0,0.3)"
                          }
                          strokeWidth={isHoveredProto ? 1.5 : 0.5}
                        />
                        {showLabel && (
                          <text
                            x={pRect.x + pRect.w / 2}
                            y={
                              pRect.y +
                              (showDelta ? pRect.h * 0.35 : pRect.h / 2)
                            }
                            textAnchor="middle"
                            dominantBaseline="central"
                            fill="rgba(255,255,255,0.85)"
                            fontSize={labelSize}
                            fontWeight="500"
                            style={{ pointerEvents: "none" }}
                          >
                            {p.protocol.length > maxChars
                              ? `${p.protocol.slice(0, maxChars)}...`
                              : p.protocol}
                          </text>
                        )}
                        {showDelta && (
                          <text
                            x={pRect.x + pRect.w / 2}
                            y={pRect.y + pRect.h * 0.65}
                            textAnchor="middle"
                            dominantBaseline="central"
                            fill={
                              isOthers
                                ? "#6b7280"
                                : getDeltaTextColor(p.delta)
                            }
                            fontSize={deltaSize}
                            fontWeight="700"
                            style={{ pointerEvents: "none" }}
                          >
                            {isOthers
                              ? "..."
                              : `${p.delta >= 0 ? "+" : ""}${p.delta.toFixed(1)}%`}
                          </text>
                        )}
                      </g>
                    );
                  })}
                </g>
              </g>
            );
          })}
        </svg>

        {/* Finviz-style Hover Tooltip */}
        {hovered && (
          <div className="absolute top-3 right-3 bg-zinc-900/98 backdrop-blur-sm border border-zinc-700 rounded-lg shadow-2xl pointer-events-none z-10 min-w-[320px] max-w-[400px] overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 border-b border-zinc-700/50 bg-zinc-800/50">
              <div className="flex items-center justify-between">
                <div>
                  {hovered.type === "protocol" && (
                    <span className="text-zinc-500 text-[10px] uppercase tracking-wider block mb-0.5">
                      {hovered.categoryLabel}
                    </span>
                  )}
                  <span className="font-semibold text-white text-base">
                    {hovered.label}
                  </span>
                </div>
                <div className="text-right">
                  <span
                    className={`inline-flex items-center gap-1 text-lg font-bold px-2 py-0.5 rounded ${getDeltaBgClass(hovered.delta)}`}
                  >
                    {hovered.delta >= 0 ? (
                      <ArrowUpRight className="w-4 h-4" />
                    ) : (
                      <ArrowDownRight className="w-4 h-4" />
                    )}
                    {hovered.delta >= 0 ? "+" : ""}
                    {hovered.delta.toFixed(2)}%
                  </span>
                </div>
              </div>
            </div>

            {/* Stats Grid */}
            <div className="px-4 py-3 grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-md bg-amber-500/10 flex items-center justify-center">
                  <Fuel className="w-3.5 h-3.5 text-amber-400" />
                </div>
                <div>
                  <div className="text-[10px] text-zinc-500 uppercase">Gas Share</div>
                  <div className="text-sm font-semibold text-white">{hovered.gasShare.toFixed(2)}%</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-md bg-blue-500/10 flex items-center justify-center">
                  <Activity className="w-3.5 h-3.5 text-blue-400" />
                </div>
                <div>
                  <div className="text-[10px] text-zinc-500 uppercase">Transactions</div>
                  <div className="text-sm font-semibold text-white">{formatNumber(hovered.txCount)}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-md bg-orange-500/10 flex items-center justify-center">
                  <Flame className="w-3.5 h-3.5 text-orange-400" />
                </div>
                <div>
                  <div className="text-[10px] text-zinc-500 uppercase">AVAX Burned</div>
                  <div className="text-sm font-semibold text-white">
                    {hovered.avaxBurned.toFixed(2)}
                    {hovered.avaxBurnedUsd > 0 && (
                      <span className="text-zinc-500 text-xs ml-1">
                        ({formatUsd(hovered.avaxBurnedUsd)})
                      </span>
                    )}
                  </div>
                </div>
              </div>
              {hovered.uniqueSenders > 0 && (
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-md bg-purple-500/10 flex items-center justify-center">
                    <Users className="w-3.5 h-3.5 text-purple-400" />
                  </div>
                  <div>
                    <div className="text-[10px] text-zinc-500 uppercase">Unique Senders</div>
                    <div className="text-sm font-semibold text-white">{formatNumber(hovered.uniqueSenders)}</div>
                  </div>
                </div>
              )}
            </div>

            {/* Protocol Table - Only for category hover */}
            {hovered.type === "category" && hoveredCategoryProtocols.length > 0 && (
              <div className="border-t border-zinc-700/50">
                <div className="px-4 py-2 bg-zinc-800/30">
                  <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Top Protocols</span>
                </div>
                <div className="max-h-[200px] overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-zinc-500 text-[10px] uppercase">
                        <th className="text-left px-4 py-1.5 font-medium">Protocol</th>
                        <th className="text-right px-2 py-1.5 font-medium">Gas</th>
                        <th className="text-right px-4 py-1.5 font-medium">Change</th>
                      </tr>
                    </thead>
                    <tbody>
                      {hoveredCategoryProtocols.map((p, idx) => (
                        <tr
                          key={p.protocol}
                          className={idx % 2 === 0 ? "bg-zinc-800/20" : ""}
                        >
                          <td className="px-4 py-1.5 text-zinc-200 font-medium truncate max-w-[140px]">
                            {p.protocol}
                          </td>
                          <td className="px-2 py-1.5 text-right text-zinc-400 font-mono">
                            {formatGas(p.gasUsed)}
                          </td>
                          <td className={`px-4 py-1.5 text-right font-semibold ${
                            p.delta >= 0 ? "text-emerald-400" : "text-red-400"
                          }`}>
                            {p.delta >= 0 ? "+" : ""}{p.delta.toFixed(1)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="px-4 py-2 border-t border-zinc-700/50 bg-zinc-800/30">
              <span className="text-[10px] text-zinc-500">
                vs previous {TIME_RANGES[timeRange].label} period
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Enhanced Insights Panel */}
      {insights.length > 0 && (
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-4 h-4 text-zinc-400" />
            <h3 className="text-sm font-semibold text-zinc-200">Market Insights</h3>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-500">
              {TIME_RANGES[timeRange].label} period
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {insights.map((insight, i) => (
              <div
                key={i}
                className={`relative overflow-hidden rounded-lg border p-3 transition-colors ${
                  insight.deltaDirection === "up"
                    ? "bg-emerald-500/5 border-emerald-500/20 hover:border-emerald-500/40"
                    : insight.deltaDirection === "down"
                      ? "bg-red-500/5 border-red-500/20 hover:border-red-500/40"
                      : "bg-zinc-800/50 border-zinc-700/50 hover:border-zinc-600"
                }`}
              >
                {/* Icon */}
                <div className={`absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center ${
                  insight.deltaDirection === "up"
                    ? "bg-emerald-500/10"
                    : insight.deltaDirection === "down"
                      ? "bg-red-500/10"
                      : "bg-zinc-700/50"
                }`}>
                  {insight.icon === "trending" && (
                    insight.deltaDirection === "up"
                      ? <TrendingUp className="w-4 h-4 text-emerald-400" />
                      : <TrendingDown className="w-4 h-4 text-red-400" />
                  )}
                  {insight.icon === "zap" && <Zap className="w-4 h-4 text-amber-400" />}
                  {insight.icon === "fire" && <Flame className="w-4 h-4 text-orange-400" />}
                  {insight.icon === "info" && <Info className="w-4 h-4 text-zinc-400" />}
                </div>

                {/* Content */}
                <div className="pr-10">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold text-zinc-100 truncate">
                      {insight.title}
                    </span>
                  </div>

                  {insight.deltaDirection !== "neutral" && (
                    <div className={`text-lg font-bold mb-1 ${
                      insight.deltaDirection === "up" ? "text-emerald-400" : "text-red-400"
                    }`}>
                      {insight.delta >= 0 ? "+" : ""}{insight.delta.toFixed(1)}%
                    </div>
                  )}

                  <p className="text-xs text-zinc-400 leading-relaxed">
                    {insight.description}
                  </p>

                  {insight.metric && (
                    <div className="mt-2 pt-2 border-t border-zinc-700/30">
                      <span className="text-[10px] uppercase text-zinc-500">
                        {insight.metric}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
