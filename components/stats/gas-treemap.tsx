"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Treemap, ResponsiveContainer, Tooltip as RechartsTooltip } from "recharts";
import { Flame, Fuel, Activity, AlertTriangle } from "lucide-react";

interface ProtocolBreakdown {
  protocol: string;
  slug: string | null;
  category: string;
  txCount: number;
  gasUsed: number;
  avaxBurned: number;
  gasShare: number;
}

interface ChainStatsData {
  totalTransactions: number;
  totalGasUsed: number;
  totalAvaxBurned: number;
  protocolBreakdown: ProtocolBreakdown[];
  coverage: {
    taggedGasPercent: number;
    taggedTxPercent: number;
    totalChainTxs: number;
    totalChainGas: number;
    totalChainBurned: number;
  };
}

type TimeRange = "30d" | "90d" | "365d";

const TIME_RANGES: Record<TimeRange, { label: string; days: number }> = {
  "30d": { label: "30D", days: 30 },
  "90d": { label: "90D", days: 90 },
  "365d": { label: "1Y", days: 365 },
};

const CATEGORY_COLORS: Record<string, string> = {
  dex: "#3b82f6",
  lending: "#10b981",
  bridge: "#ec4899",
  derivatives: "#ef4444",
  nft: "#a855f7",
  yield: "#06b6d4",
  icm: "#f97316",
  infrastructure: "#6b7280",
  gaming: "#eab308",
  token: "#8b5cf6",
  native: "#78716c",
  other: "#71717a",
  unknown: "#dc2626",
};

function formatNumber(num: number): string {
  if (num >= 1e12) return `${(num / 1e12).toFixed(1)}T`;
  if (num >= 1e9) return `${(num / 1e9).toFixed(1)}B`;
  if (num >= 1e6) return `${(num / 1e6).toFixed(1)}M`;
  if (num >= 1e3) return `${(num / 1e3).toFixed(1)}K`;
  return num.toLocaleString();
}

// Custom treemap cell renderer
function CustomTreemapContent(props: any) {
  const { x, y, width, height, name, gasShare, category, fill } = props;

  if (width < 30 || height < 20) return null;

  const showDetails = width > 80 && height > 40;
  const showName = width > 50 && height > 25;

  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill={fill}
        stroke="rgba(0,0,0,0.3)"
        strokeWidth={1}
        rx={4}
        className="transition-opacity hover:opacity-80 cursor-pointer"
      />
      {showName && (
        <text
          x={x + width / 2}
          y={y + height / 2 - (showDetails ? 8 : 0)}
          textAnchor="middle"
          dominantBaseline="central"
          fill="white"
          fontSize={Math.min(14, Math.max(10, width / 8))}
          fontWeight="600"
          style={{ textShadow: "0 1px 2px rgba(0,0,0,0.5)" }}
        >
          {name && name.length > Math.floor(width / 8) ? `${name.slice(0, Math.floor(width / 8))}...` : name}
        </text>
      )}
      {showDetails && (
        <text
          x={x + width / 2}
          y={y + height / 2 + 12}
          textAnchor="middle"
          dominantBaseline="central"
          fill="rgba(255,255,255,0.85)"
          fontSize={Math.min(12, Math.max(9, width / 10))}
          fontWeight="400"
        >
          {gasShare?.toFixed(1)}%
        </text>
      )}
    </g>
  );
}

// Custom tooltip
function CustomTooltip({ active, payload }: any) {
  if (!active || !payload || !payload.length) return null;

  const data = payload[0]?.payload;
  if (!data) return null;

  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3 shadow-xl text-sm">
      <p className="font-semibold text-white mb-1">{data.name}</p>
      <div className="space-y-0.5 text-zinc-300">
        <p className="flex items-center gap-1.5">
          <Fuel className="w-3 h-3 text-amber-400" />
          Gas: {data.gasShare?.toFixed(2)}% of chain
        </p>
        <p className="flex items-center gap-1.5">
          <Activity className="w-3 h-3 text-blue-400" />
          Txs: {formatNumber(data.txCount || 0)}
        </p>
        <p className="flex items-center gap-1.5">
          <Flame className="w-3 h-3 text-orange-400" />
          Burned: {formatNumber(data.avaxBurned || 0)} AVAX
        </p>
        <p className="text-xs text-zinc-400 mt-1 capitalize">
          {data.category}
        </p>
      </div>
    </div>
  );
}

