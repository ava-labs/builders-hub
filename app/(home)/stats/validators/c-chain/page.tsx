"use client";
import { useState, useEffect, useMemo } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Pie,
  PieChart,
  Line,
  LineChart,
  Brush,
  ResponsiveContainer,
  Tooltip,
  ComposedChart,
} from "recharts";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  type ChartConfig,
  ChartLegendContent,
  ChartStyle,
  ChartContainer,
  ChartTooltip,
  ChartLegend,
} from "@/components/ui/chart";
import {
  Landmark,
  Shield,
  TrendingUp,
  Monitor,
  HandCoins,
  Users,
  Percent,
  Search,
  X,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  ArrowUpRight,
  Twitter,
  Linkedin,
} from "lucide-react";
import { ValidatorWorldMap } from "@/components/stats/ValidatorWorldMap";
import { L1BubbleNav } from "@/components/stats/l1-bubble.config";
import { ExplorerDropdown } from "@/components/stats/ExplorerDropdown";
import { ChartSkeletonLoader } from "@/components/ui/chart-skeleton";
import {
  TimeSeriesDataPoint,
  ChartDataPoint,
  PrimaryNetworkMetrics,
  VersionCount,
  L1Chain,
} from "@/types/stats";
import { AvalancheLogo } from "@/components/navigation/avalanche-logo";
import { StatsBreadcrumb } from "@/components/navigation/StatsBreadcrumb";
import { ChainIdChips } from "@/components/ui/copyable-id-chip";
import { AddToWalletButton } from "@/components/ui/add-to-wallet-button";
import {
  VersionBreakdownCard,
  calculateVersionStats,
  type VersionBreakdownData,
} from "@/components/stats/VersionBreakdown";
import l1ChainsData from "@/constants/l1-chains.json";

