"use client";
import type React from "react";
import { useState, useEffect } from "react";
import Image from "next/image";
import { useTheme } from "next-themes";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowUpDown, ArrowUp, ArrowDown, Activity, Users, BarChart3, Search, ExternalLink } from "lucide-react";
import { ChartContainer, ChartTooltip } from "@/components/ui/chart";
import { Area, AreaChart, XAxis, YAxis, CartesianGrid } from "recharts";
import { StatsBubbleNav } from "@/components/stats/stats-bubble.config";
import l1ChainsData from "@/constants/l1-chains.json";
import { TimeSeriesMetric, ICMMetric, TimeRange, L1Chain } from "@/types/stats";
import { AvalancheLogo } from "@/components/navigation/avalanche-logo";
import { ChartSkeletonLoader } from "@/components/ui/chart-skeleton";
import { ExplorerDropdown } from "@/components/stats/ExplorerDropdown";

interface ChainOverviewMetrics {
  chainId: string;
  chainName: string;
  chainLogoURI: string;
  txCount: TimeSeriesMetric;
  activeAddresses: TimeSeriesMetric;
  icmMessages: ICMMetric;
  validatorCount: number | string;
}

interface OverviewMetrics {
  chains: ChainOverviewMetrics[];
  aggregated: {
    totalTxCount: TimeSeriesMetric;
    totalActiveAddresses: TimeSeriesMetric;
    totalICMMessages: ICMMetric;
    totalValidators: number;
    activeChains: number;
  };
  last_updated: number;
}

type SortDirection = "asc" | "desc";

