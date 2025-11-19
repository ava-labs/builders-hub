"use client";
import type React from "react";
import { useState, useEffect } from "react";
import Image from "next/image";
import { useTheme } from "next-themes";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Activity,
  BarChart3,
  Search,
  ArrowUpRight,
} from "lucide-react";
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

  return (
    <div className="min-h-screen bg-white dark:bg-neutral-950 pt-8">
      <main className="container mx-auto px-6 py-10 pb-24 space-y-8">
        {/* Hero Section */}
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
              {/* Title and description */}
              <div className="flex-1">
                <h1 className="text-3xl sm:text-4xl font-semibold text-white mb-3">
                  Avalanche L1s Index
                </h1>
                <p className="text-white/80 text-sm sm:text-base max-w-3xl">
                  Opinionated stats for Mainnet L1s in the Avalanche ecosystem.
                </p>
              </div>

              {/* Submit button */}
              <Button
                size="sm"
                onClick={() =>
                  window.open(
                    "https://github.com/ava-labs/builders-hub/blob/master/constants/l1-chains.json",
                    "_blank"
                  )
                }
                className="flex-shrink-0 border border-white bg-black text-white hover:bg-neutral-800 dark:bg-transparent dark:hover:border-neutral-400 transition-colors"
              >
                Submit Your L1
                <ArrowUpRight className="ml-1.5 h-4 w-4" />
              </Button>
            </div>

            {/* Separator */}
            <div className="border-t border-white/20" />

            {/* Main metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="backdrop-blur-md bg-white/10 border border-white/20 rounded-lg p-6 text-center">
                <p className="mb-2 text-sm font-medium text-white/60">
                  Mainnet Avalanche L1s
                </p>
                <p className="text-4xl font-semibold tracking-tight text-white">
                  {overviewMetrics.chains.length}
                </p>
              </div>

              <div className="backdrop-blur-md bg-white/10 border border-white/20 rounded-lg p-6 text-center">
                <p className="mb-2 text-sm font-medium text-white/60">
                  Daily Transactions
                </p>
                <p className="text-4xl font-semibold tracking-tight text-white">
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

              <div className="backdrop-blur-md bg-white/10 border border-white/20 rounded-lg p-6 text-center">
                <p className="mb-2 text-sm font-medium text-white/60">
                  Combined Throughput
                </p>
                <p className="text-4xl font-semibold tracking-tight text-white">
                  {(() => {
                    const totalTxs =
                      typeof overviewMetrics.aggregated.totalTxCount
                        .current_value === "number"
                        ? overviewMetrics.aggregated.totalTxCount.current_value
                        : 0;
                    const secondsInYear = 365 * 24 * 60 * 60;
                    const tps = (totalTxs / secondsInYear).toFixed(2);
                    return tps;
                  })()}{" "}
                  TPS
                </p>
              </div>
            </div>

            {/* Secondary metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="backdrop-blur-md bg-white/10 border border-white/20 rounded-lg p-5 text-center">
                <p className="mb-3 text-xs font-medium uppercase tracking-wide text-white/60">
                  Daily ICM Count
                </p>
                <p className="text-2xl font-semibold text-white">
                  {formatNumber(
                    Math.round(
                      overviewMetrics.aggregated.totalICMMessages.current_value /
                        365
                    )
                  )}
                </p>
              </div>

              <div className="backdrop-blur-md bg-white/10 border border-white/20 rounded-lg p-5 text-center">
                <p className="mb-3 text-xs font-medium uppercase tracking-wide text-white/60">
                  Total Validators
                </p>
                <p className="text-2xl font-semibold text-white">
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

        <div className="border-t border-neutral-200 dark:border-neutral-800 my-8"></div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400 dark:text-neutral-500" />
            <Input
              placeholder="Search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 rounded-full border-[#e1e2ea] dark:border-neutral-700 bg-[#fcfcfd] dark:bg-neutral-800 transition-colors focus-visible:border-black dark:focus-visible:border-white focus-visible:ring-0 text-black dark:text-white placeholder:text-neutral-500 dark:placeholder:text-neutral-400"
            />
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearchTerm("");
              setVisibleCount(25);
            }}
            className="text-neutral-600 dark:text-neutral-400 hover:bg-[#fcfcfd] dark:hover:bg-neutral-800 hover:text-black dark:hover:text-white rounded-full"
          >
            Clear Search
          </Button>
        </div>

        <Card className="overflow-hidden border border-neutral-200 dark:border-neutral-800 py-0">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead className="bg-[#fcfcfd] dark:bg-neutral-900">
                <tr className="border-b border-neutral-200 dark:border-neutral-800">
                  <th className="border-r border-neutral-200 dark:border-neutral-800 px-4 py-2 text-left">
                    <div className="flex items-center gap-2">
                      <SortButton field="chainName">
                        <span className="text-sm font-semibold uppercase tracking-wide text-neutral-700 dark:text-neutral-300">
                          L1 Name
                        </span>
                      </SortButton>
                    </div>
                  </th>
                  <th className="border-r border-neutral-200 dark:border-neutral-800 px-4 py-2 text-left">
                    <div className="flex items-center gap-2">
                      <SortButton field="weeklyActiveAddresses">
                        <span className="hidden lg:flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-neutral-700 dark:text-neutral-300">
                          Active Addresses
                        </span>
                        <span className="lg:hidden text-xs font-medium uppercase tracking-wide text-neutral-600 dark:text-neutral-400">
                          Addresses
                        </span>
                      </SortButton>
                    </div>
                  </th>
                  <th className="border-r border-neutral-200 dark:border-neutral-800 px-4 py-2 text-left">
                    <div className="flex items-center gap-2">
                      <SortButton field="weeklyTxCount">
                        <span className="hidden lg:flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-neutral-700 dark:text-neutral-300">
                          Transactions
                        </span>
                        <span className="lg:hidden text-xs font-medium uppercase tracking-wide text-neutral-600 dark:text-neutral-400">
                          Transactions
                        </span>
                      </SortButton>
                    </div>
                  </th>
                  <th className="border-r border-neutral-200 dark:border-neutral-800 px-4 py-2 text-left">
                    <div className="flex items-center gap-2">
                      <SortButton field="totalIcmMessages">
                        <span className="hidden lg:flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-neutral-700 dark:text-neutral-300">
                          Interchain Messages
                        </span>
                        <span className="lg:hidden text-xs font-medium uppercase tracking-wide text-neutral-600 dark:text-neutral-400">
                          ICM
                        </span>
                      </SortButton>
                    </div>
                  </th>
                  <th className="border-r border-neutral-200 dark:border-neutral-800 px-4 py-2 text-left">
                    <div className="flex items-center gap-2">
                      <SortButton field="validatorCount">
                        <span className="hidden lg:flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-neutral-700 dark:text-neutral-300">
                          Validators
                        </span>
                      </SortButton>
                    </div>
                  </th>
                  <th className="border-r border-neutral-200 dark:border-neutral-800 px-4 py-2 text-left">
                    <div className="flex items-center gap-2">
                      <SortButton field="throughput">
                        <span className="text-sm font-semibold uppercase tracking-wide text-neutral-700 dark:text-neutral-300">
                          Throughput
                        </span>
                      </SortButton>
                    </div>
                  </th>
                  <th className="border-r border-neutral-200 dark:border-neutral-800 px-4 py-2 text-left">
                    <div className="flex items-center gap-2">
                      <SortButton field="category">
                        <span className="text-sm font-semibold uppercase tracking-wide text-neutral-700 dark:text-neutral-300">
                          Category
                        </span>
                      </SortButton>
                    </div>
                  </th>
                  <th className="px-4 py-2 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <span className="text-sm font-semibold uppercase tracking-wide text-neutral-700 dark:text-neutral-300 whitespace-nowrap">
                        Block Explorer
                      </span>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-neutral-950">
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
                      <td className="border-r border-slate-100 dark:border-neutral-800 px-4 py-2">
                        <div className="flex items-center gap-3 group">
                          <div className="relative">
                            {chain.chainLogoURI ? (
                              <Image
                                src={
                                  getThemedLogoUrl(chain.chainLogoURI) ||
                                  "/placeholder.svg"
                                }
                                alt={`${chain.chainName} logo`}
                                width={32}
                                height={32}
                                className="rounded-full flex-shrink-0 shadow-sm"
                                onError={(e) => {
                                  e.currentTarget.style.display = "none";
                                }}
                              />
                            ) : (
                              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600 shadow-sm">
                                <span className="text-sm font-bold text-white">
                                  {chain.chainName.charAt(0)}
                                </span>
                              </div>
                            )}
                          </div>
                          <span className="font-medium text-black dark:text-white">
                            {chain.chainName}
                          </span>
                          {chainSlug && (
                            <div className="relative overflow-hidden w-4 h-4 flex-shrink-0">
                              <ArrowUpRight className="h-4 w-4 text-blue-600 dark:text-blue-400 absolute transition-all duration-300 ease-out transform translate-y-4 translate-x-4 opacity-0 group-hover:translate-y-0 group-hover:translate-x-0 group-hover:opacity-100" />
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="border-r border-slate-100 dark:border-neutral-800 px-4 py-2">
                        <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                          {typeof chain.activeAddresses.current_value ===
                          "number"
                            ? formatFullNumber(
                                chain.activeAddresses.current_value
                              )
                            : chain.activeAddresses.current_value}
                        </span>
                      </td>
                      <td className="border-r border-slate-100 dark:border-neutral-800 px-4 py-2">
                        <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                          {typeof chain.txCount.current_value === "number"
                            ? formatFullNumber(
                                Math.round(chain.txCount.current_value / 365)
                              )
                            : chain.txCount.current_value}
                        </span>
                      </td>
                      <td className="border-r border-slate-100 dark:border-neutral-800 px-4 py-2">
                        <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                          {typeof chain.icmMessages.current_value === "number"
                            ? formatFullNumber(
                                Math.round(
                                  chain.icmMessages.current_value / 365
                                )
                              )
                            : chain.icmMessages.current_value}
                        </span>
                      </td>
                      <td className="border-r border-slate-100 dark:border-neutral-800 px-4 py-2">
                        <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                          {typeof chain.validatorCount === "number"
                            ? formatFullNumber(chain.validatorCount)
                            : chain.validatorCount}
                        </span>
                      </td>
                      <td className="border-r border-slate-100 dark:border-neutral-800 px-4 py-2">
                        <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                          {getChainTPS(chain)} TPS
                        </span>
                      </td>
                      <td className="border-r border-slate-100 dark:border-neutral-800 px-4 py-2">
                        <span
                          className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${getCategoryColor(
                            getChainCategory(chain.chainId, chain.chainName)
                          )}`}
                        >
                          {getChainCategory(chain.chainId, chain.chainName)}
                        </span>
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex items-center justify-center">
                          <ExplorerDropdown
                            explorers={
                              (l1ChainsData.find(
                                (c) => c.chainId === chain.chainId
                              ) as L1Chain)?.explorers
                            }
                            size="sm"
                            variant="outline"
                            showIcon={true}
                            buttonText="Open"
                          />
                        </div>
                      </td>
                    </tr>
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
