"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ArrowLeft,
  ExternalLink,
  Globe,
  ChevronRight,
  AppWindow,
  Layers,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Twitter,
  Shield,
  Link as LinkIcon,
  Flame,
  Fuel,
  Users,
  Activity,
  BarChart3,
  PieChart,
} from "lucide-react";
import { StatsBubbleNav } from "@/components/stats/stats-bubble.config";
import { AvalancheLogo } from "@/components/navigation/avalanche-logo";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Area, AreaChart, Bar, BarChart, XAxis, YAxis, ResponsiveContainer } from "recharts";
import type { DAppDetail } from "@/types/dapps";
import { DAPP_CATEGORIES } from "@/types/dapps";

// On-chain data types
interface OnChainStats {
  txCount: number;
  totalGas: number;
  avaxBurned: number;
  uniqueUsers: number;
  avgGasPerTx: number;
}

interface DailyActivity {
  date: string;
  txCount: number;
  gasUsed: number;
  avaxBurned: number;
  uniqueUsers: number;
}

interface OnChainData {
  protocol: string;
  slug: string;
  contracts: string[];
  stats: OnChainStats;
  dailyActivity: DailyActivity[];
  lastUpdated: string;
}

function formatNumber(num: number | undefined | null): string {
  if (num === null || num === undefined) return "N/A";
  if (num >= 1e12) return `${(num / 1e12).toFixed(2)}T`;
  if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B`;
  if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
  if (num >= 1e3) return `${(num / 1e3).toFixed(2)}K`;
  return num.toFixed(2);
}

function formatCurrency(num: number | undefined | null): string {
  if (num === null || num === undefined) return "N/A";
  return `$${formatNumber(num)}`;
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

type TimeRangeKey = "7d" | "30d" | "90d" | "all";

const TIME_RANGES: Record<TimeRangeKey, { label: string; days: number }> = {
  "7d": { label: "7D", days: 7 },
  "30d": { label: "30D", days: 30 },
  "90d": { label: "90D", days: 90 },
  "all": { label: "All", days: 0 },
};

export default function DAppDetailPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const [dapp, setDapp] = useState<DAppDetail | null>(null);
  const [onChainData, setOnChainData] = useState<OnChainData | null>(null);
  const [loading, setLoading] = useState(true);
  const [onChainLoading, setOnChainLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRangeKey>("30d");

  // Fetch DeFiLlama data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/dapps/${slug}`);
        if (!response.ok) {
          if (response.status === 404) {
            throw new Error("Protocol not found");
          }
          throw new Error("Failed to fetch protocol data");
        }
        const data = await response.json();
        setDapp(data);
      } catch (err: any) {
        console.error("Error fetching dApp:", err);
        setError(err?.message || "Failed to load data");
      } finally {
        setLoading(false);
      }
    };

    if (slug) {
      fetchData();
    }
  }, [slug]);

  // Fetch on-chain data separately (may take longer) - refetch when time range changes
  useEffect(() => {
    const fetchOnChainData = async () => {
      try {
        setOnChainLoading(true);
        const days = TIME_RANGES[timeRange].days;
        const response = await fetch(`/api/dapps/${slug}/onchain?days=${days}`);
        if (response.ok) {
          const data = await response.json();
          setOnChainData(data);
        }
        // Don't throw on error - on-chain data is optional
      } catch (err) {
        console.error("Error fetching on-chain data:", err);
      } finally {
        setOnChainLoading(false);
      }
    };

    if (slug) {
      fetchOnChainData();
    }
  }, [slug, timeRange]);

  // Filter TVL history based on time range
  const filteredHistory = useMemo(() => {
    if (!dapp?.tvlHistory?.length) return [];

    const days = TIME_RANGES[timeRange].days;

    // If "all" time range (days = 0), return all history
    if (days === 0) {
      return dapp.tvlHistory.map((d) => ({
        ...d,
        date: formatDate(d.timestamp),
      }));
    }

    const now = Date.now();
    const cutoff = now - days * 24 * 60 * 60 * 1000;

    return dapp.tvlHistory
      .filter((d) => d.timestamp >= cutoff)
      .map((d) => ({
        ...d,
        date: formatDate(d.timestamp),
      }));
  }, [dapp?.tvlHistory, timeRange]);

  // Chart config
  const chartConfig = {
    tvl: {
      label: "TVL",
      color: "#ef4444",
    },
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-16">
          <div className="animate-pulse space-y-8">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-xl bg-zinc-200 dark:bg-zinc-800" />
              <div className="space-y-2">
                <div className="h-8 w-48 bg-zinc-200 dark:bg-zinc-800 rounded" />
                <div className="h-4 w-32 bg-zinc-200 dark:bg-zinc-800 rounded" />
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="p-4 bg-zinc-200 dark:bg-zinc-800 rounded-xl h-24" />
              ))}
            </div>
            <div className="h-[300px] bg-zinc-200 dark:bg-zinc-800 rounded-xl" />
          </div>
        </div>
        <StatsBubbleNav />
      </div>
    );
  }

  // Error state
  if (error || !dapp) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center">
        <div className="text-center space-y-4">
          <AppWindow className="h-12 w-12 text-red-500 mx-auto" />
          <p className="text-red-600 dark:text-red-400">{error || "Protocol not found"}</p>
          <Button variant="outline" onClick={() => router.push("/stats/dapps")}>
            Back to DApps
          </Button>
        </div>
        <StatsBubbleNav />
      </div>
    );
  }

  const catInfo = DAPP_CATEGORIES[dapp.category];

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Hero Section */}
      <div className="relative overflow-hidden border-b border-zinc-200 dark:border-zinc-800">
        <div
          className="absolute top-0 right-0 w-2/3 h-full pointer-events-none"
          style={{
            background: `linear-gradient(to left, rgba(239, 68, 68, 0.15) 0%, rgba(239, 68, 68, 0.08) 40%, rgba(239, 68, 68, 0.02) 70%, transparent 100%)`,
          }}
        />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 pt-8 sm:pt-12 pb-8">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-1.5 text-xs sm:text-sm mb-4 overflow-x-auto scrollbar-hide pb-1">
            <button
              onClick={() => router.push("/stats/dapps")}
              className="inline-flex items-center gap-1 sm:gap-1.5 text-zinc-500 dark:text-zinc-400 whitespace-nowrap flex-shrink-0 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
            >
              <AppWindow className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              <span>DApps</span>
            </button>
            <ChevronRight className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-zinc-300 dark:text-zinc-600 flex-shrink-0" />
            <span className="font-medium text-zinc-900 dark:text-zinc-100 whitespace-nowrap flex-shrink-0">
              {dapp.name}
            </span>
          </nav>

          {/* Header */}
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
            <div className="flex items-start gap-4">
              {dapp.logo ? (
                <Image
                  src={dapp.logo}
                  alt={dapp.name}
                  width={64}
                  height={64}
                  className="w-16 h-16 rounded-xl bg-zinc-100 dark:bg-zinc-800"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              ) : (
                <div className="w-16 h-16 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center text-2xl font-bold text-zinc-500">
                  {dapp.name.charAt(0)}
                </div>
              )}
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-white">
                    {dapp.name}
                  </h1>
                  <span
                    className="inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-full"
                    style={{
                      backgroundColor: `${catInfo?.color || "#666"}20`,
                      color: catInfo?.color || "#666",
                    }}
                  >
                    {catInfo?.name || dapp.category}
                  </span>
                </div>
                {dapp.description && (
                  <p className="text-zinc-600 dark:text-zinc-400 max-w-2xl text-sm sm:text-base">
                    {dapp.description}
                  </p>
                )}
                <div className="flex items-center gap-4 mt-3">
                  {dapp.url && (
                    <a
                      href={dapp.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors"
                    >
                      <Globe className="w-4 h-4" />
                      Website
                    </a>
                  )}
                  {dapp.twitter && (
                    <a
                      href={`https://twitter.com/${dapp.twitter}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors"
                    >
                      <Twitter className="w-4 h-4" />
                      @{dapp.twitter}
                    </a>
                  )}
                  {dapp.audit_links && dapp.audit_links.length > 0 && (
                    <a
                      href={dapp.audit_links[0]}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors"
                    >
                      <Shield className="w-4 h-4" />
                      Audited
                    </a>
                  )}
                </div>
              </div>
            </div>

            {/* Time range selector */}
            <div className="flex items-center gap-1 self-start">
              {(Object.keys(TIME_RANGES) as TimeRangeKey[]).map((range) => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={`relative px-3 py-1.5 text-sm font-medium cursor-pointer transition-colors rounded-lg ${
                    timeRange === range
                      ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                      : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  }`}
                >
                  {TIME_RANGES[range].label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Stats cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 sm:p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                TVL on Avalanche
              </span>
              <Layers className="w-4 h-4 text-zinc-400" />
            </div>
            <p className="text-xl sm:text-2xl font-semibold text-zinc-900 dark:text-white">
              {formatCurrency(dapp.tvl)}
            </p>
          </div>

          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 sm:p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                24h Change
              </span>
              {dapp.change_1d != null && dapp.change_1d >= 0 ? (
                <TrendingUp className="w-4 h-4 text-emerald-500" />
              ) : (
                <TrendingDown className="w-4 h-4 text-red-500" />
              )}
            </div>
            <p
              className={`text-xl sm:text-2xl font-semibold ${
                dapp.change_1d != null
                  ? dapp.change_1d >= 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-red-600 dark:text-red-400"
                  : "text-zinc-900 dark:text-white"
              }`}
            >
              {dapp.change_1d != null
                ? `${dapp.change_1d >= 0 ? "+" : ""}${dapp.change_1d.toFixed(2)}%`
                : "N/A"}
            </p>
          </div>

          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 sm:p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                7d Change
              </span>
              {dapp.change_7d != null && dapp.change_7d >= 0 ? (
                <TrendingUp className="w-4 h-4 text-emerald-500" />
              ) : (
                <TrendingDown className="w-4 h-4 text-red-500" />
              )}
            </div>
            <p
              className={`text-xl sm:text-2xl font-semibold ${
                dapp.change_7d != null
                  ? dapp.change_7d >= 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-red-600 dark:text-red-400"
                  : "text-zinc-900 dark:text-white"
              }`}
            >
              {dapp.change_7d != null
                ? `${dapp.change_7d >= 0 ? "+" : ""}${dapp.change_7d.toFixed(2)}%`
                : "N/A"}
            </p>
          </div>

          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 sm:p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                Market Cap
              </span>
              <DollarSign className="w-4 h-4 text-zinc-400" />
            </div>
            <p className="text-xl sm:text-2xl font-semibold text-zinc-900 dark:text-white">
              {formatCurrency(dapp.mcap)}
            </p>
          </div>
        </div>

        {/* Sub-protocol TVL Breakdown */}
        {dapp.subProtocols && dapp.subProtocols.length > 1 && (
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5">
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4 flex items-center gap-2">
              <PieChart className="w-5 h-5 text-blue-500" />
              TVL Breakdown by Product
            </h3>
            <div className="space-y-3">
              {dapp.subProtocols.map((sub, index) => {
                const percentage = dapp.tvl > 0 ? (sub.tvl / dapp.tvl) * 100 : 0;
                return (
                  <div key={sub.slug} className="flex items-center gap-3">
                    <div className="flex items-center gap-2 min-w-[180px]">
                      {sub.logo && (
                        <Image
                          src={sub.logo}
                          alt={sub.name}
                          width={24}
                          height={24}
                          className="rounded-full"
                        />
                      )}
                      <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300 truncate">
                        {sub.name}
                      </span>
                    </div>
                    <div className="flex-1 h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-red-500 to-orange-500 rounded-full transition-all"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <div className="text-right min-w-[100px]">
                      <span className="text-sm font-semibold text-zinc-900 dark:text-white">
                        {formatCurrency(sub.tvl)}
                      </span>
                      <span className="text-xs text-zinc-500 dark:text-zinc-400 ml-1">
                        ({percentage.toFixed(1)}%)
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TVL Chart */}
        {filteredHistory.length > 0 && (
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5">
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">
              TVL History (Avalanche)
            </h3>
            <ChartContainer config={chartConfig} className="h-[300px] w-full">
              <AreaChart data={filteredHistory} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="tvlGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ef4444" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="date"
                  stroke="#71717a"
                  tick={{ fill: "#71717a", fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tickFormatter={(value) => formatCurrency(value)}
                  stroke="#71717a"
                  tick={{ fill: "#71717a", fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  width={80}
                />
                <ChartTooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-zinc-900 dark:bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 shadow-lg">
                          <p className="text-xs text-zinc-400 mb-1">{data.date}</p>
                          <p className="text-sm font-semibold text-white">
                            {formatCurrency(data.value)}
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#ef4444"
                  strokeWidth={2}
                  fill="url(#tvlGradient)"
                />
              </AreaChart>
            </ChartContainer>
          </div>
        )}

        {/* On-Chain Analytics Section */}
        {(onChainData || onChainLoading) && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
                <Activity className="w-5 h-5 text-red-500" />
                On-Chain Activity
                <span className="text-sm font-normal text-zinc-500 dark:text-zinc-400">
                  ({timeRange === "all" ? "All Time" : TIME_RANGES[timeRange].label})
                </span>
              </h2>
              {onChainData && (
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  {onChainData.contracts.length} tracked contract{onChainData.contracts.length > 1 ? "s" : ""}
                </span>
              )}
            </div>

            {/* On-chain stats cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {onChainLoading ? (
                <>
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 sm:p-5 animate-pulse">
                      <div className="h-4 w-20 bg-zinc-200 dark:bg-zinc-700 rounded mb-3" />
                      <div className="h-7 w-24 bg-zinc-200 dark:bg-zinc-700 rounded" />
                    </div>
                  ))}
                </>
              ) : onChainData ? (
                <>
                  <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 sm:p-5">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                        Total Transactions
                      </span>
                      <BarChart3 className="w-4 h-4 text-blue-500" />
                    </div>
                    <p className="text-xl sm:text-2xl font-semibold text-zinc-900 dark:text-white">
                      {formatNumber(onChainData.stats.txCount)}
                    </p>
                  </div>

                  <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 sm:p-5">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                        Gas Consumed
                      </span>
                      <Fuel className="w-4 h-4 text-amber-500" />
                    </div>
                    <p className="text-xl sm:text-2xl font-semibold text-zinc-900 dark:text-white">
                      {formatNumber(onChainData.stats.totalGas)}
                    </p>
                  </div>

                  <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 sm:p-5">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                        AVAX Burned
                      </span>
                      <Flame className="w-4 h-4 text-orange-500" />
                    </div>
                    <p className="text-xl sm:text-2xl font-semibold text-orange-600 dark:text-orange-400">
                      {formatNumber(onChainData.stats.avaxBurned)} AVAX
                    </p>
                  </div>

                  <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 sm:p-5">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                        Unique Users
                      </span>
                      <Users className="w-4 h-4 text-purple-500" />
                    </div>
                    <p className="text-xl sm:text-2xl font-semibold text-zinc-900 dark:text-white">
                      {formatNumber(onChainData.stats.uniqueUsers)}
                    </p>
                  </div>
                </>
              ) : null}
            </div>

            {/* Daily activity chart */}
            {onChainData && onChainData.dailyActivity.length > 0 && (
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5">
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">
                  Daily Transaction Activity
                </h3>
                <ChartContainer config={{
                  txCount: { label: "Transactions", color: "#3b82f6" },
                }} className="h-[250px] w-full">
                  <BarChart data={onChainData.dailyActivity} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <XAxis
                      dataKey="date"
                      stroke="#71717a"
                      tick={{ fill: "#71717a", fontSize: 10 }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(value) => {
                        const date = new Date(value);
                        return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
                      }}
                      interval={Math.floor(onChainData.dailyActivity.length / 6)}
                    />
                    <YAxis
                      tickFormatter={(value) => formatNumber(value)}
                      stroke="#71717a"
                      tick={{ fill: "#71717a", fontSize: 10 }}
                      tickLine={false}
                      axisLine={false}
                      width={60}
                    />
                    <ChartTooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload as DailyActivity;
                          return (
                            <div className="bg-zinc-900 dark:bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 shadow-lg">
                              <p className="text-xs text-zinc-400 mb-1">{data.date}</p>
                              <p className="text-sm font-semibold text-white">
                                {formatNumber(data.txCount)} txs
                              </p>
                              <p className="text-xs text-orange-400">
                                {formatNumber(data.avaxBurned)} AVAX burned
                              </p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar dataKey="txCount" fill="#3b82f6" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ChartContainer>
              </div>
            )}

            {/* Tracked contracts */}
            {onChainData && onChainData.contracts.length > 0 && (
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5">
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">
                  Tracked Contracts
                </h3>
                <div className="space-y-2">
                  {onChainData.contracts.map((address) => (
                    <a
                      key={address}
                      href={`https://snowtrace.io/address/${address}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors group"
                    >
                      <code className="text-sm text-zinc-600 dark:text-zinc-300 font-mono">
                        {address}
                      </code>
                      <ExternalLink className="w-4 h-4 text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-200" />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Token info */}
        {(dapp.token || dapp.mcap) && (
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5">
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">
              Token Info
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {dapp.token && (
                <div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
                    Symbol
                  </p>
                  <p className="text-lg font-semibold text-zinc-900 dark:text-white">
                    {dapp.token}
                  </p>
                </div>
              )}
              {dapp.mcap && (
                <div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
                    Market Cap
                  </p>
                  <p className="text-lg font-semibold text-zinc-900 dark:text-white">
                    {formatCurrency(dapp.mcap)}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Supported chains */}
        {dapp.chains.length > 0 && (
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5">
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">
              Available on {dapp.chains.length} chain{dapp.chains.length > 1 ? "s" : ""}
            </h3>
            <div className="flex flex-wrap gap-2">
              {dapp.chains.map((chain) => (
                <span
                  key={chain}
                  className={`px-3 py-1.5 text-sm font-medium rounded-lg border ${
                    chain === "Avalanche"
                      ? "bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/30"
                      : "bg-zinc-50 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700"
                  }`}
                >
                  {chain}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Resources */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5">
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">
            Resources
          </h3>
          <div className="flex flex-wrap gap-3">
            {dapp.url && (
              <a
                href={dapp.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
              >
                <Globe className="w-4 h-4" />
                Official Website
                <ExternalLink className="w-3 h-3 text-zinc-400" />
              </a>
            )}
            {!dapp.isLocalOnly && (
              <a
                href={`https://defillama.com/protocol/${dapp.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
              >
                <LinkIcon className="w-4 h-4" />
                DefiLlama
                <ExternalLink className="w-3 h-3 text-zinc-400" />
              </a>
            )}
          </div>
        </div>
      </div>

      <StatsBubbleNav />
    </div>
  );
}
