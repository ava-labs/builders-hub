"use client";
import type React from "react";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import Image from "next/image";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Activity,
  Search,
  ArrowUpRight,
  ExternalLink,
  X,
  ChevronDown,
  Globe,
  ChevronRight,
  BarChart3,
  Network,
  Info,
} from "lucide-react";
import { StatsBubbleNav } from "@/components/stats/stats-bubble.config";
import l1ChainsData from "@/constants/l1-chains.json";
import { L1Chain } from "@/types/stats";
import { AvalancheLogo } from "@/components/navigation/avalanche-logo";
import NetworkDiagram, {
  ChainCosmosData,
  ICMFlowRoute,
} from "@/components/stats/NetworkDiagram";
import {
  CategoryChip,
  getCategoryColor,
} from "@/components/stats/CategoryChip";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// Time range types matching the API
type TimeRangeKey = "day" | "week" | "month";

const TIME_RANGE_CONFIG: Record<
  TimeRangeKey,
  { label: string; shortLabel: string; secondsInRange: number }
> = {
  day: { label: "Daily", shortLabel: "D", secondsInRange: 24 * 60 * 60 },
  week: { label: "Weekly", shortLabel: "W", secondsInRange: 7 * 24 * 60 * 60 },
  month: {
    label: "Monthly",
    shortLabel: "M",
    secondsInRange: 30 * 24 * 60 * 60,
  },
};