export default function AvalancheMetrics() {
  const { resolvedTheme } = useTheme();
  const [isMounted, setIsMounted] = useState(false);
  const [overviewMetrics, setOverviewMetrics] =
    useState<OverviewMetrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortField, setSortField] = useState<string>("weeklyActiveAddresses");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [visibleCount, setVisibleCount] = useState(25);
  const [searchTerm, setSearchTerm] = useState("");
  const timeRange: TimeRange = "1y"; // Fixed time range

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const getChainSlug = (chainId: string, chainName: string): string | null => {
    const chain = l1ChainsData.find(
      (c) =>
        c.chainId === chainId ||
        c.chainName.toLowerCase() === chainName.toLowerCase()
    );
    return chain?.slug || null;
  };

  const getThemedLogoUrl = (logoUrl: string): string => {
    if (!isMounted || !logoUrl) return logoUrl;

    // fix to handle both light and dark mode logos
    if (resolvedTheme === "dark") {
      return logoUrl.replace(/Light/g, "Dark");
    } else {
      return logoUrl.replace(/Dark/g, "Light");
    }
  };

  useEffect(() => {
    const fetchMetrics = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/overview-stats?timeRange=${timeRange}`
        );
        if (!response.ok) {
          throw new Error(`Failed to fetch metrics: ${response.status}`);
        }

        const metrics = await response.json();
        setOverviewMetrics(metrics);
      } catch (err: any) {
        console.error("Error fetching metrics data:", err);
        setError(err?.message || "Failed to load metrics data");
      }

      setLoading(false);
    };

    fetchMetrics();
  }, [timeRange]);

  const formatNumber = (num: number | string): string => {
    if (num === "N/A" || num === "" || num === null || num === undefined)
      return "N/A";
    const numValue = typeof num === "string" ? Number.parseFloat(num) : num;
    if (isNaN(numValue)) return "N/A";

    if (numValue >= 1e12) {
      return `${(numValue / 1e12).toFixed(2)}T`;
    } else if (numValue >= 1e9) {
      return `${(numValue / 1e9).toFixed(2)}B`;
    } else if (numValue >= 1e6) {
      return `${(numValue / 1e6).toFixed(2)}M`;
    } else if (numValue >= 1e3) {
      return `${(numValue / 1e3).toFixed(2)}K`;
    }
    return numValue.toLocaleString();
  };

  const formatFullNumber = (num: number): string => {
    return num.toLocaleString();
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
    setVisibleCount(25);
  };

  const chains = overviewMetrics?.chains || [];

  const filteredData = chains.filter((chain) => {
    return chain.chainName.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const sortedData = [...filteredData].sort((a, b) => {
    let aValue: any;
    let bValue: any;

    switch (sortField) {
      case "chainName":
        aValue = a.chainName;
        bValue = b.chainName;
        break;
      case "weeklyTxCount":
        aValue =
          typeof a.txCount.current_value === "number"
            ? a.txCount.current_value / 365
            : 0;
        bValue =
          typeof b.txCount.current_value === "number"
            ? b.txCount.current_value / 365
            : 0;
        break;
      case "weeklyActiveAddresses":
        aValue =
          typeof a.activeAddresses.current_value === "number"
            ? a.activeAddresses.current_value
            : 0;
        bValue =
          typeof b.activeAddresses.current_value === "number"
            ? b.activeAddresses.current_value
            : 0;
        break;
      case "totalIcmMessages":
        aValue =
          typeof a.icmMessages.current_value === "number"
            ? a.icmMessages.current_value / 365
            : 0;
        bValue =
          typeof b.icmMessages.current_value === "number"
            ? b.icmMessages.current_value / 365
            : 0;
        break;
      case "validatorCount":
        aValue = typeof a.validatorCount === "number" ? a.validatorCount : 0;
        bValue = typeof b.validatorCount === "number" ? b.validatorCount : 0;
        break;
      case "throughput":
        aValue = Number.parseFloat(getChainTPS(a));
        bValue = Number.parseFloat(getChainTPS(b));
        break;
      case "category":
        aValue = getChainCategory(a.chainId, a.chainName);
        bValue = getChainCategory(b.chainId, b.chainName);
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

    const aNum = typeof aValue === "number" ? aValue : 0;
    const bNum = typeof bValue === "number" ? bValue : 0;
    return sortDirection === "asc" ? aNum - bNum : bNum - aNum;
  });

  const visibleData = sortedData.slice(0, visibleCount);
  const hasMoreData = visibleCount < sortedData.length;

  const handleLoadMore = () => {
    setVisibleCount((prev) => Math.min(prev + 25, sortedData.length));
  };

  const SortButton = ({
    field,
    children,
  }: {
    field: string;
    children: React.ReactNode;
  }) => (
    <button
      className="flex items-center gap-2 transition-colors hover:text-neutral-900 dark:hover:text-neutral-100"
      onClick={() => handleSort(field)}
    >
      {children}
      {sortField === field ? (
        sortDirection === "asc" ? (
          <ArrowUp className="h-3.5 w-3.5" />
        ) : (
          <ArrowDown className="h-3.5 w-3.5" />
        )
      ) : (
        <ArrowUpDown className="h-3.5 w-3.5" />
      )}
    </button>
  );

  const getChainCategory = (chainId: string, chainName: string): string => {
    // Look up category from constants/l1-chains.json
    const chain = l1ChainsData.find(
      (c) =>
        c.chainId === chainId ||
        c.chainName.toLowerCase() === chainName.toLowerCase()
    );
    return chain?.category || "General";
  };

  const getCategoryColor = (category: string): string => {
    const colors: { [key: string]: string } = {
      General:
        "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300",
      DeFi: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
      Gaming:
        "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
      Institutions:
        "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
      RWAs: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
      Payments: "bg-pink-100 text-pink-700 dark:bg-pink-900 dark:text-pink-300",
    };
    return (
      colors[category] ||
      "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
    );
  };

  const getChainTPS = (chain: ChainOverviewMetrics): string => {
    const txCount =
      typeof chain.txCount.current_value === "number"
        ? chain.txCount.current_value
        : 0;
    const secondsInYear = 365 * 24 * 60 * 60;
    const tps = txCount / secondsInYear;
    return tps.toFixed(2);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-neutral-950 pt-8">
        <main className="container mx-auto px-6 py-10 pb-24 space-y-8">
          {/* Hero Section - Loading State */}
          <div className="relative overflow-hidden rounded-2xl p-8 sm:p-12 mb-10">
            {/* Multi-layer gradient background */}
            <div className="absolute inset-0 bg-black" />
            <div
              className="absolute inset-0 opacity-60"
              style={{
                background: 'linear-gradient(140deg, #E84142 0%, transparent 70%)'
              }}
            />
            <div
              className="absolute inset-0 opacity-40"
              style={{
                background: 'linear-gradient(to top left, #3752AC 0%, transparent 50%)'
              }}
            />
            <div
              className="absolute inset-0 opacity-30"
              style={{
                background: 'radial-gradient(circle at 50% 50%, #E84142 0%, #3752AC 30%, transparent 70%)'
              }}
            />

            {/* Content */}
            <div className="relative z-10 space-y-8">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex-1">
                  <h1 className="text-3xl sm:text-4xl font-semibold text-white mb-3">
                    Avalanche L1s Index
                  </h1>
                  <p className="text-white/80 text-sm sm:text-base max-w-3xl">
                    Loading comprehensive stats for Avalanche Mainnet L1s...
                  </p>
                </div>

                {/* Submit button skeleton */}
                <div className="flex-shrink-0 h-9 w-32 bg-white/20 rounded-md animate-pulse" />
              </div>

              {/* Separator */}
              <div className="border-t border-white/20" />

              {/* Main metrics - 3 cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="backdrop-blur-md bg-white/10 border border-white/20 rounded-lg p-6 text-center animate-pulse">
                    <div className="h-4 bg-white/20 rounded mb-3 w-2/3 mx-auto" />
                    <div className="h-10 bg-white/30 rounded w-1/2 mx-auto" />
                  </div>
                ))}
              </div>

              {/* Secondary metrics - 4 cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="backdrop-blur-md bg-white/10 border border-white/20 rounded-lg p-5 text-center animate-pulse">
                    <div className="h-3 bg-white/20 rounded mb-3 w-3/4 mx-auto" />
                    <div className="h-7 bg-white/30 rounded w-1/3 mx-auto" />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Separator */}
          <div className="border-t border-neutral-200 dark:border-neutral-800 my-8" />

          {/* Search Bar Skeleton */}
          <div className="flex items-center gap-2">
            <div className="h-10 bg-neutral-200 dark:bg-neutral-800 rounded-full flex-1 max-w-sm animate-pulse" />
            <div className="h-9 w-28 bg-neutral-200 dark:bg-neutral-800 rounded-full animate-pulse" />
          </div>

          {/* Table Skeleton */}
          <Card className="overflow-hidden border border-neutral-200 dark:border-neutral-800 py-0">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead className="bg-[#fcfcfd] dark:bg-neutral-900">
                  <tr className="border-b border-neutral-200 dark:border-neutral-800">
                    {["L1 Name", "Addresses", "Transactions", "ICM", "Validators", "Throughput", "Category", "Explorer"].map((header, i) => (
                      <th key={i} className="border-r border-neutral-200 dark:border-neutral-800 px-4 py-2 text-left">
                        <div className="h-4 bg-neutral-300 dark:bg-neutral-700 rounded w-20 animate-pulse" />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-neutral-950">
                  {[...Array(10)].map((_, rowIndex) => (
                    <tr key={rowIndex} className="border-b border-slate-100 dark:border-neutral-800">
                      <td className="border-r border-slate-100 dark:border-neutral-800 px-4 py-2">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-neutral-200 dark:bg-neutral-800 animate-pulse" />
                          <div className="h-4 bg-neutral-200 dark:bg-neutral-800 rounded w-24 animate-pulse" />
                        </div>
                      </td>
                      <td className="border-r border-slate-100 dark:border-neutral-800 px-4 py-2">
                        <div className="h-4 bg-neutral-200 dark:bg-neutral-800 rounded w-16 animate-pulse" />
                      </td>
                      <td className="border-r border-slate-100 dark:border-neutral-800 px-4 py-2">
                        <div className="h-4 bg-neutral-200 dark:bg-neutral-800 rounded w-16 animate-pulse" />
                      </td>
                      <td className="border-r border-slate-100 dark:border-neutral-800 px-4 py-2">
                        <div className="h-4 bg-neutral-200 dark:bg-neutral-800 rounded w-12 animate-pulse" />
                      </td>
                      <td className="border-r border-slate-100 dark:border-neutral-800 px-4 py-2">
                        <div className="h-4 bg-neutral-200 dark:bg-neutral-800 rounded w-12 animate-pulse" />
                      </td>
                      <td className="border-r border-slate-100 dark:border-neutral-800 px-4 py-2">
                        <div className="h-4 bg-neutral-200 dark:bg-neutral-800 rounded w-16 animate-pulse" />
                      </td>
                      <td className="border-r border-slate-100 dark:border-neutral-800 px-4 py-2">
                        <div className="h-6 bg-neutral-200 dark:bg-neutral-800 rounded-full w-20 animate-pulse" />
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex items-center justify-center">
                          <div className="h-8 w-16 bg-neutral-200 dark:bg-neutral-800 rounded-md animate-pulse" />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </main>

        {/* Bubble Navigation */}
        <StatsBubbleNav />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-white dark:bg-neutral-950 pt-8">
        <main className="container mx-auto px-6 py-10 pb-24 space-y-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <Card className="max-w-md border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
              <div className="p-6 text-center">
                <div className="w-12 h-12 bg-red-50 dark:bg-red-950 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Activity className="h-6 w-6 text-red-600 dark:text-red-400" />
                </div>
                <h3 className="text-lg font-semibold text-black dark:text-white mb-2">
                  Failed to Load Data
                </h3>
                <p className="text-red-600 dark:text-red-400 text-sm">
                  {error}
                </p>
              </div>
            </Card>
          </div>
        </main>

        {/* Bubble Navigation */}
        <StatsBubbleNav />
      </div>
    );
  }

  if (!overviewMetrics || overviewMetrics.chains.length === 0) {
    return (
      <div className="min-h-screen bg-white dark:bg-neutral-950 pt-8">
        <main className="container mx-auto px-6 py-10 pb-24 space-y-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <Card className="max-w-md border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
              <div className="p-6 text-center">
                <div className="w-12 h-12 bg-neutral-100 dark:bg-neutral-800 rounded-full flex items-center justify-center mx-auto mb-4">
                  <BarChart3 className="h-6 w-6 text-neutral-500 dark:text-neutral-400" />
                </div>
                <h3 className="text-lg font-semibold text-black dark:text-white mb-2">
                  No Data Available
                </h3>
                <p className="text-neutral-600 dark:text-neutral-400 text-sm">
                  No chain metrics found from the API.
                </p>
              </div>
            </Card>
          </div>
        </main>

        {/* Bubble Navigation */}
        <StatsBubbleNav />
      </div>
    );
  }

  const CHART_CONFIG = {
    colors: ["#0ea5e9", "#8b5cf6", "#f97316", "#22c55e", "#ec4899", "#f59e0b", "#ef4444", "#06b6d4", "#84cc16", "#a855f7", "#6b7280"],
    maxTopChains: 10,
  };

  const { chartData, topChains } = getChartData();

  const getYAxisDomain = (data: any[]): [number, number] => {
    if (data.length === 0) return [0, 100];
    const allValues = data.flatMap((dataPoint) => {
      return topChains
        .map((chain) => {
          const chainKey = chain.chainName.length > 10 ? chain.chainName.substring(0, 10) + "..." : chain.chainName;
          return dataPoint[chainKey] || 0;
        }).filter((val) => val > 0);
    });

    if (allValues.length === 0) return [0, 100];

    const min = Math.min(...allValues);
    const max = Math.max(...allValues);

    if (min > 100) {
      const baseStart = min * 0.7;
      const padding = (max - min) * 0.2; // More padding for better visibility
      console.log(`Applying Y-axis offset: ${baseStart} to ${max + padding}`);
      return [baseStart, max + padding];
    }
    const padding = (max - min) * 0.1;
    return [0, max + padding];
  };

  const yAxisDomain = getYAxisDomain(chartData);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="container mx-auto px-4 py-6 sm:py-8 pb-24 space-y-6 sm:space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 sm:gap-6">
          <div className="space-y-2 sm:space-y-3">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight">Avalanche Mainnet L1 Stats</h1>
            <p className="text-sm sm:text-base text-muted-foreground max-w-2xl leading-relaxed">
              Opinionated stats for Avalanche Mainnet L1s. Click on any chain to
              view detailed metrics.
            </p>
          </div>
          <div className="flex flex-col sm:items-end gap-2 self-start">
            <DateRangeFilter
              onRangeChange={(range) =>
                setTimeRange(range as "30d" | "90d" | "1y" | "all")
              }
              defaultRange={timeRange}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-6">
          <Card className="py-0 bg-card hover:border-border transition-colors">
            <CardContent className="p-4 sm:p-6">
              <div className="space-y-2 sm:space-y-3">
                <h3 className="text-xs sm:text-sm font-medium text-muted-foreground truncate">
                  Active Mainnet Avalanche L1s
                </h3>
                <div className="space-y-1">
                  <p className="text-2xl sm:text-3xl font-bold text-foreground">
                    {overviewMetrics.chains.length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="py-0 bg-card hover:border-border transition-colors">
            <CardContent className="p-4 sm:p-6">
              <div className="space-y-2 sm:space-y-3">
                <h3 className="text-xs sm:text-sm font-medium text-muted-foreground truncate">
                  Total Transactions ({timeRange})
                </h3>
                <div className="space-y-1">
                  <p className="text-2xl sm:text-3xl font-bold text-foreground">
                    {formatNumber(
                      typeof overviewMetrics.aggregated.totalTxCount
                        .current_value === "number"
                        ? overviewMetrics.aggregated.totalTxCount.current_value
                        : 0
                    )}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="py-0 bg-card hover:border-border transition-colors sm:col-span-2 lg:col-span-1">
            <CardContent className="p-4 sm:p-6">
              <div className="space-y-2 sm:space-y-3">
                <h3 className="text-xs sm:text-sm font-medium text-muted-foreground truncate">
                  Active Addresses ({timeRange})
                </h3>
                <div className="space-y-1">
                  <p className="text-2xl sm:text-3xl font-bold text-foreground">
                    {formatNumber(
                      typeof overviewMetrics.aggregated.totalActiveAddresses
                        .current_value === "number"
                        ? overviewMetrics.aggregated.totalActiveAddresses
                            .current_value
                        : 0
                    )}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          <Card className="py-0 bg-blue-500/10 border-blue-500/20">
            <CardContent className="p-3 sm:p-4">
              <div className="text-center space-y-1">
                <p className="text-xs font-medium text-muted-foreground">
                  Active Chains ({timeRange})
                </p>
                <p className="text-base sm:text-lg font-bold text-foreground">
                  {overviewMetrics.aggregated.activeChains}
                </p>
              </div>

          <Card className="py-0 bg-green-500/10 border-green-500/20">
            <CardContent className="p-3 sm:p-4">
              <div className="text-center space-y-1">
                <p className="text-xs font-medium text-muted-foreground">
                  ICM Messages
                </p>
                <p className="text-base sm:text-lg font-bold text-foreground">
                  {formatNumber(
                    typeof overviewMetrics.aggregated.totalTxCount
                      .current_value === "number"
                      ? Math.round(
                          overviewMetrics.aggregated.totalTxCount.current_value /
                            365
                        )
                      : 0
                  )}
                </p>
              </div>

          <Card className="py-0 bg-yellow-500/10 border-yellow-500/20">
            <CardContent className="p-3 sm:p-4">
              <div className="text-center space-y-1">
                <p className="text-xs font-medium text-muted-foreground">
                  Total Validators
                </p>
                <p className="text-base sm:text-lg font-bold text-foreground">
                  {formatNumber(overviewMetrics.aggregated.totalValidators)}
                </p>
              </div>

              <div className="backdrop-blur-md bg-white/10 border border-white/20 rounded-lg p-5 text-center">
                <p className="mb-3 text-xs font-medium uppercase tracking-wide text-white/60">
                  All-Time Validation Fees
                </p>
                <div className="flex items-center justify-center gap-2">
                  <AvalancheLogo className="w-6 h-6" fill="white" />
                  <p className="text-2xl font-semibold text-white">
                    8,310
                  </p>
                </div>
              </div>

              <div className="backdrop-blur-md bg-white/10 border border-white/20 rounded-lg p-5 text-center">
                <p className="mb-3 text-xs font-medium uppercase tracking-wide text-white/60">
                  Total Network Fees Burned
                </p>
                <div className="flex items-center justify-center gap-2">
                  <AvalancheLogo className="w-6 h-6" fill="white" />
                  <p className="text-2xl font-semibold text-white">
                    {formatNumber(4930978)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <Card>
          <CardHeader className="pb-3 sm:pb-4">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg md:text-xl">
              <BarChart3 className="h-4 w-4 sm:h-5 sm:w-5 text-orange-500" />
              <span className="break-words">Daily Transaction Trends - Top L1s ({timeRange})</span>
            </CardTitle>
            <p className="text-xs sm:text-sm text-muted-foreground">Stacked daily transaction volumes showing total activity across top L1s for the selected time range</p>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[250px] sm:h-[350px] w-full">
              <AreaChart
                data={chartData}
                margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
              >
                <defs>
                  {topChains.map((_, index) => (
                    <linearGradient
                      key={index}
                      id={`gradient-${index}`}
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="5%"
                        stopColor={CHART_CONFIG.colors[index]}
                        stopOpacity={0.8}
                      />
                      <stop
                        offset="95%"
                        stopColor={CHART_CONFIG.colors[index]}
                        stopOpacity={0.1}
                      />
                    </linearGradient>
                  ))}
                  <linearGradient
                    id="gradient-others"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="5%"
                      stopColor={CHART_CONFIG.colors[10]}
                      stopOpacity={0.8}
                    />
                    <stop
                      offset="95%"
                      stopColor={CHART_CONFIG.colors[10]}
                      stopOpacity={0.1}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  vertical={false}
                  strokeDasharray="3 3"
                  className="stroke-muted/30"
                />
                <XAxis
                  dataKey="day"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  minTickGap={32}
                  tickFormatter={(value) => formatDateLabel(value)}
                  tick={{
                    fontFamily:
                      'ui-monospace, SFMono-Regular, "SF Mono", Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                    fontSize: 12,
                  }}
                />
                <YAxis
                  domain={yAxisDomain}
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  tickFormatter={(value) => formatNumber(value)}
                  tick={{
                    fontFamily:
                      'ui-monospace, SFMono-Regular, "SF Mono", Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                    fontSize: 12,
                  }}
                />
                <ChartTooltip
                  cursor={false}
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      const validPayload = payload
                        .filter(
                          (entry) =>
                            typeof entry.value === "number" && entry.value > 0
                        )
                        .sort(
                          (a, b) => (b.value as number) - (a.value as number)
                        );

                      return (
                        <div className="bg-background border border-border rounded-lg shadow-lg p-4 min-w-[250px]">
                          <p className="font-semibold text-sm mb-3">
                            {formatTooltipDate(label)}
                          </p>
                          <div className="space-y-2">
                            {validPayload.map((entry, index) => {
                              const fullName =
                                chartData.find((d) => d.day === label)?.[
                                  `${entry.dataKey}_fullName`
                                ] || entry.dataKey;
                              return (
                                <div
                                  key={index}
                                  className="flex items-center justify-between gap-3"
                                >
                                  <div className="flex items-center gap-2">
                                    <div
                                      className="w-3 h-3 rounded-sm"
                                      style={{ backgroundColor: entry.color }}
                                    />
                                    <span className="text-sm font-medium">
                                      {fullName}
                                    </span>
                                  </div>
                                  <span className="text-sm font-mono font-semibold">
                                    {formatFullNumber(entry.value as number)} tx
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                {topChains.map((chain, index) => {
                  const key =
                    chain.chainName.length > 10
                      ? chain.chainName.substring(0, 10) + "..."
                      : chain.chainName;
                  return (
                    <Area
                      key={index}
                      type="monotone"
                      dataKey={key}
                      stackId="1"
                      stroke={CHART_CONFIG.colors[index]}
                      strokeWidth={2}
                      fill={`url(#gradient-${index})`}
                      fillOpacity={1}
                    />
                  );
                })}
                <Area
                  type="monotone"
                  dataKey="Others"
                  stackId="1"
                  stroke={CHART_CONFIG.colors[10]}
                  strokeWidth={2}
                  fill="url(#gradient-others)"
                  fillOpacity={1}
                />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-start sm:items-center justify-between">
          <div className="relative flex-1 max-w-sm w-full sm:w-auto">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 rounded-xl bg-white text-sm"
            />
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearchTerm("");
              setVisibleCount(25);
            }}
            className="text-xs sm:text-sm"
          >
            Clear Search
          </Button>
        </div>

        <Card className="overflow-hidden border border-neutral-200 dark:border-neutral-800 py-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-b-2 bg-muted/30 hover:bg-muted/30">
                  <TableHead className="font-medium py-3 sm:py-6 px-3 sm:px-6 text-muted-foreground min-w-[160px] sm:min-w-[200px]">
                    <SortButton field="chainName">L1 Name</SortButton>
                  </TableHead>
                  <TableHead className="font-medium text-center min-w-[100px] sm:min-w-[140px] text-muted-foreground px-2 sm:px-4">
                    <SortButton field="weeklyTxCount">
                      <span className="hidden lg:flex items-center gap-1">
                        <BarChart3 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        Transactions ({timeRange})
                      </span>
                      <span className="lg:hidden text-xs">Txs</span>
                    </SortButton>
                  </TableHead>
                  <TableHead className="font-medium text-center min-w-[100px] sm:min-w-[140px] text-muted-foreground px-2 sm:px-4">
                    <SortButton field="weeklyActiveAddresses">
                      <span className="hidden lg:flex items-center gap-1">
                        <Users className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                        Active Addresses ({timeRange})
                      </span>
                      <span className="lg:hidden text-xs">Addrs</span>
                    </SortButton>
                  </TableHead>
                  <TableHead className="font-medium text-center min-w-[80px] sm:min-w-[140px] text-muted-foreground px-2 sm:px-4">
                    <SortButton field="totalIcmMessages">
                      <span className="hidden lg:flex items-center gap-1">
                        <Activity className="h-4 w-4 text-green-600 dark:text-green-400" />
                        Total ICM Count
                      </span>
                      <span className="lg:hidden text-xs">ICM</span>
                    </SortButton>
                  </TableHead>
                  <TableHead className="font-medium text-center min-w-[80px] sm:min-w-[140px] text-muted-foreground px-2 sm:px-4">
                    <SortButton field="validatorCount">
                      <span className="hidden lg:flex items-center gap-1">
                        <Users className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                        Validators
                      </span>
                      <span className="lg:hidden text-xs">Vals</span>
                    </SortButton>
                  </TableHead>
                  <TableHead className="font-medium text-center min-w-[80px] sm:min-w-[100px] text-muted-foreground text-xs sm:text-sm">
                    Activity
                  </TableHead>
                  <TableHead className="font-medium text-center min-w-[80px] sm:min-w-[100px] text-muted-foreground text-xs sm:text-sm">
                    Details
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleData.map((chain, index) => {
                  const chainSlug = getChainSlug(
                    chain.chainId,
                    chain.chainName
                  );
                  return (
                    <tr
                      key={chain.chainId}
                      className={`border-b border-slate-100 dark:border-neutral-800 transition-colors hover:bg-blue-50/50 dark:hover:bg-neutral-800/50 ${
                        chainSlug ? "cursor-pointer" : ""
                      }`}
                      onClick={() => {
                        if (chainSlug) {
                          window.location.href = `/stats/l1/${chainSlug}`;
                        }
                      }}
                    >
                      <TableCell className="py-2 sm:py-4 px-3 sm:px-6">
                        <div className="flex items-center gap-2 sm:gap-4">
                          <div className="relative">
                            {chain.chainLogoURI ? (
                              <Image
                                src={
                                  getThemedLogoUrl(chain.chainLogoURI) ||
                                  "/placeholder.svg"
                                }
                                alt={`${chain.chainName} logo`}
                                width={24}
                                height={24}
                                className="sm:w-8 sm:h-8 rounded-full flex-shrink-0 ring-2 ring-border/50"
                                onError={(e) => {
                                  e.currentTarget.style.display = "none";
                                }}
                              />
                            ) : (
                              <div className="w-6 h-6 sm:w-8 sm:h-8 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-xs sm:text-sm font-bold text-white flex-shrink-0">
                                {chain.chainName.charAt(0)}
                              </div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="font-semibold text-foreground text-sm sm:text-base truncate">
                              {chain.chainName}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center px-2 sm:px-4">
                        <span
                          className={`font-mono font-semibold text-xs sm:text-sm ${
                            typeof chain.txCount.current_value === "number" &&
                            chain.txCount.current_value > 0
                              ? "text-foreground"
                              : "text-muted-foreground"
                          }`}
                        >
                          {typeof chain.txCount.current_value === "number"
                            ? formatFullNumber(chain.txCount.current_value)
                            : chain.txCount.current_value}
                        </span>
                      </TableCell>
                      <TableCell className="text-center px-2 sm:px-4">
                        <span
                          className={`font-mono font-semibold text-xs sm:text-sm ${
                            typeof chain.activeAddresses.current_value ===
                              "number" &&
                            chain.activeAddresses.current_value > 0
                              ? "text-foreground"
                              : "text-muted-foreground"
                          }`}
                        >
                          {typeof chain.activeAddresses.current_value ===
                          "number"
                            ? formatFullNumber(
                                chain.activeAddresses.current_value
                              )
                            : chain.activeAddresses.current_value}
                        </span>
                      </TableCell>
                      <TableCell className="text-center px-2 sm:px-4">
                        <span
                          className={`font-mono font-semibold text-xs sm:text-sm ${
                            typeof chain.icmMessages.current_value ===
                              "number" && chain.icmMessages.current_value > 0
                              ? "text-foreground"
                              : "text-muted-foreground"
                          }`}
                        >
                          {typeof chain.icmMessages.current_value === "number"
                            ? formatFullNumber(
                                Math.round(
                                  chain.icmMessages.current_value / 365
                                )
                              )
                            : chain.icmMessages.current_value}
                        </span>
                      </TableCell>
                      <TableCell className="text-center px-2 sm:px-4">
                        <span
                          className={`font-mono font-semibold text-xs sm:text-sm ${
                            typeof chain.validatorCount === "number" &&
                            chain.validatorCount > 0
                              ? "text-foreground"
                              : "text-muted-foreground"
                          }`}
                        >
                          {typeof chain.validatorCount === "number"
                            ? formatFullNumber(chain.validatorCount)
                            : chain.validatorCount}
                        </span>
                      </TableCell>
                      <TableCell className="text-center px-2 sm:px-4">
                        <ActivityIndicator count={getActivityDots(chain)} />
                      </TableCell>
                      <TableCell className="text-center px-2 sm:px-4">
                        {chainSlug ? (
                          <Link href={`/stats/l1/${chainSlug}`}>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 sm:h-8 sm:w-8 p-0 hover:bg-primary/10"
                            >
                              <ExternalLink className="h-3 w-3 sm:h-4 sm:w-4" />
                            </Button>
                          </Link>
                        ) : (
                          <span className="text-muted-foreground text-xs">
                            —
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        {hasMoreData && (
          <div className="flex justify-center">
            <Button
              onClick={handleLoadMore}
              variant="outline"
              size="lg"
              className="px-8 py-3 border-[#e1e2ea] dark:border-neutral-700 bg-[#fcfcfd] dark:bg-neutral-900 text-black dark:text-white transition-colors hover:border-black dark:hover:border-white hover:bg-[#fcfcfd] dark:hover:bg-neutral-900"
            >
              Load More Chains ({sortedData.length - visibleCount} remaining)
            </Button>
          </div>
        )}
      </main>

      {/* Bubble Navigation */}
      <StatsBubbleNav />
    </div>
  );
}
