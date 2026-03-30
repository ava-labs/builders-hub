"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import {
  Fuel,
  Activity,
  Flame,
  Users,
  TrendingUp,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  LayoutGrid,
  Table2,
  HelpCircle,
} from "lucide-react";
import { ProtocolSpotlight } from "./gas-treemap-spotlight";
import { GasTreemapTable } from "./gas-treemap-table";
import ContractGasXray from "./contract-gas-xray";
import { GasCategoryTimeline } from "./gas-category-timeline";
import { GasBurnBars } from "./gas-burn-bars";
import { CustomDateRangePicker } from "@/components/custom-date-range-picker";
import { differenceInCalendarDays, format } from "date-fns";
import type { DateRange } from "react-day-picker";
import { useTheme } from "@/components/content-design/theme-observer";
import {
  CATEGORY_LABELS,
  SUBCATEGORY_LABELS,
  formatNumber,
  formatAvax,
  formatUsd,
  getDeltaColor,
  getDeltaTextColor,
  getDeltaBgClass,
  type CategoryBreakdown,
  type ProtocolBreakdown,
  type DailyCategoryStat,
} from "./gas-treemap-utils";

type ViewMode = "treemap" | "table" | "bars";

interface ChainStatsData {
  totalTransactions: number;
  totalGasUsed: number;
  totalAvaxBurned: number;
  topBurnerAddress: string | null;
  categoryBreakdown: CategoryBreakdown[];
  protocolBreakdown: ProtocolBreakdown[];
  dailyCategoryStats?: DailyCategoryStat[];
  topBreadcrumbs?: { address: string; txCount: number; gasUsed: number; avaxBurned: number }[];
  coverage: {
    taggedGasPercent: number;
    taggedTxPercent: number;
    totalChainTxs: number;
    totalChainGas: number;
    totalChainBurned: number;
  };
}

type TimeRange = "1d" | "7d" | "30d" | "90d" | "custom";

const TIME_RANGES: Record<Exclude<TimeRange, "custom">, { label: string; days: number }> = {
  "1d": { label: "1D", days: 1 },
  "7d": { label: "1W", days: 7 },
  "30d": { label: "1M", days: 30 },
  "90d": { label: "3M", days: 90 },
};

const PRESET_KEYS = Object.keys(TIME_RANGES) as Exclude<TimeRange, "custom">[];

function estimateLoadTime(days: number): number {
  if (days <= 1) return 10;
  if (days <= 7) return 20;
  if (days <= 30) return 35;
  if (days <= 90) return 50;
  return 60;
}

const LOADING_PHASES = [
  "Scanning blocks...",
  "Aggregating protocols...",
  "Computing deltas...",
  "Almost done...",
];

import { squarify, type SquarifyItem, type SquarifyRect } from "./squarify";

// --- Nested treemap data structures ---