// Animated number component - continuously increasing
function AnimatedNumber({
  value,
  duration = 2000,
}: {
  value: number;
  duration?: number;
}) {
  const [displayValue, setDisplayValue] = useState(0);
  const startTime = useRef<number | null>(null);
  const lastIncrementTime = useRef<number | null>(null);
  const baseValue = useRef(0);
  const animationRef = useRef<number | null>(null);
  const hasReachedTarget = useRef(false);

  useEffect(() => {
    startTime.current = null;
    lastIncrementTime.current = null;
    baseValue.current = 0;
    hasReachedTarget.current = false;

    const animate = (timestamp: number) => {
      if (!startTime.current) startTime.current = timestamp;

      if (!hasReachedTarget.current) {
        // Initial animation to reach target value
        const progress = Math.min(
          (timestamp - startTime.current) / duration,
          1
        );
        const easeOut = 1 - Math.pow(1 - progress, 3);
        const currentValue = Math.floor(easeOut * value);
        setDisplayValue(currentValue);

        if (progress >= 1) {
          hasReachedTarget.current = true;
          baseValue.current = value;
          setDisplayValue(value);
          lastIncrementTime.current = timestamp; // Start tracking for continuous increment
        }
      } else {
        // After reaching target, continuously increment at daily rate
        if (!lastIncrementTime.current) lastIncrementTime.current = timestamp;

        const deltaMs = timestamp - lastIncrementTime.current;
        lastIncrementTime.current = timestamp;

        // Calculate transactions per millisecond from daily count
        // Daily txns / (24 hours * 60 minutes * 60 seconds * 1000 ms) = txns per ms
        const txnsPerMs = value / (24 * 60 * 60 * 1000);
        const increment = txnsPerMs * deltaMs;
        baseValue.current += increment;
        setDisplayValue(Math.floor(baseValue.current));
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [value, duration]);

  // Just show raw number with commas, no K/M/B formatting
  return <span>{displayValue.toLocaleString()}</span>;
}

// Speed gauge component for TPS - needle always at max, vibrating
function SpeedGauge({ value }: { value: number }) {
  const [vibration, setVibration] = useState(0);
  const gaugeId = useRef(
    `gauge-${Math.random().toString(36).substr(2, 9)}`
  ).current;

  // Vibration effect - needle shakes at the limit
  useEffect(() => {
    const interval = setInterval(() => {
      setVibration(Math.random() * 4 - 2); // Random shake between -2 and 2 degrees
    }, 50);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative inline-flex items-baseline gap-1.5 sm:gap-3 md:gap-4">
      <div className="relative w-10 h-6 sm:w-16 sm:h-9 md:w-20 md:h-12">
        {/* Gauge SVG */}
        <svg
          className="w-full h-full"
          viewBox="0 0 80 48"
          overflow="visible"
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            <linearGradient id={gaugeId} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#22c55e" />
              <stop offset="50%" stopColor="#eab308" />
              <stop offset="100%" stopColor="#ef4444" />
            </linearGradient>
          </defs>

          {/* Background arc */}
          <path
            d="M 8 44 A 32 32 0 0 1 72 44"
            fill="none"
            stroke="currentColor"
            strokeWidth="6"
            strokeLinecap="round"
            className="text-zinc-200 dark:text-zinc-700"
          />

          {/* Colored arc - full */}
          <path
            d="M 8 44 A 32 32 0 0 1 72 44"
            fill="none"
            stroke={`url(#${gaugeId})`}
            strokeWidth="6"
            strokeLinecap="round"
          />

          {/* Needle - always at rightmost position (90 degrees = horizontal right) with vibration */}
          <line
            x1="40"
            y1="44"
            x2="40"
            y2="16"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            className="text-zinc-800 dark:text-zinc-100"
            style={{
              transformOrigin: "40px 44px",
              transform: `rotate(${90 + vibration}deg)`,
            }}
          />

          {/* Center dot */}
          <circle
            cx="40"
            cy="44"
            r="4"
            fill="currentColor"
            className="text-zinc-800 dark:text-zinc-100"
          />
        </svg>
      </div>
      <div className="flex items-baseline">
        <span className="text-2xl sm:text-3xl md:text-4xl font-semibold tabular-nums text-zinc-900 dark:text-white">
          {value.toFixed(2)}
        </span>
        <span className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 ml-1 sm:ml-2">
          TPS
        </span>
      </div>
    </div>
  );
}

// Simplified interfaces matching API response
interface ChainOverviewMetrics {
  chainId: string;
  chainName: string;
  chainLogoURI: string;
  txCount: number;
  tps: number;
  activeAddresses: number;
  icmMessages: number;
  validatorCount: number | string;
}

interface OverviewMetrics {
  chains: ChainOverviewMetrics[];
  aggregated: {
    totalTxCount: number;
    totalTps: number;
    totalActiveAddresses: number;
    totalICMMessages: number;
    totalValidators: number;
    activeChains: number;
  };
  timeRange: TimeRangeKey;
  last_updated: number;
}

type SortDirection = "asc" | "desc";

export default function AvalancheMetrics() {
  const { resolvedTheme } = useTheme();
  const [isMounted, setIsMounted] = useState(false);
  const [overviewMetrics, setOverviewMetrics] =
    useState<OverviewMetrics | null>(null);
  const [initialLoading, setInitialLoading] = useState(true); // For first load only
  const [tableLoading, setTableLoading] = useState(false); // For time range changes
  const [error, setError] = useState<string | null>(null);
  const [sortField, setSortField] = useState<string>("activeAddresses");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [visibleCount, setVisibleCount] = useState(25);
  const [searchTerm, setSearchTerm] = useState("");
  const [timeRange, setTimeRange] = useState<TimeRangeKey>("day");

  const [icmFlows, setIcmFlows] = useState<ICMFlowRoute[]>([]);
  const [icmFailedChainIds, setIcmFailedChainIds] = useState<string[]>([]);
  const [icmLoading, setIcmLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  const categoryDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Fetch ICM flows separately (only additional data needed for NetworkDiagram)
  const fetchIcmFlows = useCallback(async () => {
    try {
      setIcmLoading(true);
      const icmResponse = await fetch("/api/icm-flow?days=30").catch(
        () => null
      );

      if (icmResponse && icmResponse.ok) {
        try {
          const icmData = await icmResponse.json();
          if (icmData.flows && Array.isArray(icmData.flows)) {
            setIcmFlows(
              icmData.flows.map((f: any) => ({
                sourceChainId: f.sourceChainId,
                targetChainId: f.targetChainId,
                messageCount: f.messageCount,
              }))
            );
          }
          if (icmData.failedChainIds && Array.isArray(icmData.failedChainIds)) {
            setIcmFailedChainIds(icmData.failedChainIds);
          }
        } catch (e) {
          console.warn("Could not parse ICM flow data:", e);
        }
      }
    } catch (err) {
      console.error("Error fetching ICM flows:", err);
    } finally {
      setIcmLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchIcmFlows();
  }, [fetchIcmFlows]);

  const getChainSlug = (chainId: string, chainName: string): string | null => {
    const chain = l1ChainsData.find(
      (c) =>
        c.chainId === chainId ||
        c.chainName.toLowerCase() === chainName.toLowerCase()
    );
    return chain?.slug || null;
  };

  // Helper to generate consistent color from chain name
  const generateColorFromName = (name: string): string => {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = hash % 360;
    return `hsl(${hue}, 70%, 50%)`;
  };

  // Transform overviewMetrics.chains to ChainCosmosData for NetworkDiagram
  const cosmosData: ChainCosmosData[] = useMemo(() => {
    if (!overviewMetrics?.chains) return [];

    return overviewMetrics.chains
      .map((chain) => {
        // Get additional info from l1-chains.json
        const l1Chain = l1ChainsData.find(
          (c) =>
            c.chainId === chain.chainId ||
            c.chainName.toLowerCase() === chain.chainName.toLowerCase()
        );

        const validatorCount =
          typeof chain.validatorCount === "number" ? chain.validatorCount : 0;
        if (validatorCount === 0) return null;

        return {
          id: l1Chain?.subnetId || chain.chainId,
          chainId: chain.chainId,
          name: chain.chainName,
          logo: chain.chainLogoURI,
          color: l1Chain?.color || generateColorFromName(chain.chainName),
          validatorCount,
          subnetId: l1Chain?.subnetId,
          activeAddresses:
            chain.activeAddresses > 0 ? chain.activeAddresses : undefined,
          txCount: chain.txCount > 0 ? Math.round(chain.txCount) : undefined,
          icmMessages:
            chain.icmMessages > 0 ? Math.round(chain.icmMessages) : undefined,
          tps: chain.tps > 0 ? parseFloat(chain.tps.toFixed(2)) : undefined,
          category: l1Chain?.category || "General",
        } as ChainCosmosData;
      })
      .filter((chain): chain is ChainCosmosData => chain !== null)
      .sort((a, b) => b.validatorCount - a.validatorCount);
  }, [overviewMetrics?.chains]);

  const getThemedLogoUrl = (logoUrl: string): string => {
    if (!isMounted || !logoUrl) return logoUrl;
    if (resolvedTheme === "dark") {
      return logoUrl.replace(/Light/g, "Dark");
    } else {
      return logoUrl.replace(/Dark/g, "Light");
    }
  };

  useEffect(() => {
    const fetchMetrics = async () => {
      // Use tableLoading for subsequent loads, initialLoading for first load
      if (overviewMetrics) {
        setTableLoading(true);
      }
      setError(null);
      try {
        const response = await fetch(
          `/api/overview-stats?timeRange=${timeRange}`
        );
        if (!response.ok)
          throw new Error(`Failed to fetch metrics: ${response.status}`);
        const metrics = await response.json();
        setOverviewMetrics(metrics);
      } catch (err: any) {
        console.error("Error fetching metrics data:", err);
        setError(err?.message || "Failed to load metrics data");
      }
      setInitialLoading(false);
      setTableLoading(false);
    };
    fetchMetrics();
  }, [timeRange]);

  const formatNumber = (num: number | string): string => {
    if (num === "N/A" || num === "" || num === null || num === undefined)
      return "N/A";
    const numValue = typeof num === "string" ? Number.parseFloat(num) : num;
    if (isNaN(numValue)) return "N/A";
    if (numValue >= 1e12) return `${(numValue / 1e12).toFixed(1)}T`;
    if (numValue >= 1e9) return `${(numValue / 1e9).toFixed(1)}B`;
    if (numValue >= 1e6) return `${(numValue / 1e6).toFixed(1)}M`;
    if (numValue >= 1e3) return `${(numValue / 1e3).toFixed(1)}K`;
    return numValue.toLocaleString();
  };

  const formatFullNumber = (num: number): string => num.toLocaleString();

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
    setVisibleCount(25);
  };

  const getChainCategory = (chainId: string, chainName: string): string => {
    const chain = l1ChainsData.find(
      (c) =>
        c.chainId === chainId ||
        c.chainName.toLowerCase() === chainName.toLowerCase()
    );
    return chain?.category || "General";
  };

  const getChainTPS = (chain: ChainOverviewMetrics): string => {
    return chain.tps.toFixed(2);
  };

  const chains = overviewMetrics?.chains || [];

  // Extract unique categories sorted by count (descending)
  const { sortedCategories, visibleCategories, overflowCategories } =
    useMemo(() => {
      const catCounts = new Map<string, number>();
      chains.forEach((chain) => {
        const category = getChainCategory(chain.chainId, chain.chainName);
        catCounts.set(category, (catCounts.get(category) || 0) + 1);
      });

      // Sort by count descending
      const sorted = Array.from(catCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([cat]) => cat);

      // Show "All" + top 4 categories as buttons, rest in dropdown
      const MAX_VISIBLE = 4;
      const visible = ["All", ...sorted.slice(0, MAX_VISIBLE)];
      const overflow = sorted.slice(MAX_VISIBLE);

      return {
        sortedCategories: ["All", ...sorted],
        visibleCategories: visible,
        overflowCategories: overflow,
      };
    }, [chains]);

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

  // Filter by category first, then by search term
  const filteredData = chains.filter((chain) => {
    const chainCategory = getChainCategory(chain.chainId, chain.chainName);
    const matchesCategory =
      selectedCategory === "All" || chainCategory === selectedCategory;
    const matchesSearch = chain.chainName
      .toLowerCase()
      .includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const sortedData = [...filteredData].sort((a, b) => {
    let aValue: any, bValue: any;
    switch (sortField) {
      case "chainName":
        aValue = a.chainName;
        bValue = b.chainName;
        break;
      case "txCount":
        aValue = a.txCount || 0;
        bValue = b.txCount || 0;
        break;
      case "activeAddresses":
        aValue = a.activeAddresses || 0;
        bValue = b.activeAddresses || 0;
        break;
      case "icmMessages":
        aValue = a.icmMessages || 0;
        bValue = b.icmMessages || 0;
        break;
      case "validatorCount":
        aValue = typeof a.validatorCount === "number" ? a.validatorCount : 0;
        bValue = typeof b.validatorCount === "number" ? b.validatorCount : 0;
        break;
      case "tps":
        aValue = a.tps || 0;
        bValue = b.tps || 0;
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
    return sortDirection === "asc"
      ? (aValue || 0) - (bValue || 0)
      : (bValue || 0) - (aValue || 0);
  });

  const visibleData = sortedData.slice(0, visibleCount);
  const hasMoreData = visibleCount < sortedData.length;
  const handleLoadMore = () =>
    setVisibleCount((prev) => Math.min(prev + 25, sortedData.length));

  const SortButton = ({
    field,
    children,
    align = "left",
  }: {
    field: string;
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

  // Initial loading state (full page skeleton)
  if (initialLoading && !overviewMetrics) {
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
            <div className="h-[300px] sm:h-[400px] md:h-[500px] bg-zinc-200 dark:bg-zinc-800 rounded-2xl" />
          </div>
        </div>
        <StatsBubbleNav />
      </div>
    );
  }

  // Table skeleton rows for loading state
  const TableSkeleton = () => (
    <>
      {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
        <tr key={i} className="animate-pulse">
          <td className="px-4 sm:px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-zinc-200 dark:bg-zinc-800" />
              <div className="h-4 w-24 sm:w-32 bg-zinc-200 dark:bg-zinc-800 rounded" />
            </div>
          </td>
          <td className="px-4 sm:px-6 py-4 text-right">
            <div className="h-4 w-16 bg-zinc-200 dark:bg-zinc-800 rounded ml-auto" />
          </td>
          <td className="px-4 sm:px-6 py-4 text-right">
            <div className="h-4 w-20 bg-zinc-200 dark:bg-zinc-800 rounded ml-auto" />
          </td>
          <td className="px-4 sm:px-6 py-4 text-right">
            <div className="h-4 w-14 bg-zinc-200 dark:bg-zinc-800 rounded ml-auto" />
          </td>
          <td className="px-4 sm:px-6 py-4 text-right">
            <div className="h-4 w-12 bg-zinc-200 dark:bg-zinc-800 rounded ml-auto" />
          </td>
          <td className="px-4 sm:px-6 py-4 text-right">
            <div className="h-4 w-14 bg-zinc-200 dark:bg-zinc-800 rounded ml-auto" />
          </td>
          <td className="px-4 sm:px-6 py-4">
            <div className="h-6 w-16 bg-zinc-200 dark:bg-zinc-800 rounded-full" />
          </td>
        </tr>
      ))}
    </>
  );

  // Error state
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

  if (!overviewMetrics || overviewMetrics.chains.length === 0) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center">
        <p className="text-zinc-500">No data available</p>
        <StatsBubbleNav />
      </div>
    );
  }

  const totalTx = Math.round(overviewMetrics.aggregated.totalTxCount || 0);
  const totalTps = overviewMetrics.aggregated.totalTps?.toFixed(2) || "0";
  const totalIcm = Math.round(overviewMetrics.aggregated.totalICMMessages || 0);
  const timeRangeLabel = TIME_RANGE_CONFIG[timeRange].label;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Hero - Clean typographic approach */}
      <div className="relative overflow-hidden border-b border-zinc-200 dark:border-zinc-800">
        {/* Avalanche gradient decoration */}
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
              <BarChart3 className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-red-500" />
              <span>Overview</span>
            </span>
          </nav>

          <div className="flex flex-col sm:flex-row items-start justify-between gap-6 sm:gap-8">
            <div className="space-y-4 sm:space-y-6 flex-1">
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
                  L1s Index
                </h1>
              </div>

              {/* Key metrics - 2x2 grid on mobile, inline on desktop */}
              <div className="grid grid-cols-2 sm:flex sm:items-baseline gap-y-3 gap-x-6 sm:gap-6 md:gap-12 pt-4">
                <div className="flex items-baseline">
                  <span className="text-2xl sm:text-3xl md:text-4xl font-semibold tabular-nums text-zinc-900 dark:text-white">
                    {overviewMetrics.chains.length}
                  </span>
                  <span className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 ml-1 sm:ml-2">
                    chains
                  </span>
                </div>
                <div className="flex items-baseline justify-end sm:justify-start">
                  <span className="text-2xl sm:text-3xl md:text-4xl font-semibold tabular-nums text-zinc-900 dark:text-white">
                    <AnimatedNumber value={totalTx} />
                  </span>
                  <span className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 ml-1 sm:ml-2">
                    txns
                  </span>
                </div>
                <div className="flex items-baseline">
                  <SpeedGauge value={parseFloat(totalTps)} />
                </div>
                <div className="flex items-baseline justify-end sm:justify-start">
                  <span className="text-2xl sm:text-3xl md:text-4xl font-semibold tabular-nums text-zinc-900 dark:text-white">
                    {formatNumber(overviewMetrics.aggregated.totalValidators)}
                  </span>
                  <span className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 ml-1 sm:ml-2">
                    validators
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 w-full sm:w-auto mt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => (window.location.href = "/stats/chain-list")}
                className="w-full sm:w-auto gap-2 text-zinc-600 dark:text-zinc-400 border-zinc-300 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-600"
              >
                <Network className="h-3.5 w-3.5" />
                Chain List
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  window.open(
                    "https://github.com/ava-labs/builders-hub/blob/master/constants/l1-chains.json",
                    "_blank"
                  )
                }
                className="w-full sm:w-auto gap-2 text-zinc-600 dark:text-zinc-400 border-zinc-300 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-600"
              >
                Submit L1
                <ExternalLink className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* Secondary stats row - responsive */}
          <div className="flex flex-wrap items-center gap-4 sm:gap-6 md:gap-8 mt-6 sm:mt-8 pt-4 sm:pt-6 border-t border-zinc-200 dark:border-zinc-800">
            <div className="flex items-center gap-2">
              <span className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
                {timeRangeLabel} ICM:
              </span>
              <span className="text-xs sm:text-sm font-medium text-zinc-900 dark:text-white">
                {formatNumber(totalIcm)}
              </span>
            </div>
            <div className="hidden sm:block w-px h-4 bg-zinc-300 dark:bg-zinc-700" />
            <div className="flex items-center gap-2">
              <span className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
                Validation Fees:
              </span>
              <div className="flex items-center gap-1">
                <AvalancheLogo
                  className="w-3 h-3 sm:w-4 sm:h-4"
                  fill="currentColor"
                />
                <span className="text-xs sm:text-sm font-medium text-zinc-900 dark:text-white">
                  8,310
                </span>
              </div>
            </div>
            <div className="hidden sm:block w-px h-4 bg-zinc-300 dark:bg-zinc-700" />
            <div className="flex items-center gap-2">
              <span className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
                Fees Burned:
              </span>
              <div className="flex items-center gap-1">
                <AvalancheLogo
                  className="w-3 h-3 sm:w-4 sm:h-4"
                  fill="currentColor"
                />
                <span className="text-xs sm:text-sm font-medium text-zinc-900 dark:text-white">
                  {formatNumber(4930978)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Network visualization - full bleed */}
      <div className="bg-zinc-900 dark:bg-black">
        <div className="h-[400px] sm:h-[500px] md:h-[560px]">
          {cosmosData.length > 0 ? (
            <NetworkDiagram
              data={cosmosData}
              icmFlows={icmFlows}
              failedChainIds={icmFailedChainIds}
            />
          ) : (
            <div className="h-full flex items-center justify-center text-zinc-500 text-xs sm:text-sm">
              No network data
            </div>
          )}
        </div>
      </div>

      {/* Table section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {/* Table header */}
        <div className="mb-4">
          {/* Title row with time range selector */}
          <div className="flex items-center justify-between gap-4 mb-4">
            <div className="flex items-baseline gap-2 sm:gap-3">
              <h2 className="text-lg sm:text-xl font-semibold text-zinc-900 dark:text-white">
                All Chains
              </h2>
              <span className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
                {sortedData.length} tracked
              </span>
            </div>

            {/* Time range filter */}
            <div className="flex items-center rounded-full border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 p-1">
              {(["day", "week", "month"] as TimeRangeKey[]).map((range) => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={`px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-medium rounded-full transition-all ${
                    timeRange === range
                      ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-sm"
                      : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"
                  }`}
                >
                  {TIME_RANGE_CONFIG[range].shortLabel}
                </button>
              ))}
            </div>
          </div>

          {/* Category filter badges and search bar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
            {/* Category filter badges */}
            <div className="flex flex-wrap items-center gap-2 flex-1">
              {/* Visible category badges */}
              {visibleCategories.map((category) => {
                const count =
                  category === "All"
                    ? chains.length
                    : chains.filter(
                        (c) =>
                          getChainCategory(c.chainId, c.chainName) === category
                      ).length;

                return (
                  <CategoryChip
                    key={category}
                    category={category}
                    selected={selectedCategory === category}
                    count={count}
                    onClick={() => {
                      setSelectedCategory(category);
                      setVisibleCount(25);
                    }}
                  />
                );
              })}

              {/* More dropdown for overflow categories */}
              {overflowCategories.length > 0 && (
                <div className="relative" ref={categoryDropdownRef}>
                  <button
                    onClick={() =>
                      setCategoryDropdownOpen(!categoryDropdownOpen)
                    }
                    className={`px-3 py-1.5 text-xs sm:text-sm font-medium rounded-full border transition-all flex items-center gap-1 ${
                      overflowCategories.includes(selectedCategory)
                        ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 border-transparent"
                        : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                    }`}
                  >
                    {overflowCategories.includes(selectedCategory)
                      ? selectedCategory
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
                        const count = chains.filter(
                          (c) =>
                            getChainCategory(c.chainId, c.chainName) ===
                            category
                        ).length;

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
                              <span>{category}</span>
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
            </div>

            {/* Search bar */}
            <div className="relative w-full sm:w-auto sm:flex-shrink-0 sm:w-64">
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
          </div>
        </div>

        {/* Table */}
        <div className="overflow-hidden border-0 bg-white dark:bg-zinc-950">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
                <tr>
                  <th className="px-4 sm:px-6 py-4 text-left">
                    <SortButton field="chainName" align="left">
                      <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                        Name
                      </span>
                    </SortButton>
                  </th>
                  <th className="px-4 sm:px-6 py-4 text-right">
                    <SortButton field="activeAddresses" align="right">
                      <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                        {timeRangeLabel} Addresses
                      </span>
                    </SortButton>
                  </th>
                  <th className="px-4 sm:px-6 py-4 text-right">
                    <SortButton field="txCount" align="right">
                      <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                        {timeRangeLabel} Txns
                      </span>
                    </SortButton>
                  </th>
                  <th className="px-4 sm:px-6 py-4 text-right">
                    <SortButton field="icmMessages" align="right">
                      <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                        {timeRangeLabel} ICM
                      </span>
                    </SortButton>
                  </th>
                  <th className="px-4 sm:px-6 py-4 text-right">
                    <SortButton field="validatorCount" align="right">
                      <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                        Validators
                      </span>
                    </SortButton>
                  </th>
                  <th className="px-4 sm:px-6 py-4 text-right">
                    <SortButton field="tps" align="right">
                      <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                        Avg TPS
                      </span>
                    </SortButton>
                  </th>
                  <th className="px-4 sm:px-6 py-4 text-left">
                    <SortButton field="category" align="left">
                      <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                        Category
                      </span>
                    </SortButton>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {tableLoading ? (
                  <TableSkeleton />
                ) : (
                  visibleData.map((chain) => {
                    const chainSlug = getChainSlug(
                      chain.chainId,
                      chain.chainName
                    );
                    return (
                      <tr
                        key={chain.chainId}
                        className={`group transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900/50 ${
                          chainSlug ? "cursor-pointer" : ""
                        }`}
                        onClick={() =>
                          chainSlug &&
                          (window.location.href = `/stats/l1/${chainSlug}`)
                        }
                      >
                        <td className="px-4 sm:px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800 flex-shrink-0 overflow-hidden">
                              {chain.chainLogoURI ? (
                                <Image
                                  src={
                                    getThemedLogoUrl(chain.chainLogoURI) ||
                                    "/placeholder.svg"
                                  }
                                  alt={chain.chainName}
                                  width={40}
                                  height={40}
                                  className="h-full w-full rounded-full object-cover"
                                  onError={(e) => {
                                    e.currentTarget.style.display = "none";
                                  }}
                                />
                              ) : (
                                <span className="text-base font-semibold text-zinc-600 dark:text-zinc-300">
                                  {chain.chainName.charAt(0)}
                                </span>
                              )}
                            </div>
                            <span className="font-medium text-zinc-900 dark:text-zinc-100">
                              {chain.chainName}
                            </span>
                            {chainSlug && (
                              <ArrowUpRight className="h-4 w-4 text-zinc-400 opacity-0 transition-opacity group-hover:opacity-100" />
                            )}
                          </div>
                        </td>
                        <td className="px-4 sm:px-6 py-4 text-right font-mono text-sm tabular-nums text-zinc-900 dark:text-zinc-100">
                          {typeof chain.activeAddresses === "number"
                            ? formatFullNumber(chain.activeAddresses)
                            : "N/A"}
                        </td>
                        <td className="px-4 sm:px-6 py-4 text-right font-mono text-sm tabular-nums text-zinc-900 dark:text-zinc-100">
                          {typeof chain.txCount === "number"
                            ? formatFullNumber(Math.round(chain.txCount))
                            : "N/A"}
                        </td>
                        <td className="px-4 sm:px-6 py-4 text-right font-mono text-sm tabular-nums text-zinc-900 dark:text-zinc-100">
                          {icmFailedChainIds.includes(chain.chainId) ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="text-amber-500 cursor-pointer inline-flex justify-end">
                                  <Info className="w-4 h-4" />
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Data unavailable</p>
                              </TooltipContent>
                            </Tooltip>
                          ) : typeof chain.icmMessages === "number" ? (
                            formatFullNumber(Math.round(chain.icmMessages))
                          ) : (
                            "N/A"
                          )}
                        </td>
                        <td className="px-4 sm:px-6 py-4 text-right font-mono text-sm tabular-nums text-zinc-900 dark:text-zinc-100">
                          {typeof chain.validatorCount === "number"
                            ? formatFullNumber(chain.validatorCount)
                            : chain.validatorCount}
                        </td>
                        <td className="px-4 sm:px-6 py-4 text-right font-mono text-sm tabular-nums text-zinc-900 dark:text-zinc-100">
                          {getChainTPS(chain)}
                        </td>
                        <td className="px-4 sm:px-6 py-4">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${getCategoryColor(
                              getChainCategory(chain.chainId, chain.chainName)
                            )}`}
                          >
                            {getChainCategory(chain.chainId, chain.chainName)}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {hasMoreData && !tableLoading && (
          <div className="flex justify-center mt-4 sm:mt-6 pb-14">
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
      </div>

      <StatsBubbleNav />
    </div>
  );
}