interface ValidatorData {
  nodeId: string;
  amountStaked: string;
  delegationFee: string;
  validationStatus: string;
  delegatorCount: number;
  amountDelegated: string;
  version?: string;
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
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [displayCount, setDisplayCount] = useState(50);
  const [sortColumn, setSortColumn] = useState<string>("amountStaked");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch all APIs in parallel
      // Use validator-stats API for version breakdown (same as landing page)
      const [statsResponse, validatorsResponse, validatorStatsResponse] =
        await Promise.all([
          fetch(`/api/primary-network-stats?timeRange=all`),
          fetch("/api/primary-network-validators"),
          fetch("/api/validator-stats?network=mainnet"),
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
    } catch (err) {
      setError(`An error occurred while fetching data`);
    } finally {
      setLoading(false);
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

  // Get total validator weight from metrics
  const getTotalWeight = (): string => {
    if (!metrics?.validator_weight?.current_value) return "0";
    const weightInAvax = Number(metrics.validator_weight.current_value) / 1e9;
    return formatLargeNumber(weightInAvax);
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
      title: "Validator Count",
      icon: Monitor,
      metricKey: "validator_count" as const,
      description: "Number of active validators",
      color: chainConfig.color,
      chartType: "bar" as const,
    },
    {
      title: "Validator Weight",
      icon: Landmark,
      metricKey: "validator_weight" as const,
      description: "Total validator weight",
      color: chainConfig.color,
      chartType: "area" as const,
    },
    {
      title: "Delegator Count",
      icon: HandCoins,
      metricKey: "delegator_count" as const,
      description: "Number of active delegators",
      color: "#E84142",
      chartType: "bar" as const,
    },
    {
      title: "Delegator Weight",
      icon: Landmark,
      metricKey: "delegator_weight" as const,
      description: "Total delegator weight",
      color: "#E84142",
      chartType: "area" as const,
    },
  ];

  const [chartPeriods, setChartPeriods] = useState<
    Record<string, "D" | "W" | "M" | "Q" | "Y">
  >(Object.fromEntries(chartConfigs.map((config) => [config.metricKey, "D"])));

  // Active section tracking for navbar
  const [activeSection, setActiveSection] = useState<string>("trends");

  // Navigation categories
  const navCategories = [
    { id: "trends", label: "Historical Trends" },
    { id: "distribution", label: "Stake Distribution" },
    { id: "versions", label: "Software Versions" },
    { id: "map", label: "Global Map" },
    { id: "validators", label: "Validator List" },
  ];

  // Copy to clipboard helper
  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

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

  // Track active section on scroll
  useEffect(() => {
    const handleScroll = () => {
      const sections = navCategories.map((cat) =>
        document.getElementById(cat.id)
      );
      const scrollPosition = window.scrollY + 180; // Account for navbar height

      for (let i = sections.length - 1; i >= 0; i--) {
        const section = sections[i];
        if (section && section.offsetTop <= scrollPosition) {
          setActiveSection(navCategories[i].id);
          break;
        }
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll(); // Set initial state
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Smooth scroll to section
  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      const offset = 180; // Account for both navbars
      const elementPosition =
        element.getBoundingClientRect().top + window.scrollY;
      window.scrollTo({
        top: elementPosition - offset,
        behavior: "smooth",
      });
    }
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
                {(chainConfig.website || chainConfig.socials || chainConfig.rpcUrl) && (
                  <div className="flex sm:hidden items-center gap-2 mt-4">
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
                            ...(chainConfig.explorers || []).filter((e: { name: string }) => e.name !== "BuilderHub"),
                          ]}
                          variant="outline"
                          size="sm"
                        />
                      </div>
                    )}
                  </div>
                )}
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
      <div className="sticky top-14 z-30 w-full bg-zinc-50/95 dark:bg-zinc-950/95 backdrop-blur-sm border-b border-t border-zinc-200 dark:border-zinc-800">
        <div className="w-full">
          <div
            className="flex items-center gap-1 sm:gap-2 overflow-x-auto py-3 px-4 sm:px-6 max-w-7xl mx-auto"
            style={{
              scrollbarWidth: "none",
              msOverflowStyle: "none",
              WebkitOverflowScrolling: "touch",
            }}
          >
            {navCategories.map((category) => (
              <button
                key={category.id}
                onClick={() => scrollToSection(category.id)}
                className={`px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium rounded-lg whitespace-nowrap transition-all flex-shrink-0 ${
                  activeSection === category.id
                    ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-sm"
                    : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 hover:text-zinc-900 dark:hover:text-zinc-100"
                }`}
              >
                {category.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-8 sm:space-y-12">
        <section id="trends" className="space-y-4 sm:space-y-6 scroll-mt-32">
          <div className="space-y-2">
            <h2 className="text-lg sm:text-2xl font-medium text-left">
              Historical Trends
            </h2>
            <p className="text-zinc-500 dark:text-zinc-400 text-sm sm:text-base text-left">
              Track network growth and validator activity over time
            </p>
          </div>

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

        <section
          id="distribution"
          className="space-y-4 sm:space-y-6 scroll-mt-32"
        >
          <div className="space-y-2">
            <h2 className="text-lg sm:text-2xl font-medium text-left">
              Stake Distribution Analysis
            </h2>
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
                  <div className="px-4 sm:px-5 py-4 sm:py-5">
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
                  </div>
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
                  <div className="px-4 sm:px-5 py-4 sm:py-5">
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
                  </div>
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
                  <div className="px-4 sm:px-5 py-4 sm:py-5">
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
                  </div>
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
                  <div className="px-4 sm:px-5 py-4 sm:py-5">
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
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </section>

        <section id="versions" className="space-y-4 sm:space-y-6 scroll-mt-32">
          <div className="space-y-2">
            <h2 className="text-lg sm:text-2xl font-medium text-left">
              Software Versions
            </h2>
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
        <section id="map" className="space-y-4 sm:space-y-6 scroll-mt-32">
          <ValidatorWorldMap />
        </section>

        {/* All Validators Table */}
        <section
          id="validators"
          className="space-y-4 sm:space-y-6 scroll-mt-32"
        >
          <div className="space-y-2">
            <h2 className="text-lg sm:text-2xl font-medium text-left">
              Validator List
            </h2>
            <p className="text-zinc-500 dark:text-zinc-400 text-sm sm:text-base text-left">
              Complete list of all validators on the Primary Network
            </p>
          </div>

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
                                title={
                                  copiedId === `node-${validator.nodeId}`
                                    ? "Copied!"
                                    : `Click to copy: ${validator.nodeId}`
                                }
                                onClick={() =>
                                  copyToClipboard(
                                    validator.nodeId,
                                    `node-${validator.nodeId}`
                                  )
                                }
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
                            <td className="border-r border-slate-100 dark:border-neutral-800 px-4 py-2 text-right font-mono text-sm">
                              {formatValidatorStake(validator.amountStaked)}{" "}
                              AVAX
                            </td>
                            <td className="border-r border-slate-100 dark:border-neutral-800 px-4 py-2 text-right text-sm">
                              {parseFloat(validator.delegationFee).toFixed(1)}%
                            </td>
                            <td className="border-r border-slate-100 dark:border-neutral-800 px-4 py-2 text-right text-sm">
                              {validator.delegatorCount}
                            </td>
                            <td className="px-4 py-2 text-right font-mono text-sm">
                              {formatValidatorStake(validator.amountDelegated)}{" "}
                              AVAX
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
    <Card className="py-0 border-gray-200 rounded-md dark:border-gray-700">
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
          <div className="flex gap-0.5 sm:gap-1">
            {(["D", "W", "M", "Q", "Y"] as const).map((p) => (
              <button
                key={p}
                onClick={() => onPeriodChange(p)}
                className={`px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm  rounded-md transition-colors ${
                  period === p
                    ? "text-white dark:text-white"
                    : "text-muted-foreground hover:bg-muted"
                }`}
                style={
                  period === p
                    ? { backgroundColor: `${config.color}`, opacity: 0.9 }
                    : {}
                }
              >
                {p}
              </button>
            ))}
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

          <div className="mb-6">
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
          </div>

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
