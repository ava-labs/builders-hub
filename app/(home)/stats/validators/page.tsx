"use client";
import type React from "react";
import { useState, useEffect } from "react";
import Image from "next/image";
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
} from "lucide-react";
import { StatsBubbleNav } from "@/components/stats/stats-bubble.config";
import { type SubnetStats } from "@/types/validator-stats";
import { ChartSkeletonLoader } from "@/components/ui/chart-skeleton";
import l1ChainsData from "@/constants/l1-chains.json";

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
  const [loading, setLoading] = useState(false);
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

  const compareVersions = (v1: string, v2: string): number => {
    if (v1 === "Unknown") return -1;
    if (v2 === "Unknown") return 1;

    const extractNumbers = (v: string) => {
      const match = v.match(/(\d+)\.(\d+)\.(\d+)/);
      if (!match) return [0, 0, 0];
      return [parseInt(match[1]), parseInt(match[2]), parseInt(match[3])];
    };

    const [major1, minor1, patch1] = extractNumbers(v1);
    const [major2, minor2, patch2] = extractNumbers(v2);

    if (major1 !== major2) return major1 - major2;
    if (minor1 !== minor2) return minor1 - minor2;
    return patch1 - patch2;
  };

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

  // Color palette for version breakdown in card
  const versionColors = [
    "bg-blue-500 dark:bg-blue-600",
    "bg-purple-500 dark:bg-purple-600",
    "bg-pink-500 dark:bg-pink-600",
    "bg-indigo-500 dark:bg-indigo-600",
    "bg-cyan-500 dark:bg-cyan-600",
    "bg-teal-500 dark:bg-teal-600",
    "bg-emerald-500 dark:bg-emerald-600",
    "bg-lime-500 dark:bg-lime-600",
    "bg-yellow-500 dark:bg-yellow-600",
    "bg-amber-500 dark:bg-amber-600",
    "bg-orange-500 dark:bg-orange-600",
    "bg-red-500 dark:bg-red-600",
  ];

  const getVersionColor = (index: number): string => {
    return versionColors[index % versionColors.length];
  };

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
      <div className="min-h-screen bg-white dark:bg-neutral-950 pt-8">
        <main className="container mx-auto px-6 py-10 pb-24 space-y-8">
          {/* Header Section */}
          <div className="mb-10">
            <div className="flex items-start justify-between gap-4 mb-3">
              <div>
                <h1 className="text-4xl sm:text-4xl font-semibold tracking-tight text-black dark:text-white">
                  Validator Stats
                </h1>
                <p className="text-base text-neutral-600 dark:text-neutral-400 max-w-2xl leading-relaxed mt-2">
                  Loading validator statistics for {network}...
                </p>
              </div>
            </div>
          </div>

          {/* Aggregated Stats Cards Skeleton */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-4">
            {/* Total Chains Card */}
            <Card className="border border-[#e1e2ea] dark:border-neutral-800 bg-[#fcfcfd] dark:bg-neutral-900 py-0 h-full flex flex-col lg:col-span-3">
              <div className="p-6 text-center flex flex-col justify-center flex-1 animate-pulse">
                <div className="h-4 bg-neutral-300 dark:bg-neutral-700 rounded mb-3 w-24 mx-auto" />
                <div className="h-10 bg-neutral-300 dark:bg-neutral-700 rounded w-16 mx-auto mb-2" />
                <div className="h-3 bg-neutral-200 dark:bg-neutral-800 rounded w-32 mx-auto" />
              </div>
            </Card>

            {/* Total Validators Card */}
            <Card className="border border-[#e1e2ea] dark:border-neutral-800 bg-[#fcfcfd] dark:bg-neutral-900 py-0 h-full flex flex-col lg:col-span-3">
              <div className="p-6 text-center flex flex-col justify-center flex-1 animate-pulse">
                <div className="h-4 bg-neutral-300 dark:bg-neutral-700 rounded mb-3 w-28 mx-auto" />
                <div className="h-10 bg-neutral-300 dark:bg-neutral-700 rounded w-20 mx-auto mb-2" />
                <div className="h-3 bg-neutral-200 dark:bg-neutral-800 rounded w-24 mx-auto" />
              </div>
            </Card>

            {/* Version Breakdown Card */}
            <Card className="border border-[#e1e2ea] dark:border-neutral-800 bg-[#fcfcfd] dark:bg-neutral-900 py-0 h-full flex flex-col lg:col-span-6">
              <div className="p-6 flex flex-col justify-center flex-1 animate-pulse">
                <div className="h-4 bg-neutral-300 dark:bg-neutral-700 rounded mb-4 w-40" />
                <div className="h-8 bg-neutral-200 dark:bg-neutral-800 rounded-full mb-4" />
                <div className="flex flex-wrap gap-3 justify-center">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div
                      key={i}
                      className="h-4 bg-neutral-200 dark:bg-neutral-800 rounded w-20"
                    />
                  ))}
                </div>
              </div>
            </Card>
          </div>

          {/* Search & Filter Bar Skeleton */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <div className="h-10 bg-neutral-200 dark:bg-neutral-800 rounded-md animate-pulse" />
            </div>
            <div className="h-9 w-9 bg-neutral-200 dark:bg-neutral-800 rounded-md animate-pulse" />
            <div className="flex items-center gap-2">
              <div className="h-4 bg-neutral-200 dark:bg-neutral-800 rounded w-24 animate-pulse" />
              <div className="h-10 w-40 bg-neutral-200 dark:bg-neutral-800 rounded-md animate-pulse" />
            </div>
          </div>

          {/* Table Skeleton */}
          <Card className="overflow-hidden border border-[#e1e2ea] dark:border-neutral-800 py-0">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead className="bg-[#fcfcfd] dark:bg-neutral-900">
                  <tr className="border-b border-neutral-200 dark:border-neutral-800">
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
                        className={`border-r border-neutral-200 dark:border-neutral-800 px-4 py-2 ${
                          i === 0
                            ? "text-left"
                            : i === 5
                            ? "text-center"
                            : "text-right"
                        }`}
                      >
                        <div
                          className={`h-4 bg-neutral-300 dark:bg-neutral-700 rounded w-24 animate-pulse ${
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
                      className="border-b border-neutral-200 dark:border-neutral-800"
                    >
                      <td className="border-r border-neutral-200 dark:border-neutral-800 px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-neutral-200 dark:bg-neutral-800 animate-pulse" />
                          <div className="flex flex-col gap-1">
                            <div className="h-4 bg-neutral-200 dark:bg-neutral-800 rounded w-32 animate-pulse" />
                            <div className="h-3 bg-neutral-200 dark:bg-neutral-800 rounded w-20 animate-pulse" />
                          </div>
                        </div>
                      </td>
                      <td className="border-r border-neutral-200 dark:border-neutral-800 px-4 py-3 text-right">
                        <div className="h-4 bg-neutral-200 dark:bg-neutral-800 rounded w-12 ml-auto animate-pulse" />
                      </td>
                      <td className="border-r border-neutral-200 dark:border-neutral-800 px-4 py-3 text-right">
                        <div className="h-4 bg-neutral-200 dark:bg-neutral-800 rounded w-16 ml-auto animate-pulse" />
                      </td>
                      <td className="border-r border-neutral-200 dark:border-neutral-800 px-4 py-3 text-right">
                        <div className="h-4 bg-neutral-200 dark:bg-neutral-800 rounded w-16 ml-auto animate-pulse" />
                      </td>
                      <td className="border-r border-neutral-200 dark:border-neutral-800 px-4 py-3">
                        <div className="space-y-2">
                          <div className="h-6 bg-neutral-200 dark:bg-neutral-800 rounded-full animate-pulse" />
                          <div className="flex gap-2">
                            <div className="h-3 bg-neutral-200 dark:bg-neutral-800 rounded w-16 animate-pulse" />
                            <div className="h-3 bg-neutral-200 dark:bg-neutral-800 rounded w-16 animate-pulse" />
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="h-8 w-16 bg-neutral-200 dark:bg-neutral-800 rounded-md mx-auto animate-pulse" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </main>
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
        <StatsBubbleNav />
      </div>
    );
  }

  if (!data || data.length === 0) {
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
                  No subnet validator statistics found.
                </p>
              </div>
            </Card>
          </div>
        </main>
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
              background:
                "linear-gradient(140deg, #E84142 0%, transparent 70%)",
            }}
          />
          <div
            className="absolute inset-0 opacity-40"
            style={{
              background:
                "linear-gradient(to top left, #3752AC 0%, transparent 50%)",
            }}
          />
          <div
            className="absolute inset-0 opacity-30"
            style={{
              background:
                "radial-gradient(circle at 50% 50%, #E84142 0%, #3752AC 30%, transparent 70%)",
            }}
          />

          {/* Content */}
          <div className="relative z-10 space-y-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-4xl sm:text-4xl font-semibold tracking-tight text-white">
                  Validator Stats
                </h1>
                <p className="text-base text-white/80 max-w-2xl leading-relaxed mt-2">
                  Validator statistics and version tracking across Avalanche
                  networks
                </p>
              </div>
            </div>

            {/* Separator */}
            <div className="border-t border-white/20" />

            {/* Aggregated Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-4">
              <div className="backdrop-blur-sm bg-white/10 border border-white/20 rounded-xl p-6 text-center flex flex-col justify-center h-full lg:col-span-3 transition-all hover:bg-white/15">
                <p className="mb-2 text-sm font-medium text-white/70">
                  Total Chains
                </p>
                <p className="text-4xl font-semibold tracking-tight text-white">
                  {aggregatedStats.totalSubnets}
                </p>
                <p className="mt-1 text-xs text-white/70">
                  {aggregatedStats.l1Count} L1s / {aggregatedStats.subnetCount}{" "}
                  Subnets
                </p>
              </div>

              <div className="backdrop-blur-sm bg-white/10 border border-white/20 rounded-xl p-6 text-center flex flex-col justify-center h-full lg:col-span-3 transition-all hover:bg-white/15">
                <p className="mb-2 text-sm font-medium text-white/70">
                  Total Validators
                </p>
                <p className="text-4xl font-semibold tracking-tight text-white">
                  {formatNumber(aggregatedStats.totalNodes)}
                </p>
                <p className="mt-1 text-xs text-white/70">
                  {upToDatePercentage.toFixed(1)}% up to date
                </p>
              </div>

              <div className="backdrop-blur-sm bg-white/10 border border-white/20 rounded-xl p-6 text-center flex flex-col justify-center h-full lg:col-span-6 transition-all hover:bg-white/15">
                <p className="mb-4 text-sm font-medium text-white/70">
                  Total Version Breakdown
                </p>
                <div className="space-y-2">
                  {/* Horizontal Bar Chart */}
                  <div className="flex h-6 w-full rounded overflow-hidden bg-white/20">
                    {Object.entries(totalVersionBreakdown)
                      .sort(([v1], [v2]) => compareVersions(v2, v1))
                      .map(([version, data], index) => {
                        const percentage =
                          aggregatedStats.totalNodes > 0
                            ? (data.nodes / aggregatedStats.totalNodes) * 100
                            : 0;
                        return (
                          <div
                            key={version}
                            className={`h-full transition-all ${getVersionColor(
                              index
                            )}`}
                            style={{ width: `${percentage}%` }}
                            title={`${version}: ${
                              data.nodes
                            } nodes (${percentage.toFixed(1)}%)`}
                          />
                        );
                      })}
                  </div>
                  {/* Version Labels */}
                  <div className="flex flex-wrap gap-x-2 gap-y-1 text-xs justify-center">
                    {Object.entries(totalVersionBreakdown)
                      .sort(([v1], [v2]) => compareVersions(v2, v1))
                      .slice(0, 5) // Show top 5 versions
                      .map(([version, data], index) => {
                        return (
                          <div
                            key={version}
                            className="flex items-center gap-1"
                          >
                            <div
                              className={`h-2 w-2 rounded-full flex-shrink-0 ${getVersionColor(
                                index
                              )}`}
                            />
                            <span className="font-mono text-white">
                              {version}
                            </span>
                            <span className="text-white/70">
                              ({data.nodes})
                            </span>
                          </div>
                        );
                      })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="flex items-center gap-4 justify-between">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400 dark:text-neutral-500 pointer-events-none z-10" />
            <Input
              placeholder="Search chains..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-10 rounded-lg border-[#e1e2ea] dark:border-neutral-700 bg-[#fcfcfd] dark:bg-neutral-800 transition-colors focus-visible:border-black dark:focus-visible:border-white focus-visible:ring-0 text-black dark:text-white placeholder:text-neutral-500 dark:placeholder:text-neutral-400"
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
          <div className="flex items-center gap-2">
            {/* Version Selector */}
            {availableVersions.length > 0 && (
              <div className="flex items-center gap-2">
                <label
                  htmlFor="version-select"
                  className="text-sm text-neutral-600 dark:text-neutral-400 whitespace-nowrap"
                >
                  Target Version:
                </label>
                <select
                  id="version-select"
                  value={minVersion}
                  onChange={(e) => setMinVersion(e.target.value)}
                  className="px-4 py-2 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg text-sm text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-colors"
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
                      className={`border-b border-slate-100 dark:border-neutral-800 transition-colors hover:bg-blue-50/50 dark:hover:bg-neutral-800/50 ${
                        subnet.id === "11111111111111111111111111111111LpoYY"
                          ? "cursor-pointer"
                          : ""
                      }`}
                      onClick={() => {
                        if (
                          subnet.id === "11111111111111111111111111111111LpoYY"
                        ) {
                          router.push("/stats/primary-network/validators");
                        }
                      }}
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
                          {/* Horizontal Bar Chart */}
                          <div className="flex h-6 w-full rounded overflow-hidden bg-neutral-100 dark:bg-neutral-800">
                            {Object.entries(subnet.byClientVersion)
                              .sort(([v1], [v2]) => compareVersions(v2, v1))
                              .map(([version, data]) => {
                                const percentage =
                                  stats.totalNodes > 0
                                    ? (data.nodes / stats.totalNodes) * 100
                                    : 0;
                                const isAboveTarget =
                                  compareVersions(version, minVersion) >= 0;
                                return (
                                  <div
                                    key={version}
                                    className={`h-full transition-all ${
                                      isAboveTarget
                                        ? "bg-green-700 dark:bg-green-800"
                                        : "bg-gray-200 dark:bg-gray-500"
                                    }`}
                                    style={{ width: `${percentage}%` }}
                                    title={`${version}: ${
                                      data.nodes
                                    } nodes (${percentage.toFixed(1)}%)`}
                                  />
                                );
                              })}
                          </div>
                          {/* Version Labels */}
                          <div className="flex flex-wrap gap-x-2 gap-y-1 text-xs">
                            {Object.entries(subnet.byClientVersion)
                              .sort(([v1], [v2]) => compareVersions(v2, v1))
                              .map(([version, data]) => {
                                const isAboveTarget =
                                  compareVersions(version, minVersion) >= 0;
                                return (
                                  <div
                                    key={version}
                                    className="flex items-center gap-1"
                                  >
                                    <div
                                      className={`h-2 w-2 rounded-full flex-shrink-0 ${
                                        isAboveTarget
                                          ? "bg-green-700 dark:bg-green-800"
                                          : "bg-gray-200 dark:bg-gray-500"
                                      }`}
                                    />
                                    <span
                                      className={`font-mono ${
                                        isAboveTarget
                                          ? "text-black dark:text-white"
                                          : "text-neutral-500 dark:text-neutral-500"
                                      }`}
                                    >
                                      {version}
                                    </span>
                                    <span className="text-neutral-500 dark:text-neutral-500">
                                      ({data.nodes})
                                    </span>
                                  </div>
                                );
                              })}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-2 text-center">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (
                              subnet.id ===
                              "11111111111111111111111111111111LpoYY"
                            ) {
                              router.push("/stats/primary-network/validators");
                            } else {
                              // Find chain slug from l1-chains.json using subnetId
                              const chain = (l1ChainsData as any[]).find(
                                (c: any) => c.subnetId === subnet.id
                              );
                              if (chain && chain.slug) {
                                router.push(`/stats/validators/${chain.slug}`);
                              }
                            }
                          }}
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

      <StatsBubbleNav />
    </div>
  );
}
