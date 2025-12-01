"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Activity } from "lucide-react";
import { StatsBubbleNav } from "@/components/stats/stats-bubble.config";
import l1ChainsData from "@/constants/l1-chains.json";
import Image from "next/image";

interface ValidatorData {
  nodeId: string;
  amountStaked: string;
  delegationFee: string;
  validationStatus: string;
  delegatorCount: number;
  amountDelegated: string;
  validationId?: string;
  weight?: number;
  remainingBalance?: number;
  creationTimestamp?: number;
  blsCredentials?: any;
  remainingBalanceOwner?: {
    addresses: string[];
    threshold: number;
  };
  deactivationOwner?: {
    addresses: string[];
    threshold: number;
  };
  version?: string;
}

interface VersionBreakdown {
  byClientVersion: Record<string, { nodes: number; stakeString: string }>;
  totalStakeString: string;
}

interface ChainData {
  chainId: string;
  chainName: string;
  chainLogoURI: string;
  subnetId: string;
  slug: string;
  color: string;
  category: string;
}

export default function ChainValidatorsPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const [validators, setValidators] = useState<ValidatorData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chainInfo, setChainInfo] = useState<ChainData | null>(null);
  const [isL1, setIsL1] = useState(false);
  const [versionBreakdown, setVersionBreakdown] =
    useState<VersionBreakdown | null>(null);
  const [availableVersions, setAvailableVersions] = useState<string[]>([]);
  const [minVersion, setMinVersion] = useState<string>("");

  useEffect(() => {
    // Find chain info by slug
    const chain = (l1ChainsData as ChainData[]).find((c) => c.slug === slug);

    if (!chain) {
      setError("Chain not found");
      setLoading(false);
      return;
    }

    setChainInfo(chain);

    async function fetchValidators() {
      if (!chain) return;

      try {
        setLoading(true);
        const response = await fetch(`/api/chain-validators/${chain.subnetId}`);

        if (!response.ok) {
          throw new Error(`Failed to fetch validators: ${response.status}`);
        }

        const data = await response.json();
        const validatorsList = data.validators || [];
        setValidators(validatorsList);

        // Set version breakdown data
        if (data.versionBreakdown) {
          setVersionBreakdown(data.versionBreakdown);

          // Extract available versions
          const versions = Object.keys(data.versionBreakdown.byClientVersion)
            .filter((v) => v !== "Unknown")
            .sort()
            .reverse();
          setAvailableVersions(versions);

          // Set default minVersion if not set
          if (!minVersion && versions.length > 0) {
            setMinVersion(versions[0]);
          }
        }

        // Detect if these are L1 validators (have validationId field)
        if (validatorsList.length > 0 && validatorsList[0].validationId) {
          setIsL1(true);
        }
      } catch (err: any) {
        console.error("Error fetching validators:", err);
        setError(err?.message || "Failed to load validators");
      } finally {
        setLoading(false);
      }
    }

    fetchValidators();
  }, [slug]);

  const formatNumber = (num: number | string): string => {
    if (typeof num === "string") {
      num = parseFloat(num);
    }
    if (isNaN(num)) return "N/A";

    const billions = num / 1e9;
    if (billions >= 1) {
      return `${billions.toFixed(2)}B`;
    }

    const millions = num / 1e6;
    if (millions >= 1) {
      return `${millions.toFixed(2)}M`;
    }

    const thousands = num / 1e3;
    if (thousands >= 1) {
      return `${thousands.toFixed(2)}K`;
    }

    return num.toLocaleString();
  };

  const formatStake = (stake: string): string => {
    const stakeNum = parseFloat(stake);
    return formatNumber(stakeNum / 1e9);
  };

  const formatTimestamp = (timestamp?: number): string => {
    if (!timestamp) return "N/A";
    return new Date(timestamp * 1000).toLocaleString();
  };

  const formatAddress = (address: string): string => {
    return `${address.slice(0, 8)}...${address.slice(-6)}`;
  };

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

  const calculateVersionStats = () => {
    if (!versionBreakdown || !minVersion) {
      return {
        nodesPercentAbove: 0,
        stakePercentAbove: 0,
        aboveTargetNodes: 0,
        belowTargetNodes: 0,
      };
    }

    const totalStake = BigInt(versionBreakdown.totalStakeString);
    let aboveTargetNodes = 0;
    let belowTargetNodes = 0;
    let aboveTargetStake = 0n;

    Object.entries(versionBreakdown.byClientVersion).forEach(
      ([version, data]) => {
        const isAboveTarget = compareVersions(version, minVersion) >= 0;
        if (isAboveTarget) {
          aboveTargetNodes += data.nodes;
          aboveTargetStake += BigInt(data.stakeString);
        } else {
          belowTargetNodes += data.nodes;
        }
      }
    );

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
    };
  };

  const calculateStats = () => {
    if (validators.length === 0) {
      return {
        totalValidators: 0,
        totalStaked: "0",
        avgDelegationFee: 0,
        totalDelegators: 0,
        totalWeight: 0,
        totalRemainingBalance: 0,
      };
    }

    const totalStaked = validators.reduce(
      (sum, v) => sum + parseFloat(v.amountStaked),
      0
    );

    const avgFee =
      validators.reduce(
        (sum, v) => sum + parseFloat(v.delegationFee || "0"),
        0
      ) / validators.length;

    const totalDelegators = validators.reduce(
      (sum, v) => sum + v.delegatorCount,
      0
    );

    const totalWeight = validators.reduce((sum, v) => sum + (v.weight || 0), 0);

    const totalRemainingBalance = validators.reduce(
      (sum, v) => sum + (v.remainingBalance || 0),
      0
    );

    return {
      totalValidators: validators.length,
      totalStaked: (totalStaked / 1e9).toFixed(2),
      avgDelegationFee: avgFee.toFixed(2),
      totalDelegators,
      totalWeight,
      totalRemainingBalance: (totalRemainingBalance / 1e9).toFixed(2),
    };
  };

  const stats = calculateStats();
  const versionStats = calculateVersionStats();

  const getHealthColor = (percent: number): string => {
    if (percent === 0) return "text-red-600 dark:text-red-400";
    if (percent < 80) return "text-orange-600 dark:text-orange-400";
    return "text-green-600 dark:text-green-400";
  };

  // Color palette for version breakdown
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

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
        <div className="border-b border-zinc-200 dark:border-zinc-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-8 sm:pt-16 pb-8 sm:pb-12">
            <div className="animate-pulse space-y-6">
              <div className="h-10 w-40 bg-zinc-200 dark:bg-zinc-800 rounded" />
              <div className="flex items-center gap-6">
                <div className="w-16 h-16 bg-zinc-200 dark:bg-zinc-800 rounded-full" />
                <div className="space-y-3 flex-1">
                  <div className="h-10 w-64 bg-zinc-200 dark:bg-zinc-800 rounded" />
                  <div className="h-4 w-96 bg-zinc-200 dark:bg-zinc-800 rounded" />
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 pt-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="space-y-2">
                    <div className="h-10 w-20 bg-zinc-200 dark:bg-zinc-800 rounded" />
                    <div className="h-4 w-16 bg-zinc-200 dark:bg-zinc-800 rounded" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-8">
          {/* Version Breakdown Skeleton */}
          <Card className="border border-[#e1e2ea] dark:border-neutral-800 bg-[#fcfcfd] dark:bg-neutral-900 py-0">
            <div className="p-6 animate-pulse">
              <div className="flex items-center justify-between mb-6">
                <div className="space-y-2">
                  <div className="h-6 w-40 bg-zinc-200 dark:bg-zinc-800 rounded" />
                  <div className="h-4 w-64 bg-zinc-200 dark:bg-zinc-800 rounded" />
                </div>
                <div className="h-8 w-32 bg-zinc-200 dark:bg-zinc-800 rounded" />
              </div>
              <div className="space-y-4">
                <div className="h-8 w-full bg-zinc-200 dark:bg-zinc-800 rounded" />
                <div className="flex flex-wrap gap-4">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="h-4 w-24 bg-zinc-200 dark:bg-zinc-800 rounded"
                    />
                  ))}
                </div>
              </div>
            </div>
          </Card>

          {/* Table Skeleton */}
          <Card className="overflow-hidden py-0 border-0 shadow-none rounded-lg">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead className="bg-[#fcfcfd] dark:bg-neutral-900">
                  <tr>
                    <th className="px-4 py-2 text-left">
                      <span className="text-xs font-normal text-neutral-700 dark:text-neutral-300">
                        #
                      </span>
                    </th>
                    <th className="px-4 py-2 text-left">
                      <span className="text-xs font-normal text-neutral-700 dark:text-neutral-300">
                        Node ID
                      </span>
                    </th>
                    <th className="px-4 py-2 text-left">
                      <span className="text-xs font-normal text-neutral-700 dark:text-neutral-300">
                        Version
                      </span>
                    </th>
                    <th className="px-4 py-2 text-left">
                      <span className="text-xs font-normal text-neutral-700 dark:text-neutral-300">
                        Validation ID
                      </span>
                    </th>
                    <th className="px-4 py-2 text-right">
                      <span className="text-xs font-normal text-neutral-700 dark:text-neutral-300">
                        Weight
                      </span>
                    </th>
                    <th className="px-4 py-2 text-right">
                      <span className="text-xs font-normal text-neutral-700 dark:text-neutral-300">
                        Remaining Balance
                      </span>
                    </th>
                    <th className="px-4 py-2 text-right">
                      <span className="text-xs font-normal text-neutral-700 dark:text-neutral-300">
                        Creation Time
                      </span>
                    </th>
                    <th className="px-4 py-2 text-left">
                      <span className="text-xs font-normal text-neutral-700 dark:text-neutral-300">
                        Balance Owner
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-neutral-950">
                  {[...Array(10)].map((_, rowIndex) => (
                    <tr
                      key={rowIndex}
                      className="border-b border-slate-100 dark:border-neutral-800 animate-pulse"
                    >
                      <td className="border-r border-slate-100 dark:border-neutral-800 px-4 py-3">
                        <div className="h-4 w-8 bg-zinc-200 dark:bg-zinc-800 rounded" />
                      </td>
                      <td className="border-r border-slate-100 dark:border-neutral-800 px-4 py-3">
                        <div className="h-4 w-40 bg-zinc-200 dark:bg-zinc-800 rounded" />
                      </td>
                      <td className="border-r border-slate-100 dark:border-neutral-800 px-4 py-3">
                        <div className="h-4 w-24 bg-zinc-200 dark:bg-zinc-800 rounded" />
                      </td>
                      <td className="border-r border-slate-100 dark:border-neutral-800 px-4 py-3">
                        <div className="h-4 w-40 bg-zinc-200 dark:bg-zinc-800 rounded" />
                      </td>
                      <td className="border-r border-slate-100 dark:border-neutral-800 px-4 py-3">
                        <div className="h-4 w-20 bg-zinc-200 dark:bg-zinc-800 rounded ml-auto" />
                      </td>
                      <td className="border-r border-slate-100 dark:border-neutral-800 px-4 py-3">
                        <div className="h-4 w-24 bg-zinc-200 dark:bg-zinc-800 rounded ml-auto" />
                      </td>
                      <td className="border-r border-slate-100 dark:border-neutral-800 px-4 py-3">
                        <div className="h-4 w-32 bg-zinc-200 dark:bg-zinc-800 rounded ml-auto" />
                      </td>
                      <td className="px-4 py-3">
                        <div className="space-y-1">
                          <div className="h-3 w-28 bg-zinc-200 dark:bg-zinc-800 rounded" />
                          <div className="h-3 w-20 bg-zinc-200 dark:bg-zinc-800 rounded" />
                        </div>
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

  if (error || !chainInfo) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
        <div className="border-b border-zinc-200 dark:border-zinc-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-8 sm:pt-16 pb-8 sm:pb-12">
            <Button
              variant="ghost"
              onClick={() => router.push("/stats/validators")}
              className="mb-4 -ml-2"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to All Validators
            </Button>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center space-y-4">
              <Activity className="h-12 w-12 text-red-500 mx-auto" />
              <p className="text-red-600 dark:text-red-400">
                {error || "Chain not found"}
              </p>
            </div>
          </div>
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
          <div className="space-y-6">
            <Button
              variant="ghost"
              onClick={() => router.push("/stats/validators")}
              className="mb-2 -ml-2"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to All Validators
            </Button>

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6">
              {chainInfo.chainLogoURI && (
                <Image
                  src={chainInfo.chainLogoURI}
                  alt={chainInfo.chainName}
                  width={64}
                  height={64}
                  className="rounded-full"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
              )}
              <div className="space-y-2">
                <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-zinc-900 dark:text-white">
                  {chainInfo.chainName} Validators
                </h1>
                <p className="text-sm sm:text-base text-zinc-500 dark:text-zinc-400 max-w-2xl">
                  Active validators and delegation metrics for{" "}
                  {chainInfo.chainName}
                </p>
              </div>
            </div>

            {/* Key metrics - inline */}
            <div className="grid grid-cols-2 sm:flex sm:items-baseline gap-3 sm:gap-6 md:gap-12 pt-4">
              <div>
                <span className="text-2xl sm:text-3xl md:text-4xl font-semibold tabular-nums text-zinc-900 dark:text-white">
                  {stats.totalValidators}
                </span>
                <span className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 ml-1 sm:ml-2">
                  validators
                </span>
              </div>
              <div>
                <span
                  className={`text-2xl sm:text-3xl md:text-4xl font-semibold tabular-nums ${getHealthColor(
                    versionStats.nodesPercentAbove
                  )}`}
                >
                  {versionStats.nodesPercentAbove.toFixed(1)}%
                </span>
                <span className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 ml-1 sm:ml-2">
                  by nodes
                </span>
              </div>
              <div>
                <span
                  className={`text-2xl sm:text-3xl md:text-4xl font-semibold tabular-nums ${getHealthColor(
                    versionStats.stakePercentAbove
                  )}`}
                >
                  {versionStats.stakePercentAbove.toFixed(1)}%
                </span>
                <span className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 ml-1 sm:ml-2">
                  by stake
                </span>
              </div>
              {isL1 ? (
                <div>
                  <span className="text-2xl sm:text-3xl md:text-4xl font-semibold tabular-nums text-zinc-900 dark:text-white">
                    {formatNumber(stats.totalWeight)}
                  </span>
                  <span className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 ml-1 sm:ml-2">
                    total weight
                  </span>
                </div>
              ) : (
                <div>
                  <span className="text-2xl sm:text-3xl md:text-4xl font-semibold tabular-nums text-zinc-900 dark:text-white">
                    {formatNumber(stats.totalDelegators)}
                  </span>
                  <span className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 ml-1 sm:ml-2">
                    delegators
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-8">
        {/* Version Breakdown Card */}
        {versionBreakdown && availableVersions.length > 0 && (
          <Card className="border border-[#e1e2ea] dark:border-neutral-800 bg-[#fcfcfd] dark:bg-neutral-900 py-0">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-semibold text-black dark:text-white">
                    Version Breakdown
                  </h3>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
                    Distribution of validator versions
                  </p>
                </div>
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
                    className="px-3 py-1 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-md text-sm text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-colors"
                  >
                    {availableVersions.map((version) => (
                      <option key={version} value={version}>
                        {version}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="space-y-4">
                {/* Horizontal Bar Chart */}
                <div className="flex h-8 w-full rounded overflow-hidden bg-neutral-100 dark:bg-neutral-800">
                  {Object.entries(versionBreakdown.byClientVersion)
                    .sort(([v1], [v2]) => compareVersions(v2, v1))
                    .map(([version, data], index) => {
                      const percentage =
                        stats.totalValidators > 0
                          ? (data.nodes / stats.totalValidators) * 100
                          : 0;
                      const isAboveTarget =
                        compareVersions(version, minVersion) >= 0;
                      return (
                        <div
                          key={version}
                          className={`h-full transition-all ${
                            isAboveTarget
                              ? "bg-green-700 dark:bg-green-800"
                              : "bg-gray-300 dark:bg-gray-500"
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
                <div className="flex flex-wrap gap-4">
                  {Object.entries(versionBreakdown.byClientVersion)
                    .sort(([v1], [v2]) => compareVersions(v2, v1))
                    .map(([version, data], index) => {
                      const isAboveTarget =
                        compareVersions(version, minVersion) >= 0;
                      const percentage =
                        stats.totalValidators > 0
                          ? (data.nodes / stats.totalValidators) * 100
                          : 0;
                      return (
                        <div key={version} className="flex items-center gap-2">
                          <div
                            className={`h-3 w-3 rounded-full flex-shrink-0 ${
                              isAboveTarget
                                ? "bg-green-700 dark:bg-green-800"
                                : "bg-gray-300 dark:bg-gray-500"
                            }`}
                          />
                          <span
                            className={`font-mono text-sm ${
                              isAboveTarget
                                ? "text-black dark:text-white"
                                : "text-neutral-500 dark:text-neutral-500"
                            }`}
                          >
                            {version}
                          </span>
                          <span className="text-sm text-neutral-500 dark:text-neutral-500">
                            ({data.nodes} - {percentage.toFixed(1)}%)
                          </span>
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Validators Table */}
        <Card className="overflow-hidden py-0 border-0 shadow-none rounded-lg">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead className="bg-[#fcfcfd] dark:bg-neutral-900">
                <tr>
                  <th className="px-4 py-2 text-left">
                    <span className="text-xs font-normal text-neutral-700 dark:text-neutral-300">
                      #
                    </span>
                  </th>
                  <th className="px-4 py-2 text-left">
                    <span className="text-xs font-normal text-neutral-700 dark:text-neutral-300">
                      Node ID
                    </span>
                  </th>
                  <th className="px-4 py-2 text-left">
                    <span className="text-xs font-normal text-neutral-700 dark:text-neutral-300">
                      Version
                    </span>
                  </th>
                  {isL1 ? (
                    <>
                      <th className="px-4 py-2 text-left">
                        <span className="text-xs font-normal text-neutral-700 dark:text-neutral-300">
                          Validation ID
                        </span>
                      </th>
                      <th className="px-4 py-2 text-right">
                        <span className="text-xs font-normal text-neutral-700 dark:text-neutral-300">
                          Weight
                        </span>
                      </th>
                      <th className="px-4 py-2 text-right">
                        <span className="text-xs font-normal text-neutral-700 dark:text-neutral-300">
                          Remaining Balance
                        </span>
                      </th>
                      <th className="px-4 py-2 text-right">
                        <span className="text-xs font-normal text-neutral-700 dark:text-neutral-300">
                          Creation Time
                        </span>
                      </th>
                      <th className="px-4 py-2 text-left">
                        <span className="text-xs font-normal text-neutral-700 dark:text-neutral-300">
                          Balance Owner
                        </span>
                      </th>
                    </>
                  ) : (
                    <>
                      <th className="px-4 py-2 text-right">
                        <span className="text-xs font-normal text-neutral-700 dark:text-neutral-300">
                          Amount Staked
                        </span>
                      </th>
                      <th className="px-4 py-2 text-right">
                        <span className="text-xs font-normal text-neutral-700 dark:text-neutral-300">
                          Delegation Fee
                        </span>
                      </th>
                      <th className="px-4 py-2 text-right">
                        <span className="text-xs font-normal text-neutral-700 dark:text-neutral-300">
                          Delegators
                        </span>
                      </th>
                      <th className="px-4 py-2 text-right">
                        <span className="text-xs font-normal text-neutral-700 dark:text-neutral-300">
                          Amount Delegated
                        </span>
                      </th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-neutral-950">
                {validators.length === 0 ? (
                  <tr>
                    <td
                      colSpan={isL1 ? 8 : 7}
                      className="text-center py-8 text-neutral-600 dark:text-neutral-400"
                    >
                      No validators found for this chain
                    </td>
                  </tr>
                ) : isL1 ? (
                  validators.map((validator, index) => (
                    <tr
                      key={validator.validationId || validator.nodeId}
                      className="border-b border-slate-100 dark:border-neutral-800 transition-colors hover:bg-blue-50/50 dark:hover:bg-neutral-800/50"
                    >
                      <td className="border-r border-slate-100 dark:border-neutral-800 px-4 py-2">
                        <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                          {index + 1}
                        </span>
                      </td>
                      <td className="border-r border-slate-100 dark:border-neutral-800 px-4 py-2 font-mono text-xs">
                        <span title={validator.nodeId}>
                          {validator.nodeId.slice(0, 12)}...
                          {validator.nodeId.slice(-8)}
                        </span>
                      </td>
                      <td className="border-r border-slate-100 dark:border-neutral-800 px-4 py-2 font-mono text-xs">
                        <span
                          className={
                            validator.version &&
                            compareVersions(validator.version, minVersion) >= 0
                              ? "text-green-600 dark:text-green-400"
                              : "text-neutral-500 dark:text-neutral-500"
                          }
                        >
                          {validator.version || "Unknown"}
                        </span>
                      </td>
                      <td className="border-r border-slate-100 dark:border-neutral-800 px-4 py-2 font-mono text-xs">
                        {validator.validationId ? (
                          <span title={validator.validationId}>
                            {validator.validationId.slice(0, 12)}...
                            {validator.validationId.slice(-8)}
                          </span>
                        ) : (
                          "N/A"
                        )}
                      </td>
                      <td className="border-r border-slate-100 dark:border-neutral-800 px-4 py-2 text-right font-mono text-sm">
                        {formatNumber(validator.weight || 0)}
                      </td>
                      <td className="border-r border-slate-100 dark:border-neutral-800 px-4 py-2 text-right font-mono text-sm">
                        {formatNumber((validator.remainingBalance || 0) / 1e9)}{" "}
                        AVAX
                      </td>
                      <td className="border-r border-slate-100 dark:border-neutral-800 px-4 py-2 text-right text-xs">
                        {formatTimestamp(validator.creationTimestamp)}
                      </td>
                      <td className="px-4 py-2 font-mono text-xs">
                        {validator.remainingBalanceOwner?.addresses?.[0] ? (
                          <div>
                            <div>
                              {formatAddress(
                                validator.remainingBalanceOwner.addresses[0]
                              )}
                            </div>
                            {validator.remainingBalanceOwner.addresses.length >
                              1 && (
                              <div className="text-neutral-500 dark:text-neutral-500">
                                +
                                {validator.remainingBalanceOwner.addresses
                                  .length - 1}{" "}
                                more
                              </div>
                            )}
                            <div className="text-neutral-500 dark:text-neutral-500 text-xs">
                              Threshold:{" "}
                              {validator.remainingBalanceOwner.threshold}
                            </div>
                          </div>
                        ) : (
                          "N/A"
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  validators.map((validator, index) => (
                    <tr
                      key={validator.nodeId}
                      className="border-b border-slate-100 dark:border-neutral-800 transition-colors hover:bg-blue-50/50 dark:hover:bg-neutral-800/50"
                    >
                      <td className="border-r border-slate-100 dark:border-neutral-800 px-4 py-2">
                        <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                          {index + 1}
                        </span>
                      </td>
                      <td className="border-r border-slate-100 dark:border-neutral-800 px-4 py-2 font-mono text-xs">
                        <span title={validator.nodeId}>
                          {validator.nodeId.slice(0, 12)}...
                          {validator.nodeId.slice(-8)}
                        </span>
                      </td>
                      <td className="border-r border-slate-100 dark:border-neutral-800 px-4 py-2 font-mono text-xs">
                        <span
                          className={
                            validator.version &&
                            compareVersions(validator.version, minVersion) >= 0
                              ? "text-green-600 dark:text-green-400"
                              : "text-neutral-500 dark:text-neutral-500"
                          }
                        >
                          {validator.version || "Unknown"}
                        </span>
                      </td>
                      <td className="border-r border-slate-100 dark:border-neutral-800 px-4 py-2 text-right font-mono text-sm">
                        {formatStake(validator.amountStaked)} AVAX
                      </td>
                      <td className="border-r border-slate-100 dark:border-neutral-800 px-4 py-2 text-right text-sm">
                        {validator.delegationFee}%
                      </td>
                      <td className="border-r border-slate-100 dark:border-neutral-800 px-4 py-2 text-right text-sm">
                        {validator.delegatorCount}
                      </td>
                      <td className="px-4 py-2 text-right font-mono text-sm">
                        {formatStake(validator.amountDelegated)} AVAX
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </main>

      <StatsBubbleNav />
    </div>
  );
}
