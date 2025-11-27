"use client";
import { useState, useEffect, useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
  Tooltip,
  Brush,
  ResponsiveContainer,
} from "recharts";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  MessageSquare,
  TrendingUp,
  Trophy,
  ArrowUpRight,
  BookOpen,
  Activity,
  BadgeDollarSign,
  Layers,
} from "lucide-react";
import { StatsBubbleNav } from "@/components/stats/stats-bubble.config";
import { ChartSkeletonLoader } from "@/components/ui/chart-skeleton";
import { ICMMetric } from "@/types/stats";
import { ICMGlobe } from "@/components/stats/ICMGlobe";
import Image from "next/image";
import l1ChainsData from "@/constants/l1-chains.json";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  ICTTDashboard,
  ICTTTransfersTable,
} from "@/components/stats/ICTTDashboard";

interface AggregatedICMDataPoint {
  timestamp: number;
  date: string;
  totalMessageCount: number;
  chainBreakdown: Record<string, number>;
}

interface ICMStats {
  dailyMessageVolume: ICMMetric;
  aggregatedData: AggregatedICMDataPoint[];
  last_updated: number;
}

interface ICTTStats {
  overview: {
    totalTransfers: number;
    totalVolumeUsd: number;
    activeChains: number;
    activeRoutes: number;
    topToken: {
      name: string;
      percentage: string;
    };
  };
  topRoutes: Array<{
    name: string;
    total: number;
    direction: string;
  }>;
  tokenDistribution: Array<{
    name: string;
    symbol: string;
    value: number;
    address: string;
  }>;
  transfers: any[];
  last_updated: number;
}

