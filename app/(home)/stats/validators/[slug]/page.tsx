"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter, notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Activity, Search, X, ArrowUpRight, Twitter, Linkedin, ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import { ChainIdChips } from "@/components/ui/copyable-id-chip";
import { AddToWalletButton } from "@/components/ui/add-to-wallet-button";
import { StatsBreadcrumb } from "@/components/navigation/StatsBreadcrumb";
import { Button } from "@/components/ui/button";
import { L1BubbleNav } from "@/components/stats/l1-bubble.config";
import { ExplorerDropdown } from "@/components/stats/ExplorerDropdown";
import { AvalancheLogo } from "@/components/navigation/avalanche-logo";
import l1ChainsData from "@/constants/l1-chains.json";
import Image from "next/image";
import Link from "next/link";
import { 
  compareVersions, 
  calculateVersionStats, 
  VersionBreakdownCard,
  type VersionBreakdownData,
} from "@/components/stats/VersionBreakdown";

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


interface ChainData {
  chainId: string;
  chainName: string;
  chainLogoURI: string;
  subnetId: string;
  blockchainId?: string;
  slug: string;
  color: string;
  category: string;
  description?: string;
  rpcUrl?: string;
  website?: string;
  socials?: {
    twitter?: string;
    linkedin?: string;
  };
  explorers?: Array<{
    name: string;
    link: string;
  }>;
  networkToken?: {
    symbol: string;
    name?: string;
    decimals?: number;
  };
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
    useState<VersionBreakdownData | null>(null);
  const [availableVersions, setAvailableVersions] = useState<string[]>([]);
  const [minVersion, setMinVersion] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [displayCount, setDisplayCount] = useState(50);
  const [sortColumn, setSortColumn] = useState<string>("weight");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  // Find chain info by slug - must be done before any hooks that depend on it
  const chainFromData = (l1ChainsData as ChainData[]).find((c) => c.slug === slug);

  useEffect(() => {
    if (!chainFromData) {
      return;
    }

    setChainInfo(chainFromData);

    async function fetchValidators() {
      if (!chainFromData) return;

      try {
        setLoading(true);
        const response = await fetch(`/api/chain-validators/${chainFromData.subnetId}`);

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
  }, [slug, chainFromData]);

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
  const versionStats = calculateVersionStats(versionBreakdown, minVersion);

  // Handle column sorting
  const handleSort = (column: string) => {
    if (sortColumn === column) {
      // Toggle direction if same column
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      // New column, default to descending
      setSortColumn(column);
      setSortDirection("desc");
    }
  };

  // Sort icon component
  const SortIcon = ({ column }: { column: string }) => {
    if (sortColumn !== column) {
      return <ChevronsUpDown className="w-3 h-3 ml-1 opacity-40" />;
    }
    return sortDirection === "asc" 
      ? <ChevronUp className="w-3 h-3 ml-1" />
      : <ChevronDown className="w-3 h-3 ml-1" />;
  };

  // Filter validators based on search term
  const filteredValidators = validators.filter((validator) => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      validator.nodeId.toLowerCase().includes(searchLower) ||
      (validator.validationId && validator.validationId.toLowerCase().includes(searchLower)) ||
      (validator.version && validator.version.toLowerCase().includes(searchLower))
    );
  });

  // Sort validators
  const sortedValidators = [...filteredValidators].sort((a, b) => {
    
    let aValue: number | string = 0;
    let bValue: number | string = 0;
    
    switch (sortColumn) {
      case "version":
        aValue = a.version || "";
        bValue = b.version || "";
        // Use version comparison for versions
        if (aValue && bValue) {
          const result = compareVersions(aValue as string, bValue as string);
          return sortDirection === "asc" ? result : -result;
        }
        return sortDirection === "asc" 
          ? (aValue as string).localeCompare(bValue as string) 
          : (bValue as string).localeCompare(aValue as string);
      case "weight":
        aValue = a.weight || 0;
        bValue = b.weight || 0;
        break;
      case "remainingBalance":
        aValue = a.remainingBalance || 0;
        bValue = b.remainingBalance || 0;
        break;
      case "creationTimestamp":
        aValue = a.creationTimestamp || 0;
        bValue = b.creationTimestamp || 0;
        break;
      case "amountStaked":
        aValue = parseFloat(a.amountStaked) || 0;
        bValue = parseFloat(b.amountStaked) || 0;
        break;
      case "delegationFee":
        aValue = parseFloat(a.delegationFee) || 0;
        bValue = parseFloat(b.delegationFee) || 0;
        break;
      case "delegatorCount":
        aValue = a.delegatorCount || 0;
        bValue = b.delegatorCount || 0;
        break;
      case "amountDelegated":
        aValue = parseFloat(a.amountDelegated) || 0;
        bValue = parseFloat(b.amountDelegated) || 0;
        break;
      default:
        return 0;
    }
    
    if (sortDirection === "asc") {
      return (aValue as number) - (bValue as number);
    }
    return (bValue as number) - (aValue as number);
  });

