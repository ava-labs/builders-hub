"use client";
import React, { useState, useEffect, useMemo, useTransition, useRef } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, XAxis, YAxis, Pie, PieChart, Line, LineChart, Brush, ResponsiveContainer, Tooltip, ComposedChart } from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { type ChartConfig, ChartLegendContent, ChartStyle, ChartContainer, ChartTooltip, ChartLegend } from "@/components/ui/chart";
import { Landmark, Shield, TrendingUp, Monitor, HandCoins, Users, Percent, ArrowUpRight, Twitter, Linkedin, Coins, Download, Camera, ChevronDown, Copy, Check } from "lucide-react";
import { ValidatorWorldMap } from "@/components/stats/ValidatorWorldMap";
import { L1BubbleNav } from "@/components/stats/l1-bubble.config";
import { ExplorerDropdown } from "@/components/stats/ExplorerDropdown";
import { StickyNavBar } from "@/components/stats/StickyNavBar";
import { PeriodSelector, type Period } from "@/components/stats/PeriodSelector";
import { MobileSocialLinks } from "@/components/stats/MobileSocialLinks";
import { SearchInputWithClear } from "@/components/stats/SearchInputWithClear";
import { SortIcon } from "@/components/stats/SortIcon";
import { useSectionNavigation } from "@/hooks/use-section-navigation";
import { LinkableHeading } from "@/components/stats/LinkableHeading";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";
import { ChartSkeletonLoader } from "@/components/ui/chart-skeleton";
import { TimeSeriesDataPoint, ChartDataPoint, PrimaryNetworkMetrics, VersionCount, L1Chain } from "@/types/stats";
import { AvalancheLogo } from "@/components/navigation/avalanche-logo";
import { ChartWatermark } from "@/components/stats/ChartWatermark";
import { StatsBreadcrumb } from "@/components/navigation/StatsBreadcrumb";
import { ChainIdChips } from "@/components/ui/copyable-id-chip";
import { AddToWalletButton } from "@/components/ui/add-to-wallet-button";
import { VersionBreakdownCard, calculateVersionStats, type VersionBreakdownData } from "@/components/stats/VersionBreakdown";
import l1ChainsData from "@/constants/l1-chains.json";
import { getMAConfig } from "@/utils/chart-utils";
import { useTheme } from "next-themes";
import { toPng } from "html-to-image";

interface ValidatorData {
  nodeId: string;
  amountStaked: string;
  delegationFee: string;
  validationStatus: string;
  delegatorCount: number;
  amountDelegated: string;
  version?: string;
}

interface ValidatorDetails {
  txHash: string;
  nodeId: string;
  subnetId: string;
  amountStaked: string;
  delegationFee: string;
  startTimestamp: number;
  endTimestamp: number;
  blsCredentials?: {
    publicKey: string;
    proofOfPossession: string;
  };
  stakePercentage: number;
  validatorHealth?: {
    reachabilityPercent: number;
    benchedPChainRequestsPercent: number;
    benchedXChainRequestsPercent: number;
    benchedCChainRequestsPercent: number;
  };
  delegatorCount: number;
  amountDelegated: string;
  potentialRewards?: {
    validationRewardAmount: string;
    delegationRewardAmount: string;
    rewardAddresses: string[];
  };
  uptimePerformance: number;
  avalancheGoVersion?: string;
  delegationCapacity: string;
  validationStatus: string;
  geolocation?: {
    city: string;
    country: string;
    countryCode: string;
    latitude: number;
    longitude: number;
  };
}

