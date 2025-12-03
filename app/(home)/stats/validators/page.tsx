"use client";
import type React from "react";
import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
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
  AlertTriangle,
  X,
  Globe,
  ChevronRight,
  Users,
} from "lucide-react";
import { StatsBubbleNav } from "@/components/stats/stats-bubble.config";
import { type SubnetStats } from "@/types/validator-stats";
import { AvalancheLogo } from "@/components/navigation/avalanche-logo";
import l1ChainsData from "@/constants/l1-chains.json";
import {
  compareVersions,
  calculateVersionStats,
  VersionBarChart,
  VersionLabels,
  VersionBreakdownInline,
  type VersionBreakdownData,
} from "@/components/stats/VersionBreakdown";

type SortColumn =
  | "name"
  | "id"
  | "nodeCount"
  | "nodes"
  | "stake"
  | "isL1"
  | "totalStake";
type SortDirection = "asc" | "desc";
type Network = "mainnet" | "fuji";

export default function ValidatorStatsPage() {
  const { resolvedTheme } = useTheme();
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);
  const [data, setData] = useState<SubnetStats[]>([]);
  const [loading, setLoading] = useState(true); // Start with loading true since we fetch on mount
  const [error, setError] = useState<string | null>(null);
  const [network, setNetwork] = useState<Network>("mainnet");
  const [minVersion, setMinVersion] = useState<string>("");
  const [availableVersions, setAvailableVersions] = useState<string[]>([]);
  const [sortColumn, setSortColumn] = useState<SortColumn>("nodeCount");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [searchTerm, setSearchTerm] = useState("");
  const [visibleCount, setVisibleCount] = useState(25);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const getThemedLogoUrl = (logoUrl: string): string => {
    if (!isMounted || !logoUrl) return logoUrl;

    // fix to handle both light and dark mode logos
    if (resolvedTheme === "dark") {
      return logoUrl.replace(/Light/g, "Dark");
    } else {
      return logoUrl.replace(/Dark/g, "Light");
    }
  };

  // Helper function to find the slug for a subnet ID
  const getSlugForSubnetId = (subnetId: string): string | null => {
    const chain = (l1ChainsData as any[]).find((c) => c.subnetId === subnetId);
    return chain?.slug || null;
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/validator-stats?network=${network}`);
        if (!response.ok) {
          throw new Error(
            `Failed to fetch validator stats: ${response.status}`
          );
        }

        const stats: SubnetStats[] = await response.json();
        setData(stats);

        // Extract available versions
        const versions = new Set<string>();
        stats.forEach((subnet) => {
          Object.keys(subnet.byClientVersion).forEach((v) => versions.add(v));
        });
        const sortedVersions = Array.from(versions)
          .filter((v) => v !== "Unknown")
          .sort()
          .reverse();
        setAvailableVersions(sortedVersions);

        // Set default minVersion if not set
        if (!minVersion && sortedVersions.length > 0) {
          setMinVersion(sortedVersions[0]);
        }
      } catch (err: any) {
        console.error("Error fetching validator stats:", err);
        setError(err?.message || "Failed to load validator stats");
      }

      setLoading(false);
    };

    fetchData();
  }, [network]);

  const calculateStats = (subnet: SubnetStats) => {
    const totalStake = BigInt(subnet.totalStakeString);
    let aboveTargetNodes = 0;
    let belowTargetNodes = 0;
    let aboveTargetStake = 0n;

    Object.entries(subnet.byClientVersion).forEach(([version, data]) => {
      const isAboveTarget = compareVersions(version, minVersion) >= 0;
      if (isAboveTarget) {
        aboveTargetNodes += data.nodes;
        aboveTargetStake += BigInt(data.stakeString);
      } else {
        belowTargetNodes += data.nodes;
      }
    });

    const totalNodes = aboveTargetNodes + belowTargetNodes;
    const nodesPercentAbove =
      totalNodes > 0 ? (aboveTargetNodes / totalNodes) * 100 : 0;
    const stakePercentAbove =
      totalStake > 0n
        ? Number((aboveTargetStake * 10000n) / totalStake) / 100
        : 0;

    return {
      totalNodes,
      aboveTargetNodes,
      belowTargetNodes,
      nodesPercentAbove,
      stakePercentAbove,
      isStakeHealthy: stakePercentAbove >= 80,
    };
  };

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("desc");
    }
    setVisibleCount(25);
  };

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

  const formatStake = (stakeString: string): string => {
    const stake = BigInt(stakeString);
    const avax = Number(stake) / 1e9; // Convert nAVAX to AVAX
    return formatNumber(avax);
  };

  const filteredData = data.filter((subnet) => {
    return (
      subnet.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      subnet.id.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  const sortedData = [...filteredData].sort((a, b) => {
    let aValue: any;
    let bValue: any;

    const aStats = calculateStats(a);
    const bStats = calculateStats(b);

    switch (sortColumn) {
      case "name":
        aValue = a.name.toLowerCase();
        bValue = b.name.toLowerCase();
        break;
      case "id":
        aValue = a.id;
        bValue = b.id;
        break;
      case "nodeCount":
        aValue = aStats.totalNodes;
        bValue = bStats.totalNodes;
        break;
      case "nodes":
        aValue = aStats.nodesPercentAbove;
        bValue = bStats.nodesPercentAbove;
        break;
      case "stake":
        aValue = aStats.stakePercentAbove;
        bValue = bStats.stakePercentAbove;
        break;
      case "isL1":
        aValue = a.isL1 ? 1 : 0;
        bValue = b.isL1 ? 1 : 0;
        break;
      case "totalStake":
        aValue = BigInt(a.totalStakeString);
        bValue = BigInt(b.totalStakeString);
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

    if (typeof aValue === "bigint" && typeof bValue === "bigint") {
      return sortDirection === "asc"
        ? Number(aValue - bValue)
        : Number(bValue - aValue);
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

  // Calculate aggregated stats
  const aggregatedStats = {
    totalSubnets: data.length,
    l1Count: data.filter((subnet) => subnet.isL1).length,
    subnetCount: data.filter((subnet) => !subnet.isL1).length,
    totalNodes: data.reduce(
      (sum, subnet) => sum + calculateStats(subnet).totalNodes,
      0
    ),
    healthySubnets: data.filter(
      (subnet) => calculateStats(subnet).isStakeHealthy
    ).length,
    avgStakePercent:
      data.length > 0
        ? data.reduce(
            (sum, subnet) => sum + calculateStats(subnet).stakePercentAbove,
            0
          ) / data.length
        : 0,
  };

  // Calculate total version breakdown across all subnets
  const totalVersionBreakdown = data.reduce((acc, subnet) => {
    Object.entries(subnet.byClientVersion).forEach(([version, data]) => {
      if (!acc[version]) {
        acc[version] = { nodes: 0 };
      }
      acc[version].nodes += data.nodes;
    });
    return acc;
  }, {} as Record<string, { nodes: number }>);

  // Calculate up-to-date validators percentage
  const upToDateValidators = Object.entries(totalVersionBreakdown).reduce(
    (sum, [version, data]) => {
      if (compareVersions(version, minVersion) >= 0) {
        return sum + data.nodes;
      }
      return sum;
    },
    0
  );
  const upToDatePercentage =
    aggregatedStats.totalNodes > 0
      ? (upToDateValidators / aggregatedStats.totalNodes) * 100
      : 0;

  const SortButton = ({
    column,
    children,
  }: {
    column: SortColumn;
    children: React.ReactNode;
  }) => (
    <button
      className="flex items-center gap-2 transition-colors hover:text-neutral-900 dark:hover:text-neutral-100"
      onClick={() => handleSort(column)}
    >
      {children}
      {sortColumn === column ? (
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

  const getHealthColor = (percent: number): string => {
    if (percent === 0) return "text-red-600 dark:text-red-400";
    if (percent < 80) return "text-orange-600 dark:text-orange-400";
    return "text-green-600 dark:text-green-400";
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
        <div className="border-b border-zinc-200 dark:border-zinc-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-16">
            <div className="animate-pulse space-y-8 sm:space-y-12">
              <div className="space-y-4">
                {/* Breadcrumb skeleton */}
                <div className="flex items-center gap-1.5">
                  <div className="h-4 w-20 bg-zinc-200 dark:bg-zinc-800 rounded" />
                  <div className="h-3 w-3 bg-zinc-200 dark:bg-zinc-800 rounded" />
                  <div className="h-4 w-20 bg-zinc-200 dark:bg-zinc-800 rounded" />
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-5 w-5 sm:h-6 sm:w-6 bg-zinc-200 dark:bg-zinc-800 rounded" />
                  <div className="h-4 w-32 bg-zinc-200 dark:bg-zinc-800 rounded" />
                </div>
                <div className="h-10 sm:h-12 w-48 sm:w-64 bg-zinc-200 dark:bg-zinc-800 rounded" />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-8">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="space-y-2">
                    <div className="h-8 sm:h-10 w-16 sm:w-24 bg-zinc-200 dark:bg-zinc-800 rounded" />
                    <div className="h-3 sm:h-4 w-12 sm:w-16 bg-zinc-200 dark:bg-zinc-800 rounded" />
                  </div>
                ))}
              </div>
              <div className="pt-4 sm:pt-6 border-t border-zinc-200 dark:border-zinc-800">
                <div className="flex flex-wrap gap-4">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div
                      key={i}
                      className="h-4 w-20 bg-zinc-200 dark:bg-zinc-800 rounded"
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-8">
          {/* Search & Filter Bar Skeleton */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 justify-between">
            <div className="h-10 w-full sm:w-64 bg-zinc-200 dark:bg-zinc-800 rounded-lg animate-pulse" />
            <div className="flex items-center gap-2">
              <div className="h-4 w-24 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
              <div className="h-10 w-40 bg-zinc-200 dark:bg-zinc-800 rounded-lg animate-pulse" />
            </div>
          </div>

          {/* Table Skeleton */}
          <Card className="overflow-hidden py-0 border-0 shadow-none rounded-lg">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead className="bg-[#fcfcfd] dark:bg-neutral-900">
                  <tr>
                    {[
                      "Chain Name",
                      "Validators",
                      "By Nodes %",
                      "By Stake %",
                      "Version Breakdown",
                      "Actions",
                    ].map((header, i) => (
                      <th
                        key={i}
                        className={`px-4 py-2 ${
                          i === 0
                            ? "text-left"
                            : i === 5
                            ? "text-center"
                            : "text-right"
                        }`}
                      >
                        <div
                          className={`h-4 bg-zinc-300 dark:bg-zinc-700 rounded w-24 animate-pulse ${
                            i === 0 ? "" : i === 5 ? "mx-auto" : "ml-auto"
                          }`}
                        />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-neutral-950">
                  {[...Array(10)].map((_, rowIndex) => (
                    <tr
                      key={rowIndex}
                      className="border-b border-slate-100 dark:border-neutral-800"
                    >
                      <td className="border-r border-slate-100 dark:border-neutral-800 px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-zinc-200 dark:bg-zinc-800 animate-pulse" />
                          <div className="flex flex-col gap-1">
                            <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-32 animate-pulse" />
                            <div className="h-3 bg-zinc-200 dark:bg-zinc-800 rounded w-20 animate-pulse" />
                          </div>
                        </div>
                      </td>
                      <td className="border-r border-slate-100 dark:border-neutral-800 px-4 py-3 text-right">
                        <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-12 ml-auto animate-pulse" />
                      </td>
                      <td className="border-r border-slate-100 dark:border-neutral-800 px-4 py-3 text-right">
                        <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-16 ml-auto animate-pulse" />
                      </td>
                      <td className="border-r border-slate-100 dark:border-neutral-800 px-4 py-3 text-right">
                        <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-16 ml-auto animate-pulse" />
                      </td>
                      <td className="border-r border-slate-100 dark:border-neutral-800 px-4 py-3">
                        <div className="space-y-2">
                          <div className="h-6 bg-zinc-200 dark:bg-zinc-800 rounded-full animate-pulse" />
                          <div className="flex gap-2">
                            <div className="h-3 bg-zinc-200 dark:bg-zinc-800 rounded w-16 animate-pulse" />
                            <div className="h-3 bg-zinc-200 dark:bg-zinc-800 rounded w-16 animate-pulse" />
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="h-8 w-16 bg-zinc-200 dark:bg-zinc-800 rounded-md mx-auto animate-pulse" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
        <StatsBubbleNav />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center">
        <div className="text-center space-y-4">
          <Activity className="h-12 w-12 text-red-500 mx-auto" />
          <p className="text-red-600 dark:text-red-400">{error}</p>
        </div>
        <StatsBubbleNav />
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center">
        <div className="text-center space-y-4">
          <BarChart3 className="h-12 w-12 text-zinc-400 mx-auto" />
          <p className="text-zinc-500">No validator data available</p>
        </div>
        <StatsBubbleNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Hero - Clean typographic approach */}
      <div className="border-b border-zinc-200 dark:border-zinc-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-8 sm:pt-16 pb-8 sm:pb-12">
          <div className="flex flex-col sm:flex-row items-start justify-between gap-6 sm:gap-8">
            <div className="space-y-4 sm:space-y-6 flex-1">
              {/* Breadcrumb */}
              <div className="flex items-center gap-1.5 text-xs sm:text-sm">
                <Link
                  href="/stats/overview"
                  className="inline-flex items-center gap-1 sm:gap-1.5 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors cursor-pointer whitespace-nowrap flex-shrink-0"
                >
                  <Globe className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                  <span>Ecosystem</span>
                </Link>
                <ChevronRight className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-zinc-300 dark:text-zinc-600 flex-shrink-0" />
                <span className="inline-flex items-center gap-1 sm:gap-1.5 font-medium text-zinc-900 dark:text-zinc-100 whitespace-nowrap flex-shrink-0">
                  <Users className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-red-500" />
                  <span>Validators</span>
                </span>
              </div>

              <div>
                <div className="flex items-center gap-2 sm:gap-3 mb-2">
                  <AvalancheLogo
                    className="w-5 h-5 sm:w-6 sm:h-6"
                    fill="currentColor"
                  />
                  <p className="text-xs sm:text-sm font-medium text-red-600 dark:text-red-500 tracking-wide uppercase">
                    Avalanche Ecosystem
                  </p>
                </div>
                <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-zinc-900 dark:text-white">
                  Validator Stats
                </h1>
              </div>

              {/* Key metrics - inline */}
              <div className="grid grid-cols-2 sm:flex sm:items-baseline gap-3 sm:gap-6 md:gap-12 pt-4">
                <div>
                  <span className="text-2xl sm:text-3xl md:text-4xl font-semibold tabular-nums text-zinc-900 dark:text-white">
                    {aggregatedStats.totalSubnets}
                  </span>
                  <span className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 ml-1 sm:ml-2">
                    chains
                  </span>
                </div>
                <div>
                  <span className="text-2xl sm:text-3xl md:text-4xl font-semibold tabular-nums text-zinc-900 dark:text-white">
                    {formatNumber(aggregatedStats.totalNodes)}
                  </span>
                  <span className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 ml-1 sm:ml-2">
                    validators
                  </span>
                </div>
                <div>
                  <span className="text-2xl sm:text-3xl md:text-4xl font-semibold tabular-nums text-zinc-900 dark:text-white">
                    {upToDatePercentage.toFixed(1)}%
                  </span>
                  <span className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 ml-1 sm:ml-2">
                    up to date
                  </span>
                </div>
                <div>
                  <span className="text-2xl sm:text-3xl md:text-4xl font-semibold tabular-nums text-zinc-900 dark:text-white">
                    {aggregatedStats.l1Count}
                  </span>
                  <span className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 ml-1 sm:ml-2">
                    L1s
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Secondary stats row - version breakdown */}
          <div className="mt-6 sm:mt-8 pt-4 sm:pt-6 border-t border-zinc-200 dark:border-zinc-800">
            <VersionBreakdownInline
              versions={totalVersionBreakdown}
              minVersion={minVersion}
              limit={5}
            />
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-8">
        {/* Table header */}
        <div className="mb-4">
          <div className="flex items-baseline gap-2 sm:gap-3 mb-4">
            <h2 className="text-lg sm:text-xl font-semibold text-zinc-900 dark:text-white">
              All Chains
            </h2>
            <span className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
              {sortedData.length} tracked
            </span>
          </div>

          {/* Search and version filter */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
            <div className="relative w-full sm:w-auto sm:flex-shrink-0 sm:max-w-sm">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400 dark:text-neutral-500 pointer-events-none z-10" />
              <Input
                placeholder="Search chains..."
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

            {/* Version Selector */}
            {availableVersions.length > 0 && (
              <div className="flex items-center gap-2">
                <label
                  htmlFor="version-select"
                  className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 whitespace-nowrap"
                >
                  Target Version:
                </label>
                <select
                  id="version-select"
                  value={minVersion}
                  onChange={(e) => setMinVersion(e.target.value)}
                  className="px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs sm:text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-600 transition-colors"
                >
                  {availableVersions.map((version) => (
                    <option key={version} value={version}>
                      {version}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Table */}
        <Card className="overflow-hidden py-0 border-0 shadow-none rounded-lg">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead className="bg-[#fcfcfd] dark:bg-neutral-900">
                <tr>
                  <th className="px-4 py-2 text-left">
                    <SortButton column="name">
                      <span className="text-xs font-normal text-neutral-700 dark:text-neutral-300">
                        Chain Name
                      </span>
                    </SortButton>
                  </th>
                  <th className="px-4 py-2 text-right">
                    <SortButton column="nodeCount">
                      <span className="text-xs font-normal text-neutral-700 dark:text-neutral-300">
                        Validators
                      </span>
                    </SortButton>
                  </th>
                  <th className="px-4 py-2 text-right whitespace-nowrap">
                    <SortButton column="nodes">
                      <span className="text-xs font-normal text-neutral-700 dark:text-neutral-300">
                        By Nodes %
                      </span>
                    </SortButton>
                  </th>
                  <th className="px-4 py-2 text-right whitespace-nowrap">
                    <SortButton column="stake">
                      <span className="text-xs font-normal text-neutral-700 dark:text-neutral-300">
                        By Stake %
                      </span>
                    </SortButton>
                  </th>
                  <th className="px-4 py-2 text-left">
                    <span className="text-xs font-normal text-neutral-700 dark:text-neutral-300">
                      Version Breakdown
                    </span>
                  </th>
                  <th className="px-4 py-2 text-center">
                    <span className="text-xs font-normal text-neutral-700 dark:text-neutral-300">
                      Actions
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-neutral-950">
                {visibleData.map((subnet) => {
                  const stats = calculateStats(subnet);
                  return (
                    <tr
                      key={subnet.id}
                      className={`border-b border-slate-100 dark:border-neutral-800 transition-colors hover:bg-blue-50/50 dark:hover:bg-neutral-800/50`}
                    >
                      <td className="border-r border-slate-100 dark:border-neutral-800 px-4 py-2">
                        <div className="flex items-center gap-3">
                          <div className="relative h-8 w-8 flex-shrink-0">
                            {subnet.chainLogoURI ? (
                              <Image
                                src={
                                  getThemedLogoUrl(subnet.chainLogoURI) ||
                                  "/placeholder.svg"
                                }
                                alt={`${subnet.name} logo`}
                                width={32}
                                height={32}
                                className="h-8 w-8 rounded-full object-cover flex-shrink-0 shadow-sm"
                                onError={(e) => {
                                  e.currentTarget.style.display = "none";
                                }}
                              />
                            ) : (
                              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600 shadow-sm flex-shrink-0">
                                <span className="text-sm font-bold text-white">
                                  {subnet.name.charAt(0)}
                                </span>
                              </div>
                            )}
                          </div>
                          <div className="flex flex-col flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-black dark:text-white">
                                {subnet.name}
                              </span>
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${
                                  subnet.id ===
                                  "11111111111111111111111111111111LpoYY"
                                    ? "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300"
                                    : subnet.isL1
                                    ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                                    : "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
                                }`}
                              >
                                {subnet.id ===
                                "11111111111111111111111111111111LpoYY"
                                  ? "Primary Network"
                                  : subnet.isL1
                                  ? "L1"
                                  : "Subnet"}
                              </span>
                            </div>
                            <span className="text-xs font-mono text-neutral-500 dark:text-neutral-500 mt-0.5">
                              {subnet.id}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="border-r border-slate-100 dark:border-neutral-800 px-4 py-2 text-right">
                        <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                          {formatNumber(stats.totalNodes)}
                        </span>
                      </td>
                      <td className="border-r border-slate-100 dark:border-neutral-800 px-4 py-2 text-right">
                        <span
                          className={`text-sm font-medium ${getHealthColor(
                            stats.nodesPercentAbove
                          )}`}
                        >
                          {stats.nodesPercentAbove.toFixed(1)}%
                        </span>
                      </td>
                      <td className="border-r border-slate-100 dark:border-neutral-800 px-4 py-2 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <span
                            className={`text-sm font-medium ${getHealthColor(
                              stats.stakePercentAbove
                            )}`}
                          >
                            {stats.stakePercentAbove.toFixed(1)}%
                          </span>
                          {stats.stakePercentAbove < 80 && (
                            <AlertTriangle className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2">
                        <div className="space-y-1.5">
                          <VersionBarChart
                            versionBreakdown={{
                              byClientVersion: subnet.byClientVersion,
                            }}
                            minVersion={minVersion}
                            totalNodes={stats.totalNodes}
                          />
                          <VersionLabels
                            versionBreakdown={{
                              byClientVersion: subnet.byClientVersion,
                            }}
                            minVersion={minVersion}
                            totalNodes={stats.totalNodes}
                            showPercentage={false}
                            size="sm"
                          />
                        </div>
                      </td>
                      <td className="px-4 py-2 text-center">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={
                            subnet.id !==
                              "11111111111111111111111111111111LpoYY" &&
                            (!subnet.isL1 || !getSlugForSubnetId(subnet.id))
                          }
                          onClick={(e) => {
                            e.stopPropagation();
                            if (
                              subnet.id ===
                              "11111111111111111111111111111111LpoYY"
                            ) {
                              router.push("/stats/validators/c-chain");
                            } else {
                              const slug = getSlugForSubnetId(subnet.id);
                              if (slug) {
                                router.push(`/stats/validators/${slug}`);
                              }
                            }
                          }}
                          className="disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          More
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        {hasMoreData && (
          <div className="flex justify-center mt-4 sm:mt-6">
            <Button
              onClick={handleLoadMore}
              variant="outline"
              size="lg"
              className="px-4 sm:px-8 py-2 sm:py-3 text-sm sm:text-base border-[#e1e2ea] dark:border-neutral-700 bg-[#fcfcfd] dark:bg-neutral-900 text-black dark:text-white transition-colors hover:border-black dark:hover:border-white hover:bg-[#fcfcfd] dark:hover:bg-neutral-900"
            >
              <span className="hidden sm:inline">Load More Chains </span>
              <span className="sm:hidden">Load More </span>(
              {sortedData.length - visibleCount} remaining)
            </Button>
          </div>
        )}
      </main>

      <StatsBubbleNav />
    </div>
  );
}