export default function GasTreemap() {
  const router = useRouter();
  const [data, setData] = useState<ChainStatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<TimeRange>("30d");

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

  const treemapData = useMemo(() => {
    if (!data) return [];

    const items = data.protocolBreakdown
      .filter(p => p.gasShare > 0.01)
      .map(p => ({
        name: p.protocol,
        size: p.gasUsed,
        gasShare: p.gasShare,
        category: p.category,
        slug: p.slug,
        txCount: p.txCount,
        avaxBurned: p.avaxBurned,
        fill: CATEGORY_COLORS[p.category] || CATEGORY_COLORS.other,
      }));

    // Add "Unclassified" block if coverage < 100%
    if (data.coverage) {
      const unclassifiedGasPercent = Math.max(0, 100 - data.coverage.taggedGasPercent);
      if (unclassifiedGasPercent > 0.1) {
        const unclassifiedGas = data.coverage.totalChainGas - data.totalGasUsed;
        const unclassifiedTx = data.coverage.totalChainTxs - data.totalTransactions;
        items.push({
          name: "Unclassified",
          size: Math.max(unclassifiedGas, 0),
          gasShare: unclassifiedGasPercent,
          category: "unknown",
          slug: null,
          txCount: Math.max(unclassifiedTx, 0),
          avaxBurned: Math.max(data.coverage.totalChainBurned - data.totalAvaxBurned, 0),
          fill: CATEGORY_COLORS.unknown,
        });
      }
    }

    return items;
  }, [data]);

  const handleTreemapClick = (node: any) => {
    if (node?.slug) {
      router.push(`/stats/dapps/${node.slug}`);
    }
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 w-48 bg-zinc-200 dark:bg-zinc-700 rounded" />
          <div className="h-[500px] bg-zinc-200 dark:bg-zinc-700 rounded-lg" />
        </div>
      </div>
    );
  }

  if (!data) return null;

  const coveragePercent = data.coverage?.taggedGasPercent ?? 0;

  return (
    <div className="space-y-6">
      {/* Header with coverage stats */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
            <Fuel className="w-5 h-5 text-amber-500" />
            Gas Consumption Map
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Protocols sized by gas usage on C-Chain
          </p>
        </div>
        <div className="flex items-center gap-4">
          {/* Coverage indicator */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-lg">
            <div
              className={`w-2 h-2 rounded-full ${
                coveragePercent >= 90
                  ? "bg-emerald-500"
                  : coveragePercent >= 70
                  ? "bg-amber-500"
                  : "bg-red-500"
              }`}
            />
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              {coveragePercent.toFixed(1)}% classified
            </span>
          </div>
          {/* Time range selector */}
          <div className="flex items-center gap-1 bg-zinc-200/50 dark:bg-zinc-800/50 rounded-lg p-1">
            {(Object.keys(TIME_RANGES) as TimeRange[]).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                  timeRange === range
                    ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm"
                    : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"
                }`}
              >
                {TIME_RANGES[range].label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Unclassified warning */}
      {coveragePercent < 80 && (
        <div className="flex items-center gap-2 px-4 py-3 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-lg">
          <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
          <p className="text-sm text-amber-700 dark:text-amber-300">
            {(100 - coveragePercent).toFixed(1)}% of chain gas is unclassified.
            Check <code className="text-xs bg-amber-100 dark:bg-amber-500/20 px-1 py-0.5 rounded">/api/dapps/accuracy</code> for details.
          </p>
        </div>
      )}

      {/* Treemap */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 sm:p-6">
        <ResponsiveContainer width="100%" height={500}>
          <Treemap
            data={treemapData}
            dataKey="size"
            stroke="none"
            content={<CustomTreemapContent />}
            onClick={handleTreemapClick}
            animationDuration={300}
          >
            <RechartsTooltip content={<CustomTooltip />} />
          </Treemap>
        </ResponsiveContainer>
      </div>

      {/* Category legend */}
      <div className="flex flex-wrap gap-3 justify-center">
        {Object.entries(CATEGORY_COLORS)
          .filter(([cat]) => treemapData.some(d => d.category === cat))
          .map(([category, color]) => (
            <div key={category} className="flex items-center gap-1.5">
              <div
                className="w-3 h-3 rounded-sm"
                style={{ backgroundColor: color }}
              />
              <span className="text-xs text-zinc-600 dark:text-zinc-400 capitalize">
                {category}
              </span>
            </div>
          ))}
      </div>
    </div>
  );
}