export default function CChainValidatorMetrics() {
  const [metrics, setMetrics] = useState<PrimaryNetworkMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [validatorVersions, setValidatorVersions] = useState<VersionCount[]>(
    []
  );
  const [validators, setValidators] = useState<ValidatorData[]>([]);
  const [versionBreakdown, setVersionBreakdown] =
    useState<VersionBreakdownData | null>(null);
  const [availableVersions, setAvailableVersions] = useState<string[]>([]);
  const [minVersion, setMinVersion] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");
  const [displayCount, setDisplayCount] = useState(50);
  const { copiedId, copyToClipboard } = useCopyToClipboard();
  const [sortColumn, setSortColumn] = useState<string>("amountStaked");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [expandedValidators, setExpandedValidators] = useState<Set<string>>(new Set());
  const [validatorDetails, setValidatorDetails] = useState<Record<string, ValidatorDetails | null>>({});
  const [loadingDetails, setLoadingDetails] = useState<Set<string>>(new Set());
  const [detailsCopiedId, setDetailsCopiedId] = useState<string | null>(null);
  const [stakingAPYData, setStakingAPYData] = useState<{
    data: { date: string; timestamp: number; supply: number; maxAPY: number; minAPY: number }[];
    current: { supply: number; totalBurned: number; maxAPY: number; minAPY: number };
  } | null>(null);
  const [stakingAPYLoading, setStakingAPYLoading] = useState(true);

  const fetchData = async () => {
    try {
      setLoading(true);
      setStakingAPYLoading(true);
      setError(null);

      // Fetch all APIs in parallel
      // Use validator-stats API for version breakdown (same as landing page)
      const [statsResponse, validatorsResponse, validatorStatsResponse, stakingAPYResponse] =
        await Promise.all([
          fetch(`/api/primary-network-stats?timeRange=all`),
          fetch("/api/primary-network-validators"),
          fetch("/api/validator-stats?network=mainnet"),
          fetch('/api/staking-apy'),
        ]);

      if (!statsResponse.ok) {
        throw new Error(`HTTP error! status: ${statsResponse.status}`);
      }

      const primaryNetworkData = await statsResponse.json();

      if (!primaryNetworkData) {
        throw new Error("Primary Network data not found");
      }

      setMetrics(primaryNetworkData);

      // Get version breakdown from validator-stats API (same source as landing page)
      // Primary Network has id: 11111111111111111111111111111111LpoYY
      if (validatorStatsResponse.ok) {
        try {
          const allSubnets = await validatorStatsResponse.json();
          const primaryNetwork = allSubnets.find(
            (s: any) => s.id === "11111111111111111111111111111111LpoYY"
          );

          if (primaryNetwork?.byClientVersion) {
            // Use the same data structure as landing page
            setVersionBreakdown({
              byClientVersion: primaryNetwork.byClientVersion,
              totalStakeString: primaryNetwork.totalStakeString,
            });

            // Build versionArray for pie charts
            const versionArray: VersionCount[] = Object.entries(
              primaryNetwork.byClientVersion
            )
              .map(([version, data]: [string, any]) => ({
                version,
                count: data.nodes,
                percentage: 0,
                amountStaked: Number(data.stakeString) / 1e9,
                stakingPercentage: 0,
              }))
              .sort((a, b) => b.count - a.count);

            const totalValidators = versionArray.reduce(
              (sum, item) => sum + item.count,
              0
            );
            const totalStaked = versionArray.reduce(
              (sum, item) => sum + item.amountStaked,
              0
            );

            versionArray.forEach((item) => {
              item.percentage =
                totalValidators > 0 ? (item.count / totalValidators) * 100 : 0;
              item.stakingPercentage =
                totalStaked > 0 ? (item.amountStaked / totalStaked) * 100 : 0;
            });

            setValidatorVersions(versionArray);

            // Extract available versions for dropdown
            const versions = versionArray
              .map((v) => v.version)
              .filter((v) => v !== "Unknown")
              .sort()
              .reverse();
            setAvailableVersions(versions);
            if (versions.length > 0) {
              setMinVersion(versions[0]);
            }
          }
        } catch (err) {
          console.error("Failed to process validator stats data", err);
        }
      }

      // Process validators data
      if (validatorsResponse.ok) {
        const validatorsData = await validatorsResponse.json();
        const validatorsList = validatorsData.validators || [];
        setValidators(validatorsList);
      }

      // Process staking APY data
      if (stakingAPYResponse.ok) {
        try {
          const stakingData = await stakingAPYResponse.json();
          setStakingAPYData(stakingData);
        } catch (err) {
          console.error('Error parsing staking APY data:', err);
        }
      }
    } catch (err) {
      setError(`An error occurred while fetching data`);
    } finally {
      setLoading(false);
      setStakingAPYLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const formatNumber = (num: number | string): string => {
    if (num === "N/A" || num === "") return "N/A";
    const numValue = typeof num === "string" ? Number.parseFloat(num) : num;
    if (isNaN(numValue)) return "N/A";
    return numValue.toLocaleString();
  };

  const formatWeight = (weight: number | string): string => {
    if (weight === "N/A" || weight === "") return "N/A";
    const numValue =
      typeof weight === "string" ? Number.parseFloat(weight) : weight;
    if (isNaN(numValue)) return "N/A";

    const avaxValue = numValue / 1e9;

    if (avaxValue >= 1e12) {
      return `${(avaxValue / 1e12).toFixed(2)}T AVAX`;
    } else if (avaxValue >= 1e9) {
      return `${(avaxValue / 1e9).toFixed(2)}B AVAX`;
    } else if (avaxValue >= 1e6) {
      return `${(avaxValue / 1e6).toFixed(2)}M AVAX`;
    } else if (avaxValue >= 1e3) {
      return `${(avaxValue / 1e3).toFixed(2)}K AVAX`;
    }
    return `${avaxValue.toLocaleString(undefined, {
      maximumFractionDigits: 2,
    })} AVAX`;
  };

  const formatWeightForAxis = (weight: number | string): string => {
    if (weight === "N/A" || weight === "") return "N/A";
    const numValue =
      typeof weight === "string" ? Number.parseFloat(weight) : weight;
    if (isNaN(numValue)) return "N/A";

    const avaxValue = numValue / 1e9;

    if (avaxValue >= 1e12) {
      return `${(avaxValue / 1e12).toFixed(2)}T`;
    } else if (avaxValue >= 1e9) {
      return `${(avaxValue / 1e9).toFixed(2)}B`;
    } else if (avaxValue >= 1e6) {
      return `${(avaxValue / 1e6).toFixed(2)}M`;
    } else if (avaxValue >= 1e3) {
      return `${(avaxValue / 1e3).toFixed(2)}K`;
    }
    return avaxValue.toLocaleString(undefined, {
      maximumFractionDigits: 2,
    });
  };

  const formatStake = (value: number) => {
    if (value >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
    if (value >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
    if (value >= 1e3) return `${(value / 1e3).toFixed(2)}K`;
    return value.toFixed(2);
  };

  const formatPercentage = (value: number) => `${value.toFixed(1)}%`;

  // Calculate Validator Weight Distribution (stake + delegations)
  const validatorWeightDistribution = useMemo(() => {
    if (!validators.length) return [];
    const sorted = [...validators]
      .map((v) => ({
        nodeId: v.nodeId,
        weight:
          (parseFloat(v.amountStaked) + parseFloat(v.amountDelegated)) / 1e9,
      }))
      .sort((a, b) => b.weight - a.weight);
    const totalWeight = sorted.reduce((sum, v) => sum + v.weight, 0);
    let cumulativeWeight = 0;
    return sorted.map((v, index) => {
      cumulativeWeight += v.weight;
      return {
        rank: index + 1,
        weight: v.weight,
        cumulativePercentage: (cumulativeWeight / totalWeight) * 100,
      };
    });
  }, [validators]);

  // Calculate Validator Stake Distribution (own stake only)
  const validatorStakeDistribution = useMemo(() => {
    if (!validators.length) return [];
    const sorted = [...validators]
      .map((v) => ({
        nodeId: v.nodeId,
        weight: parseFloat(v.amountStaked) / 1e9,
      }))
      .sort((a, b) => b.weight - a.weight);
    const totalWeight = sorted.reduce((sum, v) => sum + v.weight, 0);
    let cumulativeWeight = 0;
    return sorted.map((v, index) => {
      cumulativeWeight += v.weight;
      return {
        rank: index + 1,
        weight: v.weight,
        cumulativePercentage: (cumulativeWeight / totalWeight) * 100,
      };
    });
  }, [validators]);

  // Calculate Delegator Stake Distribution (by validator)
  const delegatorStakeDistribution = useMemo(() => {
    if (!validators.length) return [];
    const sorted = [...validators]
      .map((v) => ({
        nodeId: v.nodeId,
        weight: parseFloat(v.amountDelegated) / 1e9,
      }))
      .sort((a, b) => b.weight - a.weight);
    const totalWeight = sorted.reduce((sum, v) => sum + v.weight, 0);
    let cumulativeWeight = 0;
    return sorted.map((v, index) => {
      cumulativeWeight += v.weight;
      return {
        rank: index + 1,
        weight: v.weight,
        cumulativePercentage:
          totalWeight > 0 ? (cumulativeWeight / totalWeight) * 100 : 0,
      };
    });
  }, [validators]);

  // Calculate Delegation Fee Distribution
  const feeDistribution = useMemo(() => {
    if (!validators.length) return [];
    const feeMap = new Map<number, { count: number; totalWeight: number }>();
    validators.forEach((v) => {
      const fee = parseFloat(v.delegationFee);
      const weight = parseFloat(v.amountStaked) / 1e9;
      if (!feeMap.has(fee)) {
        feeMap.set(fee, { count: 0, totalWeight: 0 });
      }
      const current = feeMap.get(fee)!;
      current.count += 1;
      current.totalWeight += weight;
    });
    const actualData = Array.from(feeMap.entries())
      .map(([fee, data]) => ({
        fee,
        count: data.count,
        totalWeight: data.totalWeight,
      }))
      .sort((a, b) => a.fee - b.fee);
    const tickValues = [0, 20, 40, 60, 80, 100];
    tickValues.forEach((tick) => {
      if (!actualData.some((d) => d.fee === tick)) {
        actualData.push({ fee: tick, count: 0, totalWeight: 0 });
      }
    });
    return actualData.sort((a, b) => a.fee - b.fee);
  }, [validators]);

  const getChartData = (
    metricKey: keyof Pick<
      PrimaryNetworkMetrics,
      | "validator_count"
      | "validator_weight"
      | "delegator_count"
      | "delegator_weight"
    >
  ): ChartDataPoint[] => {
    if (!metrics || !metrics[metricKey]?.data) return [];
    const today = new Date().toISOString().split("T")[0];
    const finalizedData = metrics[metricKey].data.filter(
      (point) => point.date !== today
    );

    return finalizedData
      .map((point: TimeSeriesDataPoint) => ({
        day: point.date,
        value:
          typeof point.value === "string"
            ? parseFloat(point.value)
            : point.value,
      }))
      .reverse();
  };

  const formatTooltipValue = (value: number, metricKey: string): string => {
    const roundedValue = ["validator_count", "delegator_count"].includes(
      metricKey
    )
      ? Math.round(value)
      : value;

    switch (metricKey) {
      case "validator_count":
        return `${formatNumber(roundedValue)} Validators`;

      case "validator_weight":
        return `${formatWeight(value)} Staked`;

      case "delegator_count":
        return `${formatNumber(roundedValue)} Delegators`;

      case "delegator_weight":
        return `${formatWeight(value)} Delegated Stake`;

      default:
        return formatNumber(value);
    }
  };

  const getCurrentValue = (
    metricKey: keyof Pick<
      PrimaryNetworkMetrics,
      | "validator_count"
      | "validator_weight"
      | "delegator_count"
      | "delegator_weight"
    >
  ): number | string => {
    if (!metrics || !metrics[metricKey]) return "N/A";
    return metrics[metricKey].current_value;
  };

  const getPieChartData = () => {
    if (!validatorVersions.length) return [];

    // Use Avalanche red color palette
    return validatorVersions.map((version, index) => ({
      version: version.version,
      count: version.count,
      percentage: version.percentage,
      amountStaked: version.amountStaked,
      stakingPercentage: version.stakingPercentage,
      fill: `hsl(${0 + index * 8}, ${85 - index * 5}%, ${55 + index * 5}%)`,
    }));
  };

  const getVersionsChartConfig = (): ChartConfig => {
    const config: ChartConfig = {
      count: {
        label: "Validators",
      },
    };

    // Use Avalanche red color palette
    validatorVersions.forEach((version, index) => {
      config[version.version] = {
        label: version.version,
        color: `hsl(${0 + index * 8}, ${85 - index * 5}%, ${55 + index * 5}%)`,
      };
    });

    return config;
  };

  const pieChartData = getPieChartData();
  const versionsChartConfig = getVersionsChartConfig();
  const versionStats = calculateVersionStats(versionBreakdown, minVersion);

  const getHealthColor = (percent: number): string => {
    if (percent === 0) return "text-red-600 dark:text-red-400";
    if (percent < 80) return "text-orange-600 dark:text-orange-400";
    return "text-green-600 dark:text-green-400";
  };

  // Format large numbers with B/M/K suffix
  const formatLargeNumber = (num: number): string => {
    if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B`;
    if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
    if (num >= 1e3) return `${(num / 1e3).toFixed(2)}K`;
    return num.toFixed(0);
  };

  // Get total weight (validator + delegator) from metrics
  const getTotalWeight = (): string => {
    const validatorWeight = metrics?.validator_weight?.current_value ? Number(metrics.validator_weight.current_value) : 0;
    const delegatorWeight = metrics?.delegator_weight?.current_value ? Number(metrics.delegator_weight.current_value) : 0;
    const totalWeightInAvax = (validatorWeight + delegatorWeight) / 1e9;
    return formatLargeNumber(totalWeightInAvax);
  };

  // C-Chain config from l1-chains.json
  const cChainData = (l1ChainsData as L1Chain[]).find(c => c.slug === "c-chain");
  const chainConfig = {
    chainLogoURI: cChainData?.chainLogoURI || "https://images.ctfassets.net/gcj8jwzm6086/5VHupNKwnDYJvqMENeV7iJ/3e4b8ff10b69bfa31e70080a4b142cd0/avalanche-avax-logo.svg",
    color: cChainData?.color || "#E57373",
    category: "Primary Network",
    description: cChainData?.description || "Real-time insights into the Avalanche C-Chain performance and validator distribution",
    website: cChainData?.website,
    socials: cChainData?.socials,
    explorers: cChainData?.explorers || [],
    rpcUrl: cChainData?.rpcUrl,
    slug: "c-chain",
    blockchainId: (cChainData as any)?.blockchainId,
    subnetId: cChainData?.subnetId,
  };

  const chartConfigs = [
    {
      title: "Primary Network Validator Count",
      icon: Monitor,
      metricKey: "validator_count" as const,
      description: "Number of active validators on the Primary Network",
      color: chainConfig.color,
      chartType: "bar" as const,
    },
    {
      title: "Primary Network Validator Stake",
      icon: Landmark,
      metricKey: "validator_weight" as const,
      description: "Total staked amount by validators",
      color: chainConfig.color,
      chartType: "area" as const,
    },
    {
      title: "Primary Network Delegator Count",
      icon: HandCoins,
      metricKey: "delegator_count" as const,
      description: "Number of active delegators on the Primary Network",
      color: "#E84142",
      chartType: "bar" as const,
    },
    {
      title: "Primary Network Delegated Stake",
      icon: Landmark,
      metricKey: "delegator_weight" as const,
      description: "Total delegated amount across validators",
      color: "#E84142",
      chartType: "area" as const,
    },
  ];

  const [chartPeriods, setChartPeriods] = useState<
    Record<string, "D" | "W" | "M" | "Q" | "Y">
  >(Object.fromEntries(chartConfigs.map((config) => [config.metricKey, "D"])));

  // Global period selector state
  const [globalPeriod, setGlobalPeriod] = useState<Period>("D");
  const [, startTransition] = useTransition();

  const handlePeriodChange = (newPeriod: Period) => {
    startTransition(() => {
      setGlobalPeriod(newPeriod);
    });
  };

  // Sync all chart periods when global period changes
  useEffect(() => {
    setChartPeriods(
      Object.fromEntries(chartConfigs.map((config) => [config.metricKey, globalPeriod]))
    );
  }, [globalPeriod]);

  // Navigation categories
  const navCategories = [
    { id: "trends", label: "Historical Trends" },
    { id: "rewards", label: "Rewards Distribution" },
    { id: "distribution", label: "Stake Distribution" },
    { id: "versions", label: "Software Versions" },
    { id: "map", label: "Global Map" },
    { id: "validators", label: "Validator List" },
  ];

  // Section navigation using reusable hook
  const { activeSection, scrollToSection } = useSectionNavigation({
    categories: navCategories,
    offset: 180,
    initialSection: "trends",
  });

  // Format stake for validators table
  const formatValidatorStake = (stake: string): string => {
    const stakeNum = parseFloat(stake);
    const avaxValue = stakeNum / 1e9;
    if (avaxValue >= 1e6) return `${(avaxValue / 1e6).toFixed(2)}M`;
    if (avaxValue >= 1e3) return `${(avaxValue / 1e3).toFixed(2)}K`;
    return avaxValue.toFixed(2);
  };

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

  // Filter validators based on search term
  const filteredValidators = validators.filter((validator) => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      validator.nodeId.toLowerCase().includes(searchLower) ||
      (validator.version &&
        validator.version.toLowerCase().includes(searchLower))
    );
  });

  // Sort validators
  const sortedValidators = [...filteredValidators].sort((a, b) => {
    
    let aValue: number = 0;
    let bValue: number = 0;
    
    switch (sortColumn) {
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
      return aValue - bValue;
    }
    return bValue - aValue;
  });

  // Paginated validators for display
  const displayedValidators = sortedValidators.slice(0, displayCount);
  const hasMoreValidators = sortedValidators.length > displayCount;

  // Load more validators
  const loadMoreValidators = () => {
    setDisplayCount((prev) => prev + 50);
  };

  // Reset display count when search term changes
  useEffect(() => {
    setDisplayCount(50);
  }, [searchTerm]);

  // Toggle validator expansion and fetch details
  const toggleValidatorExpansion = async (nodeId: string) => {
    const newExpanded = new Set(expandedValidators);
    
    if (newExpanded.has(nodeId)) {
      newExpanded.delete(nodeId);
      setExpandedValidators(newExpanded);
      return;
    }
    
    newExpanded.add(nodeId);
    setExpandedValidators(newExpanded);

    if (!validatorDetails[nodeId] && !loadingDetails.has(nodeId)) {
      setLoadingDetails(prev => new Set(prev).add(nodeId));
      
      try {
        const response = await fetch(`/api/validator-details/${encodeURIComponent(nodeId)}`);
        if (response.ok) {
          const data = await response.json();
          setValidatorDetails(prev => ({...prev, [nodeId]: data.validatorDetails}));
        } else {
          setValidatorDetails(prev => ({...prev, [nodeId]: null}));
        }
      } catch (error) {
        console.error(`Failed to fetch details for ${nodeId}:`, error);
        setValidatorDetails(prev => ({...prev, [nodeId]: null}));
      } finally {
        setLoadingDetails(prev => {
          const newSet = new Set(prev);
          newSet.delete(nodeId);
          return newSet;
        });
      }
    }
  };

  const copyDetailsToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setDetailsCopiedId(id);
    setTimeout(() => setDetailsCopiedId(null), 2000);
  };

  // Format timestamp
  const formatTimestamp = (timestamp: number): string => {
    if (!timestamp) return "N/A";
    return new Date(timestamp * 1000).toLocaleDateString("en-US", {year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"});
  };

  // Format nAVAX to AVAX
  const formatNavaxToAvax = (navax: string): string => {
    const value = parseFloat(navax) / 1e9;
    if (value >= 1e6) return `${(value / 1e6).toFixed(2)}M AVAX`;
    if (value >= 1e3) return `${(value / 1e3).toFixed(2)}K AVAX`;
    return `${value.toFixed(2)} AVAX`;
  };

  const truncateString = (str: string, startLen: number = 10, endLen: number = 8): string => {
    if (str.length <= startLen + endLen + 3) return str;
    return `${str.slice(0, startLen)}...${str.slice(-endLen)}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
        {/* Header Skeleton with gradient */}
        <div className="relative overflow-hidden border-b border-zinc-200 dark:border-zinc-800">
          <div
            className="absolute top-0 right-0 w-2/3 h-full pointer-events-none"
            style={{
              background: `linear-gradient(to left, rgba(229, 115, 115, 0.21) 0%, rgba(229, 115, 115, 0.12) 40%, rgba(229, 115, 115, 0.03) 70%, transparent 100%)`,
            }}
          />
          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 pt-8 sm:pt-16 pb-6 sm:pb-8">
            <div className="animate-pulse space-y-4">
              {/* Breadcrumb skeleton */}
              <div className="flex items-center gap-1.5">
                <div className="h-4 w-20 bg-zinc-200 dark:bg-zinc-800 rounded" />
                <div className="h-3 w-3 bg-zinc-200 dark:bg-zinc-800 rounded" />
                <div className="h-4 w-20 bg-zinc-200 dark:bg-zinc-800 rounded" />
                <div className="h-3 w-3 bg-zinc-200 dark:bg-zinc-800 rounded" />
                <div className="h-4 w-28 bg-zinc-200 dark:bg-zinc-800 rounded" />
              </div>
              <div className="flex items-center gap-3">
                <div className="h-4 w-4 sm:h-5 sm:w-5 bg-zinc-200 dark:bg-zinc-800 rounded" />
                <div className="h-4 w-32 bg-zinc-200 dark:bg-zinc-800 rounded" />
              </div>
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 bg-zinc-200 dark:bg-zinc-800 rounded-xl" />
                <div className="h-10 sm:h-12 w-64 sm:w-96 bg-zinc-200 dark:bg-zinc-800 rounded" />
              </div>
              <div className="h-4 w-48 sm:w-80 bg-zinc-200 dark:bg-zinc-800 rounded" />
              <div className="h-6 w-32 bg-zinc-200 dark:bg-zinc-800 rounded-full" />
            </div>
          </div>
        </div>
        {/* Navbar Skeleton */}
        <div className="sticky top-14 z-30 w-full bg-zinc-50/95 dark:bg-zinc-950/95 backdrop-blur-sm border-b border-t border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center gap-2 py-3 px-4 sm:px-6 max-w-7xl mx-auto">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-8 w-24 sm:w-32 bg-zinc-200 dark:bg-zinc-800 rounded-lg animate-pulse"
              />
            ))}
          </div>
        </div>
        {/* Content Skeleton */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-8">
          {/* Section header skeleton */}
          <div className="space-y-2 animate-pulse">
            <div className="h-6 w-48 bg-zinc-200 dark:bg-zinc-800 rounded" />
            <div className="h-4 w-72 bg-zinc-200 dark:bg-zinc-800 rounded" />
          </div>
          {/* Chart grid skeleton */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950"
              >
                {/* Chart header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-200 dark:border-zinc-700 animate-pulse">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-zinc-200 dark:bg-zinc-800" />
                    <div className="space-y-2">
                      <div className="h-5 w-32 bg-zinc-200 dark:bg-zinc-800 rounded" />
                      <div className="h-3 w-40 bg-zinc-200 dark:bg-zinc-800 rounded hidden sm:block" />
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((j) => (
                      <div
                        key={j}
                        className="w-8 h-7 bg-zinc-200 dark:bg-zinc-800 rounded"
                      />
                    ))}
                  </div>
                </div>
                {/* Chart body */}
                <div className="p-5 animate-pulse">
                  <div className="flex items-center gap-4 mb-4 pl-4">
                    <div className="h-6 w-32 bg-zinc-200 dark:bg-zinc-800 rounded" />
                    <div className="h-5 w-16 bg-zinc-200 dark:bg-zinc-800 rounded" />
                  </div>
                  <div className="h-[350px] bg-zinc-100 dark:bg-zinc-900 rounded-lg" />
                  <div className="mt-4 h-20 bg-zinc-100 dark:bg-zinc-900 rounded-lg" />
                </div>
              </div>
            ))}
          </div>
        </div>
        <L1BubbleNav
          chainSlug="c-chain"
          themeColor="#E57373"
          rpcUrl="https://api.avax.network/ext/bc/C/rpc"
        />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center">
        <div className="text-center space-y-4">
          <Monitor className="h-12 w-12 text-red-500 mx-auto" />
          <p className="text-red-600 dark:text-red-400">{error}</p>
          <button
            onClick={fetchData}
            className="px-4 py-2 bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 rounded-md hover:opacity-90"
          >
            Retry
          </button>
        </div>
        <L1BubbleNav
          chainSlug="c-chain"
          themeColor="#E57373"
          rpcUrl="https://api.avax.network/ext/bc/C/rpc"
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Hero - with gradient decoration */}
      <div className="relative overflow-hidden border-zinc-200 dark:border-zinc-800">
        {/* Gradient decoration on the right */}
        <div
          className="absolute top-0 right-0 w-2/3 h-full pointer-events-none"
          style={{
            background: `linear-gradient(to left, ${chainConfig.color}35 0%, ${chainConfig.color}20 40%, ${chainConfig.color}08 70%, transparent 100%)`,
          }}
        />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 pt-8 sm:pt-16 pb-6 sm:pb-8">
          {/* Breadcrumb - outside the flex container */}
          <StatsBreadcrumb
            showValidators
            chainSlug="c-chain"
            chainName="Avalanche C-Chain"
            chainLogoURI={chainConfig.chainLogoURI}
            themeColor={chainConfig.color}
          />

          <div className="flex flex-col sm:flex-row items-start justify-between gap-6 sm:gap-8">
            <div className="space-y-4 sm:space-y-6 flex-1">
              <div>
                <div className="flex items-center gap-2 sm:gap-3 mb-3">
                  <AvalancheLogo
                    className="w-4 h-4 sm:w-5 sm:h-5"
                    fill="#E84142"
                  />
                  <p className="text-xs sm:text-sm font-medium text-red-600 dark:text-red-500 tracking-wide uppercase">
                    Avalanche Ecosystem
                  </p>
                </div>
                <div className="flex items-center gap-3 sm:gap-4">
                  <img
                    src={chainConfig.chainLogoURI}
                    alt="C-Chain logo"
                    className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 object-contain rounded-xl"
                  />
                  <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-zinc-900 dark:text-white">
                    C-Chain Validators
                  </h1>
                </div>
                {/* Blockchain ID and Subnet ID chips + Add to Wallet */}
                {(chainConfig.subnetId || chainConfig.blockchainId || chainConfig.rpcUrl) && (
                  <div className="mt-3 -mx-4 px-4 sm:mx-0 sm:px-0">
                    <div className="flex flex-row items-center gap-2 overflow-x-auto scrollbar-hide pb-1">
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <ChainIdChips subnetId={chainConfig.subnetId} blockchainId={chainConfig.blockchainId} />
                      </div>
                      {chainConfig.rpcUrl && (
                        <div className="flex-shrink-0">
                          <AddToWalletButton 
                            rpcUrl={chainConfig.rpcUrl}
                            chainName="Avalanche C-Chain"
                            chainId={43114}
                            tokenSymbol="AVAX"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-3 mt-3">
                  <p className="text-sm sm:text-base text-zinc-500 dark:text-zinc-400 max-w-2xl">
                    {chainConfig.description}
                  </p>
                </div>
                {/* Mobile Social Links - shown below description */}
                <MobileSocialLinks
                  website={chainConfig.website}
                  socials={chainConfig.socials}
                  explorers={chainConfig.rpcUrl ? [
                    { name: "BuilderHub", link: `/explorer/${chainConfig.slug}` },
                    ...(chainConfig.explorers || []).filter((e: { name: string }) => e.name !== "BuilderHub"),
                  ] : undefined}
                />
                <div className="mt-3">
                  <span
                    className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium"
                    style={{
                      backgroundColor: `${chainConfig.color}15`,
                      color: chainConfig.color,
                    }}
                  >
                    {chainConfig.category}
                  </span>
                </div>

                {/* Key metrics - inline */}
                <div className="grid grid-cols-2 sm:flex sm:items-baseline gap-3 sm:gap-6 md:gap-12 pt-6 mt-6 border-t border-zinc-200 dark:border-zinc-800">
                  <div>
                    <span className="text-2xl sm:text-3xl md:text-4xl font-semibold tabular-nums text-zinc-900 dark:text-white">
                      {validators.length}
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
                  <div>
                    <span className="text-2xl sm:text-3xl md:text-4xl font-semibold tabular-nums text-zinc-900 dark:text-white">
                      {getTotalWeight()}
                    </span>
                    <span className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 ml-1 sm:ml-2">
                      total weight
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Desktop Social Links - hidden on mobile */}
            <div className="hidden sm:flex flex-row items-end gap-2">
              <div className="flex items-center gap-2">
                {chainConfig.website && (
                  <Button
                    variant="outline"
                    size="sm"
                    asChild
                    className="border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-zinc-400 dark:hover:border-zinc-600"
                  >
                    <a href={chainConfig.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
                      Website
                      <ArrowUpRight className="h-4 w-4" />
                    </a>
                  </Button>
                )}
                
                {/* Social buttons */}
                {chainConfig.socials && (chainConfig.socials.twitter || chainConfig.socials.linkedin) && (
                  <>
                    {chainConfig.socials.twitter && (
                      <Button
                        variant="outline"
                        size="sm"
                        asChild
                        className="border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-zinc-400 dark:hover:border-zinc-600 px-2"
                      >
                        <a 
                          href={`https://x.com/${chainConfig.socials.twitter}`} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          aria-label="Twitter"
                        >
                          <Twitter className="h-4 w-4" />
                        </a>
                      </Button>
                    )}
                    {chainConfig.socials.linkedin && (
                      <Button
                        variant="outline"
                        size="sm"
                        asChild
                        className="border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-zinc-400 dark:hover:border-zinc-600 px-2"
                      >
                        <a 
                          href={`https://linkedin.com/company/${chainConfig.socials.linkedin}`} 
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
                
                {chainConfig.rpcUrl && (
                  <div className="[&_button]:border-zinc-300 dark:[&_button]:border-zinc-700 [&_button]:text-zinc-600 dark:[&_button]:text-zinc-400 [&_button]:hover:border-zinc-400 dark:[&_button]:hover:border-zinc-600">
                    <ExplorerDropdown
                      explorers={[
                        { name: "BuilderHub", link: `/explorer/${chainConfig.slug}` },
                        ...chainConfig.explorers.filter((e: { name: string }) => e.name !== "BuilderHub"),
                      ]}
                      variant="outline"
                      size="sm"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sticky Navigation Bar */}
      <StickyNavBar
        categories={navCategories}
        activeSection={activeSection}
        onNavigate={scrollToSection}
      >
        <PeriodSelector
          selected={globalPeriod}
          onChange={handlePeriodChange}
        />
      </StickyNavBar>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-8 sm:space-y-12">
        <section className="space-y-4 sm:space-y-6">
          <div className="space-y-2">
            <LinkableHeading as="h2" id="trends" className="text-lg sm:text-2xl font-medium text-left">
              Historical Trends
            </LinkableHeading>
            <p className="text-zinc-500 dark:text-zinc-400 text-sm sm:text-base text-left">
              Track network growth and validator activity over time
            </p>
          </div>

          {/* Primary Network Total Stake - Stacked Area Chart */}
          {metrics?.validator_weight && metrics?.delegator_weight && (
            <TotalWeightStackedChartCard
              validatorData={getChartData("validator_weight")}
              delegatorData={getChartData("delegator_weight")}
              validatorCurrentValue={getCurrentValue("validator_weight")}
              delegatorCurrentValue={getCurrentValue("delegator_weight")}
              color={chainConfig.color}
              period={globalPeriod}
              onPeriodChange={handlePeriodChange}
            />
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            {chartConfigs.map((config) => {
              const rawData = getChartData(config.metricKey);
              if (rawData.length === 0) return null;

              const period = chartPeriods[config.metricKey];
              const currentValue = getCurrentValue(config.metricKey);

              return (
                <ValidatorChartCard
                  key={config.metricKey}
                  config={config}
                  rawData={rawData}
                  period={period}
                  currentValue={currentValue}
                  onPeriodChange={(newPeriod) =>
                    setChartPeriods((prev) => ({
                      ...prev,
                      [config.metricKey]: newPeriod,
                    }))
                  }
                  formatTooltipValue={(value) =>
                    formatTooltipValue(value, config.metricKey)
                  }
                  formatYAxisValue={
                    config.metricKey.includes("weight")
                      ? formatWeightForAxis
                      : formatNumber
                  }
                />
              );
            })}
          </div>
        </section>

        {/* Rewards Distribution Section */}
        <section className="space-y-4 sm:space-y-6">
          <div className="space-y-2">
            <LinkableHeading as="h2" id="rewards" className="text-lg sm:text-2xl font-medium text-left">
              Rewards Distribution
            </LinkableHeading>
            <p className="text-zinc-500 dark:text-zinc-400 text-sm sm:text-base text-left">
              Track staking rewards for the Primary Network
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            {/* Daily Rewards Chart with 30-day moving average and total */}
            {metrics?.daily_rewards && metrics.daily_rewards.data.length > 0 && (
              <DailyRewardsChartCard
                data={metrics.daily_rewards.data.map(point => ({
                  day: point.date,
                  value: typeof point.value === 'string' ? parseFloat(point.value) : point.value
                })).reverse()}
                cumulativeData={metrics.cumulative_rewards?.data.map(point => ({
                  day: point.date,
                  value: typeof point.value === 'string' ? parseFloat(point.value) : point.value
                })).reverse() || []}
                currentValue={metrics.daily_rewards.current_value}
                cumulativeCurrentValue={metrics.cumulative_rewards?.current_value || 0}
                color={chainConfig.color}
                period={globalPeriod}
                onPeriodChange={handlePeriodChange}
              />
            )}

            {/* Cumulative Rewards Chart */}
            {metrics?.cumulative_rewards && metrics.cumulative_rewards.data.length > 0 && (
              <CumulativeRewardsChartCard
                data={metrics.cumulative_rewards.data.map(point => ({
                  day: point.date,
                  value: typeof point.value === 'string' ? parseFloat(point.value) : point.value
                })).reverse()}
                currentValue={metrics.cumulative_rewards.current_value}
                color="#a855f7"
                period={globalPeriod}
                onPeriodChange={handlePeriodChange}
              />
            )}
          </div>

          {/* Historical Staking APY Chart */}
          <StakingAPYChartCard
            data={stakingAPYData?.data}
            currentMaxAPY={stakingAPYData?.current.maxAPY}
            currentMinAPY={stakingAPYData?.current.minAPY}
            period={globalPeriod}
            onPeriodChange={handlePeriodChange}
            isLoading={stakingAPYLoading}
          />
        </section>

        <section className="space-y-4 sm:space-y-6">
          <div className="space-y-2">
            <LinkableHeading as="h2" id="distribution" className="text-lg sm:text-2xl font-medium text-left">
              Stake Distribution Analysis
            </LinkableHeading>
            <p className="text-zinc-500 dark:text-zinc-400 text-sm sm:text-base text-left">
              Analyze how stake is distributed across validators and delegation
              patterns
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            {loading ? (
              <ChartSkeletonLoader />
            ) : (
              <Card className="py-0 border-gray-200 rounded-md dark:border-gray-700">
                <CardContent className="p-0">
                  <div className="flex items-center justify-between px-4 sm:px-5 py-3 sm:py-4 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-2 sm:gap-3">
                      <div
                        className="rounded-full p-2 sm:p-3 flex items-center justify-center"
                        style={{ backgroundColor: `${chainConfig.color}20` }}
                      >
                        <Landmark
                          className="h-5 w-5 sm:h-6 sm:w-6"
                          style={{ color: chainConfig.color }}
                        />
                      </div>
                      <div>
                        <h3 className="text-base sm:text-lg font-normal">
                          Current Validator Weight Distribution
                        </h3>
                        <p className="text-xs sm:text-sm text-muted-foreground hidden sm:block">
                          Total weight (stake + delegations) by rank
                        </p>
                      </div>
                    </div>
                  </div>
                  <ChartWatermark className="px-4 sm:px-5 py-4 sm:py-5">
                    <div className="flex items-center justify-start gap-6 mb-4 text-sm">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: "#E84142" }}
                        />
                        <span>
                          Cumulative Validator Weight Percentage by Rank
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: chainConfig.color }}
                        />
                        <span>Validator Weight</span>
                      </div>
                    </div>
                    <ResponsiveContainer width="100%" height={350}>
                      <ComposedChart
                        data={validatorWeightDistribution}
                        margin={{ top: 20, right: 20, left: 20, bottom: 20 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis
                          dataKey="rank"
                          label={{
                            value: "Node Rank by Validator Weight",
                            position: "insideBottom",
                            offset: -10,
                          }}
                          className="text-xs"
                          tick={{ fontSize: 11 }}
                          interval="preserveStartEnd"
                          ticks={Array.from(
                            {
                              length:
                                Math.ceil(
                                  validatorWeightDistribution.length / 200
                                ) + 1,
                            },
                            (_, i) => i * 200
                          ).filter(
                            (v) => v <= validatorWeightDistribution.length
                          )}
                        />
                        <YAxis
                          yAxisId="left"
                          label={{
                            value: "Cumulative Validator Weight % by Rank",
                            angle: -90,
                            position: "insideLeft",
                            style: { textAnchor: "middle" },
                          }}
                          className="text-xs"
                          tick={{ fontSize: 11 }}
                          tickFormatter={formatPercentage}
                        />
                        <YAxis
                          yAxisId="right"
                          orientation="right"
                          label={{
                            value: "Weight",
                            angle: 90,
                            position: "insideRight",
                          }}
                          className="text-xs"
                          tick={{ fontSize: 11 }}
                          tickFormatter={formatStake}
                        />
                        <Tooltip
                          content={({ active, payload }) => {
                            if (!active || !payload?.length) return null;
                            return (
                              <div className="bg-background p-3 border rounded-lg shadow-lg">
                                <p className="font-semibold">
                                  Rank: {payload[0].payload.rank}
                                </p>
                                <p className="text-sm">
                                  Weight:{" "}
                                  {formatStake(payload[0].payload.weight)}
                                </p>
                                <p className="text-sm">
                                  Cumulative:{" "}
                                  {payload[0].payload.cumulativePercentage.toFixed(
                                    2
                                  )}
                                  %
                                </p>
                              </div>
                            );
                          }}
                        />
                        <Bar
                          yAxisId="right"
                          dataKey="weight"
                          fill={chainConfig.color}
                        />
                        <Line
                          yAxisId="left"
                          type="monotone"
                          dataKey="cumulativePercentage"
                          stroke="#E84142"
                          strokeWidth={2}
                          dot={false}
                          name="Cumulative %"
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </ChartWatermark>
                </CardContent>
              </Card>
            )}

            {loading ? (
              <ChartSkeletonLoader />
            ) : (
              <Card className="py-0 border-gray-200 rounded-md dark:border-gray-700">
                <CardContent className="p-0">
                  <div className="flex items-center justify-between px-4 sm:px-5 py-3 sm:py-4 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-2 sm:gap-3">
                      <div
                        className="rounded-full p-2 sm:p-3 flex items-center justify-center"
                        style={{ backgroundColor: `${chainConfig.color}20` }}
                      >
                        <Landmark
                          className="h-5 w-5 sm:h-6 sm:w-6"
                          style={{ color: chainConfig.color }}
                        />
                      </div>
                      <div>
                        <h3 className="text-base sm:text-lg font-normal">
                          Validator Stake Distribution
                        </h3>
                        <p className="text-xs sm:text-sm text-muted-foreground hidden sm:block">
                          Own stake only (excluding delegations)
                        </p>
                      </div>
                    </div>
                  </div>
                  <ChartWatermark className="px-4 sm:px-5 py-4 sm:py-5">
                    <div className="flex items-center justify-start gap-6 mb-4 text-sm">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: "#E84142" }}
                        />
                        <span>Cumulative Stake Percentage by Rank</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: chainConfig.color }}
                        />
                        <span>Validator Stake</span>
                      </div>
                    </div>
                    <ResponsiveContainer width="100%" height={350}>
                      <ComposedChart
                        data={validatorStakeDistribution}
                        margin={{ top: 20, right: 20, left: 20, bottom: 20 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis
                          dataKey="rank"
                          label={{
                            value: "Validator Rank by AVAX Staked",
                            position: "insideBottom",
                            offset: -10,
                          }}
                          className="text-xs"
                          tick={{ fontSize: 11 }}
                          interval="preserveStartEnd"
                          ticks={Array.from(
                            {
                              length:
                                Math.ceil(
                                  validatorStakeDistribution.length / 200
                                ) + 1,
                            },
                            (_, i) => i * 200
                          ).filter(
                            (v) => v <= validatorStakeDistribution.length
                          )}
                        />
                        <YAxis
                          yAxisId="left"
                          label={{
                            value: "Cumulative Stake % by Rank",
                            angle: -90,
                            position: "insideLeft",
                            style: { textAnchor: "middle" },
                          }}
                          className="text-xs"
                          tick={{ fontSize: 11 }}
                          tickFormatter={formatPercentage}
                        />
                        <YAxis
                          yAxisId="right"
                          orientation="right"
                          label={{
                            value: "Stake",
                            angle: 90,
                            position: "insideRight",
                          }}
                          className="text-xs"
                          tick={{ fontSize: 11 }}
                          tickFormatter={formatStake}
                        />
                        <Tooltip
                          content={({ active, payload }) => {
                            if (!active || !payload?.length) return null;
                            return (
                              <div className="bg-background p-3 border rounded-lg shadow-lg">
                                <p className="font-semibold">
                                  Rank: {payload[0].payload.rank}
                                </p>
                                <p className="text-sm">
                                  Stake:{" "}
                                  {formatStake(payload[0].payload.weight)}
                                </p>
                                <p className="text-sm">
                                  Cumulative:{" "}
                                  {payload[0].payload.cumulativePercentage.toFixed(
                                    2
                                  )}
                                  %
                                </p>
                              </div>
                            );
                          }}
                        />
                        <Bar
                          yAxisId="right"
                          dataKey="weight"
                          fill={chainConfig.color}
                        />
                        <Line
                          yAxisId="left"
                          type="monotone"
                          dataKey="cumulativePercentage"
                          stroke="#E84142"
                          strokeWidth={2}
                          dot={false}
                          name="Cumulative %"
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </ChartWatermark>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            {loading ? (
              <ChartSkeletonLoader />
            ) : (
              <Card className="py-0 border-gray-200 rounded-md dark:border-gray-700">
                <CardContent className="p-0">
                  <div className="flex items-center justify-between px-4 sm:px-5 py-3 sm:py-4 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-2 sm:gap-3">
                      <div
                        className="rounded-full p-2 sm:p-3 flex items-center justify-center"
                        style={{ backgroundColor: "#E8414220" }}
                      >
                        <Users
                          className="h-5 w-5 sm:h-6 sm:w-6"
                          style={{ color: "#E84142" }}
                        />
                      </div>
                      <div>
                        <h3 className="text-base sm:text-lg font-normal">
                          Delegator Stake Distribution
                        </h3>
                        <p className="text-xs sm:text-sm text-muted-foreground hidden sm:block">
                          Delegated stake across validator nodes
                        </p>
                      </div>
                    </div>
                  </div>
                  <ChartWatermark className="px-4 sm:px-5 py-4 sm:py-5">
                    <div className="flex items-center justify-start gap-6 mb-4 text-sm">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: "#E84142" }}
                        />
                        <span>
                          Cumulative Delegator Stake Percentage by Rank
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: chainConfig.color }}
                        />
                        <span>Delegator Stake</span>
                      </div>
                    </div>
                    <ResponsiveContainer width="100%" height={350}>
                      <ComposedChart
                        data={delegatorStakeDistribution}
                        margin={{ top: 20, right: 20, left: 20, bottom: 20 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis
                          dataKey="rank"
                          label={{
                            value: "Node Rank by Delegator Stake",
                            position: "insideBottom",
                            offset: -10,
                          }}
                          className="text-xs"
                          tick={{ fontSize: 11 }}
                          interval="preserveStartEnd"
                          ticks={Array.from(
                            {
                              length:
                                Math.ceil(
                                  delegatorStakeDistribution.length / 200
                                ) + 1,
                            },
                            (_, i) => i * 200
                          ).filter(
                            (v) => v <= delegatorStakeDistribution.length
                          )}
                        />
                        <YAxis
                          yAxisId="left"
                          label={{
                            value: "Cumulative Delegator Stake % by Rank",
                            angle: -90,
                            position: "insideLeft",
                            style: { textAnchor: "middle" },
                          }}
                          className="text-xs"
                          tick={{ fontSize: 11 }}
                          tickFormatter={formatPercentage}
                        />
                        <YAxis
                          yAxisId="right"
                          orientation="right"
                          label={{
                            value: "Delegated",
                            angle: 90,
                            position: "insideRight",
                          }}
                          className="text-xs"
                          tick={{ fontSize: 11 }}
                          tickFormatter={formatStake}
                        />
                        <Tooltip
                          content={({ active, payload }) => {
                            if (!active || !payload?.length) return null;
                            return (
                              <div className="bg-background p-3 border rounded-lg shadow-lg">
                                <p className="font-semibold">
                                  Rank: {payload[0].payload.rank}
                                </p>
                                <p className="text-sm">
                                  Delegated:{" "}
                                  {formatStake(payload[0].payload.weight)}
                                </p>
                                <p className="text-sm">
                                  Cumulative:{" "}
                                  {payload[0].payload.cumulativePercentage.toFixed(
                                    2
                                  )}
                                  %
                                </p>
                              </div>
                            );
                          }}
                        />
                        <Bar
                          yAxisId="right"
                          dataKey="weight"
                          fill={chainConfig.color}
                        />
                        <Line
                          yAxisId="left"
                          type="monotone"
                          dataKey="cumulativePercentage"
                          stroke="#E84142"
                          strokeWidth={2}
                          dot={false}
                          name="Cumulative %"
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </ChartWatermark>
                </CardContent>
              </Card>
            )}

            {loading ? (
              <ChartSkeletonLoader />
            ) : (
              <Card className="py-0 border-gray-200 rounded-md dark:border-gray-700">
                <CardContent className="p-0">
                  <div className="flex items-center justify-between px-4 sm:px-5 py-3 sm:py-4 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-2 sm:gap-3">
                      <div
                        className="rounded-full p-2 sm:p-3 flex items-center justify-center"
                        style={{ backgroundColor: "#E8414220" }}
                      >
                        <Percent
                          className="h-5 w-5 sm:h-6 sm:w-6"
                          style={{ color: "#E84142" }}
                        />
                      </div>
                      <div>
                        <h3 className="text-base sm:text-lg font-normal">
                          Delegation Fee Distribution
                        </h3>
                        <p className="text-xs sm:text-sm text-muted-foreground hidden sm:block">
                          Distribution of fees weighted by stake
                        </p>
                      </div>
                    </div>
                  </div>
                  <ChartWatermark className="px-4 sm:px-5 py-4 sm:py-5">
                    <ResponsiveContainer width="100%" height={350}>
                      <BarChart
                        data={feeDistribution}
                        margin={{ top: 20, right: 20, left: 20, bottom: 20 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          vertical={false}
                          stroke="rgba(200, 200, 200, 0.2)"
                        />
                        <XAxis
                          dataKey="fee"
                          label={{
                            value: "Fee (%)",
                            position: "insideBottom",
                            offset: -10,
                          }}
                          className="text-xs"
                          tick={(props: any) => {
                            const { x, y, payload } = props;
                            const value = parseFloat(payload.value);
                            if ([20, 40, 60, 100].includes(value)) {
                              return (
                                <text
                                  x={x}
                                  y={y + 10}
                                  textAnchor="middle"
                                  fontSize={11}
                                >
                                  {value}
                                </text>
                              );
                            }
                            return <g />;
                          }}
                          tickLine={false}
                          interval={0}
                          axisLine={{ stroke: "rgba(255, 255, 255, 0.1)" }}
                        />
                        <YAxis
                          label={{
                            value: "Weight",
                            angle: -90,
                            position: "insideLeft",
                          }}
                          className="text-xs"
                          tick={{ fontSize: 11 }}
                          tickFormatter={formatStake}
                        />
                        <Tooltip
                          cursor={{ fill: "#e8414220" }}
                          content={({ active, payload }) => {
                            if (!active || !payload?.length) return null;
                            const data = payload[0].payload;
                            return (
                              <div className="rounded-lg border bg-background p-2 shadow-sm">
                                <div className="grid gap-2">
                                  <p className="font-medium text-sm">
                                    Fee: {data.fee}%
                                  </p>
                                  <p className="text-sm">
                                    Validators: {data.count}
                                  </p>
                                  <p className="text-sm">
                                    Weight: {formatStake(data.totalWeight)}
                                  </p>
                                </div>
                              </div>
                            );
                          }}
                        />
                        <Bar
                          dataKey="totalWeight"
                          fill="#e84142"
                          barSize={6}
                          radius={[4, 4, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartWatermark>
                </CardContent>
              </Card>
            )}
          </div>
        </section>

        <section className="space-y-4 sm:space-y-6">
          <div className="space-y-2">
            <LinkableHeading as="h2" id="versions" className="text-lg sm:text-2xl font-medium text-left">
              Software Versions
            </LinkableHeading>
            <p className="text-zinc-500 dark:text-zinc-400 text-sm sm:text-base text-left">
              Distribution of AvalancheGo versions across validators
            </p>
          </div>

          {/* Version Distribution Charts */}
          {validatorVersions.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* By Validator Count */}
              <Card data-chart="pie-count" className="flex flex-col">
                <ChartStyle id="pie-count" config={versionsChartConfig} />
                <CardHeader className="items-center pb-0">
                  <CardTitle className="flex items-center gap-2 font-medium">
                    <Shield
                      className="h-5 w-5"
                      style={{ color: chainConfig.color }}
                    />
                    By Validator Count
                  </CardTitle>
                  <CardDescription>
                    Distribution by number of validators
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-1 pb-0">
                  <ChartContainer
                    id="pie-count"
                    config={versionsChartConfig}
                    className="mx-auto aspect-square max-h-[300px]"
                  >
                    <PieChart>
                      <ChartTooltip
                        cursor={false}
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div className="rounded-lg border bg-background p-2 shadow-sm font-mono">
                                <div className="grid gap-2">
                                  <div className="flex flex-col">
                                    <span className="text-[0.70rem] uppercase text-muted-foreground">
                                      {data.version}
                                    </span>
                                    <span className="font-mono font-bold text-muted-foreground">
                                      {data.count} validators (
                                      {data.percentage.toFixed(1)}%)
                                    </span>
                                  </div>
                                </div>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Pie
                        data={pieChartData}
                        dataKey="count"
                        nameKey="version"
                      />
                      <ChartLegend
                        content={<ChartLegendContent nameKey="version" />}
                        className="-translate-y-2 flex-wrap gap-2 *:basis-1/4 *:justify-center"
                      />
                    </PieChart>
                  </ChartContainer>
                </CardContent>
              </Card>

              {/* By Stake Weight */}
              <Card data-chart="pie-stake" className="flex flex-col">
                <ChartStyle id="pie-stake" config={versionsChartConfig} />
                <CardHeader className="items-center pb-0">
                  <CardTitle className="flex items-center gap-2 font-medium">
                    <Shield
                      className="h-5 w-5"
                      style={{ color: chainConfig.color }}
                    />
                    By Stake Weight
                  </CardTitle>
                  <CardDescription>
                    Distribution by amount staked
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-1 pb-0">
                  <ChartContainer
                    id="pie-stake"
                    config={versionsChartConfig}
                    className="mx-auto aspect-square max-h-[300px]"
                  >
                    <PieChart>
                      <ChartTooltip
                        cursor={false}
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div className="rounded-lg border bg-background p-2 shadow-sm font-mono">
                                <div className="grid gap-2">
                                  <div className="flex flex-col">
                                    <span className="text-[0.70rem] uppercase text-muted-foreground">
                                      {data.version}
                                    </span>
                                    <span className="font-mono font-bold text-muted-foreground">
                                      {data.amountStaked.toLocaleString(
                                        undefined,
                                        { maximumFractionDigits: 0 }
                                      )}{" "}
                                      AVAX ({data.stakingPercentage.toFixed(1)}
                                      %)
                                    </span>
                                  </div>
                                </div>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Pie
                        data={pieChartData}
                        dataKey="amountStaked"
                        nameKey="version"
                      />
                      <ChartLegend
                        content={<ChartLegendContent nameKey="version" />}
                        className="-translate-y-2 flex-wrap gap-2 *:basis-1/4 *:justify-center"
                      />
                    </PieChart>
                  </ChartContainer>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Version Breakdown Card - replaces the old Detailed Version Breakdown grid */}
          {versionBreakdown && availableVersions.length > 0 && (
            <VersionBreakdownCard
              versionBreakdown={versionBreakdown}
              availableVersions={availableVersions}
              minVersion={minVersion}
              onVersionChange={setMinVersion}
              totalValidators={validatorVersions.reduce(
                (sum, v) => sum + v.count,
                0
              )}
              title="Version Breakdown"
              description="Distribution of validator software versions"
            />
          )}
        </section>

        {/* Global Validator Distribution Map */}
        <section className="space-y-4 sm:space-y-6">
          <LinkableHeading as="h2" id="map" className="text-lg sm:text-2xl font-medium text-left sr-only">
            Validator Map
          </LinkableHeading>
          <ValidatorWorldMap />
        </section>

        {/* All Validators Table */}
        <section className="space-y-4 sm:space-y-6">
          <div className="space-y-2">
            <LinkableHeading as="h2" id="validators" className="text-lg sm:text-2xl font-medium text-left">
              Validator List
            </LinkableHeading>
            <p className="text-zinc-500 dark:text-zinc-400 text-sm sm:text-base text-left">
              Complete list of all validators on the Primary Network
            </p>
          </div>

          {/* Search Input */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
            <SearchInputWithClear
              value={searchTerm}
              onChange={setSearchTerm}
              placeholder="Search validators..."
            />
            <span className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
              {displayedValidators.length} of {sortedValidators.length}{" "}
              validators
            </span>
          </div>

          {/* Validators Table */}
          {loading ? (
            <Card className="overflow-hidden py-0 border-0 shadow-none rounded-lg">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead className="bg-[#fcfcfd] dark:bg-neutral-900">
                    <tr>
                      <th className="px-4 py-4 text-left">
                        <span className="text-xs font-normal text-neutral-700 dark:text-neutral-300">
                          #
                        </span>
                      </th>
                      <th className="px-4 py-4 text-left">
                        <span className="text-xs font-normal text-neutral-700 dark:text-neutral-300">
                          Node ID
                        </span>
                      </th>
                      <th className="px-4 py-4 text-right">
                        <span className="text-xs font-normal text-neutral-700 dark:text-neutral-300">
                          Amount Staked
                        </span>
                      </th>
                      <th className="px-4 py-4 text-right">
                        <span className="text-xs font-normal text-neutral-700 dark:text-neutral-300">
                          Delegation Fee
                        </span>
                      </th>
                      <th className="px-4 py-4 text-right">
                        <span className="text-xs font-normal text-neutral-700 dark:text-neutral-300">
                          Delegators
                        </span>
                      </th>
                      <th className="px-4 py-4 text-right">
                        <span className="text-xs font-normal text-neutral-700 dark:text-neutral-300">
                          Amount Delegated
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
                          <div className="flex items-center gap-1.5">
                            <div className="h-4 w-4 bg-zinc-200 dark:bg-zinc-800 rounded" />
                            <div className="h-4 w-4 bg-zinc-200 dark:bg-zinc-800 rounded" />
                          </div>
                        </td>
                        <td className="border-r border-slate-100 dark:border-neutral-800 px-4 py-3">
                          <div className="h-4 w-40 bg-zinc-200 dark:bg-zinc-800 rounded" />
                        </td>
                        <td className="border-r border-slate-100 dark:border-neutral-800 px-4 py-3">
                          <div className="h-4 w-24 bg-zinc-200 dark:bg-zinc-800 rounded ml-auto" />
                        </td>
                        <td className="border-r border-slate-100 dark:border-neutral-800 px-4 py-3">
                          <div className="h-4 w-16 bg-zinc-200 dark:bg-zinc-800 rounded ml-auto" />
                        </td>
                        <td className="border-r border-slate-100 dark:border-neutral-800 px-4 py-3">
                          <div className="h-4 w-12 bg-zinc-200 dark:bg-zinc-800 rounded ml-auto" />
                        </td>
                        <td className="px-4 py-3">
                          <div className="h-4 w-24 bg-zinc-200 dark:bg-zinc-800 rounded ml-auto" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          ) : (
            <>
              <Card className="overflow-hidden py-0 border-0 shadow-none rounded-lg">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead className="bg-[#fcfcfd] dark:bg-neutral-900">
                      <tr>
                        <th className="px-4 py-4 text-left">
                          <span className="text-xs font-normal text-neutral-700 dark:text-neutral-300">
                            #
                          </span>
                        </th>
                        <th className="px-4 py-4 text-left">
                          <span className="text-xs font-normal text-neutral-700 dark:text-neutral-300">
                            Node ID
                          </span>
                        </th>
                        <th
                          className="px-4 py-4 text-right cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                          onClick={() => handleSort("amountStaked")}
                        >
                          <span className="text-xs font-normal text-neutral-700 dark:text-neutral-300 inline-flex items-center justify-end">
                            Amount Staked
                            <SortIcon column="amountStaked" sortColumn={sortColumn} sortDirection={sortDirection} />
                          </span>
                        </th>
                        <th
                          className="px-4 py-4 text-right cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                          onClick={() => handleSort("delegationFee")}
                        >
                          <span className="text-xs font-normal text-neutral-700 dark:text-neutral-300 inline-flex items-center justify-end">
                            Delegation Fee
                            <SortIcon column="delegationFee" sortColumn={sortColumn} sortDirection={sortDirection} />
                          </span>
                        </th>
                        <th
                          className="px-4 py-4 text-right cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                          onClick={() => handleSort("delegatorCount")}
                        >
                          <span className="text-xs font-normal text-neutral-700 dark:text-neutral-300 inline-flex items-center justify-end">
                            Delegators
                            <SortIcon column="delegatorCount" sortColumn={sortColumn} sortDirection={sortDirection} />
                          </span>
                        </th>
                        <th
                          className="px-4 py-4 text-right cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                          onClick={() => handleSort("amountDelegated")}
                        >
                          <span className="text-xs font-normal text-neutral-700 dark:text-neutral-300 inline-flex items-center justify-end">
                            Amount Delegated
                            <SortIcon column="amountDelegated" sortColumn={sortColumn} sortDirection={sortDirection} />
                          </span>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-neutral-950">
                      {displayedValidators.length === 0 ? (
                        <tr>
                          <td
                            colSpan={6}
                            className="text-center py-8 text-neutral-600 dark:text-neutral-400"
                          >
                            {searchTerm
                              ? "No validators match your search"
                              : "No validators found"}
                          </td>
                        </tr>
                      ) : (
                        displayedValidators.map((validator, index) => {
                          const isExpanded = expandedValidators.has(validator.nodeId);
                          const details = validatorDetails[validator.nodeId];
                          const isLoadingDetails = loadingDetails.has(validator.nodeId);
                          
                          return (
                            <React.Fragment key={validator.nodeId}>
                              <tr
                                onClick={() => toggleValidatorExpansion(validator.nodeId)}
                                className={`border-b border-slate-100 dark:border-neutral-800 transition-colors hover:bg-blue-50/50 dark:hover:bg-neutral-800/50 cursor-pointer ${isExpanded ? 'bg-blue-50/30 dark:bg-neutral-800/30' : ''}`}
                          >
                            <td className="border-r border-slate-100 dark:border-neutral-800 px-4 py-4">
                                  <div className="flex items-center gap-1.5">
                                    <ChevronDown
                                      className={`h-4 w-4 text-zinc-400 transition-transform duration-200 ${
                                        isExpanded ? "rotate-180" : ""
                                      }`}
                                    />
                              <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                                {index + 1}
                              </span>
                                  </div>
                            </td>
                            <td className="border-r border-slate-100 dark:border-neutral-800 px-4 py-4 font-mono text-xs">
                              <span
                                title={
                                  copiedId === `node-${validator.nodeId}`
                                    ? "Copied!"
                                    : `Click to copy: ${validator.nodeId}`
                                }
                                    onClick={(e) => {
                                      e.stopPropagation();
                                  copyToClipboard(
                                    validator.nodeId,
                                    `node-${validator.nodeId}`
                                      );
                                    }}
                                className={`cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors ${
                                  copiedId === `node-${validator.nodeId}`
                                    ? "text-green-600 dark:text-green-400"
                                    : ""
                                }`}
                              >
                                {copiedId === `node-${validator.nodeId}`
                                  ? "Copied!"
                                  : `${validator.nodeId.slice(
                                      0,
                                      12
                                    )}...${validator.nodeId.slice(-8)}`}
                              </span>
                            </td>
                            <td className="border-r border-slate-100 dark:border-neutral-800 px-4 py-4 text-right font-mono text-sm">
                              {formatValidatorStake(validator.amountStaked)}{" "}
                              AVAX
                            </td>
                            <td className="border-r border-slate-100 dark:border-neutral-800 px-4 py-4 text-right text-sm">
                              {parseFloat(validator.delegationFee).toFixed(1)}%
                            </td>
                            <td className="border-r border-slate-100 dark:border-neutral-800 px-4 py-4 text-right text-sm">
                              {validator.delegatorCount}
                            </td>
                            <td className="px-4 py-4 text-right font-mono text-sm">
                              {formatValidatorStake(validator.amountDelegated)}{" "}
                              AVAX
                            </td>
                          </tr>
                              
                              {/* Expanded Details Section */}
                              {isExpanded && (
                                <tr className="bg-zinc-50/50 dark:bg-neutral-900/30">
                                  <td colSpan={6} className="px-6 py-5">
                                    {isLoadingDetails ? (
                                      <div className="animate-in fade-in duration-300">
                                        {/* Status & Version Skeleton */}
                                        <div className="flex items-center justify-between mb-5">
                                          <div className="flex items-center gap-3">
                                            <div className="h-6 w-16 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
                                            <div className="h-4 w-20 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
                                          </div>
                                          <div className="h-8 w-28 bg-zinc-200 dark:bg-zinc-800 rounded-md animate-pulse" />
                                        </div>

                                        {/* First Grid Row Skeleton */}
                                        <div className="grid md:grid-cols-3 gap-3 mb-3">
                                          {[1, 2, 3].map((i) => (
                                            <div key={i} className="p-3 border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-neutral-900">
                                              <div className="h-3 w-24 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse mb-3" />
                                              <div className="space-y-2">
                                                <div className="h-3 w-36 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
                                                <div className="h-3 w-32 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
                                                <div className="h-3 w-28 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
                                              </div>
                                            </div>
                                          ))}
                                        </div>

                                        {/* Second Grid Row Skeleton */}
                                        <div className="grid md:grid-cols-3 gap-3 mb-4">
                                          {[1, 2, 3].map((i) => (
                                            <div key={i} className="p-3 border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-neutral-900">
                                              <div className="h-3 w-20 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse mb-3" />
                                              <div className="space-y-2">
                                                <div className="h-3 w-32 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
                                                <div className="h-3 w-28 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
                                              </div>
                                            </div>
                                          ))}
                                        </div>

                                        {/* Technical Details Skeleton */}
                                        <div className="border-t border-zinc-200 dark:border-zinc-700 pt-4">
                                          <div className="h-3 w-28 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse mb-3" />
                                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                            {[1, 2].map((i) => (
                                              <div key={i} className="flex items-center justify-between p-2.5 bg-white dark:bg-neutral-900 border border-zinc-200 dark:border-zinc-700 rounded-lg">
                                                <div className="flex items-center gap-2">
                                                  <div className="h-3 w-16 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
                                                  <div className="h-3 w-32 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
                                                </div>
                                                <div className="h-6 w-6 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      </div>
                                    ) : details ? (
                                      <>
                                        {/* Status & Version */}
                                        <div className="flex items-center justify-between mb-5">
                                          <div className="flex items-center gap-3">
                                            <span className={`px-2.5 py-1 text-xs font-medium rounded flex items-center gap-1.5 ${
                                              details.validationStatus === 'active'
                                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                                                : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                                            }`}>
                                              <span className={`w-1.5 h-1.5 rounded-full ${details.validationStatus === 'active' ? 'bg-emerald-500' : 'bg-yellow-500'}`} />
                                              {details.validationStatus.charAt(0).toUpperCase() + details.validationStatus.slice(1)}
                                            </span>
                                            {details.avalancheGoVersion && (
                                              <span className="text-sm text-zinc-500 dark:text-zinc-400">{details.avalancheGoVersion}</span>
                                            )}
                                          </div>
                                          <a
                                            href={`https://subnets.avax.network/validators/${validator.nodeId}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            onClick={(e) => e.stopPropagation()}
                                            className="inline-flex items-center h-8 px-3 text-xs font-medium gap-2 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:border-zinc-400 dark:hover:border-zinc-500 rounded-md transition-all bg-transparent"
                                          >
                                            View on Explorer
                                            <ArrowUpRight className="h-3.5 w-3.5" />
                                          </a>
                                        </div>

                                        <div className="grid md:grid-cols-3 gap-3 mb-3">
                                          <div className="p-3 border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-neutral-900">
                                            <h4 className="text-xs font-medium text-zinc-900 dark:text-zinc-100 mb-2">Validation Period</h4>
                                            <div className="text-xs text-zinc-500 dark:text-zinc-400 space-y-0.5">
                                              <p>Start: {formatTimestamp(details.startTimestamp)}</p>
                                              <p>End: {formatTimestamp(details.endTimestamp)}</p>
                                            </div>
                                          </div>
                                          <div className="p-3 border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-neutral-900">
                                            <h4 className="text-xs font-medium text-zinc-900 dark:text-zinc-100 mb-2">Staking Details</h4>
                                            <div className="text-xs text-zinc-500 dark:text-zinc-400 space-y-0.5">
                                              <p>Staked: {formatNavaxToAvax(details.amountStaked)}</p>
                                              <p>Delegated: {formatNavaxToAvax(details.amountDelegated)}</p>
                                              <p>Stake Percentage: {details.stakePercentage.toFixed(4)}%</p>
                                            </div>
                                          </div>
                                          <div className="p-3 border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-neutral-900">
                                            <h4 className="text-xs font-medium text-zinc-900 dark:text-zinc-100 mb-2">Delegation</h4>
                                            <div className="text-xs text-zinc-500 dark:text-zinc-400 space-y-0.5">
                                              <p>Fee: {parseFloat(details.delegationFee).toFixed(2)}%</p>
                                              <p>Capacity: {formatNavaxToAvax(details.delegationCapacity)}</p>
                                              <p>Delegators: {details.delegatorCount}</p>
                                            </div>
                                          </div>
                                        </div>

                                        <div className="grid md:grid-cols-3 gap-3 mb-4">
                                          <div className="p-3 border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-neutral-900">
                                            <h4 className="text-xs font-medium text-zinc-900 dark:text-zinc-100 mb-2">Performance</h4>
                                            <div className="text-xs space-y-0.5">
                                              <p className="text-zinc-500 dark:text-zinc-400">
                                                Uptime: <span className={`font-medium ${details.uptimePerformance >= 80 ? 'text-emerald-600 dark:text-emerald-400' : details.uptimePerformance >= 50 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400'}`}>{details.uptimePerformance.toFixed(2)}%</span>
                                              </p>
                                              {details.validatorHealth && (
                                                <p className="text-zinc-500 dark:text-zinc-400">
                                                  Reachability: <span className={`font-medium ${details.validatorHealth.reachabilityPercent >= 80 ? 'text-emerald-600 dark:text-emerald-400' : 'text-yellow-600 dark:text-yellow-400'}`}>{details.validatorHealth.reachabilityPercent}%</span>
                                                </p>
                                              )}
                                            </div>
                                          </div>
                                          {details.potentialRewards && (
                                            <div className="p-3 border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-neutral-900">
                                              <h4 className="text-xs font-medium text-zinc-900 dark:text-zinc-100 mb-2">Potential Rewards</h4>
                                              <div className="text-xs space-y-0.5">
                                                <p className="text-zinc-500 dark:text-zinc-400">
                                                  Validation: <span className="text-emerald-600 dark:text-emerald-400 font-medium">{formatNavaxToAvax(details.potentialRewards.validationRewardAmount)}</span>
                                                </p>
                                                <p className="text-zinc-500 dark:text-zinc-400">
                                                  Delegation: <span className="text-emerald-600 dark:text-emerald-400 font-medium">{formatNavaxToAvax(details.potentialRewards.delegationRewardAmount)}</span>
                                                </p>
                                              </div>
                                            </div>
                                          )}
                                          {details.geolocation && (
                                            <div className="p-3 border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-neutral-900">
                                              <h4 className="text-xs font-medium text-zinc-900 dark:text-zinc-100 mb-2">Location</h4>
                                              <div className="text-xs text-zinc-500 dark:text-zinc-400">
                                                <p>{details.geolocation.city}, {details.geolocation.country}</p>
                                              </div>
                                            </div>
                                          )}
                                        </div>

                                        <div className="border-t border-zinc-200 dark:border-zinc-700 pt-4">
                                          <h4 className="text-xs font-medium text-zinc-900 dark:text-zinc-100 mb-3">Technical Details</h4>
                                          <div className="space-y-2">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                              <div className="flex items-center justify-between p-2.5 bg-white dark:bg-neutral-900 border border-zinc-200 dark:border-zinc-700 rounded-lg">
                                                <div className="flex items-center gap-2 min-w-0">
                                                  <span className="text-xs text-zinc-500 dark:text-zinc-400 shrink-0">TX Hash:</span>
                                                  <a 
                                                    href={`https://subnets.avax.network/p-chain/tx/${details.txHash}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="inline-flex items-center gap-1 font-mono text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors truncate"
                                                  >
                                                    {truncateString(details.txHash, 12, 8)}
                                                    <ArrowUpRight className="h-3 w-3 shrink-0" />
                                                  </a>
                                                </div>
                                                <button 
                                                  onClick={(e) => { e.stopPropagation(); copyDetailsToClipboard(details.txHash, `tx-${validator.nodeId}`); }}
                                                  className="h-6 w-6 p-0 flex items-center justify-center hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded transition-colors shrink-0"
                                                >
                                                  {detailsCopiedId === `tx-${validator.nodeId}` ? (
                                                    <Check className="h-3 w-3 text-emerald-500" />
                                                  ) : (
                                                    <Copy className="h-3 w-3 text-zinc-400" />
                                                  )}
                                                </button>
                                              </div>
                                              {details.potentialRewards?.rewardAddresses?.[0] && (
                                                <div className="flex items-center justify-between p-2.5 bg-white dark:bg-neutral-900 border border-zinc-200 dark:border-zinc-700 rounded-lg">
                                                  <div className="flex items-center gap-2 min-w-0">
                                                    <span className="text-xs text-zinc-500 dark:text-zinc-400 shrink-0">Payout Address:</span>
                                                    <a 
                                                      href={`https://subnets.avax.network/p-chain/address/${details.potentialRewards.rewardAddresses[0]}`}
                                                      target="_blank"
                                                      rel="noopener noreferrer"
                                                      onClick={(e) => e.stopPropagation()}
                                                      className="inline-flex items-center gap-1 font-mono text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors truncate"
                                                    >
                                                      {truncateString(details.potentialRewards.rewardAddresses[0], 10, 8)}
                                                      <ArrowUpRight className="h-3 w-3 shrink-0" />
                                                    </a>
                                                  </div>
                                                  <button 
                                                    onClick={(e) => { e.stopPropagation(); copyDetailsToClipboard(details.potentialRewards!.rewardAddresses[0], `payout-${validator.nodeId}`); }}
                                                    className="h-6 w-6 p-0 flex items-center justify-center hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded transition-colors shrink-0"
                                                  >
                                                    {detailsCopiedId === `payout-${validator.nodeId}` ? (
                                                      <Check className="h-3 w-3 text-emerald-500" />
                                                    ) : (
                                                      <Copy className="h-3 w-3 text-zinc-400" />
                                                    )}
                                                  </button>
                                                </div>
                                              )}
                                            </div>
                                            {(details.blsCredentials?.publicKey || details.blsCredentials?.proofOfPossession) && (
                                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                                {details.blsCredentials?.publicKey && (
                                                  <div className="flex items-center justify-between p-2.5 bg-white dark:bg-neutral-900 border border-zinc-200 dark:border-zinc-700 rounded-lg">
                                                    <div className="flex items-center gap-2 min-w-0">
                                                      <span className="text-xs text-zinc-500 dark:text-zinc-400 shrink-0">BLS Key:</span>
                                                      <span className="font-mono text-xs text-zinc-700 dark:text-zinc-300 truncate">{truncateString(details.blsCredentials.publicKey, 12, 8)}</span>
                                                    </div>
                                                    <button 
                                                      onClick={(e) => { e.stopPropagation(); copyDetailsToClipboard(details.blsCredentials!.publicKey, `bls-${validator.nodeId}`); }}
                                                      className="h-6 w-6 p-0 flex items-center justify-center hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded transition-colors shrink-0"
                                                    >
                                                      {detailsCopiedId === `bls-${validator.nodeId}` ? (
                                                        <Check className="h-3 w-3 text-emerald-500" />
                                                      ) : (
                                                        <Copy className="h-3 w-3 text-zinc-400" />
                                                      )}
                                                    </button>
                                                  </div>
                                                )}
                                                {details.blsCredentials?.proofOfPossession && (
                                                  <div className="flex items-center justify-between p-2.5 bg-white dark:bg-neutral-900 border border-zinc-200 dark:border-zinc-700 rounded-lg">
                                                    <div className="flex items-center gap-2 min-w-0">
                                                      <span className="text-xs text-zinc-500 dark:text-zinc-400 shrink-0">BLS Signature:</span>
                                                      <span className="font-mono text-xs text-zinc-700 dark:text-zinc-300 truncate">{truncateString(details.blsCredentials.proofOfPossession, 12, 8)}</span>
                                                    </div>
                                                    <button 
                                                      onClick={(e) => { e.stopPropagation(); copyDetailsToClipboard(details.blsCredentials!.proofOfPossession, `blssig-${validator.nodeId}`); }}
                                                      className="h-6 w-6 p-0 flex items-center justify-center hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded transition-colors shrink-0"
                                                    >
                                                      {detailsCopiedId === `blssig-${validator.nodeId}` ? (
                                                        <Check className="h-3 w-3 text-emerald-500" />
                                                      ) : (
                                                        <Copy className="h-3 w-3 text-zinc-400" />
                                                      )}
                                                    </button>
                                                  </div>
                                                )}
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      </>
                                    ) : (
                                      <div className="flex items-center justify-center py-8">
                                        <span className="text-sm text-zinc-500">Unable to load validator details</span>
                                      </div>
                                    )}
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })
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
                    Load More ({sortedValidators.length - displayCount}{" "}
                    remaining)
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      </main>

      {/* Bubble Navigation */}
      <L1BubbleNav
        chainSlug="c-chain"
        themeColor="#E57373"
        rpcUrl="https://api.avax.network/ext/bc/C/rpc"
      />
    </div>
  );
}

function ValidatorChartCard({
  config,
  rawData,
  period,
  currentValue,
  onPeriodChange,
  formatTooltipValue,
  formatYAxisValue,
}: {
  config: any;
  rawData: any[];
  period: "D" | "W" | "M" | "Q" | "Y";
  currentValue: number | string;
  onPeriodChange: (period: "D" | "W" | "M" | "Q" | "Y") => void;
  formatTooltipValue: (value: number) => string;
  formatYAxisValue: (value: number) => string;
}) {
  const [brushIndexes, setBrushIndexes] = useState<{
    startIndex: number;
    endIndex: number;
  } | null>(null);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const { resolvedTheme } = useTheme();
  const handleScreenshot = async () => {
    if (!chartContainerRef.current) return;

    try {
      const element = chartContainerRef.current;
      const bgColor = resolvedTheme === "dark" ? "#0a0a0a" : "#ffffff";

      const dataUrl = await toPng(element, {
        quality: 1,
        pixelRatio: 2,
        backgroundColor: bgColor,
        cacheBust: true,
      });

      const link = document.createElement("a");
      link.download = `${config.title.replace(/\s+/g, "_")}_${period}_${new Date().toISOString().split("T")[0]}.png`;
      link.href = dataUrl;
      link.click();
    } catch (error) {
      console.error("Failed to capture screenshot:", error);
    }
  };

  const aggregatedData = useMemo(() => {
    if (period === "D") return rawData;

    const grouped = new Map<
      string,
      { sum: number; count: number; date: string }
    >();

    rawData.forEach((point) => {
      const date = new Date(point.day);
      let key: string;

      if (period === "W") {
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        key = weekStart.toISOString().split("T")[0];
      } else if (period === "M") {
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
          2,
          "0"
        )}`;
      } else if (period === "Q") {
        const quarter = Math.floor(date.getMonth() / 3) + 1;
        key = `${date.getFullYear()}-Q${quarter}`;
      } else {
        key = String(date.getFullYear());
      }

      if (!grouped.has(key)) {
        grouped.set(key, { sum: 0, count: 0, date: key });
      }

      const group = grouped.get(key)!;
      group.sum += point.value;
      group.count += 1;
    });

    return Array.from(grouped.values())
      .map((group) => ({
        day: group.date,
        value: group.sum / group.count,
      }))
      .sort((a, b) => a.day.localeCompare(b.day));
  }, [rawData, period]);

  useEffect(() => {
    if (aggregatedData.length === 0) return;

    if (period === "D") {
      const daysToShow = 90;
      setBrushIndexes({
        startIndex: Math.max(0, aggregatedData.length - daysToShow),
        endIndex: aggregatedData.length - 1,
      });
    } else {
      setBrushIndexes({
        startIndex: 0,
        endIndex: aggregatedData.length - 1,
      });
    }
  }, [period, aggregatedData.length]);

  const displayData = brushIndexes
    ? aggregatedData.slice(brushIndexes.startIndex, brushIndexes.endIndex + 1)
    : aggregatedData;
  const dynamicChange = useMemo(() => {
    if (!displayData || displayData.length < 2) {
      return { change: 0, isPositive: true };
    }
    const firstValue = displayData[0].value;
    const lastValue = displayData[displayData.length - 1].value;
    if (lastValue === 0) {
      return { change: 0, isPositive: true };
    }
    const changePercentage = ((lastValue - firstValue) / firstValue) * 100;
    return {
      change: Math.abs(changePercentage),
      isPositive: changePercentage >= 0,
    };
  }, [displayData]);

  // CSV download function
  const downloadCSV = () => {
    if (!displayData || displayData.length === 0) return;

    const headers = ["Date", config.title];
    const rows = displayData.map((point: any) => [point.day, point.value].join(","));

    const csvContent = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${config.title.replace(/\s+/g, "_")}_${period}_${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const formatXAxis = (value: string) => {
    if (period === "Q") {
      const parts = value.split("-");
      if (parts.length === 2) {
        return `${parts[1]} '${parts[0].slice(-2)}`;
      }
      return value;
    }
    if (period === "Y") return value;
    const date = new Date(value);
    if (period === "M") {
      return date.toLocaleDateString("en-US", {
        month: "short",
        year: "2-digit",
      });
    }
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const formatBrushXAxis = (value: string) => {
    if (period === "Q") {
      const parts = value.split("-");
      if (parts.length === 2) {
        return `${parts[1]} ${parts[0]}`;
      }
      return value;
    }
    if (period === "Y") return value;
    const date = new Date(value);
    return date.toLocaleDateString("en-US", {
      month: "short",
      year: "numeric",
    });
  };

  const formatTooltipDate = (value: string) => {
    if (period === "Y") {
      return value;
    }

    if (period === "Q") {
      const parts = value.split("-");
      if (parts.length === 2) {
        return `${parts[1]} ${parts[0]}`;
      }
      return value;
    }

    const date = new Date(value);

    if (period === "M") {
      return date.toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      });
    }

    if (period === "W") {
      const endDate = new Date(date);
      endDate.setDate(date.getDate() + 6);
      const startMonth = date.toLocaleDateString("en-US", { month: "long" });
      const endMonth = endDate.toLocaleDateString("en-US", { month: "long" });
      const startDay = date.getDate();
      const endDay = endDate.getDate();
      const year = endDate.getFullYear();

      if (startMonth === endMonth) {
        return `${startMonth} ${startDay}-${endDay}, ${year}`;
      } else {
        return `${startMonth} ${startDay} - ${endMonth} ${endDay}, ${year}`;
      }
    }

    return date.toLocaleDateString("en-US", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  const Icon = config.icon;

  return (
    <Card className="py-0 border-gray-200 rounded-md dark:border-gray-700" ref={chartContainerRef}>
      <CardContent className="p-0">
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 sm:py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 sm:gap-3">
            <div
              className="rounded-full p-2 sm:p-3 flex items-center justify-center"
              style={{ backgroundColor: `${config.color}20` }}
            >
              <Icon
                className="h-5 w-5 sm:h-6 sm:w-6"
                style={{ color: config.color }}
              />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-normal">
                {config.title}
              </h3>
              <p className="text-xs sm:text-sm text-muted-foreground hidden sm:block">
                {config.description}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Select
              value={period}
              onValueChange={(value) =>
                onPeriodChange(value as "D" | "W" | "M" | "Q" | "Y")
              }
            >
              <SelectTrigger className="h-7 w-auto px-2 gap-1 text-xs sm:text-sm border-0 bg-transparent hover:bg-muted focus:ring-0 shadow-none">
                <SelectValue>
                  {period === "D" ? "Daily" : period === "W" ? "Weekly" : period === "M" ? "Monthly" : period === "Q" ? "Quarterly" : "Yearly"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {(["D", "W", "M", "Q", "Y"] as const).map((p) => (
                  <SelectItem key={p} value={p}>
                    {p === "D" ? "Daily" : p === "W" ? "Weekly" : p === "M" ? "Monthly" : p === "Q" ? "Quarterly" : "Yearly"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <button
              onClick={handleScreenshot}
              className="p-1.5 sm:p-2 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
              title="Download chart as image"
            >
              <Camera className="h-4 w-4" />
            </button>
            <button
              onClick={downloadCSV}
              className="p-1.5 sm:p-2 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
              title="Download CSV"
            >
              <Download className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="px-5 pt-6 pb-6">
          {/* Current Value and Change */}
          <div className="flex items-center gap-2 sm:gap-4 mb-3 sm:mb-4 pl-2 sm:pl-4">
            <div className="text-md sm:text-xl font-mono break-all">
              {formatTooltipValue(
                typeof currentValue === "string"
                  ? parseFloat(currentValue)
                  : currentValue
              )}
            </div>
            {dynamicChange.change > 0 && (
              <div
                className={`flex items-center gap-1 text-xs sm:text-sm ${
                  dynamicChange.isPositive ? "text-green-600" : "text-red-600"
                }`}
                title={`Change over selected time range`}
              >
                <TrendingUp
                  className={`h-3 w-3 sm:h-4 sm:w-4 ${
                    dynamicChange.isPositive ? "" : "rotate-180"
                  }`}
                />
                {dynamicChange.change.toFixed(1)}%
              </div>
            )}
          </div>

          <ChartWatermark className="mb-6">
            <ResponsiveContainer width="100%" height={350}>
              {config.chartType === "bar" ? (
                <BarChart
                  data={displayData}
                  margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    className="stroke-gray-200 dark:stroke-gray-700"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="day"
                    tickFormatter={formatXAxis}
                    className="text-xs text-gray-600 dark:text-gray-400"
                    tick={{ className: "fill-gray-600 dark:fill-gray-400" }}
                    minTickGap={80}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tickFormatter={formatYAxisValue}
                    className="text-xs text-gray-600 dark:text-gray-400"
                    tick={{ className: "fill-gray-600 dark:fill-gray-400" }}
                  />
                  <Tooltip
                    cursor={{ fill: `${config.color}20` }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.[0]) return null;
                      const formattedDate = formatTooltipDate(
                        payload[0].payload.day
                      );
                      return (
                        <div className="rounded-lg border bg-background p-2 shadow-sm font-mono">
                          <div className="grid gap-2">
                            <div className="font-medium text-sm">
                              {formattedDate}
                            </div>
                            <div className="text-sm">
                              {formatTooltipValue(payload[0].value as number)}
                            </div>
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Bar
                    dataKey="value"
                    fill={config.color}
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              ) : (
                <AreaChart
                  data={displayData}
                  margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient
                      id={`gradient-${config.metricKey}`}
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="5%"
                        stopColor={config.color}
                        stopOpacity={0.3}
                      />
                      <stop
                        offset="95%"
                        stopColor={config.color}
                        stopOpacity={0}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    className="stroke-gray-200 dark:stroke-gray-700"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="day"
                    tickFormatter={formatXAxis}
                    className="text-xs text-gray-600 dark:text-gray-400"
                    tick={{ className: "fill-gray-600 dark:fill-gray-400" }}
                    minTickGap={80}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tickFormatter={formatYAxisValue}
                    className="text-xs text-gray-600 dark:text-gray-400"
                    tick={{ className: "fill-gray-600 dark:fill-gray-400" }}
                  />
                  <Tooltip
                    cursor={{ fill: `${config.color}20` }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.[0]) return null;
                      const formattedDate = formatTooltipDate(
                        payload[0].payload.day
                      );
                      return (
                        <div className="rounded-lg border bg-background p-2 shadow-sm font-mono">
                          <div className="grid gap-2">
                            <div className="font-medium text-sm">
                              {formattedDate}
                            </div>
                            <div className="text-sm">
                              {formatTooltipValue(payload[0].value as number)}
                            </div>
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke={config.color}
                    fill={`url(#gradient-${config.metricKey})`}
                    strokeWidth={2}
                  />
                </AreaChart>
              )}
            </ResponsiveContainer>
          </ChartWatermark>

          {/* Brush Slider */}
          <div className="mt-4 bg-white dark:bg-black pl-[60px]">
            <ResponsiveContainer width="100%" height={80}>
              <LineChart
                data={aggregatedData}
                margin={{ top: 0, right: 30, left: 0, bottom: 5 }}
              >
                <Brush
                  dataKey="day"
                  height={80}
                  stroke={config.color}
                  fill={`${config.color}20`}
                  alwaysShowText={false}
                  startIndex={brushIndexes?.startIndex ?? 0}
                  endIndex={brushIndexes?.endIndex ?? aggregatedData.length - 1}
                  onChange={(e: any) => {
                    if (
                      e.startIndex !== undefined &&
                      e.endIndex !== undefined
                    ) {
                      setBrushIndexes({
                        startIndex: e.startIndex,
                        endIndex: e.endIndex,
                      });
                    }
                  }}
                  travellerWidth={8}
                  tickFormatter={formatBrushXAxis}
                >
                  <LineChart>
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke={config.color}
                      strokeWidth={1}
                      dot={false}
                    />
                  </LineChart>
                </Brush>
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Daily Rewards Chart Card with 30-day moving average and total
function DailyRewardsChartCard({
  data,
  cumulativeData,
  currentValue,
  cumulativeCurrentValue,
  color,
  period,
  onPeriodChange,
}: {
  data: { day: string; value: number }[];
  cumulativeData: { day: string; value: number }[];
  currentValue: number | string;
  cumulativeCurrentValue: number | string;
  color: string;
  period: "D" | "W" | "M" | "Q" | "Y";
  onPeriodChange: (period: "D" | "W" | "M" | "Q" | "Y") => void;
}) {
  const [brushIndexes, setBrushIndexes] = useState<{
    startIndex: number;
    endIndex: number;
  } | null>(null);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const { resolvedTheme } = useTheme();
  const handleScreenshot = async () => {
    if (!chartContainerRef.current) return;

    try {
      const element = chartContainerRef.current;
      const bgColor = resolvedTheme === "dark" ? "#0a0a0a" : "#ffffff";

      const dataUrl = await toPng(element, {
        quality: 1,
        pixelRatio: 2,
        backgroundColor: bgColor,
        cacheBust: true,
      });

      const link = document.createElement("a");
      link.download = `Daily_Rewards_${period}_${new Date().toISOString().split("T")[0]}.png`;
      link.href = dataUrl;
      link.click();
    } catch (error) {
      console.error("Failed to capture screenshot:", error);
    }
  };

  // Create a map of cumulative data for quick lookup
  const cumulativeMap = useMemo(() => {
    return new Map(cumulativeData.map(point => [point.day, point.value]));
  }, [cumulativeData]);

  // Get moving average window size and label based on period (using shared utility)
  const maConfig = useMemo(() => getMAConfig(period), [period]);

  // Aggregate data by period first
  const aggregatedBaseData = useMemo(() => {
    if (!data || data.length === 0) return [];
    
    const filteredData = data.filter(point => point.day && !isNaN(point.value));
    
    if (period === "D") {
      return filteredData.map(point => ({
        day: point.day,
        value: point.value,
        cumulative: cumulativeMap.get(point.day) || 0,
      }));
    }

    const grouped = new Map<string, { sum: number; cumulativeMax: number; count: number; date: string }>();

    filteredData.forEach((point) => {
      const date = new Date(point.day);
      let key: string;

      if (period === "W") {
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        key = weekStart.toISOString().split("T")[0];
      } else if (period === "M") {
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      } else if (period === "Q") {
        const quarter = Math.floor(date.getMonth() / 3) + 1;
        key = `${date.getFullYear()}-Q${quarter}`;
      } else {
        key = String(date.getFullYear());
      }

      if (!grouped.has(key)) {
        grouped.set(key, { sum: 0, cumulativeMax: 0, count: 0, date: key });
      }

      const group = grouped.get(key)!;
      group.sum += point.value;
      group.cumulativeMax = Math.max(group.cumulativeMax, cumulativeMap.get(point.day) || 0);
      group.count += 1;
    });

    return Array.from(grouped.values())
      .map((group) => ({
        day: group.date,
        value: group.sum,
        cumulative: group.cumulativeMax,
      }))
      .sort((a, b) => a.day.localeCompare(b.day));
  }, [data, cumulativeMap, period]);

  // Calculate moving average based on period-appropriate window
  const aggregatedData = useMemo(() => {
    if (aggregatedBaseData.length === 0) return [];
    
    return aggregatedBaseData.map((point, index) => {
      // Get up to N previous periods including current
      const startIdx = Math.max(0, index - (maConfig.window - 1));
      const slice = aggregatedBaseData.slice(startIdx, index + 1);
      const sum = slice.reduce((acc, p) => acc + p.value, 0);
      const ma = sum / slice.length;
      return {
        ...point,
        ma: isNaN(ma) ? 0 : ma,
      };
    });
  }, [aggregatedBaseData, maConfig.window]);

  // Initialize brush
  useEffect(() => {
    if (!aggregatedData || aggregatedData.length === 0) {
      setBrushIndexes(null);
      return;
    }

    if (period === "D") {
      const daysToShow = 90;
      setBrushIndexes({
        startIndex: Math.max(0, aggregatedData.length - daysToShow),
        endIndex: aggregatedData.length - 1,
      });
    } else {
      setBrushIndexes({
        startIndex: 0,
        endIndex: aggregatedData.length - 1,
      });
    }
  }, [period, aggregatedData]);

  const displayData = useMemo(() => {
    if (!brushIndexes || !aggregatedData || aggregatedData.length === 0) return [];
    const start = Math.max(0, Math.min(brushIndexes.startIndex, aggregatedData.length - 1));
    const end = Math.max(0, Math.min(brushIndexes.endIndex, aggregatedData.length - 1));
    if (start > end) return [];
    return aggregatedData.slice(start, end + 1);
  }, [brushIndexes, aggregatedData]);

  // Calculate current moving average
  const currentMA = useMemo(() => {
    if (!aggregatedData || aggregatedData.length === 0) return 0;
    return aggregatedData[aggregatedData.length - 1].ma;
  }, [aggregatedData]);

  // Calculate change from previous day
  const dailyChange = useMemo(() => {
    if (!data || data.length < 2) return { change: 0, isPositive: true };
    const current = data[data.length - 1].value;
    const previous = data[data.length - 2].value;
    if (!previous || previous === 0 || isNaN(previous)) return { change: 0, isPositive: true };
    const changePercent = ((current - previous) / previous) * 100;
    if (isNaN(changePercent)) return { change: 0, isPositive: true };
    return {
      change: Math.abs(changePercent),
      isPositive: changePercent >= 0,
    };
  }, [data]);

  // CSV download function
  const downloadCSV = () => {
    if (!displayData || displayData.length === 0) return;

    const headers = ["Date", "Daily Rewards (AVAX)", "Moving Average (AVAX)"];
    const rows = displayData.map((point: any) => 
      [point.day, point.value, point.ma || ""].join(",")
    );

    const csvContent = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Daily_Rewards_${period}_${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const formatValue = (value: number): string => {
    if (value >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
    if (value >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
    if (value >= 1e3) return `${(value / 1e3).toFixed(2)}K`;
    return value.toFixed(2);
  };

  const formatXAxis = (value: string) => {
    if (period === "Q") {
      const parts = value.split("-");
      if (parts.length === 2) return `${parts[1]} '${parts[0].slice(-2)}`;
      return value;
    }
    if (period === "Y") return value;
    const date = new Date(value);
    if (period === "M") {
      return date.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
    }
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const formatTooltipDate = (value: string) => {
    if (period === "Y") return value;
    if (period === "Q") {
      const parts = value.split("-");
      if (parts.length === 2) return `${parts[1]} ${parts[0]}`;
      return value;
    }
    const date = new Date(value);
    if (period === "M") {
      return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    }
    if (period === "W") {
      const endDate = new Date(date);
      endDate.setDate(date.getDate() + 6);
      return `${date.toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${endDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
    }
    return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
  };

  const formatBrushXAxis = (value: string) => {
    if (period === "Q" || period === "Y") return value;
    const date = new Date(value);
    return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
  };

  return (
    <Card className="py-0 border-gray-200 rounded-md dark:border-gray-700" ref={chartContainerRef}>
      <CardContent className="p-0">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 sm:py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 sm:gap-3">
            <div
              className="rounded-full p-2 sm:p-3 flex items-center justify-center"
              style={{ backgroundColor: `${color}20` }}
            >
              <Coins className="h-5 w-5 sm:h-6 sm:w-6" style={{ color }} />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-normal">Daily Rewards</h3>
              <p className="text-xs sm:text-sm text-muted-foreground hidden sm:block">
                Daily staking and delegation rewards with 30-day moving average
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Select
              value={period}
              onValueChange={(value) =>
                onPeriodChange(value as "D" | "W" | "M" | "Q" | "Y")
              }
            >
              <SelectTrigger className="h-7 w-auto px-2 gap-1 text-xs sm:text-sm border-0 bg-transparent hover:bg-muted focus:ring-0 shadow-none">
                <SelectValue>
                  {period === "D" ? "Daily" : period === "W" ? "Weekly" : period === "M" ? "Monthly" : period === "Q" ? "Quarterly" : "Yearly"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {(["D", "W", "M", "Q", "Y"] as const).map((p) => (
                  <SelectItem key={p} value={p}>
                    {p === "D" ? "Daily": p === "W" ? "Weekly" : p === "M" ? "Monthly" : p === "Q" ? "Quarterly" : "Yearly"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <button
              onClick={handleScreenshot}
              className="p-1.5 sm:p-2 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
              title="Download chart as image"
            >
              <Camera className="h-4 w-4" />
            </button>
            <button
              onClick={downloadCSV}
              className="p-1.5 sm:p-2 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
              title="Download CSV"
            >
              <Download className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="px-5 pt-6 pb-6">
          {/* Current Values and Legend */}
          <div className="flex items-center gap-2 sm:gap-4 mb-3 sm:mb-4 pl-2 sm:pl-4 flex-wrap">
            <div className="text-md sm:text-base font-mono">
              {formatValue(typeof currentValue === 'string' ? parseFloat(currentValue) : currentValue)} AVAX
            </div>
            {dailyChange.change > 0 && (
              <div
                className={`flex items-center gap-1 text-xs sm:text-sm ${
                  dailyChange.isPositive ? "text-green-600" : "text-red-600"
                }`}
                title="Change from previous day"
              >
                <TrendingUp
                  className={`h-3 w-3 sm:h-4 sm:w-4 ${
                    dailyChange.isPositive ? "" : "rotate-180"
                  }`}
                />
                {dailyChange.change >= 1000
                  ? `${(dailyChange.change / 1000).toFixed(1)}K%`
                  : `${dailyChange.change.toFixed(1)}%`}
              </div>
            )}
            <div className="flex items-center gap-3 ml-auto text-xs">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded" style={{ backgroundColor: color }} />
                <span className="text-muted-foreground">
                  {period === "D" ? "Daily" : period === "W" ? "Weekly" : period === "M" ? "Monthly" : period === "Q" ? "Quarterly" : "Yearly"}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-0.5" style={{ backgroundColor: "#22c55e" }} />
                <span style={{ color: "#22c55e" }}>{maConfig.label}</span>
              </div>
            </div>
          </div>

          {/* Chart */}
          <ChartWatermark className="mb-6">
            {displayData.length > 0 ? (
              <ResponsiveContainer width="100%" height={350}>
                <ComposedChart data={displayData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    className="stroke-gray-200 dark:stroke-gray-700"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="day"
                    tickFormatter={formatXAxis}
                    className="text-xs text-gray-600 dark:text-gray-400"
                    tick={{ className: "fill-gray-600 dark:fill-gray-400" }}
                    minTickGap={80}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    yAxisId="left"
                    tickFormatter={formatValue}
                    className="text-xs text-gray-600 dark:text-gray-400"
                    tick={{ className: "fill-gray-600 dark:fill-gray-400" }}
                  />
                  <Tooltip
                    cursor={{ fill: `${color}20` }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.[0]) return null;
                      return (
                        <div className="rounded-lg border bg-background p-2 shadow-sm font-mono">
                          <div className="grid gap-2">
                            <div className="font-medium text-sm">
                              {formatTooltipDate(payload[0].payload.day)}
                            </div>
                            <div className="text-xs">
                              {period === "D" ? "Daily" : period === "W" ? "Weekly" : period === "M" ? "Monthly" : period === "Q" ? "Quarterly" : "Yearly"}:{" "}
                              {formatValue(payload[0].payload.value)} AVAX
                            </div>
                            <div className="text-xs" style={{ color: "#22c55e" }}>
                              {maConfig.label}: {formatValue(payload[0].payload.ma)} AVAX
                            </div>
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Bar
                    dataKey="value"
                    fill={color}
                    radius={[4, 4, 0, 0]}
                    yAxisId="left"
                    name="Daily Rewards"
                  />
                  <Line
                    type="monotone"
                    dataKey="ma"
                    stroke="#22c55e"
                    strokeWidth={2}
                    dot={false}
                    yAxisId="left"
                    name="Moving Average"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[350px] flex items-center justify-center text-muted-foreground">
                Loading chart data...
              </div>
            )}
          </ChartWatermark>

          {/* Brush Slider */}
          {aggregatedData.length > 0 && brushIndexes && 
           !isNaN(brushIndexes.startIndex) && !isNaN(brushIndexes.endIndex) &&
           brushIndexes.startIndex >= 0 && brushIndexes.endIndex < aggregatedData.length && (
            <div className="bg-white dark:bg-black pl-[60px]">
              <ResponsiveContainer width="100%" height={80}>
                <LineChart data={aggregatedData} margin={{ top: 0, right: 30, left: 0, bottom: 5 }}>
                  <Brush
                    dataKey="day"
                    height={80}
                    stroke={color}
                    fill={`${color}20`}
                    alwaysShowText={false}
                    startIndex={brushIndexes.startIndex}
                    endIndex={brushIndexes.endIndex}
                    onChange={(e: any) => {
                      if (e.startIndex !== undefined && e.endIndex !== undefined &&
                          !isNaN(e.startIndex) && !isNaN(e.endIndex)) {
                        setBrushIndexes({ startIndex: e.startIndex, endIndex: e.endIndex });
                      }
                    }}
                    travellerWidth={8}
                    tickFormatter={formatBrushXAxis}
                  >
                    <LineChart>
                      <Line type="monotone" dataKey="value" stroke={color} strokeWidth={1} dot={false} />
                    </LineChart>
                  </Brush>
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Historical Staking APY Chart Card
function StakingAPYChartCard({
  data,
  currentMaxAPY,
  currentMinAPY,
  period,
  onPeriodChange,
  isLoading = false,
}: {
  data?: { date: string; timestamp: number; supply: number; maxAPY: number; minAPY: number }[];
  currentMaxAPY?: number;
  currentMinAPY?: number;
  period: "D" | "W" | "M" | "Q" | "Y";
  onPeriodChange: (period: "D" | "W" | "M" | "Q" | "Y") => void;
  isLoading?: boolean;
}) {
  const [brushIndexes, setBrushIndexes] = useState<{
    startIndex: number;
    endIndex: number;
  } | null>(null);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const { resolvedTheme } = useTheme();

  const handleScreenshot = async () => {
    if (!chartContainerRef.current) return;
    try {
      const element = chartContainerRef.current;
      const bgColor = resolvedTheme === "dark" ? "#0a0a0a" : "#ffffff";
      const dataUrl = await toPng(element, {
        quality: 1,
        pixelRatio: 2,
        backgroundColor: bgColor,
        cacheBust: true,
      });
      const link = document.createElement("a");
      link.download = `Staking_APY_${period}_${new Date().toISOString().split("T")[0]}.png`;
      link.href = dataUrl;
      link.click();
    } catch (error) {
      console.error("Failed to capture screenshot:", error);
    }
  };

  // Transform data to chart format
  const chartData = useMemo(() => {
    if (!data) return [];
    return data.map((point) => ({
      day: point.date,
      maxAPY: point.maxAPY,
      minAPY: point.minAPY,
    }));
  }, [data]);

  // Aggregate data by period
  const aggregatedData = useMemo(() => {
    if (period === "D") return chartData;

    const grouped = new Map<string, { avgMaxAPY: number; avgMinAPY: number; count: number; date: string }>();

    chartData.forEach((point) => {
      const date = new Date(point.day);
      let key: string;

      if (period === "W") {
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        key = weekStart.toISOString().split("T")[0];
      } else if (period === "M") {
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      } else if (period === "Q") {
        const quarter = Math.floor(date.getMonth() / 3) + 1;
        key = `${date.getFullYear()}-Q${quarter}`;
      } else {
        key = String(date.getFullYear());
      }

      if (!grouped.has(key)) {
        grouped.set(key, { avgMaxAPY: 0, avgMinAPY: 0, count: 0, date: key });
      }

      const group = grouped.get(key)!;
      group.avgMaxAPY += point.maxAPY;
      group.avgMinAPY += point.minAPY;
      group.count++;
    });

    return Array.from(grouped.values())
      .map((group) => ({
        day: group.date,
        maxAPY: group.avgMaxAPY / group.count,
        minAPY: group.avgMinAPY / group.count,
      }))
      .sort((a, b) => a.day.localeCompare(b.day));
  }, [chartData, period]);

  // Initialize brush
  useEffect(() => {
    if (!aggregatedData || aggregatedData.length === 0) {
      setBrushIndexes(null);
      return;
    }

    if (period === "D") {
      const daysToShow = 90;
      setBrushIndexes({
        startIndex: Math.max(0, aggregatedData.length - daysToShow),
        endIndex: aggregatedData.length - 1,
      });
    } else {
      setBrushIndexes({
        startIndex: 0,
        endIndex: aggregatedData.length - 1,
      });
    }
  }, [period, aggregatedData]);

  const displayData = useMemo(() => {
    if (!brushIndexes || !aggregatedData || aggregatedData.length === 0) return [];
    const start = Math.max(0, Math.min(brushIndexes.startIndex, aggregatedData.length - 1));
    const end = Math.max(0, Math.min(brushIndexes.endIndex, aggregatedData.length - 1));
    if (start > end) return [];
    return aggregatedData.slice(start, end + 1);
  }, [brushIndexes, aggregatedData]);

  // CSV download function
  const downloadCSV = () => {
    if (!displayData || displayData.length === 0) return;

    const headers = ["Date", "Max APY (1 Year %)", "Min APY (2 Weeks %)"];
    const rows = displayData.map((point) => [point.day, point.maxAPY.toFixed(4), point.minAPY.toFixed(4)].join(","));

    const csvContent = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Staking_APY_${period}_${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const formatXAxis = (value: string) => {
    if (period === "Q") {
      const parts = value.split("-");
      if (parts.length === 2) return `${parts[1]} '${parts[0].slice(-2)}`;
      return value;
    }
    if (period === "Y") return value;
    const date = new Date(value);
    if (period === "M") {
      return date.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
    }
    if (period === "W") {
      return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" });
    }
    // Daily - include year
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" });
  };

  const formatTooltipDate = (value: string) => {
    if (period === "Y") return value;
    if (period === "Q") {
      const parts = value.split("-");
      if (parts.length === 2) return `${parts[1]} ${parts[0]}`;
      return value;
    }
    const date = new Date(value);
    if (period === "M") {
      return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    }
    if (period === "W") {
      const endDate = new Date(date);
      endDate.setDate(date.getDate() + 6);
      return `${date.toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${endDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
    }
    return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
  };

  const formatBrushXAxis = (value: string) => {
    if (period === "Q" || period === "Y") return value;
    const date = new Date(value);
    return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
  };

  const maxAPYColor = "#10B981"; // Emerald for max APY (1 year)
  const minAPYColor = "#3B82F6"; // Blue for min APY (2 weeks)

  return (
    <Card className="py-0 border-gray-200 rounded-md dark:border-gray-700" ref={chartContainerRef}>
      <CardContent className="p-0">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 sm:py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 sm:gap-3">
            <div
              className="rounded-full p-2 sm:p-3 flex items-center justify-center"
              style={{ backgroundColor: `${maxAPYColor}20` }}
            >
              <Percent className="h-5 w-5 sm:h-6 sm:w-6" style={{ color: maxAPYColor }} />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-normal">Historical Staking APY</h3>
              <p className="text-xs sm:text-sm text-muted-foreground hidden sm:block">
                Estimated APY based on staking duration and current supply
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Select
              value={period}
              onValueChange={(value) => onPeriodChange(value as "D" | "W" | "M" | "Q" | "Y")}
            >
              <SelectTrigger className="h-7 w-auto px-2 gap-1 text-xs sm:text-sm border-0 bg-transparent hover:bg-muted focus:ring-0 shadow-none">
                <SelectValue>
                  {period === "D" ? "Daily" : period === "W" ? "Weekly" : period === "M" ? "Monthly" : period === "Q" ? "Quarterly" : "Yearly"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {(["D", "W", "M", "Q", "Y"] as const).map((p) => (
                  <SelectItem key={p} value={p}>
                    {p === "D" ? "Daily" : p === "W" ? "Weekly" : p === "M" ? "Monthly" : p === "Q" ? "Quarterly" : "Yearly"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <button
              onClick={handleScreenshot}
              className="p-1.5 sm:p-2 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
              title="Download chart as image"
            >
              <Camera className="h-4 w-4" />
            </button>
            <button
              onClick={downloadCSV}
              className="p-1.5 sm:p-2 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
              title="Download CSV"
            >
              <Download className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="px-5 pt-6 pb-6">
          {/* Current Values */}
          <div className="flex items-center gap-4 sm:gap-8 mb-3 sm:mb-4 pl-2 sm:pl-4 flex-wrap">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: maxAPYColor }} />
              <span className="text-sm text-muted-foreground">Max (1 Year):</span>
              {isLoading ? (
                <div className="h-4 w-14 bg-muted animate-pulse rounded" />
              ) : (
                <span className="text-md font-mono">{(currentMaxAPY ?? 0).toFixed(2)}%</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: minAPYColor }} />
              <span className="text-sm text-muted-foreground">Min (2 Weeks):</span>
              {isLoading ? (
                <div className="h-4 w-14 bg-muted animate-pulse rounded" />
              ) : (
                <span className="text-md font-mono">{(currentMinAPY ?? 0).toFixed(2)}%</span>
              )}
            </div>
          </div>

          {/* Chart */}
          <ChartWatermark className="mb-6">
            {isLoading ? (
              <div className="h-[350px] flex flex-col items-center justify-center gap-4">
                <div className="relative w-full h-full">
                  <svg className="absolute inset-0 w-full h-full" viewBox="0 0 400 200" preserveAspectRatio="none">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <line key={`h-${i}`} x1="50" y1={30 + i * 35} x2="390" y2={30 + i * 35} className="stroke-muted" strokeWidth="0.5" strokeDasharray="4 4" />
                    ))}
                    <path d="M50,60 C100,65 150,70 200,80 C250,90 300,100 350,110 L390,115" fill="none" className="stroke-muted animate-pulse" strokeWidth="2" strokeLinecap="round" />
                    <path d="M50,90 C100,95 150,100 200,110 C250,120 300,130 350,140 L390,145" fill="none" className="stroke-muted animate-pulse" strokeWidth="2" strokeLinecap="round" style={{ animationDelay: '150ms' }} />
                  </svg>
                  <div className="absolute left-0 top-0 bottom-8 w-12 flex flex-col justify-between py-4">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="h-3 w-8 bg-muted animate-pulse rounded" style={{ animationDelay: `${i * 100}ms` }} />
                    ))}
                  </div>
                  <div className="absolute bottom-0 left-12 right-0 h-8 flex justify-between items-center px-4">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div key={i} className="h-3 w-12 bg-muted animate-pulse rounded" style={{ animationDelay: `${i * 80}ms` }} />
                    ))}
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="flex items-center gap-2 bg-background/80 px-4 py-2 rounded-lg shadow-sm border border-border/50">
                      <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      <span className="text-sm text-muted-foreground">Loading APY data...</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : displayData.length > 0 ? (
              <ResponsiveContainer width="100%" height={350}>
                <LineChart data={displayData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
                  <XAxis
                    dataKey="day"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    tickFormatter={formatXAxis}
                    className="text-xs"
                    tick={{ fontSize: 11 }}
                    interval="preserveStartEnd"
                    minTickGap={50}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => `${value.toFixed(1)}%`}
                    className="text-xs"
                    tick={{ fontSize: 11 }}
                    width={50}
                    domain={['auto', 'auto']}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const data = payload[0].payload;
                      return (
                        <div className="rounded-lg border bg-background p-3 shadow-lg">
                          <p className="font-medium text-sm mb-2">{formatTooltipDate(data.day)}</p>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: maxAPYColor }} />
                              <span className="text-xs text-muted-foreground">Max APY (1 Year):</span>
                              <span className="text-xs font-mono font-medium">{data.maxAPY.toFixed(2)}%</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: minAPYColor }} />
                              <span className="text-xs text-muted-foreground">Min APY (2 Weeks):</span>
                              <span className="text-xs font-mono font-medium">{data.minAPY.toFixed(2)}%</span>
                            </div>
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="maxAPY"
                    stroke={maxAPYColor}
                    strokeWidth={2}
                    dot={false}
                    name="Max APY (1 Year)"
                  />
                  <Line
                    type="monotone"
                    dataKey="minAPY"
                    stroke={minAPYColor}
                    strokeWidth={2}
                    dot={false}
                    name="Min APY (2 Weeks)"
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[350px] flex items-center justify-center text-muted-foreground">
                No data available
              </div>
            )}
          </ChartWatermark>

          {/* Brush Slider */}
          {!isLoading && aggregatedData.length > 0 && brushIndexes && 
           !isNaN(brushIndexes.startIndex) && !isNaN(brushIndexes.endIndex) &&
           brushIndexes.startIndex >= 0 && brushIndexes.endIndex < aggregatedData.length &&
           brushIndexes.startIndex <= brushIndexes.endIndex && (
            <div className="bg-white dark:bg-black pl-[60px]">
              <ResponsiveContainer width="100%" height={80}>
                <LineChart data={aggregatedData} margin={{ top: 0, right: 30, left: 0, bottom: 5 }}>
                  <Brush
                    dataKey="day"
                    height={80}
                    stroke={maxAPYColor}
                    fill={`${maxAPYColor}20`}
                    alwaysShowText={false}
                    startIndex={brushIndexes.startIndex}
                    endIndex={brushIndexes.endIndex}
                    onChange={(e: any) => {
                      if (e.startIndex !== undefined && e.endIndex !== undefined &&
                          !isNaN(e.startIndex) && !isNaN(e.endIndex) &&
                          e.startIndex <= e.endIndex) {
                        setBrushIndexes({ startIndex: e.startIndex, endIndex: e.endIndex });
                      }
                    }}
                    travellerWidth={8}
                    tickFormatter={formatBrushXAxis}
                  >
                    <LineChart>
                      <Line type="monotone" dataKey="maxAPY" stroke={maxAPYColor} strokeWidth={1} dot={false} />
                    </LineChart>
                  </Brush>
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Total Weight (Staked + Delegated) Stacked Area Chart
function TotalWeightStackedChartCard({
  validatorData,
  delegatorData,
  validatorCurrentValue,
  delegatorCurrentValue,
  color,
  period,
  onPeriodChange,
}: {
  validatorData: { day: string; value: number }[];
  delegatorData: { day: string; value: number }[];
  validatorCurrentValue: number | string;
  delegatorCurrentValue: number | string;
  color: string;
  period: "D" | "W" | "M" | "Q" | "Y";
  onPeriodChange: (period: "D" | "W" | "M" | "Q" | "Y") => void;
}) {
  const [brushIndexes, setBrushIndexes] = useState<{
    startIndex: number;
    endIndex: number;
  } | null>(null);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const { resolvedTheme } = useTheme();

  const handleScreenshot = async () => {
    if (!chartContainerRef.current) return;
    try {
      const element = chartContainerRef.current;
      const bgColor = resolvedTheme === "dark" ? "#0a0a0a" : "#ffffff";
      const dataUrl = await toPng(element, {
        quality: 1,
        pixelRatio: 2,
        backgroundColor: bgColor,
        cacheBust: true,
      });
      const link = document.createElement("a");
      link.download = `Primary_Network_Total_Stake_${period}_${new Date().toISOString().split("T")[0]}.png`;
      link.href = dataUrl;
      link.click();
    } catch (error) {
      console.error("Failed to capture screenshot:", error);
    }
  };

  // Merge validator and delegator data by date
  const mergedData = useMemo(() => {
    const dateMap = new Map<string, { staked: number; delegated: number }>();
    
    validatorData.forEach((point) => {
      if (!dateMap.has(point.day)) {
        dateMap.set(point.day, { staked: 0, delegated: 0 });
      }
      dateMap.get(point.day)!.staked = point.value;
    });
    
    delegatorData.forEach((point) => {
      if (!dateMap.has(point.day)) {
        dateMap.set(point.day, { staked: 0, delegated: 0 });
      }
      dateMap.get(point.day)!.delegated = point.value;
    });
    
    return Array.from(dateMap.entries())
      .map(([day, values]) => ({
        day,
        staked: values.staked,
        delegated: values.delegated,
        total: values.staked + values.delegated,
      }))
      .sort((a, b) => a.day.localeCompare(b.day));
  }, [validatorData, delegatorData]);

  // Aggregate data by period
  const aggregatedData = useMemo(() => {
    if (period === "D") return mergedData;

    const grouped = new Map<string, { stakedSum: number; delegatedSum: number; count: number; date: string }>();

    mergedData.forEach((point) => {
      const date = new Date(point.day);
      let key: string;

      if (period === "W") {
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        key = weekStart.toISOString().split("T")[0];
      } else if (period === "M") {
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      } else if (period === "Q") {
        const quarter = Math.floor(date.getMonth() / 3) + 1;
        key = `${date.getFullYear()}-Q${quarter}`;
      } else {
        key = String(date.getFullYear());
      }

      if (!grouped.has(key)) {
        grouped.set(key, { stakedSum: 0, delegatedSum: 0, count: 0, date: key });
      }

      const group = grouped.get(key)!;
      group.stakedSum += point.staked;
      group.delegatedSum += point.delegated;
      group.count += 1;
    });

    return Array.from(grouped.values())
      .map((group) => ({
        day: group.date,
        staked: group.stakedSum / group.count,
        delegated: group.delegatedSum / group.count,
        total: (group.stakedSum + group.delegatedSum) / group.count,
      }))
      .sort((a, b) => a.day.localeCompare(b.day));
  }, [mergedData, period]);

  // Initialize brush
  useEffect(() => {
    if (!aggregatedData || aggregatedData.length === 0) {
      setBrushIndexes(null);
      return;
    }

    if (period === "D") {
      const daysToShow = 90;
      setBrushIndexes({
        startIndex: Math.max(0, aggregatedData.length - daysToShow),
        endIndex: aggregatedData.length - 1,
      });
    } else {
      setBrushIndexes({
        startIndex: 0,
        endIndex: aggregatedData.length - 1,
      });
    }
  }, [period, aggregatedData]);

  const displayData = useMemo(() => {
    if (!brushIndexes || !aggregatedData || aggregatedData.length === 0) return [];
    const start = Math.max(0, Math.min(brushIndexes.startIndex, aggregatedData.length - 1));
    const end = Math.max(0, Math.min(brushIndexes.endIndex, aggregatedData.length - 1));
    if (start > end) return [];
    return aggregatedData.slice(start, end + 1);
  }, [brushIndexes, aggregatedData]);

  // Calculate total current value
  const totalCurrentValue = useMemo(() => {
    const staked = typeof validatorCurrentValue === 'string' ? parseFloat(validatorCurrentValue) : validatorCurrentValue;
    const delegated = typeof delegatorCurrentValue === 'string' ? parseFloat(delegatorCurrentValue) : delegatorCurrentValue;
    return staked + delegated;
  }, [validatorCurrentValue, delegatorCurrentValue]);

  // Calculate change over visible range
  const dynamicChange = useMemo(() => {
    if (!displayData || displayData.length < 2) {
      return { change: 0, isPositive: true };
    }
    const firstValue = displayData[0].total;
    const lastValue = displayData[displayData.length - 1].total;
    if (firstValue === 0) {
      return { change: 0, isPositive: true };
    }
    const changePercentage = ((lastValue - firstValue) / firstValue) * 100;
    return {
      change: Math.abs(changePercentage),
      isPositive: changePercentage >= 0,
    };
  }, [displayData]);

  // CSV download function
  const downloadCSV = () => {
    if (!displayData || displayData.length === 0) return;

    const headers = ["Date", "Staked (nAVAX)", "Delegated (nAVAX)", "Total (nAVAX)"];
    const rows = displayData.map((point) => 
      [point.day, point.staked, point.delegated, point.total].join(",")
    );

    const csvContent = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Primary_Network_Total_Stake_${period}_${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const formatWeight = (value: number): string => {
    const avaxValue = value / 1e9;
    if (avaxValue >= 1e12) return `${(avaxValue / 1e12).toFixed(2)}T`;
    if (avaxValue >= 1e9) return `${(avaxValue / 1e9).toFixed(2)}B`;
    if (avaxValue >= 1e6) return `${(avaxValue / 1e6).toFixed(2)}M`;
    if (avaxValue >= 1e3) return `${(avaxValue / 1e3).toFixed(2)}K`;
    return avaxValue.toFixed(2);
  };

  const formatWeightFull = (value: number): string => {
    const avaxValue = value / 1e9;
    if (avaxValue >= 1e12) return `${(avaxValue / 1e12).toFixed(2)}T AVAX`;
    if (avaxValue >= 1e9) return `${(avaxValue / 1e9).toFixed(2)}B AVAX`;
    if (avaxValue >= 1e6) return `${(avaxValue / 1e6).toFixed(2)}M AVAX`;
    if (avaxValue >= 1e3) return `${(avaxValue / 1e3).toFixed(2)}K AVAX`;
    return `${avaxValue.toFixed(2)} AVAX`;
  };

  const formatXAxis = (value: string) => {
    if (period === "Q") {
      const parts = value.split("-");
      if (parts.length === 2) return `${parts[1]} '${parts[0].slice(-2)}`;
      return value;
    }
    if (period === "Y") return value;
    const date = new Date(value);
    if (period === "M") {
      return date.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
    }
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const formatTooltipDate = (value: string) => {
    if (period === "Y") return value;
    if (period === "Q") {
      const parts = value.split("-");
      if (parts.length === 2) return `${parts[1]} ${parts[0]}`;
      return value;
    }
    const date = new Date(value);
    if (period === "M") {
      return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    }
    if (period === "W") {
      const endDate = new Date(date);
      endDate.setDate(date.getDate() + 6);
      return `${date.toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${endDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
    }
    return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
  };

  const formatBrushXAxis = (value: string) => {
    if (period === "Q" || period === "Y") return value;
    const date = new Date(value);
    return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
  };

  const stakedColor = color;
  const delegatedColor = "#60a5fa"; // Light blue for better contrast

  return (
    <Card className="py-0 border-gray-200 rounded-md dark:border-gray-700" ref={chartContainerRef}>
      <CardContent className="p-0">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 sm:py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 sm:gap-3">
            <div
              className="rounded-full p-2 sm:p-3 flex items-center justify-center"
              style={{ backgroundColor: `${color}20` }}
            >
              <Landmark className="h-5 w-5 sm:h-6 sm:w-6" style={{ color }} />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-normal">Primary Network Total Stake</h3>
              <p className="text-xs sm:text-sm text-muted-foreground hidden sm:block">
                Combined validator stake and delegated amounts
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Select
              value={period}
              onValueChange={(value) =>
                onPeriodChange(value as "D" | "W" | "M" | "Q" | "Y")
              }
            >
              <SelectTrigger className="h-7 w-auto px-2 gap-1 text-xs sm:text-sm border-0 bg-transparent hover:bg-muted focus:ring-0 shadow-none">
                <SelectValue>
                  {period === "D" ? "Daily" : period === "W" ? "Weekly" : period === "M" ? "Monthly" : period === "Q" ? "Quarterly" : "Yearly"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {(["D", "W", "M", "Q", "Y"] as const).map((p) => (
                  <SelectItem key={p} value={p}>
                    {p === "D" ? "Daily" : p === "W" ? "Weekly" : p === "M" ? "Monthly" : p === "Q" ? "Quarterly" : "Yearly"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <button
              onClick={handleScreenshot}
              className="p-1.5 sm:p-2 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
              title="Download chart as image"
            >
              <Camera className="h-4 w-4" />
            </button>
            <button
              onClick={downloadCSV}
              className="p-1.5 sm:p-2 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
              title="Download CSV"
            >
              <Download className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="px-5 pt-6 pb-6">
          {/* Current Value and Legend */}
          <div className="flex items-center gap-2 sm:gap-4 mb-3 sm:mb-4 pl-2 sm:pl-4 flex-wrap">
            <div className="text-md sm:text-xl font-mono">
              {formatWeightFull(totalCurrentValue)}
            </div>
            {dynamicChange.change > 0 && (
              <div
                className={`flex items-center gap-1 text-xs sm:text-sm ${
                  dynamicChange.isPositive ? "text-green-600" : "text-red-600"
                }`}
                title="Change over selected time range"
              >
                <TrendingUp
                  className={`h-3 w-3 sm:h-4 sm:w-4 ${
                    dynamicChange.isPositive ? "" : "rotate-180"
                  }`}
                />
                {dynamicChange.change.toFixed(1)}%
              </div>
            )}
            <div className="flex items-center gap-3 ml-auto text-xs">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded" style={{ backgroundColor: stakedColor }} />
                <span className="text-muted-foreground">Staked</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded" style={{ backgroundColor: delegatedColor }} />
                <span className="text-muted-foreground">Delegated</span>
              </div>
            </div>
          </div>

          {/* Chart */}
          <ChartWatermark className="mb-6">
            {displayData.length > 0 ? (
              <ResponsiveContainer width="100%" height={350}>
                <AreaChart data={displayData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradient-staked-weight" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={stakedColor} stopOpacity={0.8} />
                      <stop offset="95%" stopColor={stakedColor} stopOpacity={0.3} />
                    </linearGradient>
                    <linearGradient id="gradient-delegated-weight" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={delegatedColor} stopOpacity={0.8} />
                      <stop offset="95%" stopColor={delegatedColor} stopOpacity={0.3} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    className="stroke-gray-200 dark:stroke-gray-700"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="day"
                    tickFormatter={formatXAxis}
                    className="text-xs text-gray-600 dark:text-gray-400"
                    tick={{ className: "fill-gray-600 dark:fill-gray-400" }}
                    minTickGap={80}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tickFormatter={formatWeight}
                    className="text-xs text-gray-600 dark:text-gray-400"
                    tick={{ className: "fill-gray-600 dark:fill-gray-400" }}
                  />
                  <Tooltip
                    cursor={{ fill: `${color}20` }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.[0]) return null;
                      const data = payload[0].payload;
                      return (
                        <div className="rounded-lg border bg-background p-2 shadow-sm font-mono">
                          <div className="grid gap-2">
                            <div className="font-medium text-sm">
                              {formatTooltipDate(data.day)}
                            </div>
                            <div className="text-xs flex items-center gap-2">
                              <div className="w-2 h-2 rounded" style={{ backgroundColor: stakedColor }} />
                              Staked: {formatWeightFull(data.staked)}
                            </div>
                            <div className="text-xs flex items-center gap-2">
                              <div className="w-2 h-2 rounded" style={{ backgroundColor: delegatedColor }} />
                              Delegated: {formatWeightFull(data.delegated)}
                            </div>
                            <div className="text-xs font-medium border-t pt-1 mt-1">
                              Total: {formatWeightFull(data.total)}
                            </div>
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="staked"
                    stackId="1"
                    stroke={stakedColor}
                    fill="url(#gradient-staked-weight)"
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="delegated"
                    stackId="1"
                    stroke={delegatedColor}
                    fill="url(#gradient-delegated-weight)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[350px] flex items-center justify-center text-muted-foreground">
                Loading chart data...
              </div>
            )}
          </ChartWatermark>

          {/* Brush Slider */}
          {aggregatedData.length > 0 && brushIndexes && 
           !isNaN(brushIndexes.startIndex) && !isNaN(brushIndexes.endIndex) &&
           brushIndexes.startIndex >= 0 && brushIndexes.endIndex < aggregatedData.length && (
            <div className="bg-white dark:bg-black pl-[60px]">
              <ResponsiveContainer width="100%" height={80}>
                <LineChart data={aggregatedData} margin={{ top: 0, right: 30, left: 0, bottom: 5 }}>
                  <Brush
                    dataKey="day"
                    height={80}
                    stroke={color}
                    fill={`${color}20`}
                    alwaysShowText={false}
                    startIndex={brushIndexes.startIndex}
                    endIndex={brushIndexes.endIndex}
                    onChange={(e: any) => {
                      if (e.startIndex !== undefined && e.endIndex !== undefined &&
                          !isNaN(e.startIndex) && !isNaN(e.endIndex)) {
                        setBrushIndexes({ startIndex: e.startIndex, endIndex: e.endIndex });
                      }
                    }}
                    travellerWidth={8}
                    tickFormatter={formatBrushXAxis}
                  >
                    <LineChart>
                      <Line type="monotone" dataKey="total" stroke={color} strokeWidth={1} dot={false} />
                    </LineChart>
                  </Brush>
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Cumulative Rewards Chart Card
function CumulativeRewardsChartCard({
  data,
  currentValue,
  color,
  period,
  onPeriodChange,
}: {
  data: { day: string; value: number }[];
  currentValue: number | string;
  color: string;
  period: "D" | "W" | "M" | "Q" | "Y";
  onPeriodChange: (period: "D" | "W" | "M" | "Q" | "Y") => void;
}) {
  const [brushIndexes, setBrushIndexes] = useState<{
    startIndex: number;
    endIndex: number;
  } | null>(null);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const { resolvedTheme } = useTheme();
  const handleScreenshot = async () => {
    if (!chartContainerRef.current) return;

    try {
      const element = chartContainerRef.current;
      const bgColor = resolvedTheme === "dark" ? "#0a0a0a" : "#ffffff";

      const dataUrl = await toPng(element, {
        quality: 1,
        pixelRatio: 2,
        backgroundColor: bgColor,
        cacheBust: true,
      });

      const link = document.createElement("a");
      link.download = `Cumulative_Rewards_${period}_${new Date().toISOString().split("T")[0]}.png`;
      link.href = dataUrl;
      link.click();
    } catch (error) {
      console.error("Failed to capture screenshot:", error);
    }
  };

  // Aggregate data by period
  const aggregatedData = useMemo(() => {
    if (period === "D") return data;

    const grouped = new Map<string, { maxValue: number; date: string }>();

    data.forEach((point) => {
      const date = new Date(point.day);
      let key: string;

      if (period === "W") {
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        key = weekStart.toISOString().split("T")[0];
      } else if (period === "M") {
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      } else if (period === "Q") {
        const quarter = Math.floor(date.getMonth() / 3) + 1;
        key = `${date.getFullYear()}-Q${quarter}`;
      } else {
        key = String(date.getFullYear());
      }

      if (!grouped.has(key)) {
        grouped.set(key, { maxValue: 0, date: key });
      }

      const group = grouped.get(key)!;
      group.maxValue = Math.max(group.maxValue, point.value);
    });

    return Array.from(grouped.values())
      .map((group) => ({
        day: group.date,
        value: group.maxValue,
      }))
      .sort((a, b) => a.day.localeCompare(b.day));
  }, [data, period]);

  // Initialize brush - always show from start for cumulative chart
  useEffect(() => {
    if (!aggregatedData || aggregatedData.length === 0) {
      setBrushIndexes(null);
      return;
    }

    // Always show full range from start for cumulative rewards
    setBrushIndexes({
      startIndex: 0,
      endIndex: aggregatedData.length - 1,
    });
  }, [period, aggregatedData]);

  const displayData = useMemo(() => {
    if (!brushIndexes || !aggregatedData || aggregatedData.length === 0) return [];
    const start = Math.max(0, Math.min(brushIndexes.startIndex, aggregatedData.length - 1));
    const end = Math.max(0, Math.min(brushIndexes.endIndex, aggregatedData.length - 1));
    if (start > end) return [];
    return aggregatedData.slice(start, end + 1);
  }, [brushIndexes, aggregatedData]);

  // CSV download function
  const downloadCSV = () => {
    if (!displayData || displayData.length === 0) return;

    const headers = ["Date", "Cumulative Rewards (AVAX)"];
    const rows = displayData.map((point: any) => [point.day, point.value].join(","));

    const csvContent = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Cumulative_Rewards_${period}_${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const formatValue = (value: number): string => {
    if (value >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
    if (value >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
    if (value >= 1e3) return `${(value / 1e3).toFixed(2)}K`;
    return value.toFixed(2);
  };

  const formatXAxis = (value: string) => {
    if (period === "Q") {
      const parts = value.split("-");
      if (parts.length === 2) return `${parts[1]} '${parts[0].slice(-2)}`;
      return value;
    }
    if (period === "Y") return value;
    const date = new Date(value);
    if (period === "M") {
      return date.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
    }
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const formatTooltipDate = (value: string) => {
    if (period === "Y") return value;
    if (period === "Q") {
      const parts = value.split("-");
      if (parts.length === 2) return `${parts[1]} ${parts[0]}`;
      return value;
    }
    const date = new Date(value);
    if (period === "M") {
      return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    }
    if (period === "W") {
      const endDate = new Date(date);
      endDate.setDate(date.getDate() + 6);
      return `${date.toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${endDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
    }
    return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
  };

  const formatBrushXAxis = (value: string) => {
    if (period === "Q" || period === "Y") return value;
    const date = new Date(value);
    return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
  };

  return (
    <Card className="py-0 border-gray-200 rounded-md dark:border-gray-700" ref={chartContainerRef}>
      <CardContent className="p-0">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 sm:py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 sm:gap-3">
            <div
              className="rounded-full p-2 sm:p-3 flex items-center justify-center"
              style={{ backgroundColor: `${color}20` }}
            >
              <TrendingUp className="h-5 w-5 sm:h-6 sm:w-6" style={{ color }} />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-normal">Cumulative Rewards</h3>
              <p className="text-xs sm:text-sm text-muted-foreground hidden sm:block">
                Total accumulated staking and delegation rewards over time
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Select
              value={period}
              onValueChange={(value) =>
                onPeriodChange(value as "D" | "W" | "M" | "Q" | "Y")
              }
            >
              <SelectTrigger className="h-7 w-auto px-2 gap-1 text-xs sm:text-sm border-0 bg-transparent hover:bg-muted focus:ring-0 shadow-none">
                <SelectValue>
                  {period === "D" ? "Daily" : period === "W" ? "Weekly" : period === "M" ? "Monthly" : period === "Q" ? "Quarterly" : "Yearly"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {(["D", "W", "M", "Q", "Y"] as const).map((p) => (
                  <SelectItem key={p} value={p}>
                    {p === "D" ? "Daily" : p === "W" ? "Weekly" : p === "M" ? "Monthly" : p === "Q" ? "Quarterly" : "Yearly"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <button
              onClick={handleScreenshot}
              className="p-1.5 sm:p-2 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
              title="Download chart as image"
            >
              <Camera className="h-4 w-4" />
            </button>
            <button
              onClick={downloadCSV}
              className="p-1.5 sm:p-2 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
              title="Download CSV"
            >
              <Download className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="px-5 pt-6 pb-6">
          {/* Current Value */}
          <div className="flex items-center gap-2 sm:gap-4 mb-3 sm:mb-4 pl-2 sm:pl-4 flex-wrap">
            <div className="text-md sm:text-base font-mono">
              Total: {formatValue(typeof currentValue === 'string' ? parseFloat(currentValue) : currentValue)} AVAX
            </div>
          </div>

          {/* Chart */}
          <ChartWatermark className="mb-6">
            {displayData.length > 0 ? (
              <ResponsiveContainer width="100%" height={350}>
                <AreaChart data={displayData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradient-cumulative-rewards" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={color} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    className="stroke-gray-200 dark:stroke-gray-700"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="day"
                    tickFormatter={formatXAxis}
                    className="text-xs text-gray-600 dark:text-gray-400"
                    tick={{ className: "fill-gray-600 dark:fill-gray-400" }}
                    minTickGap={80}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tickFormatter={formatValue}
                    className="text-xs text-gray-600 dark:text-gray-400"
                    tick={{ className: "fill-gray-600 dark:fill-gray-400" }}
                  />
                  <Tooltip
                    cursor={{ fill: `${color}20` }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.[0]) return null;
                      return (
                        <div className="rounded-lg border bg-background p-2 shadow-sm font-mono">
                          <div className="grid gap-2">
                            <div className="font-medium text-sm">
                              {formatTooltipDate(payload[0].payload.day)}
                            </div>
                            <div className="text-xs">
                              Total: {formatValue(payload[0].payload.value)} AVAX
                            </div>
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke={color}
                    fill="url(#gradient-cumulative-rewards)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[350px] flex items-center justify-center text-muted-foreground">
                Loading chart data...
              </div>
            )}
          </ChartWatermark>

          {/* Brush Slider */}
          {aggregatedData.length > 0 && brushIndexes && 
           !isNaN(brushIndexes.startIndex) && !isNaN(brushIndexes.endIndex) &&
           brushIndexes.startIndex >= 0 && brushIndexes.endIndex < aggregatedData.length && (
            <div className="bg-white dark:bg-black pl-[60px]">
              <ResponsiveContainer width="100%" height={80}>
                <LineChart data={aggregatedData} margin={{ top: 0, right: 30, left: 0, bottom: 5 }}>
                  <Brush
                    dataKey="day"
                    height={80}
                    stroke={color}
                    fill={`${color}20`}
                    alwaysShowText={false}
                    startIndex={brushIndexes.startIndex}
                    endIndex={brushIndexes.endIndex}
                    onChange={(e: any) => {
                      if (e.startIndex !== undefined && e.endIndex !== undefined &&
                          !isNaN(e.startIndex) && !isNaN(e.endIndex)) {
                        setBrushIndexes({ startIndex: e.startIndex, endIndex: e.endIndex });
                      }
                    }}
                    travellerWidth={8}
                    tickFormatter={formatBrushXAxis}
                  >
                    <LineChart>
                      <Line type="monotone" dataKey="value" stroke={color} strokeWidth={1} dot={false} />
                    </LineChart>
                  </Brush>
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}