  // Paginated validators for display
  const displayedValidators = sortedValidators.slice(0, displayCount);
  const hasMoreValidators = sortedValidators.length > displayCount;

  // Load more validators
  const loadMoreValidators = () => {
    setDisplayCount((prev) => prev + 50);
  };

  const getHealthColor = (percent: number): string => {
    if (percent === 0) return "text-red-600 dark:text-red-400";
    if (percent < 80) return "text-orange-600 dark:text-orange-400";
    return "text-green-600 dark:text-green-400";
  };


  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
        <div className="border-b border-zinc-200 dark:border-zinc-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-8 sm:pt-16 pb-8 sm:pb-12">
            <div className="animate-pulse space-y-6">
              <div className="h-6 w-64 bg-zinc-200 dark:bg-zinc-800 rounded" />
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
        <L1BubbleNav chainSlug={slug} themeColor={chainInfo?.color} rpcUrl={chainInfo?.rpcUrl} />
      </div>
    );
  }

  // If chain is not found in static data, return 404
  if (!chainFromData) {
    notFound();
  }

  if (error || !chainInfo) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
        <div className="border-b border-zinc-200 dark:border-zinc-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-8 sm:pt-16 pb-8 sm:pb-12">
            <StatsBreadcrumb
              showValidators
              chainSlug={slug}
              chainName="Unknown"
            />
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center space-y-4">
              <Activity className="h-12 w-12 text-red-500 mx-auto" />
              <p className="text-red-600 dark:text-red-400">
                {error || "Failed to load validators"}
              </p>
            </div>
          </div>
        </div>
        <L1BubbleNav chainSlug={slug} themeColor={chainInfo?.color} rpcUrl={chainInfo?.rpcUrl} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Hero - with gradient decoration */}
      <div className="relative overflow-hidden border-b border-zinc-200 dark:border-zinc-800">
        {/* Gradient decoration */}
        <div 
          className="absolute top-0 right-0 w-2/3 h-full pointer-events-none"
          style={{
            background: `linear-gradient(to left, ${chainInfo.color}35 0%, ${chainInfo.color}20 40%, ${chainInfo.color}08 70%, transparent 100%)`,
          }}
        />
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 pt-8 sm:pt-16 pb-8 sm:pb-12">
          {/* Breadcrumb - outside the flex container */}
          <StatsBreadcrumb
            showValidators
            chainSlug={chainInfo.slug}
            chainName={chainInfo.chainName}
            chainLogoURI={chainInfo.chainLogoURI}
            themeColor={chainInfo.color}
          />

          <div className="flex flex-col sm:flex-row items-start justify-between gap-6 sm:gap-8">
            <div className="space-y-4 sm:space-y-6 flex-1">
              <div>
                <div className="flex items-center gap-2 sm:gap-3 mb-3">
                  <AvalancheLogo className="w-4 h-4 sm:w-5 sm:h-5" fill="#E84142" />
                  <p className="text-xs sm:text-sm font-medium text-red-600 dark:text-red-500 tracking-wide uppercase">
                    Avalanche Ecosystem
                  </p>
                </div>
                <div className="flex items-center gap-3 sm:gap-4">
                  {chainInfo.chainLogoURI && (
                    <Image
                      src={chainInfo.chainLogoURI}
                      alt={chainInfo.chainName}
                      width={56}
                      height={56}
                      className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 object-contain rounded-xl"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                  )}
                  <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-zinc-900 dark:text-white">
                    {chainInfo.chainName} Validators
                  </h1>
                </div>
                {/* Blockchain ID and Subnet ID chips + Add to Wallet */}
                {(chainInfo.subnetId || chainInfo.blockchainId || chainInfo.rpcUrl) && (
                  <div className="mt-3 -mx-4 px-4 sm:mx-0 sm:px-0">
                    <div className="flex flex-row items-center gap-2 overflow-x-auto scrollbar-hide pb-1">
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <ChainIdChips subnetId={chainInfo.subnetId} blockchainId={chainInfo.blockchainId} />
                      </div>
                      {chainInfo.rpcUrl && (
                        <div className="flex-shrink-0">
                          <AddToWalletButton 
                            rpcUrl={chainInfo.rpcUrl}
                            chainName={chainInfo.chainName}
                            chainId={chainInfo.chainId ? parseInt(chainInfo.chainId) : undefined}
                            tokenSymbol={chainInfo.networkToken?.symbol}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {(chainInfo.description || chainInfo.chainName) && (
                  <div className="flex items-center gap-3 mt-3">
                    <p className="text-sm sm:text-base text-zinc-500 dark:text-zinc-400 max-w-2xl">
                      {chainInfo.description || `Active validators and delegation metrics for ${chainInfo.chainName}`}
                    </p>
                  </div>
                )}
                {/* Mobile Social Links - shown below description */}
                {(chainInfo.website || chainInfo.socials || chainInfo.rpcUrl) && (
                  <div className="flex sm:hidden items-center gap-2 mt-4">
                    {chainInfo.website && (
                      <Button
                        variant="outline"
                        size="sm"
                        asChild
                        className="border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-zinc-400 dark:hover:border-zinc-600"
                      >
                        <a href={chainInfo.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
                          Website
                          <ArrowUpRight className="h-4 w-4" />
                        </a>
                      </Button>
                    )}
                    {chainInfo.socials && (chainInfo.socials.twitter || chainInfo.socials.linkedin) && (
                      <>
                        {chainInfo.socials.twitter && (
                          <Button
                            variant="outline"
                            size="sm"
                            asChild
                            className="border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-zinc-400 dark:hover:border-zinc-600 px-2"
                          >
                            <a 
                              href={`https://x.com/${chainInfo.socials.twitter}`} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              aria-label="Twitter"
                            >
                              <Twitter className="h-4 w-4" />
                            </a>
                          </Button>
                        )}
                        {chainInfo.socials.linkedin && (
                          <Button
                            variant="outline"
                            size="sm"
                            asChild
                            className="border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-zinc-400 dark:hover:border-zinc-600 px-2"
                          >
                            <a 
                              href={`https://linkedin.com/company/${chainInfo.socials.linkedin}`} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              aria-label="LinkedIn"
                            >
                              <Linkedin className="h-4 w-4" />
                            </a>
                          </Button>
                        )}
                      </>
                    )}
                    {chainInfo.rpcUrl && (
                      <div className="[&_button]:border-zinc-300 dark:[&_button]:border-zinc-700 [&_button]:text-zinc-600 dark:[&_button]:text-zinc-400 [&_button]:hover:border-zinc-400 dark:[&_button]:hover:border-zinc-600">
                        <ExplorerDropdown
                          explorers={[
                            { name: "BuilderHub", link: `/explorer/${chainInfo.slug}` },
                            ...(chainInfo.explorers || []).filter((e: { name: string }) => e.name !== "BuilderHub"),
                          ]}
                          variant="outline"
                          size="sm"
                        />
                      </div>
                    )}
                  </div>
                )}
                {chainInfo.category && (
                  <div className="mt-3">
                    <span 
                      className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium"
                      style={{
                        backgroundColor: `${chainInfo.color}15`,
                        color: chainInfo.color,
                      }}
                    >
                      {chainInfo.category}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Desktop Social Links - hidden on mobile */}
            <div className="hidden sm:flex flex-row items-end gap-2">
              <div className="flex items-center gap-2">
                {chainInfo.website && (
                  <Button
                    variant="outline"
                    size="sm"
                    asChild
                    className="border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-zinc-400 dark:hover:border-zinc-600"
                  >
                    <a href={chainInfo.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
                      Website
                      <ArrowUpRight className="h-4 w-4" />
                    </a>
                  </Button>
                )}
                
                {/* Social buttons */}
                {chainInfo.socials && (chainInfo.socials.twitter || chainInfo.socials.linkedin) && (
                  <>
                    {chainInfo.socials.twitter && (
                      <Button
                        variant="outline"
                        size="sm"
                        asChild
                        className="border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-zinc-400 dark:hover:border-zinc-600 px-2"
                      >
                        <a 
                          href={`https://x.com/${chainInfo.socials.twitter}`} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          aria-label="Twitter"
                        >
                          <Twitter className="h-4 w-4" />
                        </a>
                      </Button>
                    )}
                    {chainInfo.socials.linkedin && (
                      <Button
                        variant="outline"
                        size="sm"
                        asChild
                        className="border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-zinc-400 dark:hover:border-zinc-600 px-2"
                      >
                        <a 
                          href={`https://linkedin.com/company/${chainInfo.socials.linkedin}`} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          aria-label="LinkedIn"
                        >
                          <Linkedin className="h-4 w-4" />
                        </a>
                      </Button>
                    )}
                  </>
                )}
                
                {chainInfo.rpcUrl && (
                  <div className="[&_button]:border-zinc-300 dark:[&_button]:border-zinc-700 [&_button]:text-zinc-600 dark:[&_button]:text-zinc-400 [&_button]:hover:border-zinc-400 dark:[&_button]:hover:border-zinc-600">
                    <ExplorerDropdown
                      explorers={[
                        { name: "BuilderHub", link: `/explorer/${chainInfo.slug}` },
                        ...(chainInfo.explorers || []).filter((e: { name: string }) => e.name !== "BuilderHub"),
                      ]}
                      variant="outline"
                      size="sm"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

            {/* Key metrics - inline */}
          <div className="grid grid-cols-2 sm:flex sm:items-baseline gap-3 sm:gap-6 md:gap-12 pt-6 mt-6 border-t border-zinc-200 dark:border-zinc-800">
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

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-8">
        {/* Version Breakdown Card */}
        {versionBreakdown && availableVersions.length > 0 && (
          <VersionBreakdownCard
            versionBreakdown={versionBreakdown}
            availableVersions={availableVersions}
            minVersion={minVersion}
            onVersionChange={setMinVersion}
            totalValidators={stats.totalValidators}
          />
        )}

        {/* Search Input */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
          <div className="relative w-full sm:w-auto sm:flex-shrink-0 sm:max-w-sm">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400 dark:text-neutral-500 pointer-events-none z-10" />
            <Input
              placeholder="Search validators..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-10 rounded-lg border-[#e1e2ea] dark:border-neutral-700 bg-[#fcfcfd] dark:bg-neutral-800 transition-colors focus-visible:border-black dark:focus-visible:border-white focus-visible:ring-0 text-sm sm:text-base text-black dark:text-white placeholder:text-neutral-500 dark:placeholder:text-neutral-400"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 flex items-center justify-center text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-full z-20 transition-colors"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <span className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
            {displayedValidators.length} of {sortedValidators.length} validators
          </span>
        </div>

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
                  <th 
                    className="px-4 py-2 text-left cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                    onClick={() => handleSort("version")}
                  >
                    <span className="text-xs font-normal text-neutral-700 dark:text-neutral-300 inline-flex items-center">
                      Version
                      <SortIcon column="version" />
                    </span>
                  </th>
                  {isL1 ? (
                    <>
                      <th className="px-4 py-2 text-left">
                        <span className="text-xs font-normal text-neutral-700 dark:text-neutral-300">
                          Validation ID
                        </span>
                      </th>
                      <th 
                        className="px-4 py-2 text-right cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                        onClick={() => handleSort("weight")}
                      >
                        <span className="text-xs font-normal text-neutral-700 dark:text-neutral-300 inline-flex items-center justify-end">
                          Weight
                          <SortIcon column="weight" />
                        </span>
                      </th>
                      <th 
                        className="px-4 py-2 text-right cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                        onClick={() => handleSort("remainingBalance")}
                      >
                        <span className="text-xs font-normal text-neutral-700 dark:text-neutral-300 inline-flex items-center justify-end">
                          Remaining Balance
                          <SortIcon column="remainingBalance" />
                        </span>
                      </th>
                      <th 
                        className="px-4 py-2 text-right cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                        onClick={() => handleSort("creationTimestamp")}
                      >
                        <span className="text-xs font-normal text-neutral-700 dark:text-neutral-300 inline-flex items-center justify-end">
                          Creation Time
                          <SortIcon column="creationTimestamp" />
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
                      <th 
                        className="px-4 py-2 text-right cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                        onClick={() => handleSort("amountStaked")}
                      >
                        <span className="text-xs font-normal text-neutral-700 dark:text-neutral-300 inline-flex items-center justify-end">
                          Amount Staked
                          <SortIcon column="amountStaked" />
                        </span>
                      </th>
                      <th 
                        className="px-4 py-2 text-right cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                        onClick={() => handleSort("delegationFee")}
                      >
                        <span className="text-xs font-normal text-neutral-700 dark:text-neutral-300 inline-flex items-center justify-end">
                          Delegation Fee
                          <SortIcon column="delegationFee" />
                        </span>
                      </th>
                      <th 
                        className="px-4 py-2 text-right cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                        onClick={() => handleSort("delegatorCount")}
                      >
                        <span className="text-xs font-normal text-neutral-700 dark:text-neutral-300 inline-flex items-center justify-end">
                          Delegators
                          <SortIcon column="delegatorCount" />
                        </span>
                      </th>
                      <th 
                        className="px-4 py-2 text-right cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                        onClick={() => handleSort("amountDelegated")}
                      >
                        <span className="text-xs font-normal text-neutral-700 dark:text-neutral-300 inline-flex items-center justify-end">
                          Amount Delegated
                          <SortIcon column="amountDelegated" />
                        </span>
                      </th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-neutral-950">
                {filteredValidators.length === 0 ? (
                  <tr>
                    <td
                      colSpan={isL1 ? 8 : 7}
                      className="text-center py-8 text-neutral-600 dark:text-neutral-400"
                    >
                      {searchTerm ? "No validators match your search" : "No validators found for this chain"}
                    </td>
                  </tr>
                ) : isL1 ? (
                  displayedValidators.map((validator, index) => (
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
                        <span
                          title={copiedId === `node-${validator.nodeId}` ? "Copied!" : `Click to copy: ${validator.nodeId}`}
                          onClick={() => copyToClipboard(validator.nodeId, `node-${validator.nodeId}`)}
                          className={`cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors ${
                            copiedId === `node-${validator.nodeId}` ? "text-green-600 dark:text-green-400" : ""
                          }`}
                        >
                          {copiedId === `node-${validator.nodeId}` ? "Copied!" : `${validator.nodeId.slice(0, 12)}...${validator.nodeId.slice(-8)}`}
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
                          <span
                            title={copiedId === `val-${validator.validationId}` ? "Copied!" : `Click to copy: ${validator.validationId}`}
                            onClick={() => copyToClipboard(validator.validationId!, `val-${validator.validationId}`)}
                            className={`cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors ${
                              copiedId === `val-${validator.validationId}` ? "text-green-600 dark:text-green-400" : ""
                            }`}
                          >
                            {copiedId === `val-${validator.validationId}` ? "Copied!" : `${validator.validationId.slice(0, 12)}...${validator.validationId.slice(-8)}`}
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
                            <div
                              title={copiedId === `owner-${validator.nodeId}` ? "Copied!" : `Click to copy: ${validator.remainingBalanceOwner.addresses[0]}`}
                              onClick={() => copyToClipboard(validator.remainingBalanceOwner!.addresses[0], `owner-${validator.nodeId}`)}
                              className={`cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors ${
                                copiedId === `owner-${validator.nodeId}` ? "text-green-600 dark:text-green-400" : ""
                              }`}
                            >
                              {copiedId === `owner-${validator.nodeId}` ? "Copied!" : formatAddress(validator.remainingBalanceOwner.addresses[0])}
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
                  displayedValidators.map((validator, index) => (
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
                        <span
                          title={copiedId === `node-${validator.nodeId}` ? "Copied!" : `Click to copy: ${validator.nodeId}`}
                          onClick={() => copyToClipboard(validator.nodeId, `node-${validator.nodeId}`)}
                          className={`cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors ${
                            copiedId === `node-${validator.nodeId}` ? "text-green-600 dark:text-green-400" : ""
                          }`}
                        >
                          {copiedId === `node-${validator.nodeId}` ? "Copied!" : `${validator.nodeId.slice(0, 12)}...${validator.nodeId.slice(-8)}`}
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

        {/* Load More Button */}
        {hasMoreValidators && (
          <div className="flex justify-center pt-2 pb-16">
            <button
              onClick={loadMoreValidators}
              className="px-6 py-2.5 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-lg hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-colors font-medium text-sm"
            >
              Load More ({sortedValidators.length - displayCount} remaining)
            </button>
          </div>
        )}
      </main>

      <L1BubbleNav chainSlug={slug} themeColor={chainInfo?.color} rpcUrl={chainInfo?.rpcUrl} />
    </div>
  );
}