export default function ICMStatsPage() {
  const [metrics, setMetrics] = useState<ICMStats | null>(null);
  const [icttData, setIcttData] = useState<ICTTStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [icttLoading, setIcttLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chartPeriod, setChartPeriod] = useState<"D" | "W" | "M" | "Q" | "Y">(
    "D"
  );
  const [activeSection, setActiveSection] = useState<string>("overview");

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Always fetch 1 year of data
      const response = await fetch(`/api/icm-stats?timeRange=1y`);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setMetrics(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const [loadingMoreTransfers, setLoadingMoreTransfers] = useState(false);

  const fetchIcttData = async (offset = 0, append = false) => {
    try {
      if (append) {
        setLoadingMoreTransfers(true);
      } else {
        setIcttLoading(true);
      }

      const limit = offset === 0 ? 20 : 25;
      const response = await fetch(
        `/api/ictt-stats?limit=${limit}&offset=${offset}`
      );

      if (!response.ok) {
        console.error("Failed to fetch ICTT stats:", response.status);
        return;
      }

      const data = await response.json();

      if (append && icttData) {
        setIcttData({
          ...data,
          transfers: [...icttData.transfers, ...data.transfers],
        });
      } else {
        setIcttData(data);
      }
    } catch (err) {
      console.error("Error fetching ICTT stats:", err);
    } finally {
      setIcttLoading(false);
      setLoadingMoreTransfers(false);
    }
  };

  const handleLoadMoreTransfers = () => {
    if (icttData?.transfers) {
      fetchIcttData(icttData.transfers.length, true);
    }
  };

  useEffect(() => {
    fetchData();
    fetchIcttData();
  }, []);

  // Section navigation tracking
  const sections = [
    { id: "overview", label: "ICM Overview" },
    { id: "top-chains", label: "Top Chains" },
    { id: "ictt", label: "ICTT Analytics" },
    { id: "transfers", label: "Top Transfers" },
  ];

  // Track active section on scroll
  useEffect(() => {
    const handleScroll = () => {
      const sectionElements = sections.map((sec) =>
        document.getElementById(sec.id)
      );
      const scrollPosition = window.scrollY + 180; // Account for navbar height

      for (let i = sectionElements.length - 1; i >= 0; i--) {
        const section = sectionElements[i];
        if (section && section.offsetTop <= scrollPosition) {
          setActiveSection(sections[i].id);
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

  const formatNumber = (num: number | string): string => {
    if (num === "N/A" || num === "") return "N/A";
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

  const getChartData = () => {
    if (!metrics?.aggregatedData) return [];

    return metrics.aggregatedData
      .map((point: AggregatedICMDataPoint) => ({
        day: point.date,
        value: point.totalMessageCount,
        chainBreakdown: point.chainBreakdown,
      }))
      .reverse();
  };

  const getTopChains = () => {
    if (!metrics?.aggregatedData) return [];

    const chainTotals: Record<string, number> = {};

    metrics.aggregatedData.forEach((point) => {
      Object.entries(point.chainBreakdown).forEach(([chainName, count]) => {
        chainTotals[chainName] = (chainTotals[chainName] || 0) + count;
      });
    });

    const sorted = Object.entries(chainTotals)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5);

    return sorted.map(([chainName, count]) => {
      const chain = l1ChainsData.find((c) => c.chainName === chainName);
      return {
        chainName,
        count,
        logo: chain?.chainLogoURI || "",
        color: chain?.color || "#E84142",
      };
    });
  };

  const chartConfigs = [
    {
      title: "ICM Count",
      icon: MessageSquare,
      metricKey: "dailyMessageVolume" as const,
      description: "Total Interchain Messaging volume",
      color: "#E84142",
      chartType: "bar" as const,
    },
  ];

  // Calculate key metrics for header
  const totalICMMessages =
    metrics?.aggregatedData?.reduce(
      (sum, point) => sum + point.totalMessageCount,
      0
    ) || 0;
  const dailyICM = metrics?.dailyMessageVolume?.current_value || 0; // Use current day value instead of average
  const avgDailyICM = Math.round(totalICMMessages / 365); // Keep average for reference
  const totalICTTTransfers = icttData?.overview?.totalTransfers || 0;
  const totalICTTVolumeUsd = icttData?.overview?.totalVolumeUsd || 0;
  const icttPercentage =
    totalICMMessages > 0
      ? ((totalICTTTransfers / totalICMMessages) * 100).toFixed(1)
      : "0";

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
        {/* Hero Skeleton with gradient */}
        <div className="relative overflow-hidden">
          {/* Gradient decoration skeleton */}
          <div
            className="absolute top-0 right-0 w-2/3 h-full pointer-events-none"
            style={{
              background: `linear-gradient(to left, rgba(232, 65, 66, 0.2) 0%, rgba(232, 65, 66, 0.12) 40%, rgba(232, 65, 66, 0.04) 70%, transparent 100%)`,
            }}
          />

          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 pt-8 sm:pt-16 pb-6 sm:pb-8">
            <div className="flex flex-col sm:flex-row items-start justify-between gap-6 sm:gap-8">
              <div className="space-y-4 sm:space-y-6 flex-1">
                <div>
                  <div className="flex items-center gap-2 sm:gap-3 mb-3">
                    <div className="w-4 h-4 sm:w-5 sm:h-5 bg-red-200 dark:bg-red-900/30 rounded animate-pulse" />
                    <div className="h-3 sm:h-4 w-36 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
                  </div>
                  <div className="h-8 sm:h-10 md:h-12 w-64 sm:w-80 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse mb-3" />
                  <div className="h-4 sm:h-5 w-full max-w-2xl bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />

                  {/* Metrics skeleton */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-6">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="space-y-2">
                        <div className="h-3 w-20 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
                        <div className="h-8 w-24 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <div className="h-9 w-32 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
                <div className="h-9 w-32 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
              </div>
            </div>
          </div>
        </div>

        {/* Navbar Skeleton */}
        <div className="sticky top-14 z-40 w-full bg-zinc-50/95 dark:bg-zinc-950/95 backdrop-blur-sm border-b border-t border-zinc-200 dark:border-zinc-800">
          <div className="w-full">
            <div className="flex items-center gap-2 overflow-x-auto py-3 px-4 sm:px-6 max-w-7xl mx-auto">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="h-7 sm:h-8 w-24 sm:w-32 bg-zinc-200 dark:bg-zinc-800 rounded-lg animate-pulse flex-shrink-0"
                />
              ))}
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-12 sm:space-y-16">
          {/* Charts Skeleton */}
          <section className="space-y-6">
            <div className="space-y-2">
              <div className="h-6 sm:h-8 w-40 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
              <div className="h-4 w-64 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:gap-6">
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden">
                <div className="px-4 sm:px-5 py-3 sm:py-4 border-b border-zinc-200 dark:border-zinc-800">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 sm:gap-3">
                      <div className="w-5 h-5 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
                      <div>
                        <div className="h-5 w-32 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse mb-1" />
                        <div className="h-3 w-48 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
                      </div>
                    </div>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((j) => (
                        <div
                          key={j}
                          className="h-7 w-8 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse"
                        />
                      ))}
                    </div>
                  </div>
                </div>
                <div className="px-5 pt-6 pb-6">
                  <div className="mb-4 flex items-baseline gap-2">
                    <div className="h-8 w-32 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
                    <div className="h-4 w-16 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
                  </div>
                  <div className="h-[350px] bg-zinc-100 dark:bg-zinc-800/50 rounded-lg animate-pulse" />
                  <div className="mt-4 h-20 bg-zinc-100 dark:bg-zinc-800/50 rounded-lg animate-pulse" />
                </div>
              </div>
            </div>
          </section>

          {/* Top Chains Skeleton */}
          <section className="space-y-6">
            <div className="space-y-2">
              <div className="h-6 sm:h-8 w-48 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
              <div className="h-4 w-64 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="h-[400px] bg-zinc-200 dark:bg-zinc-800 rounded-lg animate-pulse" />
              <div className="flex flex-col gap-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    className="h-20 bg-white/80 dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 rounded-lg animate-pulse"
                  />
                ))}
              </div>
            </div>
          </section>

          {/* ICTT Skeleton */}
          <section className="space-y-6">
            <div className="space-y-2">
              <div className="h-6 sm:h-8 w-56 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
              <div className="h-4 w-72 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm border border-zinc-200 dark:border-zinc-800 p-4 rounded-lg"
                >
                  <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 text-sm mb-2">
                    <div className="h-4 w-4 bg-zinc-200 dark:bg-zinc-700 rounded animate-pulse" />
                    <div className="h-4 w-24 bg-zinc-200 dark:bg-zinc-700 rounded animate-pulse" />
                  </div>
                  <div className="h-8 w-24 bg-zinc-200 dark:bg-zinc-700 rounded animate-pulse mb-1" />
                  <div className="h-3 w-16 bg-zinc-200 dark:bg-zinc-700 rounded animate-pulse" />
                </div>
              ))}
            </div>
          </section>
        </div>
        <StatsBubbleNav />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-16">
          <Card className="border border-zinc-200 dark:border-zinc-700 rounded-lg bg-card max-w-md shadow-none mx-auto">
            <div className="p-6 text-center">
              <div className="w-12 h-12 bg-red-50 dark:bg-red-950 rounded-lg flex items-center justify-center mx-auto mb-4">
                <MessageSquare className="h-6 w-6 text-red-600 dark:text-red-400" />
              </div>
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-2">
                Failed to Load Data
              </h3>
              <p className="text-red-600 dark:text-red-400 text-sm mb-4">
                {error}
              </p>
              <Button onClick={fetchData}>Retry</Button>
            </div>
          </Card>
        </div>
        <StatsBubbleNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Hero Section with Gradient */}
      <div className="relative overflow-hidden border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
        {/* Gradient decoration */}
        <div
          className="absolute top-0 right-0 w-2/3 h-full pointer-events-none"
          style={{
            background: `linear-gradient(to left, rgba(232, 65, 66, 0.2) 0%, rgba(232, 65, 66, 0.12) 40%, rgba(232, 65, 66, 0.04) 70%, transparent 100%)`,
          }}
        />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 pt-8 sm:pt-16 pb-6 sm:pb-8">
          <div className="flex flex-col sm:flex-row items-start justify-between gap-6 sm:gap-8">
            <div className="space-y-4 sm:space-y-6 flex-1">
              <div>
                <div className="flex items-center gap-2 sm:gap-3 mb-3">
                  <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5 text-red-600 dark:text-red-500" />
                  <p className="text-xs sm:text-sm font-medium text-red-600 dark:text-red-500 tracking-wide uppercase">
                    Avalanche Ecosystem
                  </p>
                </div>
                <div className="flex items-center gap-3 sm:gap-4">
                  <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-zinc-900 dark:text-white">
                    Interchain Messaging
                  </h1>
                </div>
                <div className="flex items-center gap-3 mt-3">
                  <p className="text-sm sm:text-base text-zinc-500 dark:text-zinc-400 max-w-2xl">
                    Comprehensive analytics for Avalanche Interchain Messaging
                    and Token Transfer activity across L1s
                  </p>
                </div>
              </div>

              {/* Key Metrics - Horizontal on desktop, grid on mobile */}
              <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-baseline gap-6 sm:gap-8 md:gap-12 pt-2">
                <div className="flex flex-col">
                  <span className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mb-1">
                    Total ICM (365d)
                  </span>
                  <div className="flex items-baseline gap-0.5 flex-wrap">
                    <span className="text-xl sm:text-2xl md:text-3xl font-semibold tabular-nums text-zinc-900 dark:text-white">
                      {formatNumber(totalICMMessages)}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col">
                  <span className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mb-1">
                    Latest Day ICM
                  </span>
                  <div className="flex items-baseline gap-0.5 flex-wrap">
                    <span className="text-xl sm:text-2xl md:text-3xl font-semibold tabular-nums text-zinc-900 dark:text-white">
                      {formatNumber(
                        typeof dailyICM === "string"
                          ? parseFloat(dailyICM)
                          : dailyICM
                      )}
                    </span>
                    <span className="text-xs sm:text-sm text-zinc-400 dark:text-zinc-500 ml-1">
                      avg {formatNumber(avgDailyICM)}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col">
                  <span className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mb-1">
                    ICTT Transfers
                  </span>
                  <div className="flex items-baseline gap-0.5 flex-wrap">
                    <span className="text-xl sm:text-2xl md:text-3xl font-semibold tabular-nums text-zinc-900 dark:text-white">
                      {formatNumber(totalICTTTransfers)}
                    </span>
                    <span className="text-xs sm:text-sm text-zinc-400 dark:text-zinc-500 ml-1">
                      {icttPercentage}% ICM
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <a
                href="/academy/avalanche-l1/avalanche-fundamentals/interoperability/icm-icmContracts-and-ictt"
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white border border-zinc-300 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-600 rounded-lg transition-colors whitespace-nowrap"
              >
                <BookOpen className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">What is ICM?</span>
                <span className="sm:hidden">ICM</span>
              </a>
              <a
                href="/docs/cross-chain/interchain-token-transfer/overview"
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white border border-zinc-300 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-600 rounded-lg transition-colors whitespace-nowrap"
              >
                <ArrowUpRight className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">ICTT Docs</span>
                <span className="sm:hidden">Docs</span>
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Sticky Navigation Bar */}
      <div className="sticky top-14 z-30 w-full bg-zinc-50/95 dark:bg-zinc-950/95 backdrop-blur-sm border-b border-zinc-200 dark:border-zinc-800">
        <div className="w-full">
          <div
            className="flex items-center gap-1 sm:gap-2 overflow-x-auto py-3 px-4 sm:px-6 max-w-7xl mx-auto"
            style={{
              scrollbarWidth: "none",
              msOverflowStyle: "none",
              WebkitOverflowScrolling: "touch",
            }}
          >
            {sections.map((section) => (
              <button
                key={section.id}
                onClick={() => scrollToSection(section.id)}
                className={`px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium rounded-lg whitespace-nowrap transition-all flex-shrink-0 ${
                  activeSection === section.id
                    ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-sm"
                    : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 hover:text-zinc-900 dark:hover:text-zinc-100"
                }`}
              >
                {section.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-12 sm:space-y-16 pb-24">
        {/* ICM Overview Section (Charts) */}
        <section id="overview" className="space-y-6 scroll-mt-32">
          <div className="space-y-2">
            <h2 className="text-xl sm:text-2xl font-semibold text-zinc-900 dark:text-white">
              ICM Overview
            </h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Historical messaging trends across the network
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:gap-6">
            {chartConfigs.map((config) => {
              const rawData = getChartData();
              if (rawData.length === 0) return null;

              const currentValue =
                metrics?.dailyMessageVolume?.current_value || 0;

              return (
                <ChartCard
                  key={config.metricKey}
                  config={config}
                  rawData={rawData}
                  period={chartPeriod}
                  currentValue={currentValue}
                  onPeriodChange={(newPeriod) => setChartPeriod(newPeriod)}
                  formatTooltipValue={(value) =>
                    formatNumber(Math.round(value))
                  }
                  formatYAxisValue={formatNumber}
                />
              );
            })}
          </div>
        </section>

        {/* Top Chains Section */}
        <section id="top-chains" className="space-y-6 scroll-mt-32">
          <div className="space-y-2">
            <h2 className="text-xl sm:text-2xl font-semibold text-zinc-900 dark:text-white">
              Top Chains by ICM Activity
            </h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Leading L1s by message volume over the past 365 days
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="flex justify-start items-start">
              <ICMGlobe />
            </div>

            <div className="flex flex-col gap-4">
              {getTopChains().map((chain, index) => {
                const chainData = l1ChainsData.find(
                  (c) => c.chainName === chain.chainName
                );
                const slug = chainData?.slug;
                const category = chainData?.category || "General";
                const percentage =
                  totalICMMessages > 0
                    ? ((chain.count / totalICMMessages) * 100).toFixed(1)
                    : "0";

                // Category colors matching overview page
                const getCategoryStyle = (cat: string) => {
                  const styles: Record<string, string> = {
                    DeFi: "bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400",
                    Finance:
                      "bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400",
                    Gaming:
                      "bg-violet-50 text-violet-600 dark:bg-violet-950 dark:text-violet-400",
                    Institutions:
                      "bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400",
                    RWAs: "bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400",
                    Payments:
                      "bg-rose-50 text-rose-600 dark:bg-rose-950 dark:text-rose-400",
                    Telecom:
                      "bg-cyan-50 text-cyan-600 dark:bg-cyan-950 dark:text-cyan-400",
                    SocialFi:
                      "bg-pink-50 text-pink-600 dark:bg-pink-950 dark:text-pink-400",
                    Sports:
                      "bg-orange-50 text-orange-600 dark:bg-orange-950 dark:text-orange-400",
                    Fitness:
                      "bg-lime-50 text-lime-600 dark:bg-lime-950 dark:text-lime-400",
                    AI: "bg-purple-50 text-purple-600 dark:bg-purple-950 dark:text-purple-400",
                    "AI Agents":
                      "bg-purple-50 text-purple-600 dark:bg-purple-950 dark:text-purple-400",
                    Loyalty:
                      "bg-yellow-50 text-yellow-600 dark:bg-yellow-950 dark:text-yellow-400",
                    Ticketing:
                      "bg-teal-50 text-teal-600 dark:bg-teal-950 dark:text-teal-400",
                    General:
                      "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
                  };
                  return styles[cat] || styles["General"];
                };

                return (
                  <a
                    key={chain.chainName}
                    href={slug ? `/stats/l1/${slug}` : undefined}
                    onClick={(e) => {
                      if (!slug) e.preventDefault();
                    }}
                    className={cn(
                      "group relative rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm p-4 transition-all",
                      slug
                        ? "hover:border-zinc-300 dark:hover:border-zinc-700 hover:shadow-sm cursor-pointer"
                        : "cursor-default"
                    )}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-4 min-w-0 flex-1">
                        {/* Rank Badge */}
                        <div
                          className={cn(
                            "flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold",
                            index === 0
                              ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                              : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                          )}
                        >
                          {index + 1}
                        </div>

                        {/* Chain Logo & Name */}
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          {chain.logo ? (
                            <Image
                              src={chain.logo}
                              alt={chain.chainName}
                              width={36}
                              height={36}
                              className="rounded-full object-cover flex-shrink-0 shadow-sm"
                              onError={(e) => {
                                e.currentTarget.style.display = "none";
                              }}
                            />
                          ) : (
                            <div
                              className="flex items-center justify-center w-9 h-9 rounded-full shadow-sm flex-shrink-0"
                              style={{ backgroundColor: chain.color }}
                            >
                              <span className="text-white text-sm font-semibold">
                                {chain.chainName.charAt(0)}
                              </span>
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="font-semibold text-base text-zinc-900 dark:text-white truncate group-hover:text-red-600 dark:group-hover:text-red-500 transition-colors">
                              {chain.chainName}
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <span
                                className={cn(
                                  "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium",
                                  getCategoryStyle(category)
                                )}
                              >
                                {category}
                              </span>
                              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                                {percentage}%
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Message Count */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <div className="text-right">
                            <div className="font-mono font-bold text-lg text-zinc-900 dark:text-white tabular-nums">
                              {formatNumber(chain.count)}
                            </div>
                          </div>
                          {slug && (
                            <ArrowUpRight className="w-4 h-4 text-zinc-400 dark:text-zinc-500 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                          )}
                        </div>
                      </div>
                    </div>
                  </a>
                );
              })}
            </div>
          </div>
        </section>

        {/* ICTT Section */}
        <section id="ictt" className="space-y-6 scroll-mt-32">
          <div className="space-y-2">
            <h2 className="text-xl sm:text-2xl font-semibold text-zinc-900 dark:text-white">
              Interchain Token Transfer (ICTT) Analytics
            </h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Token transfer metrics across Avalanche L1s
            </p>
          </div>

          <ICTTDashboard
            data={icttData}
            onLoadMore={handleLoadMoreTransfers}
            loadingMore={loadingMoreTransfers}
            totalICMMessages={totalICMMessages}
            showTitle={false}
          />
        </section>

        {/* Top Transfers Section - Proper section */}
        <section id="transfers" className="space-y-6 scroll-mt-32">
          <div className="space-y-2">
            <h2 className="text-xl sm:text-2xl font-semibold text-zinc-900 dark:text-white">
              Top Transfers
            </h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Recent ICTT transfer activity details
            </p>
          </div>

          <ICTTTransfersTable
            data={icttData}
            onLoadMore={handleLoadMoreTransfers}
            loadingMore={loadingMoreTransfers}
          />
        </section>
      </main>

      <StatsBubbleNav />
    </div>
  );
}

// ChartCard component (keeping original implementation)
function ChartCard({
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
  const formatNumber = (num: number | string): string => {
    if (num === "N/A" || num === "") return "N/A";
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

  const [brushIndexes, setBrushIndexes] = useState<{
    startIndex: number;
    endIndex: number;
  } | null>(null);

  const aggregatedData = useMemo(() => {
    if (period === "D") return rawData;

    const grouped = new Map<
      string,
      {
        sum: number;
        count: number;
        date: string;
        chainBreakdown: Record<string, number>;
      }
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
        grouped.set(key, { sum: 0, count: 0, date: key, chainBreakdown: {} });
      }

      const group = grouped.get(key)!;
      group.sum += point.value;
      group.count += 1;

      // Aggregate chain breakdown
      if (point.chainBreakdown) {
        Object.entries(point.chainBreakdown).forEach(([chain, count]) => {
          group.chainBreakdown[chain] =
            (group.chainBreakdown[chain] || 0) + (count as number);
        });
      }
    });

    return Array.from(grouped.values())
      .map((group) => ({
        day: group.date,
        value: group.sum,
        chainBreakdown: group.chainBreakdown,
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

    const lastValue = displayData[displayData.length - 1].value;
    const secondLastValue = displayData[displayData.length - 2].value;

    if (secondLastValue === 0) {
      return { change: 0, isPositive: true };
    }

    const changePercentage =
      ((lastValue - secondLastValue) / secondLastValue) * 100;

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
    if (period === "Y") return value;

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
    <Card className="border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm py-0 shadow-none">
      <CardContent className="p-0">
        <div className="flex items-center justify-between px-4 sm:px-5 py-4 border-b border-zinc-200 dark:border-zinc-700">
          <div className="flex items-center gap-3">
            <div
              className="rounded-lg p-2 flex items-center justify-center"
              style={{ backgroundColor: `${config.color}20` }}
            >
              <Icon
                className="h-4 w-4 sm:h-5 sm:w-5"
                style={{ color: config.color }}
              />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-semibold text-zinc-900 dark:text-white">
                {config.title}
              </h3>
              <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 hidden sm:block">
                {config.description}
              </p>
            </div>
          </div>
          <div className="flex gap-1">
            {(["D", "W", "M", "Q", "Y"] as const).map((p) => (
              <button
                key={p}
                onClick={() => onPeriodChange(p)}
                className={`px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg transition-colors ${
                  period === p
                    ? "text-white dark:text-white shadow-sm"
                    : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                }`}
                style={
                  period === p ? { backgroundColor: `${config.color}` } : {}
                }
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        <div className="px-4 sm:px-5 pt-5 pb-5">
          <div className="flex items-center gap-3 sm:gap-4 mb-4 pl-0 flex-wrap">
            <div className="text-lg sm:text-xl font-mono font-semibold break-all">
              {formatTooltipValue(
                typeof currentValue === "string"
                  ? parseFloat(currentValue)
                  : currentValue
              )}
            </div>
            {dynamicChange.change > 0 && (
              <div
                className={`flex items-center gap-1 text-sm ${
                  dynamicChange.isPositive ? "text-green-600" : "text-red-600"
                }`}
                title={`Change over selected time range`}
              >
                <TrendingUp
                  className={`h-4 w-4 ${
                    dynamicChange.isPositive ? "" : "rotate-180"
                  }`}
                />
                {dynamicChange.change >= 1000
                  ? dynamicChange.change >= 1000000
                    ? `${(dynamicChange.change / 1000000).toFixed(1)}M%`
                    : `${(dynamicChange.change / 1000).toFixed(1)}K%`
                  : `${dynamicChange.change.toFixed(1)}%`}
              </div>
            )}
          </div>

          <div className="mb-6">
            <ResponsiveContainer width="100%" height={400}>
              <BarChart
                data={displayData}
                margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  className="stroke-zinc-200 dark:stroke-zinc-700"
                  vertical={false}
                />
                <XAxis
                  dataKey="day"
                  tickFormatter={formatXAxis}
                  className="text-xs text-zinc-600 dark:text-zinc-400"
                  tick={{ className: "fill-zinc-600 dark:fill-zinc-400" }}
                  minTickGap={80}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tickFormatter={formatYAxisValue}
                  className="text-xs text-zinc-600 dark:text-zinc-400"
                  tick={{ className: "fill-zinc-600 dark:fill-zinc-400" }}
                />
                <Tooltip
                  cursor={{ fill: `${config.color}20` }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.[0]) return null;
                    const formattedDate = formatTooltipDate(
                      payload[0].payload.day
                    );
                    const chainBreakdown = payload[0].payload.chainBreakdown;

                    // Sort chains by message count
                    const sortedChains = chainBreakdown
                      ? Object.entries(chainBreakdown)
                          .sort(([, a], [, b]) => (b as number) - (a as number))
                          .slice(0, 8) // Show top 8 chains
                      : [];

                    return (
                      <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-card p-3 shadow-lg font-mono max-w-sm">
                        <div className="grid gap-2">
                          <div className="font-medium text-sm border-b border-zinc-200 dark:border-zinc-700 pb-2 text-zinc-900 dark:text-white">
                            {formattedDate}
                          </div>
                          <div className="text-sm font-semibold text-zinc-900 dark:text-white">
                            Total:{" "}
                            {formatTooltipValue(payload[0].value as number)}
                          </div>
                          {sortedChains.length > 0 && (
                            <div className="text-xs mt-2 space-y-1.5 max-h-64 overflow-y-auto">
                              {sortedChains.map(([chainName, count]) => {
                                const chain = l1ChainsData.find(
                                  (c) => c.chainName === chainName
                                );
                                const chainColor = chain?.color || "#E84142";
                                const chainLogo = chain?.chainLogoURI || "";

                                return (
                                  <div
                                    key={chainName}
                                    className="flex items-center justify-between gap-3"
                                  >
                                    <div className="flex items-center gap-2 min-w-0">
                                      {chainLogo && (
                                        <Image
                                          src={chainLogo}
                                          alt={chainName}
                                          width={16}
                                          height={16}
                                          className="rounded-full object-cover flex-shrink-0"
                                          onError={(e) => {
                                            e.currentTarget.style.display =
                                              "none";
                                          }}
                                        />
                                      )}
                                      <span
                                        className="truncate font-medium"
                                        style={{ color: chainColor }}
                                      >
                                        {chainName}
                                      </span>
                                    </div>
                                    <span className="font-semibold text-zinc-900 dark:text-white flex-shrink-0 tabular-nums">
                                      {formatNumber(count as number)}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  }}
                />
                <Bar
                  dataKey="value"
                  fill="url(#colorGradient)"
                  radius={[0, 0, 0, 0]}
                  shape={(props: any) => {
                    const { x, y, width, height, payload } = props;
                    if (!payload.chainBreakdown) {
                      return (
                        <rect
                          x={x}
                          y={y}
                          width={width}
                          height={height}
                          fill={config.color}
                          rx={0}
                        />
                      );
                    }

                    // Get top chains for this bar
                    const sortedChains = Object.entries(
                      payload.chainBreakdown
                    ).sort(([, a], [, b]) => (b as number) - (a as number));

                    const totalValue = payload.value;
                    let currentY = y + height; // Start from bottom

                    return (
                      <g>
                        {sortedChains.map(([chainName, count], idx) => {
                          const chain = l1ChainsData.find(
                            (c) => c.chainName === chainName
                          );
                          const chainColor = chain?.color || config.color;
                          const segmentHeight =
                            ((count as number) / totalValue) * height;
                          const segmentY = currentY - segmentHeight;

                          const rect = (
                            <rect
                              key={chainName}
                              x={x}
                              y={segmentY}
                              width={width}
                              height={segmentHeight}
                              fill={chainColor}
                              rx={0}
                            />
                          );

                          currentY = segmentY;
                          return rect;
                        })}
                      </g>
                    );
                  }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-6 pl-[60px]">
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
                    if (e.startIndex !== undefined && e.endIndex !== undefined)
                      setBrushIndexes({
                        startIndex: e.startIndex,
                        endIndex: e.endIndex,
                      });
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