interface CategoryItem extends SquarifyItem {
  key: string;
  value: number;
  category: string;
  label: string;
  gasShare: number;
  burnShare: number;
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
  subcategory: string | null;
  gasShare: number;
  burnShare: number;
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
      burnShare: number;
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
      subcategoryLabel: string | null;
      delta: number;
      gasShare: number;
      burnShare: number;
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

// --- Insight row generation (2 rows: Top Burners + Fastest Growing) ---

interface InsightCard {
  protocol: string;
  category: string;
  avaxBurned: number;
  avaxBurnedUsd: number;
  delta: number;
  gasShare: number;
  txCount: number;
  uniqueSenders: number;
}

interface InsightRow {
  title: string;
  subtitle: string;
  icon: "flame" | "trending";
  cards: InsightCard[];
}

function generateInsightRows(data: ChainStatsData): InsightRow[] {
  const rows: InsightRow[] = [];
  const protos = data.protocolBreakdown;

  // Row 1: Top Burners (by absolute avaxBurned)
  const topBurners = [...protos]
    .sort((a, b) => b.avaxBurned - a.avaxBurned)
    .slice(0, 3);

  if (topBurners.length > 0) {
    rows.push({
      title: "Top Burners",
      subtitle: "by AVAX burned",
      icon: "flame",
      cards: topBurners.map((p) => ({
        protocol: p.protocol,
        category: p.category,
        avaxBurned: p.avaxBurned,
        avaxBurnedUsd: p.avaxBurnedUsd,
        delta: p.delta,
        gasShare: p.gasShare,
        txCount: p.txCount,
        uniqueSenders: p.uniqueSenders,
      })),
    });
  }

  // Row 2: Fastest Growing (by delta %, filter noise below 0.05% gas share)
  const fastestGrowing = [...protos]
    .filter((p) => p.delta > 0 && p.gasShare > 0.05)
    .sort((a, b) => b.delta - a.delta)
    .slice(0, 3);

  if (fastestGrowing.length > 0) {
    rows.push({
      title: "Fastest Growing",
      subtitle: "by period growth",
      icon: "trending",
      cards: fastestGrowing.map((p) => ({
        protocol: p.protocol,
        category: p.category,
        avaxBurned: p.avaxBurned,
        avaxBurnedUsd: p.avaxBurnedUsd,
        delta: p.delta,
        gasShare: p.gasShare,
        txCount: p.txCount,
        uniqueSenders: p.uniqueSenders,
      })),
    });
  }

  return rows;
}

// --- Hover helpers (reduces repeated object construction) ---

function buildCategoryHover(cat: CategoryItem): HoveredInfo {
  return {
    type: "category",
    label: cat.label,
    delta: cat.delta,
    gasShare: cat.gasShare,
    burnShare: cat.burnShare,
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
    subcategoryLabel: p.subcategory ? (SUBCATEGORY_LABELS[p.subcategory] || p.subcategory) : null,
    delta: p.delta,
    gasShare: p.gasShare,
    burnShare: p.burnShare,
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
  const theme = useTheme();
  const isDark = theme === "dark";
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<TimeRange>("30d");
  const [customRange, setCustomRange] = useState<DateRange | undefined>(undefined);
  const [customPopoverOpen, setCustomPopoverOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("treemap");
  const [hovered, setHovered] = useState<HoveredInfo | null>(null);
  const [hoveredInsight, setHoveredInsight] = useState<{ row: number; col: number } | null>(null);
  const [dimensions, setDimensions] = useState({ width: 900, height: 500 });
  const [loadingStartTime, setLoadingStartTime] = useState(() => Date.now());
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingPhase, setLoadingPhase] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  // Default to table view on mobile after hydration
  useEffect(() => {
    if (window.innerWidth < 640) setViewMode("table");
  }, []);

  // Compute active days from either preset or custom range
  const activeDays = useMemo(() => {
    if (timeRange === "custom" && customRange?.from && customRange?.to) {
      return Math.min(differenceInCalendarDays(customRange.to, customRange.from) + 1, 183);
    }
    return TIME_RANGES[timeRange as Exclude<TimeRange, "custom">]?.days ?? 30;
  }, [timeRange, customRange]);

  useEffect(() => {
    // Abort previous request
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const fetchData = async () => {
      try {
        setLoading(true);
        setLoadingStartTime(Date.now());
        setLoadingProgress(0);
        setLoadingPhase(0);
        let url: string;
        if (timeRange === "custom" && customRange?.from && customRange?.to) {
          const startDate = format(customRange.from, 'yyyy-MM-dd');
          const endDate = format(customRange.to, 'yyyy-MM-dd');
          url = `/api/dapps/chain-stats?startDate=${startDate}&endDate=${endDate}`;
        } else {
          url = `/api/dapps/chain-stats?days=${activeDays}`;
        }
        const response = await fetch(url, {
          signal: controller.signal,
        });
        if (response.ok) {
          setData(await response.json());
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        console.error("Error fetching treemap data:", err);
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };
    fetchData();

    return () => controller.abort();
  }, [activeDays, timeRange, customRange]);

  // Loading animation timer
  useEffect(() => {
    if (!loading) return;
    const estimate = estimateLoadTime(activeDays);
    const interval = setInterval(() => {
      const elapsed = (Date.now() - loadingStartTime) / 1000;
      // Asymptotic to 95%
      const progress = Math.min(95, (elapsed / estimate) * 80);
      setLoadingProgress(progress);
      // Phase transitions at 20%, 45%, 70%, 85%
      const phase = progress < 20 ? 0 : progress < 45 ? 1 : progress < 70 ? 2 : 3;
      setLoadingPhase(phase);
    }, 200);
    return () => clearInterval(interval);
  }, [loading, loadingStartTime, activeDays]);

  // Responsive container
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setDimensions({
          width: entry.contentRect.width,
          height: entry.contentRect.width < 500
            ? Math.max(350, entry.contentRect.width * 0.9)
            : Math.max(400, Math.min(600, entry.contentRect.width * 0.55)),
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

    const totalBurned = data.coverage?.totalChainBurned || 1;
    const items: CategoryItem[] = data.categoryBreakdown
      .filter((c) => c.gasShare > 0.1)
      .map((c) => ({
        key: c.category,
        value: c.avaxBurned,
        category: c.category,
        label: CATEGORY_LABELS[c.category] || c.category,
        gasShare: c.gasShare,
        burnShare: totalBurned > 0 ? (c.avaxBurned / totalBurned) * 100 : 0,
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
      const unclassifiedBurned = Math.max(
        data.coverage.totalChainBurned - data.totalAvaxBurned,
        0
      );
      const unclassifiedPercent = Math.max(
        0,
        100 - data.coverage.taggedGasPercent
      );
      if (unclassifiedPercent > 0.5) {
        items.push({
          key: "unclassified",
          value: unclassifiedBurned,
          category: "unclassified",
          label: "Breadcrumbs",
          gasShare: unclassifiedPercent,
          burnShare: totalBurned > 0 ? (unclassifiedBurned / totalBurned) * 100 : 0,
          delta: 0,
          txCount: Math.max(
            data.coverage.totalChainTxs - data.totalTransactions,
            0
          ),
          gasUsed: unclassifiedGas,
          avaxBurned: unclassifiedBurned,
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

      // Show all protocols individually (no "Others" bucket)
      // Compute total burned from all category rects for burnShare calculation
      const allBurned = categoryRects.reduce((s, r) => s + r.item.avaxBurned, 0) || 1;
      const significant: ProtocolItem[] = protocols.map((p) => ({
        key: `${cat.category}:${p.protocol}`,
        value: p.avaxBurned,
        protocol: p.protocol,
        category: cat.category,
        subcategory: p.subcategory || null,
        gasShare: p.gasShare,
        burnShare: allBurned > 0 ? (p.avaxBurned / allBurned) * 100 : 0,
        delta: p.delta,
        txCount: p.txCount,
        gasUsed: p.gasUsed,
        avaxBurned: p.avaxBurned,
        gasCostUsd: p.gasCostUsd,
        avaxBurnedUsd: p.avaxBurnedUsd,
        uniqueSenders: p.uniqueSenders,
      }));

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

  const insightRows = useMemo(() => {
    if (!data) return [];
    return generateInsightRows(data);
  }, [data]);

  const hoveredCategoryProtocols = useMemo(() => {
    if (!hovered || hovered.type !== "category") return [];
    const protocols = protocolsByCategory.get(hovered.category) || [];
    return [...protocols]
      .sort((a, b) => b.gasUsed - a.gasUsed)
      .slice(0, 12);
  }, [hovered, protocolsByCategory]);

  if (!data && !loading) return null;

  const timeRangeLabel = timeRange === "custom" && customRange?.from && customRange?.to
    ? `${format(customRange.from, "MMM d")} – ${format(customRange.to, "MMM d")}`
    : null;

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
            AVAX Burners
          </h2>
          {data && (
            <>
              <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400">
                {data.coverage?.totalChainBurned
                  ? ((data.totalAvaxBurned / data.coverage.totalChainBurned) * 100).toFixed(1)
                  : data.coverage?.taggedGasPercent.toFixed(1)}% classified
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20">
                {formatAvax(data.coverage?.totalChainBurned ?? data.totalAvaxBurned)}
              </span>
              <div className="relative group">
                <HelpCircle className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500 cursor-help" />
                <div className="absolute left-0 top-full mt-2 z-50 hidden group-hover:block w-72 p-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  <p className="font-medium text-zinc-900 dark:text-white mb-1">How to read this treemap</p>
                  <p><strong>Box size</strong> = share of total AVAX burned on C-Chain.</p>
                  <p className="mt-1"><strong>Percentages inside boxes</strong> (e.g. +54%) = change vs the previous period of equal length.</p>
                  <p className="mt-1"><strong>Colors</strong>: green = growing, red = shrinking, gray = flat.</p>
                  <p className="mt-1"><strong>Breadcrumbs</strong> = transactions to contracts not yet classified.</p>
                </div>
              </div>
            </>
          )}
        </div>

        {/* View toggle + Time range pills */}
        <div className="flex flex-wrap items-center gap-2">
          {/* View mode toggle */}
          <div className="flex items-center bg-zinc-100 dark:bg-zinc-900 rounded-md overflow-hidden border border-zinc-300 dark:border-zinc-700">
            <button
              onClick={() => setViewMode("treemap")}
              className={`px-2.5 py-1.5 text-xs font-medium transition-colors flex items-center gap-1.5 ${
                viewMode === "treemap"
                  ? "bg-zinc-300 dark:bg-zinc-700 text-zinc-900 dark:text-white"
                  : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-800"
              }`}
              title="Treemap view"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode("table")}
              className={`px-2.5 py-1.5 text-xs font-medium transition-colors flex items-center gap-1.5 ${
                viewMode === "table"
                  ? "bg-zinc-300 dark:bg-zinc-700 text-zinc-900 dark:text-white"
                  : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-800"
              }`}
              title="Table view"
            >
              <Table2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode("bars")}
              className={`px-2.5 py-1.5 text-xs font-medium transition-colors flex items-center gap-1.5 ${
                viewMode === "bars"
                  ? "bg-zinc-300 dark:bg-zinc-700 text-zinc-900 dark:text-white"
                  : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-800"
              }`}
              title="Growth chart"
            >
              <BarChart3 className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Time range pills */}
          <div className="flex items-center bg-zinc-100 dark:bg-zinc-900 rounded-md overflow-hidden border border-zinc-300 dark:border-zinc-700">
            {PRESET_KEYS.map((range) => (
              <button
                key={range}
                onClick={() => { setTimeRange(range); setCustomRange(undefined); }}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  timeRange === range
                    ? "bg-zinc-300 dark:bg-zinc-700 text-zinc-900 dark:text-white"
                    : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-800"
                }`}
              >
                {TIME_RANGES[range].label}
              </button>
            ))}
          </div>

          <CustomDateRangePicker
            customRange={customRange}
            setCustomRange={setCustomRange}
            isCustomActive={timeRange === "custom"}
            open={customPopoverOpen}
            onOpenChange={setCustomPopoverOpen}
            timeRangeLabel={timeRangeLabel}
            onApply={(range) => {
              if (range.from && range.to) {
                const span = differenceInCalendarDays(range.to, range.from);
                if (span <= 183) {
                  setTimeRange("custom");
                  setCustomPopoverOpen(false);
                }
              }
            }}
          />
        </div>
      </div>

      {/* Treemap view */}
      {viewMode === "treemap" && <div
        ref={containerRef}
        className="relative rounded-lg overflow-hidden bg-zinc-100 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800"
        style={{ height: dimensions.height }}
      >
        {/* Loading overlay */}
        {loading && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-zinc-100/90 dark:bg-zinc-950/90 backdrop-blur-sm">
            {/* Placeholder grid */}
            <div className="absolute inset-4 grid grid-cols-3 grid-rows-2 gap-2 opacity-20">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className="rounded-md bg-zinc-300 dark:bg-zinc-700 animate-pulse"
                  style={{ animationDelay: `${i * 150}ms` }}
                />
              ))}
            </div>

            {/* Center content */}
            <div className="relative z-10 flex flex-col items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center">
                <Flame className="w-6 h-6 text-red-400 animate-pulse" />
              </div>
              <div className="text-sm font-medium text-zinc-600 dark:text-zinc-300">
                Crunching {activeDays} day{activeDays !== 1 ? "s" : ""} of C-Chain data...
              </div>
              <div className="text-xs text-zinc-400 dark:text-zinc-500">
                {LOADING_PHASES[loadingPhase]}
              </div>

              {/* Progress bar */}
              <div className="w-48 sm:w-64 h-1.5 bg-zinc-300 dark:bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-red-500 to-amber-500 transition-all duration-300 ease-out"
                  style={{ width: `${loading ? loadingProgress : 100}%` }}
                />
              </div>
              <div className="text-[10px] text-zinc-400 dark:text-zinc-600">
                ~{estimateLoadTime(activeDays)}s estimated
              </div>
            </div>
          </div>
        )}

        {data && <svg
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
                ? (isDark ? "#1c1c24" : "#e4e4e7")
                : getDeltaColor(cat.delta, isDark);
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
                    opacity={isHoveredCategory ? 0.85 : 1}
                    stroke={isHoveredCategory ? (isDark ? "#fff" : "#000") : (isDark ? "rgba(0,0,0,0.6)" : "rgba(0,0,0,0.25)")}
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
                      fill={isUnclassified ? (isDark ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.7)") : "#fff"}
                      fontSize={labelSize}
                      fontWeight="700"
                      style={{ pointerEvents: "none", textShadow: isUnclassified ? "none" : "0 1px 3px rgba(0,0,0,0.5)" }}
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
                          ? (isDark ? "#6b7280" : "#71717a")
                          : "#fff"
                      }
                      fontSize={deltaSize}
                      fontWeight="700"
                      style={{ pointerEvents: "none", textShadow: isUnclassified ? "none" : "0 1px 3px rgba(0,0,0,0.5)" }}
                    >
                      {isUnclassified
                        ? `${cat.burnShare.toFixed(1)}%`
                        : `${cat.delta >= 0 ? "+" : ""}${cat.delta.toFixed(1)}%`}
                    </text>
                  )}
                  {showGasShare && !isUnclassified && (
                    <text
                      x={catRect.x + catRect.w / 2}
                      y={catRect.y + catRect.h * 0.75}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fill="rgba(255,255,255,0.6)"
                      fontSize={shareSize}
                      fontWeight="400"
                      style={{ pointerEvents: "none" }}
                    >
                      {cat.burnShare.toFixed(1)}% burned
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
                  stroke={isHoveredAny ? (isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.4)") : (isDark ? "rgba(0,0,0,0.7)" : "rgba(0,0,0,0.3)")}
                  strokeWidth={1.5}
                />

                {/* Category header strip — opaque dark bar */}
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
                    fill={isDark ? "#0f1117" : "#1a1f2e"}
                    clipPath={`url(#clip-${cat.category})`}
                  />
                  {catRect.w > 40 && (
                    <text
                      x={catRect.x + 6}
                      y={catRect.y + 1 + headerHeight / 2}
                      textAnchor="start"
                      dominantBaseline="central"
                      fill="#fff"
                      fontSize={headerFontSize}
                      fontWeight="700"
                      letterSpacing="0.02em"
                      style={{ pointerEvents: "none", textTransform: "uppercase" } as React.CSSProperties}
                    >
                      {catLabel}
                      <tspan fill="rgba(255,255,255,0.45)" fontWeight="400">
                        {" "}
                        {cat.burnShare.toFixed(1)}%
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
                      fontWeight="700"
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
                    const bgColor = getDeltaColor(p.delta, isDark);

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
                          opacity={isHoveredProto ? 0.85 : 1}
                          stroke={
                            isHoveredProto
                              ? (isDark ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.6)")
                              : (isDark ? "rgba(0,0,0,0.5)" : "rgba(0,0,0,0.2)")
                          }
                          strokeWidth={isHoveredProto ? 2 : 1}
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
                            fill="#fff"
                            fontSize={labelSize}
                            fontWeight="700"
                            style={{ pointerEvents: "none", textShadow: "0 1px 3px rgba(0,0,0,0.6)" }}
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
                            fill="#fff"
                            fontSize={deltaSize}
                            fontWeight="700"
                            style={{ pointerEvents: "none", textShadow: "0 1px 3px rgba(0,0,0,0.6)" }}
                          >
                            {`${p.delta >= 0 ? "+" : ""}${p.delta.toFixed(1)}%`}
                          </text>
                        )}
                      </g>
                    );
                  })}
                </g>
              </g>
            );
          })}
        </svg>}

        {/* Finviz-style Hover Tooltip */}
        {hovered && (
          <div className="absolute top-3 left-3 right-3 sm:left-auto sm:min-w-[320px] sm:max-w-[400px] bg-white/98 dark:bg-zinc-900/98 backdrop-blur-sm border border-zinc-300 dark:border-zinc-700 rounded-lg shadow-2xl pointer-events-none z-10 overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 border-b border-zinc-200/50 dark:border-zinc-700/50 bg-zinc-100/50 dark:bg-zinc-800/50">
              <div className="flex items-center justify-between">
                <div>
                  {hovered.type === "protocol" && (
                    <span className="text-zinc-400 dark:text-zinc-500 text-[10px] uppercase tracking-wider block mb-0.5">
                      {hovered.categoryLabel}
                      {hovered.subcategoryLabel && (
                        <span className="text-zinc-300 dark:text-zinc-600"> / {hovered.subcategoryLabel}</span>
                      )}
                    </span>
                  )}
                  <span className="font-semibold text-zinc-900 dark:text-white text-base">
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
                  <div className="text-[10px] text-zinc-400 dark:text-zinc-500 uppercase">Burn Share</div>
                  <div className="text-sm font-semibold text-zinc-900 dark:text-white">{hovered.burnShare.toFixed(2)}%</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-md bg-blue-500/10 flex items-center justify-center">
                  <Activity className="w-3.5 h-3.5 text-blue-400" />
                </div>
                <div>
                  <div className="text-[10px] text-zinc-400 dark:text-zinc-500 uppercase">Transactions</div>
                  <div className="text-sm font-semibold text-zinc-900 dark:text-white">{formatNumber(hovered.txCount)}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-md bg-orange-500/10 flex items-center justify-center">
                  <Flame className="w-3.5 h-3.5 text-orange-400" />
                </div>
                <div>
                  <div className="text-[10px] text-zinc-400 dark:text-zinc-500 uppercase">AVAX Burned</div>
                  <div className="text-sm font-semibold text-zinc-900 dark:text-white">
                    {hovered.avaxBurned.toFixed(2)}
                    {hovered.avaxBurnedUsd > 0 && (
                      <span className="text-zinc-400 dark:text-zinc-500 text-xs ml-1">
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
                    <div className="text-[10px] text-zinc-400 dark:text-zinc-500 uppercase">Unique Senders</div>
                    <div className="text-sm font-semibold text-zinc-900 dark:text-white">{formatNumber(hovered.uniqueSenders)}</div>
                  </div>
                </div>
              )}
            </div>

            {/* Protocol Table - Only for category hover */}
            {hovered.type === "category" && hoveredCategoryProtocols.length > 0 && (
              <div className="border-t border-zinc-200/50 dark:border-zinc-700/50">
                <div className="px-4 py-2 bg-zinc-100/30 dark:bg-zinc-800/30">
                  <span className="text-[10px] text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Top Protocols</span>
                </div>
                <div className="max-h-[200px] overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-zinc-400 dark:text-zinc-500 text-[10px] uppercase">
                        <th className="text-left px-4 py-1.5 font-medium">Protocol</th>
                        <th className="text-right px-2 py-1.5 font-medium">AVAX</th>
                        <th className="text-right px-4 py-1.5 font-medium">Change</th>
                      </tr>
                    </thead>
                    <tbody>
                      {hoveredCategoryProtocols.map((p, idx) => (
                        <tr
                          key={p.protocol}
                          className={idx % 2 === 0 ? "bg-zinc-100/20 dark:bg-zinc-800/20" : ""}
                        >
                          <td className="px-4 py-1.5 text-zinc-700 dark:text-zinc-200 font-medium truncate max-w-[140px]">
                            {p.protocol}
                          </td>
                          <td className="px-2 py-1.5 text-right text-zinc-500 dark:text-zinc-400 font-mono">
                            {p.avaxBurned.toFixed(2)}
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

            {/* Breadcrumbs: top unclassified contracts */}
            {hovered.type === "category" && hovered.category === "unclassified" && data?.topBreadcrumbs && data.topBreadcrumbs.length > 0 && (
              <div className="border-t border-zinc-200/50 dark:border-zinc-700/50">
                <div className="px-4 py-2 bg-zinc-100/30 dark:bg-zinc-800/30">
                  <span className="text-[10px] text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Top Unclassified Contracts</span>
                </div>
                <div className="max-h-[260px] overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-zinc-400 dark:text-zinc-500 text-[10px] uppercase">
                        <th className="text-left px-4 py-1.5 font-medium">Address</th>
                        <th className="text-right px-2 py-1.5 font-medium">AVAX</th>
                        <th className="text-right px-4 py-1.5 font-medium">Txs</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.topBreadcrumbs.map((c, idx) => (
                        <tr
                          key={c.address}
                          className={idx % 2 === 0 ? "bg-zinc-100/20 dark:bg-zinc-800/20" : ""}
                        >
                          <td className="px-4 py-1.5 text-zinc-700 dark:text-zinc-200 font-mono text-[11px]">
                            {c.address.slice(0, 6)}...{c.address.slice(-4)}
                          </td>
                          <td className="px-2 py-1.5 text-right text-zinc-500 dark:text-zinc-400 font-mono">
                            {c.avaxBurned.toFixed(2)}
                          </td>
                          <td className="px-4 py-1.5 text-right text-zinc-500 dark:text-zinc-400 font-mono">
                            {formatNumber(c.txCount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="px-4 py-2 border-t border-zinc-200/50 dark:border-zinc-700/50 bg-zinc-100/30 dark:bg-zinc-800/30">
              <span className="text-[10px] text-zinc-400 dark:text-zinc-500">
                vs previous {timeRangeLabel || (timeRange !== "custom" ? TIME_RANGES[timeRange as Exclude<TimeRange, "custom">].label : "")} period
              </span>
            </div>
          </div>
        )}
      </div>}

      {/* Table view */}
      {viewMode === "table" && data && !loading && (
        <GasTreemapTable protocols={data.protocolBreakdown} />
      )}
      {viewMode === "table" && loading && (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-8 animate-pulse">
          <div className="h-6 w-32 bg-zinc-200 dark:bg-zinc-800 rounded mb-4" />
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="h-10 bg-zinc-100 dark:bg-zinc-800/50 rounded mb-2" style={{ animationDelay: `${i * 50}ms` }} />
          ))}
        </div>
      )}

      {/* Bars view */}
      {viewMode === "bars" && data && !loading && (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 sm:p-6">
          <GasBurnBars protocols={data.protocolBreakdown} isDark={isDark} />
        </div>
      )}
      {viewMode === "bars" && loading && (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-8 animate-pulse">
          <div className="h-6 w-32 bg-zinc-200 dark:bg-zinc-800 rounded mb-4" />
          <div className="h-[350px] bg-zinc-100 dark:bg-zinc-800/50 rounded" />
        </div>
      )}

      {/* Loading insight skeletons */}
      {loading && !data && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-3 animate-pulse" style={{ animationDelay: `${i * 100}ms` }}>
              <div className="h-4 w-24 bg-zinc-200 dark:bg-zinc-800 rounded mb-2" />
              <div className="h-6 w-16 bg-zinc-200 dark:bg-zinc-800 rounded mb-2" />
              <div className="h-3 w-full bg-zinc-200 dark:bg-zinc-800 rounded" />
            </div>
          ))}
        </div>
      )}

      {/* Market Insights — 2 Rows */}
      {insightRows.length > 0 && !loading && (
        <div className="bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
            <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">Market Insights</h3>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-500">
              {timeRangeLabel || (timeRange !== "custom" ? TIME_RANGES[timeRange as Exclude<TimeRange, "custom">].label : "")} period
            </span>
          </div>

          <div className="space-y-4">
            {insightRows.map((row, rowIdx) => (
              <div key={row.title}>
                <div className="flex items-center gap-2 mb-2">
                  {row.icon === "flame" ? (
                    <Flame className="w-3.5 h-3.5 text-orange-500 dark:text-orange-400" />
                  ) : (
                    <TrendingUp className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
                  )}
                  <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">{row.title}</span>
                  <span className="text-[10px] text-zinc-400 dark:text-zinc-500">{row.subtitle}</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {row.cards.map((card, colIdx) => {
                    const isExpanded =
                      (hoveredInsight?.row === rowIdx && hoveredInsight?.col === colIdx) ||
                      (!!hovered && hovered.type === "protocol" && hovered.label === card.protocol);
                    const catLabel = CATEGORY_LABELS[card.category] || card.category;
                    const isGrowthRow = row.icon === "trending";

                    return (
                      <div
                        key={card.protocol}
                        onMouseEnter={() => setHoveredInsight({ row: rowIdx, col: colIdx })}
                        onMouseLeave={() => setHoveredInsight(null)}
                        className={`relative overflow-hidden rounded-lg border p-3 cursor-default transition-all duration-300 ${
                          isExpanded ? "scale-[1.02] shadow-lg z-10" : ""
                        } ${
                          card.delta >= 0
                            ? isExpanded
                              ? "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-400 dark:border-emerald-500/50 shadow-emerald-200/50 dark:shadow-emerald-500/20"
                              : "bg-white dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-700 hover:border-emerald-300 dark:hover:border-emerald-500/40"
                            : isExpanded
                              ? "bg-red-50 dark:bg-red-500/10 border-red-400 dark:border-red-500/50 shadow-red-200/50 dark:shadow-red-500/20"
                              : "bg-white dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-700 hover:border-red-300 dark:hover:border-red-500/40"
                        }`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 block truncate max-w-[180px]">
                              {card.protocol}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-400">
                              {catLabel}
                            </span>
                          </div>
                          <div className="text-right flex-shrink-0">
                            {isGrowthRow ? (
                              <>
                                <span className={`text-lg font-bold block ${
                                  card.delta >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
                                }`}>
                                  {card.delta >= 0 ? "+" : ""}{card.delta.toFixed(1)}%
                                </span>
                                <span className="text-[10px] text-zinc-400 dark:text-zinc-500">
                                  {formatAvax(card.avaxBurned)}
                                </span>
                              </>
                            ) : (
                              <>
                                <span className="text-sm font-bold text-zinc-900 dark:text-white block">
                                  {formatAvax(card.avaxBurned)}
                                </span>
                                <span className={`inline-flex items-center gap-0.5 text-xs font-semibold px-1.5 py-0.5 rounded ${getDeltaBgClass(card.delta)}`}>
                                  {card.delta >= 0 ? (
                                    <ArrowUpRight className="w-3 h-3" />
                                  ) : (
                                    <ArrowDownRight className="w-3 h-3" />
                                  )}
                                  {card.delta >= 0 ? "+" : ""}{card.delta.toFixed(1)}%
                                </span>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Expanded detail */}
                        <div
                          className={`overflow-hidden transition-all duration-300 ease-out ${
                            isExpanded ? "max-h-[200px] opacity-100" : "max-h-0 opacity-0"
                          }`}
                        >
                          <div className="pt-2 border-t border-zinc-200/50 dark:border-zinc-700/50 grid grid-cols-2 gap-2 text-xs">
                            <div>
                              <span className="text-[10px] text-zinc-400 dark:text-zinc-500 uppercase block">Gas Share</span>
                              <span className="font-semibold text-zinc-900 dark:text-white">{card.gasShare.toFixed(2)}%</span>
                            </div>
                            <div>
                              <span className="text-[10px] text-zinc-400 dark:text-zinc-500 uppercase block">Transactions</span>
                              <span className="font-semibold text-zinc-900 dark:text-white">{formatNumber(card.txCount)}</span>
                            </div>
                            <div>
                              <span className="text-[10px] text-zinc-400 dark:text-zinc-500 uppercase block">Senders</span>
                              <span className="font-semibold text-zinc-900 dark:text-white">{formatNumber(card.uniqueSenders)}</span>
                            </div>
                            {card.avaxBurnedUsd > 0 && (
                              <div>
                                <span className="text-[10px] text-zinc-400 dark:text-zinc-500 uppercase block">USD Value</span>
                                <span className="font-semibold text-zinc-900 dark:text-white">{formatUsd(card.avaxBurnedUsd)}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Gas Category Timeline */}
      {data?.dailyCategoryStats && data.dailyCategoryStats.length > 1 && !loading && (
        <GasCategoryTimeline data={data.dailyCategoryStats} isDark={isDark} />
      )}

      {/* Protocol Spotlight */}
      {data && !loading && data.protocolBreakdown.length > 0 && (
        <ProtocolSpotlight protocols={data.protocolBreakdown} />
      )}

      {/* Contract Gas X-Ray — auto-preloaded with top burner */}
      {data && !loading && (
        <ContractGasXray initialAddress={data.topBurnerAddress} />
      )}
    </div>
  );
}
