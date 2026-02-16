"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Search,
  ExternalLink,
  X,
  ChevronDown,
  Globe,
  ChevronRight,
  BarChart3,
  Layers,
  Activity,
  AppWindow,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Flame,
  Fuel,
} from "lucide-react";
import { StatsBubbleNav } from "@/components/stats/stats-bubble.config";
import { AvalancheLogo } from "@/components/navigation/avalanche-logo";
import type { DAppStats, DAppsMetrics, DAppCategory } from "@/types/dapps";
import { DAPP_CATEGORIES } from "@/types/dapps";

// On-chain stats types
interface ChainStats {
  totalTransactions: number;
  totalGasUsed: number;
  totalAvaxBurned: number;
  protocolBreakdown: {
    protocol: string;
    slug: string | null;
    txCount: number;
    gasUsed: number;
    avaxBurned: number;
    gasShare: number;
  }[];
}

type SortDirection = "asc" | "desc";
type SortField = "tvl" | "change_1d" | "change_7d" | "volume24h" | "mcap" | "name";

function formatNumber(num: number | undefined | null): string {
  if (num === null || num === undefined) return "N/A";
  if (num >= 1e12) return `${(num / 1e12).toFixed(1)}T`;
  if (num >= 1e9) return `${(num / 1e9).toFixed(1)}B`;
  if (num >= 1e6) return `${(num / 1e6).toFixed(1)}M`;
  if (num >= 1e3) return `${(num / 1e3).toFixed(1)}K`;
  return num.toLocaleString();
}

function formatCurrency(num: number | undefined | null): string {
  if (num === null || num === undefined) return "N/A";
  return `$${formatNumber(num)}`;
}

function getCategoryColor(category: DAppCategory | string): string {
  const colors: Record<string, string> = {
    dex: "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400",
    lending: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400",
    nft: "bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400",
    gaming: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400",
    bridge: "bg-pink-100 text-pink-700 dark:bg-pink-500/20 dark:text-pink-400",
    yield: "bg-cyan-100 text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-400",
    derivatives: "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400",
    launchpad: "bg-lime-100 text-lime-700 dark:bg-lime-500/20 dark:text-lime-400",
    other: "bg-zinc-100 text-zinc-700 dark:bg-zinc-500/20 dark:text-zinc-400",
    All: "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900",
  };
  return colors[category] || colors.other;
}

type ChainStatsRange = "30d" | "90d" | "365d" | "all";

const CHAIN_STATS_RANGES: Record<ChainStatsRange, { label: string; days: number }> = {
  "30d": { label: "30D", days: 30 },
  "90d": { label: "90D", days: 90 },
  "365d": { label: "1Y", days: 365 },
  "all": { label: "All", days: 0 },
};

