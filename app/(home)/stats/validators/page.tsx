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

type SortColumn = "name" | "id" | "nodeCount" | "nodes" | "stake" | "isL1" | "totalStake";
type SortDirection = "asc" | "desc";
type Network = "mainnet" | "fuji";

interface SubnetStatsWithCalculations extends SubnetStats {
  stats: {
    totalNodes: number;
    aboveTargetNodes: number;
    belowTargetNodes: number;
    nodesPercentAbove: number;
    stakePercentAbove: number;
    isStakeHealthy: boolean;
  };
}

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
        const response = await fetch(
          `/api/validator-stats?network=${network}`
        );
        if (!response.ok) {
          throw new Error(`Failed to fetch validator stats: ${response.status}`);
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
      return [
        parseInt(match[1]),
        parseInt(match[2]),
        parseInt(match[3]),
      ];
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
    avgStakePercent: data.length > 0
      ? data.reduce(
          (sum, subnet) => sum + calculateStats(subnet).stakePercentAbove,
          0
        ) / data.length
      : 0,
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
        <div className="container mx-auto px-6 py-10 pb-24 space-y-12">
          <div className="space-y-3">
            <div>
              <h1 className="text-4xl sm:text-4xl font-semibold tracking-tight text-black dark:text-white">
                Subnet Validator Monitor
              </h1>
              <p className="text-base text-neutral-600 dark:text-neutral-400 max-w-2xl leading-relaxed">
                Loading validator statistics for {network}...
              </p>
            </div>
          </div>
          <ChartSkeletonLoader />
        </div>
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
                <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
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
        <div className="mb-10">
          <div className="flex items-start justify-between gap-4 mb-3">
            <div>
              <h1 className="text-4xl sm:text-4xl font-semibold tracking-tight text-black dark:text-white">
                Validator Stats
              </h1>
              <p className="text-base text-neutral-600 dark:text-neutral-400 max-w-2xl leading-relaxed mt-2">
                Validator statistics and version tracking across Avalanche networks
              </p>
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
              className="pl-10 rounded-lg border-[#e1e2ea] dark:border-neutral-700 bg-[#fcfcfd] dark:bg-neutral-800 transition-colors focus-visible:border-black dark:focus-visible:border-white focus-visible:ring-0 text-black dark:text-white placeholder:text-neutral-500 dark:placeholder:text-neutral-400"
            />
          </div>
          <div className="flex items-center gap-2">
            {searchTerm && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchTerm("");
                  setVisibleCount(25);
                }}
                className="h-8 w-8 p-0 text-neutral-600 dark:text-neutral-400 hover:bg-[#fcfcfd] dark:hover:bg-neutral-800 hover:text-black dark:hover:text-white rounded-full"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
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
        <Card className="overflow-hidden py-0 border-0 shadow-none">
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
                  <th className="px-4 py-2 text-right whitespace-nowrap">
                    <span className="text-xs font-normal text-neutral-700 dark:text-neutral-300">
                      Validator Weight
                    </span>
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
                        subnet.id === "11111111111111111111111111111111LpoYY" ? "cursor-pointer" : ""
                      }`}
                      onClick={() => {
                        if (subnet.id === "11111111111111111111111111111111LpoYY") {
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
                                  subnet.id === "11111111111111111111111111111111LpoYY"
                                    ? "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300"
                                    : subnet.isL1
                                    ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                                    : "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
                                }`}
                              >
                                {subnet.id === "11111111111111111111111111111111LpoYY"
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
                      <td className="border-r border-slate-100 dark:border-neutral-800 px-4 py-2 text-right">
                        <div className="flex flex-col items-end">
                          <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                            {formatStake(subnet.totalStakeString)}
                          </span>
                          <span className="text-xs text-neutral-500 dark:text-neutral-500">
                            {subnet.id === "11111111111111111111111111111111LpoYY" ? "AVAX" : "gas tokens"}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-2">
                        <div className="space-y-1.5">
                          {/* Horizontal Bar Chart */}
                          <div className="flex h-6 w-full rounded overflow-hidden bg-neutral-100 dark:bg-neutral-800">
                            {Object.entries(subnet.byClientVersion)
                              .sort(([v1], [v2]) => compareVersions(v2, v1))
                              .map(([version, data]) => {
                                const percentage = stats.totalNodes > 0 
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
                                        : "bg-gray-300 dark:bg-gray-600"
                                    }`}
                                    style={{ width: `${percentage}%` }}
                                    title={`${version}: ${data.nodes} nodes (${percentage.toFixed(1)}%)`}
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
                                          : "bg-gray-300 dark:bg-gray-600"
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
                          disabled={subnet.id !== "11111111111111111111111111111111LpoYY"}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (subnet.id === "11111111111111111111111111111111LpoYY") {
                              router.push("/stats/primary-network/validators");
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
          <div className="flex justify-center">
            <Button
              onClick={handleLoadMore}
              variant="outline"
              size="lg"
              className="px-8 py-3 border-[#e1e2ea] dark:border-neutral-700 bg-[#fcfcfd] dark:bg-neutral-900 text-black dark:text-white transition-colors hover:border-black dark:hover:border-white hover:bg-[#fcfcfd] dark:hover:bg-neutral-900"
            >
              Load More Subnets ({sortedData.length - visibleCount} remaining)
            </Button>
          </div>
        )}
      </main>

      <StatsBubbleNav />
    </div>
  );
}