export default function DAppsPage() {
  const router = useRouter();
  const [dapps, setDapps] = useState<DAppStats[]>([]);
  const [metrics, setMetrics] = useState<DAppsMetrics | null>(null);
  const [chainStats, setChainStats] = useState<ChainStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [chainStatsLoading, setChainStatsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chainStatsRange, setChainStatsRange] = useState<ChainStatsRange>("all");

  const [sortField, setSortField] = useState<SortField>("tvl");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [visibleCount, setVisibleCount] = useState(25);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [showOnChainOnly, setShowOnChainOnly] = useState(false);
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  const categoryDropdownRef = useRef<HTMLDivElement>(null);

  // Fetch DefiLlama data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await fetch("/api/dapps");
        if (!response.ok) throw new Error("Failed to fetch dApps data");
        const data = await response.json();
        setDapps(data.dapps);
        setMetrics(data.metrics);
      } catch (err: any) {
        console.error("Error fetching dApps:", err);
        setError(err?.message || "Failed to load data");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Fetch on-chain stats (separate, may take longer) - refetch when range changes
  useEffect(() => {
    const fetchChainStats = async () => {
      try {
        setChainStatsLoading(true);
        const days = CHAIN_STATS_RANGES[chainStatsRange].days;
        const response = await fetch(`/api/dapps/chain-stats?days=${days}`);
        if (response.ok) {
          const data = await response.json();
          setChainStats(data);
        }
      } catch (err) {
        console.error("Error fetching chain stats:", err);
      } finally {
        setChainStatsLoading(false);
      }
    };
    fetchChainStats();
  }, [chainStatsRange]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        categoryDropdownRef.current &&
        !categoryDropdownRef.current.contains(event.target as Node)
      ) {
        setCategoryDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Extract categories with counts
  const { sortedCategories, visibleCategories, overflowCategories } = useMemo(() => {
    const catCounts = new Map<string, number>();
    dapps.forEach((dapp) => {
      catCounts.set(dapp.category, (catCounts.get(dapp.category) || 0) + 1);
    });

    const sorted = Array.from(catCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([cat]) => cat);

    const MAX_VISIBLE = 5;
    const visible = ["All", ...sorted.slice(0, MAX_VISIBLE)];
    const overflow = sorted.slice(MAX_VISIBLE);

    return {
      sortedCategories: ["All", ...sorted],
      visibleCategories: visible,
      overflowCategories: overflow,
    };
  }, [dapps]);

  // Filter and sort
  const filteredData = useMemo(() => {
    return dapps.filter((dapp) => {
      const matchesCategory =
        selectedCategory === "All" || dapp.category === selectedCategory;
      const matchesSearch =
        dapp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        dapp.category.toLowerCase().includes(searchTerm.toLowerCase());
      // "On-chain only" shows local registry protocols (TVL = 0 but have on-chain tracking)
      const matchesOnChainFilter = !showOnChainOnly || dapp.tvl === 0;
      return matchesCategory && matchesSearch && matchesOnChainFilter;
    });
  }, [dapps, selectedCategory, searchTerm, showOnChainOnly]);

  const sortedData = useMemo(() => {
    return [...filteredData].sort((a, b) => {
      let aValue: any, bValue: any;
      switch (sortField) {
        case "name":
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case "tvl":
          aValue = a.tvl || 0;
          bValue = b.tvl || 0;
          break;
        case "change_1d":
          aValue = a.change_1d ?? -Infinity;
          bValue = b.change_1d ?? -Infinity;
          break;
        case "change_7d":
          aValue = a.change_7d ?? -Infinity;
          bValue = b.change_7d ?? -Infinity;
          break;
        case "volume24h":
          aValue = a.volume24h ?? 0;
          bValue = b.volume24h ?? 0;
          break;
        case "mcap":
          aValue = a.mcap ?? 0;
          bValue = b.mcap ?? 0;
          break;
        default:
          aValue = 0;
          bValue = 0;
      }
      if (typeof aValue === "string" && typeof bValue === "string") {
        return sortDirection === "asc"
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }
      return sortDirection === "asc" ? aValue - bValue : bValue - aValue;
    });
  }, [filteredData, sortField, sortDirection]);

  const visibleData = sortedData.slice(0, visibleCount);
  const hasMoreData = visibleCount < sortedData.length;

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
    setVisibleCount(25);
  };

  const handleLoadMore = () =>
    setVisibleCount((prev) => Math.min(prev + 25, sortedData.length));

  const getCategoryCount = (cat: string) => {
    if (cat === "All") return dapps.length;
    return dapps.filter((d) => d.category === cat).length;
  };

  const SortButton = ({
    field,
    children,
    align = "left",
  }: {
    field: SortField;
    children: React.ReactNode;
    align?: "left" | "right" | "center";
  }) => (
    <button
      className={`w-full flex items-center gap-1.5 transition-colors hover:text-black dark:hover:text-white ${
        align === "right"
          ? "justify-end"
          : align === "center"
          ? "justify-center"
          : "justify-start"
      }`}
      onClick={() => handleSort(field)}
    >
      {children}
      {sortField === field ? (
        sortDirection === "asc" ? (
          <ArrowUp className="h-3 w-3" />
        ) : (
          <ArrowDown className="h-3 w-3" />
        )
      ) : (
        <ArrowUpDown className="h-3 w-3 opacity-40" />
      )}
    </button>
  );

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-16">
          <div className="animate-pulse space-y-8 sm:space-y-12">
            <div className="space-y-4">
              <div className="h-8 sm:h-12 w-48 sm:w-96 bg-zinc-200 dark:bg-zinc-800 rounded" />
              <div className="h-4 sm:h-6 w-32 sm:w-64 bg-zinc-200 dark:bg-zinc-800 rounded" />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-8">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="space-y-2">
                  <div className="h-3 sm:h-4 w-16 sm:w-20 bg-zinc-200 dark:bg-zinc-800 rounded" />
                  <div className="h-8 sm:h-10 w-24 sm:w-32 bg-zinc-200 dark:bg-zinc-800 rounded" />
                </div>
              ))}
            </div>
            <div className="h-[300px] sm:h-[400px] bg-zinc-200 dark:bg-zinc-800 rounded-2xl" />
          </div>
        </div>
        <StatsBubbleNav />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center">
        <div className="text-center space-y-4">
          <AppWindow className="h-12 w-12 text-red-500 mx-auto" />
          <p className="text-red-600 dark:text-red-400">{error}</p>
        </div>
        <StatsBubbleNav />
      </div>
    );
  }

  // Table skeleton for loading states
  const TableSkeleton = () => (
    <>
      {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
        <tr key={i} className="animate-pulse">
          <td className="px-4 sm:px-6 py-4">
            <div className="h-4 w-6 bg-zinc-200 dark:bg-zinc-800 rounded" />
          </td>
          <td className="px-4 sm:px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-zinc-200 dark:bg-zinc-800" />
              <div className="h-4 w-24 sm:w-32 bg-zinc-200 dark:bg-zinc-800 rounded" />
            </div>
          </td>
          <td className="px-4 sm:px-6 py-4">
            <div className="h-6 w-16 bg-zinc-200 dark:bg-zinc-800 rounded-full" />
          </td>
          <td className="px-4 sm:px-6 py-4 text-right">
            <div className="h-4 w-20 bg-zinc-200 dark:bg-zinc-800 rounded ml-auto" />
          </td>
          <td className="px-4 sm:px-6 py-4 text-right">
            <div className="h-4 w-14 bg-zinc-200 dark:bg-zinc-800 rounded ml-auto" />
          </td>
          <td className="px-4 sm:px-6 py-4 text-right">
            <div className="h-4 w-14 bg-zinc-200 dark:bg-zinc-800 rounded ml-auto" />
          </td>
        </tr>
      ))}
    </>
  );

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Hero Section */}
      <div className="relative overflow-hidden border-b border-zinc-200 dark:border-zinc-800">
        {/* Gradient decoration */}
        <div
          className="absolute top-0 right-0 w-2/3 h-full pointer-events-none"
          style={{
            background: `linear-gradient(to left, rgba(239, 68, 68, 0.2) 0%, rgba(239, 68, 68, 0.12) 40%, rgba(239, 68, 68, 0.04) 70%, transparent 100%)`,
          }}
        />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 pt-8 sm:pt-16 pb-8 sm:pb-12">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-1.5 text-xs sm:text-sm mb-3 sm:mb-4 overflow-x-auto scrollbar-hide pb-1">
            <span className="inline-flex items-center gap-1 sm:gap-1.5 text-zinc-500 dark:text-zinc-400 whitespace-nowrap flex-shrink-0">
              <Globe className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              <span>Ecosystem</span>
            </span>
            <ChevronRight className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-zinc-300 dark:text-zinc-600 flex-shrink-0" />
            <span className="inline-flex items-center gap-1 sm:gap-1.5 font-medium text-zinc-900 dark:text-zinc-100 whitespace-nowrap flex-shrink-0">
              <AppWindow className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-red-500" />
              <span>DApp Analytics</span>
            </span>
          </nav>

          <div className="flex flex-col sm:flex-row items-start justify-between gap-4 sm:gap-8">
            <div>
              <div className="flex items-center gap-2 sm:gap-3 mb-2">
                <AvalancheLogo className="w-5 h-5 sm:w-6 sm:h-6" fill="currentColor" />
                <p className="text-xs sm:text-sm font-medium text-red-600 dark:text-red-500 tracking-wide uppercase">
                  Avalanche C-Chain
                </p>
              </div>
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-zinc-900 dark:text-white">
                DApp Analytics
              </h1>
            </div>

            <div className="flex gap-2 sm:gap-3 self-start sm:self-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open("https://defillama.com/chain/Avalanche", "_blank")}
                className="gap-2 text-zinc-600 dark:text-zinc-400 border-zinc-300 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-600"
              >
                DefiLlama
                <ExternalLink className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* Key metrics row */}
          <div className="grid grid-cols-2 sm:flex sm:items-baseline gap-y-3 gap-x-6 sm:gap-6 md:gap-12 pt-4 sm:pt-6">
            <div className="flex items-baseline">
              <span className="text-2xl sm:text-3xl md:text-4xl font-semibold tabular-nums text-zinc-900 dark:text-white">
                {formatCurrency(metrics?.totalTVL)}
              </span>
              <span className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 ml-1 sm:ml-2">
                TVL
              </span>
            </div>
            <div className="flex items-baseline justify-end sm:justify-start">
              <span className="text-2xl sm:text-3xl md:text-4xl font-semibold tabular-nums text-zinc-900 dark:text-white">
                {formatCurrency(metrics?.total24hVolume)}
              </span>
              <span className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 ml-1 sm:ml-2">
                24h Vol
              </span>
            </div>
            <div className="flex items-baseline">
              <span className="text-2xl sm:text-3xl md:text-4xl font-semibold tabular-nums text-zinc-900 dark:text-white">
                {metrics?.totalProtocols || 0}
              </span>
              <span className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 ml-1 sm:ml-2">
                protocols
              </span>
            </div>
            {metrics?.avaxPrice && (
              <div className="flex items-baseline justify-end sm:justify-start">
                <span className="text-2xl sm:text-3xl md:text-4xl font-semibold tabular-nums text-zinc-900 dark:text-white">
                  ${metrics.avaxPrice.usd.toFixed(2)}
                </span>
                <span
                  className={`text-xs sm:text-sm ml-1 sm:ml-2 ${
                    metrics.avaxPrice.usd_24h_change >= 0
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-red-600 dark:text-red-400"
                  }`}
                >
                  {metrics.avaxPrice.usd_24h_change >= 0 ? "+" : ""}
                  {metrics.avaxPrice.usd_24h_change.toFixed(2)}%
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Top DApps Grid */}
      <div className="bg-zinc-900 dark:bg-black py-8 sm:py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <h3 className="text-sm font-medium text-zinc-400 mb-4">Top Protocols by TVL</h3>
          <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-12 gap-3 sm:gap-4">
            {dapps.slice(0, 12).map((dapp, index) => (
              <button
                key={dapp.id}
                onClick={() => router.push(`/stats/dapps/${dapp.slug}`)}
                className="group relative flex flex-col items-center cursor-pointer"
              >
                <div className="relative">
                  <div className="absolute -top-1 -right-1 z-10 w-4 h-4 rounded-full bg-white text-zinc-900 text-[10px] font-bold flex items-center justify-center">
                    {index + 1}
                  </div>
                  <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-zinc-800 border-2 border-zinc-700 overflow-hidden transition-all duration-200 group-hover:scale-110 group-hover:border-red-500">
                    {dapp.logo ? (
                      <Image
                        src={dapp.logo}
                        alt={dapp.name}
                        width={56}
                        height={56}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-lg font-bold text-zinc-400">
                        {dapp.name.charAt(0)}
                      </div>
                    )}
                  </div>
                </div>
                <span className="mt-1.5 text-[10px] sm:text-xs text-zinc-500 text-center truncate w-full max-w-[60px] group-hover:text-white transition-colors">
                  {dapp.name.length > 8 ? `${dapp.name.slice(0, 8)}...` : dapp.name}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* On-Chain Analytics Section */}
      {(chainStats || chainStatsLoading) && (
        <div className="bg-gradient-to-b from-zinc-100 to-zinc-50 dark:from-zinc-900 dark:to-zinc-950 py-8 sm:py-12 border-y border-zinc-200 dark:border-zinc-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
                <Activity className="w-5 h-5 text-red-500" />
                On-Chain Activity
                <span className="text-sm font-normal text-zinc-500 dark:text-zinc-400">
                  ({chainStatsRange === "all" ? "All Time" : CHAIN_STATS_RANGES[chainStatsRange].label})
                </span>
              </h3>
              <div className="flex items-center gap-2">
                {chainStatsLoading && (
                  <span className="text-xs text-zinc-500 animate-pulse">Loading...</span>
                )}
                <div className="flex items-center gap-1 bg-zinc-200/50 dark:bg-zinc-800/50 rounded-lg p-1">
                  {(Object.keys(CHAIN_STATS_RANGES) as ChainStatsRange[]).map((range) => (
                    <button
                      key={range}
                      onClick={() => setChainStatsRange(range)}
                      className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                        chainStatsRange === range
                          ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm"
                          : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"
                      }`}
                    >
                      {CHAIN_STATS_RANGES[range].label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* On-chain stats cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              {chainStatsLoading ? (
                <>
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 animate-pulse">
                      <div className="h-4 w-20 bg-zinc-200 dark:bg-zinc-700 rounded mb-3" />
                      <div className="h-8 w-28 bg-zinc-200 dark:bg-zinc-700 rounded" />
                    </div>
                  ))}
                </>
              ) : chainStats ? (
                <>
                  <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 sm:p-5">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                        Transactions
                      </span>
                      <BarChart3 className="w-4 h-4 text-blue-500" />
                    </div>
                    <p className="text-xl sm:text-2xl font-semibold text-zinc-900 dark:text-white">
                      {formatNumber(chainStats.totalTransactions)}
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
                      {formatNumber(chainStats.totalGasUsed)}
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
                      {formatNumber(chainStats.totalAvaxBurned)} AVAX
                    </p>
                  </div>

                  <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 sm:p-5">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                        Top Protocols
                      </span>
                      <Layers className="w-4 h-4 text-purple-500" />
                    </div>
                    <p className="text-xl sm:text-2xl font-semibold text-zinc-900 dark:text-white">
                      {chainStats.protocolBreakdown.length}
                    </p>
                  </div>
                </>
              ) : null}
            </div>

            {/* Gas consumption breakdown */}
            {chainStats && chainStats.protocolBreakdown.length > 0 && (
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5">
                <h4 className="text-sm font-semibold text-zinc-900 dark:text-white mb-4 flex items-center gap-2">
                  <Fuel className="w-4 h-4 text-amber-500" />
                  Top Gas Consumers (30d)
                </h4>
                <div className="space-y-3">
                  {chainStats.protocolBreakdown.slice(0, 10).map((protocol, index) => (
                    <div
                      key={protocol.protocol}
                      onClick={() => protocol.slug && router.push(`/stats/dapps/${protocol.slug}`)}
                      className={`flex items-center gap-3 ${protocol.slug ? "cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/50 -mx-2 px-2 py-1.5 rounded-lg transition-colors" : ""}`}
                    >
                      <span className="text-xs text-zinc-400 w-5">{index + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-zinc-900 dark:text-white truncate">
                            {protocol.protocol}
                          </span>
                          <span className="text-xs text-zinc-500 dark:text-zinc-400 ml-2">
                            {protocol.gasShare.toFixed(1)}%
                          </span>
                        </div>
                        <div className="h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full"
                            style={{ width: `${Math.min(protocol.gasShare, 100)}%` }}
                          />
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-xs font-medium text-zinc-900 dark:text-white">
                          {formatNumber(protocol.txCount)} txs
                        </p>
                        <p className="text-xs text-orange-500">
                          {formatNumber(protocol.avaxBurned)} AVAX
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Table Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {/* Table header */}
        <div className="mb-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
            <div className="flex items-baseline gap-2 sm:gap-3">
              <h2 className="text-lg sm:text-xl font-semibold text-zinc-900 dark:text-white">
                Protocol Leaderboard
              </h2>
              <span className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
                {sortedData.length} protocols
              </span>
            </div>
          </div>

          {/* Category filters and search */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
            {/* Category filter badges */}
            <div className="flex flex-wrap items-center gap-2 flex-1">
              {visibleCategories.map((category) => {
                const count = getCategoryCount(category);
                const isSelected = selectedCategory === category;
                const catInfo = DAPP_CATEGORIES[category as DAppCategory];

                return (
                  <button
                    key={category}
                    onClick={() => {
                      setSelectedCategory(category);
                      setVisibleCount(25);
                    }}
                    className={`px-3 py-1.5 text-xs sm:text-sm font-medium rounded-full border transition-all ${
                      isSelected
                        ? getCategoryColor(category)
                        : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                    } ${isSelected ? "border-transparent" : ""}`}
                  >
                    {category === "All" ? "All" : catInfo?.name || category} ({count})
                  </button>
                );
              })}

              {/* More dropdown for overflow categories */}
              {overflowCategories.length > 0 && (
                <div className="relative" ref={categoryDropdownRef}>
                  <button
                    onClick={() => setCategoryDropdownOpen(!categoryDropdownOpen)}
                    className={`px-3 py-1.5 text-xs sm:text-sm font-medium rounded-full border transition-all flex items-center gap-1 ${
                      overflowCategories.includes(selectedCategory)
                        ? getCategoryColor(selectedCategory)
                        : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                    }`}
                  >
                    {overflowCategories.includes(selectedCategory)
                      ? DAPP_CATEGORIES[selectedCategory as DAppCategory]?.name || selectedCategory
                      : "More"}
                    <ChevronDown
                      className={`h-3 w-3 transition-transform ${
                        categoryDropdownOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  {categoryDropdownOpen && (
                    <div className="absolute top-full left-0 mt-1 py-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg z-50 min-w-[160px]">
                      {overflowCategories.map((category) => {
                        const isSelected = selectedCategory === category;
                        const count = getCategoryCount(category);
                        const catInfo = DAPP_CATEGORIES[category as DAppCategory];

                        return (
                          <button
                            key={category}
                            onClick={() => {
                              setSelectedCategory(category);
                              setVisibleCount(25);
                              setCategoryDropdownOpen(false);
                            }}
                            className={`w-full px-3 py-2 text-left text-xs sm:text-sm transition-colors ${
                              isSelected
                                ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white font-medium"
                                : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                            }`}
                          >
                            <span className="flex items-center justify-between">
                              <span>{catInfo?.name || category}</span>
                              <span className="text-zinc-400 dark:text-zinc-500">
                                ({count})
                              </span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* On-chain only toggle */}
              <button
                onClick={() => {
                  setShowOnChainOnly(!showOnChainOnly);
                  setVisibleCount(25);
                }}
                className={`px-3 py-1.5 text-xs sm:text-sm font-medium rounded-full border transition-all flex items-center gap-1.5 ${
                  showOnChainOnly
                    ? "bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400 border-orange-200 dark:border-orange-500/30"
                    : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                }`}
              >
                <Activity className="w-3 h-3" />
                On-chain Only
              </button>
            </div>

            {/* Search */}
            <div className="relative w-full sm:w-auto sm:flex-shrink-0 sm:w-64">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400 dark:text-neutral-500 pointer-events-none z-10" />
              <Input
                placeholder="Search protocols..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-10 rounded-lg border-[#e1e2ea] dark:border-neutral-700 bg-[#fcfcfd] dark:bg-neutral-800 transition-colors focus-visible:border-black dark:focus-visible:border-white focus-visible:ring-0 text-sm sm:text-base text-black dark:text-white placeholder:text-neutral-500 dark:placeholder:text-neutral-400"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchTerm("");
                    setVisibleCount(25);
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 flex items-center justify-center text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-full z-20 transition-colors"
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-hidden border-0 bg-white dark:bg-zinc-950">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
                <tr>
                  <th className="px-4 sm:px-6 py-4 text-left whitespace-nowrap w-12">
                    <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                      #
                    </span>
                  </th>
                  <th className="px-4 sm:px-6 py-4 text-left whitespace-nowrap">
                    <SortButton field="name" align="left">
                      <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                        Protocol
                      </span>
                    </SortButton>
                  </th>
                  <th className="px-4 sm:px-6 py-4 text-left whitespace-nowrap">
                    <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                      Category
                    </span>
                  </th>
                  <th className="px-4 sm:px-6 py-4 text-right whitespace-nowrap">
                    <SortButton field="tvl" align="right">
                      <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                        TVL
                      </span>
                    </SortButton>
                  </th>
                  <th className="px-4 sm:px-6 py-4 text-right whitespace-nowrap">
                    <SortButton field="change_1d" align="right">
                      <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                        24h
                      </span>
                    </SortButton>
                  </th>
                  <th className="px-4 sm:px-6 py-4 text-right whitespace-nowrap">
                    <SortButton field="change_7d" align="right">
                      <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                        7d
                      </span>
                    </SortButton>
                  </th>
                  <th className="px-4 sm:px-6 py-4 text-right whitespace-nowrap hidden lg:table-cell">
                    <SortButton field="volume24h" align="right">
                      <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                        Volume 24h
                      </span>
                    </SortButton>
                  </th>
                  <th className="px-4 sm:px-6 py-4 text-right whitespace-nowrap hidden xl:table-cell">
                    <SortButton field="mcap" align="right">
                      <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                        Market Cap
                      </span>
                    </SortButton>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {visibleData.map((dapp, index) => {
                  const catInfo = DAPP_CATEGORIES[dapp.category];
                  const rank = sortedData.indexOf(dapp) + 1;

                  return (
                    <tr
                      key={dapp.id}
                      onClick={() => router.push(`/stats/dapps/${dapp.slug}`)}
                      className="group transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900/50 cursor-pointer"
                    >
                      <td className="px-4 sm:px-6 py-4 text-sm text-zinc-500 dark:text-zinc-400">
                        {rank}
                      </td>
                      <td className="px-4 sm:px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800 flex-shrink-0 overflow-hidden">
                            {dapp.logo ? (
                              <Image
                                src={dapp.logo}
                                alt={dapp.name}
                                width={40}
                                height={40}
                                className="h-full w-full rounded-full object-cover"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = "none";
                                }}
                              />
                            ) : (
                              <span className="text-base font-semibold text-zinc-600 dark:text-zinc-300">
                                {dapp.name.charAt(0)}
                              </span>
                            )}
                          </div>
                          <span className="font-medium text-zinc-900 dark:text-zinc-100 group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors">
                            {dapp.name}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 sm:px-6 py-4">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${getCategoryColor(
                            dapp.category
                          )}`}
                        >
                          {catInfo?.name || dapp.category}
                        </span>
                      </td>
                      <td className="px-4 sm:px-6 py-4 text-right font-mono text-sm tabular-nums text-zinc-900 dark:text-zinc-100">
                        {formatCurrency(dapp.tvl)}
                      </td>
                      <td className="px-4 sm:px-6 py-4 text-right font-mono text-sm tabular-nums">
                        {dapp.change_1d != null ? (
                          <span
                            className={`${
                              dapp.change_1d >= 0
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-red-600 dark:text-red-400"
                            }`}
                          >
                            {dapp.change_1d >= 0 ? "+" : ""}
                            {dapp.change_1d.toFixed(2)}%
                          </span>
                        ) : (
                          <span className="text-zinc-400">-</span>
                        )}
                      </td>
                      <td className="px-4 sm:px-6 py-4 text-right font-mono text-sm tabular-nums">
                        {dapp.change_7d != null ? (
                          <span
                            className={`${
                              dapp.change_7d >= 0
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-red-600 dark:text-red-400"
                            }`}
                          >
                            {dapp.change_7d >= 0 ? "+" : ""}
                            {dapp.change_7d.toFixed(2)}%
                          </span>
                        ) : (
                          <span className="text-zinc-400">-</span>
                        )}
                      </td>
                      <td className="px-4 sm:px-6 py-4 text-right font-mono text-sm tabular-nums text-zinc-900 dark:text-zinc-100 hidden lg:table-cell">
                        {dapp.volume24h ? formatCurrency(dapp.volume24h) : "-"}
                      </td>
                      <td className="px-4 sm:px-6 py-4 text-right font-mono text-sm tabular-nums text-zinc-900 dark:text-zinc-100 hidden xl:table-cell">
                        {dapp.mcap ? formatCurrency(dapp.mcap) : "-"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {hasMoreData && (
          <div className="flex justify-center mt-4 sm:mt-6 pb-14">
            <Button
              onClick={handleLoadMore}
              variant="outline"
              size="lg"
              className="px-4 sm:px-8 py-2 sm:py-3 text-sm sm:text-base border-[#e1e2ea] dark:border-neutral-700 bg-[#fcfcfd] dark:bg-neutral-900 text-black dark:text-white transition-colors hover:border-black dark:hover:border-white hover:bg-[#fcfcfd] dark:hover:bg-neutral-900"
            >
              <span className="hidden sm:inline">Load More Protocols </span>
              <span className="sm:hidden">Load More </span>({sortedData.length - visibleCount} remaining)
            </Button>
          </div>
        )}

        {sortedData.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <AppWindow className="h-12 w-12 text-zinc-400 mb-4" />
            <p className="text-zinc-600 dark:text-zinc-400 mb-2">No protocols found</p>
            <p className="text-sm text-zinc-500 dark:text-zinc-500">
              Try adjusting your search or filter
            </p>
          </div>
        )}
      </div>

      <StatsBubbleNav />
    </div>
  );
}
