"use client";
import { useState, useEffect, useMemo, useRef } from "react";
import {Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis, Tooltip, Brush, ResponsiveContainer} from "recharts";
import {Card, CardContent} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select";
import {MessageSquare, TrendingUp, ArrowUpRight, BookOpen, Camera, Download, Globe, ChevronRight} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { StatsBubbleNav } from "@/components/stats/stats-bubble.config";
import { ICMMetric } from "@/types/stats";
import Image from "next/image";
import l1ChainsData from "@/constants/l1-chains.json";
import { AvalancheLogo } from "@/components/navigation/avalanche-logo";
import { useTheme } from "next-themes";
import { toPng } from "html-to-image";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { ICTTDashboard, ICTTTransfersTable } from "@/components/stats/ICTTDashboard";
import ICMFlowChart from "@/components/stats/ICMFlowChart";
import { LinkableHeading } from "@/components/stats/LinkableHeading";
import { ChainCategoryFilter, allChains } from "@/components/stats/ChainCategoryFilter";

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

interface ICMFlowResponse {
  flows: any[];
  sourceNodes: any[];
  targetNodes: any[];
  totalMessages: number;
  last_updated: number;
}

export default function ICMStatsPage() {
  const [metrics, setMetrics] = useState<ICMStats | null>(null);
  const [icttData, setIcttData] = useState<ICTTStats | null>(null);
  const [icmFlowData, setIcmFlowData] = useState<ICMFlowResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [icttLoading, setIcttLoading] = useState(true);
  const [icmFlowLoading, setIcmFlowLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chartPeriod, setChartPeriod] = useState<"D" | "W" | "M" | "Q" | "Y">(
    "D"
  );
  const [activeSection, setActiveSection] = useState<string>("overview");

  // Chain filter state - start with all chains
  const [selectedChainIds, setSelectedChainIds] = useState<Set<string>>(
    () => new Set(allChains.map((c) => c.chainId))
  );

  const handleSelectionChange = (newSelection: Set<string>) => {
    setSelectedChainIds(newSelection);
  };

  const selectedChainNames = useMemo(() => {
    const names = new Set<string>();
    allChains.forEach((chain) => {
      if (selectedChainIds.has(chain.chainId)) {
        names.add(chain.chainName);
      }
    });
    return names;
  }, [selectedChainIds]);

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

  const fetchIcmFlowData = async () => {
    try {
      setIcmFlowLoading(true);
      const response = await fetch("/api/icm-flow?days=30");
      if (response.ok) {
        const data = await response.json();
        setIcmFlowData(data);
      }
    } catch (err) {
      console.error("Error fetching ICM flow data:", err);
    } finally {
      setIcmFlowLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    fetchIcttData();
    fetchIcmFlowData();
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
      .map((point: AggregatedICMDataPoint) => {
        // only include selected chains
        const filteredBreakdown: Record<string, number> = {};
        let filteredTotal = 0;

        Object.entries(point.chainBreakdown).forEach(([chainName, count]) => {
          if (selectedChainNames.has(chainName)) {
            filteredBreakdown[chainName] = count;
            filteredTotal += count;
          }
        });

        return {
          day: point.date,
          value: filteredTotal,
          chainBreakdown: filteredBreakdown,
        };
      })
      .reverse();
  };

  const getTopChains = () => {
    if (!metrics?.aggregatedData) return [];

    const chainTotals: Record<string, number> = {};

    metrics.aggregatedData.forEach((point) => {
      Object.entries(point.chainBreakdown).forEach(([chainName, count]) => {
        // Only include selected chains
        if (selectedChainNames.has(chainName)) {
          chainTotals[chainName] = (chainTotals[chainName] || 0) + count;
        }
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

  const getTopPeers = (chainName: string) => {
    if (!filteredIcmFlowData?.flows) return [];

    const peerMap = new Map<
      string,
      { count: number; logo: string; color: string }
    >();

    filteredIcmFlowData.flows.forEach((flow: any) => {
      if (flow.sourceChain === chainName) {
        const current = peerMap.get(flow.targetChain) || {
          count: 0,
          logo: flow.targetLogo,
          color: flow.targetColor,
        };
        current.count += flow.messageCount;
        peerMap.set(flow.targetChain, current);
      } else if (flow.targetChain === chainName) {
        const current = peerMap.get(flow.sourceChain) || {
          count: 0,
          logo: flow.sourceLogo,
          color: flow.sourceColor,
        };
        current.count += flow.messageCount;
        peerMap.set(flow.sourceChain, current);
      }
    });

    return Array.from(peerMap.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 3)
      .map(([name, data]) => ({ name, ...data }));
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

  // Calculate key metrics for header (filtered by selected chains)
  const totalICMMessages = useMemo(() => {
    if (!metrics?.aggregatedData) return 0;
    return metrics.aggregatedData.reduce((sum, point) => {
      const filteredSum = Object.entries(point.chainBreakdown).reduce(
        (acc, [chainName, count]) => {
          return selectedChainNames.has(chainName) ? acc + count : acc;
        },
        0
      );
      return sum + filteredSum;
    }, 0);
  }, [metrics?.aggregatedData, selectedChainNames]);

  const dailyICM = useMemo(() => {
    if (!metrics?.aggregatedData || metrics.aggregatedData.length === 0) return 0;
    const latestPoint = metrics.aggregatedData[0];
    return Object.entries(latestPoint.chainBreakdown).reduce(
      (acc, [chainName, count]) => {
        return selectedChainNames.has(chainName) ? acc + count : acc;
      },
      0
    );
  }, [metrics?.aggregatedData, selectedChainNames]);

  const avgDailyICM = Math.round(totalICMMessages / 365); // Keep average for reference
  const totalICTTTransfers = icttData?.overview?.totalTransfers || 0;
  const totalICTTVolumeUsd = icttData?.overview?.totalVolumeUsd || 0;
  const icttPercentage =
    totalICMMessages > 0
      ? ((totalICTTTransfers / totalICMMessages) * 100).toFixed(1)
      : "0";

  // Filter ICM flow data based on selected chains
  const filteredIcmFlowData = useMemo(() => {
    if (!icmFlowData) return null;

    const filteredFlows = icmFlowData.flows.filter(
      (flow: any) => selectedChainNames.has(flow.sourceChain) || selectedChainNames.has(flow.targetChain)
    );
    
    const sourceNodeMap = new Map<string, any>();
    const targetNodeMap = new Map<string, any>();
    let totalMessages = 0;

    filteredFlows.forEach((flow: any) => {
      totalMessages += flow.messageCount;

      if (!sourceNodeMap.has(flow.sourceChain)) {
        sourceNodeMap.set(flow.sourceChain, {
          id: flow.sourceChainId,
          name: flow.sourceChain,
          logo: flow.sourceLogo,
          color: flow.sourceColor,
          totalMessages: 0,
          isSource: true,
        });
      }
      sourceNodeMap.get(flow.sourceChain).totalMessages += flow.messageCount;

      if (!targetNodeMap.has(flow.targetChain)) {
        targetNodeMap.set(flow.targetChain, {
          id: flow.targetChainId,
          name: flow.targetChain,
          logo: flow.targetLogo,
          color: flow.targetColor,
          totalMessages: 0,
          isSource: false,
        });
      }
      targetNodeMap.get(flow.targetChain).totalMessages += flow.messageCount;
    });

    return {
      ...icmFlowData,
      flows: filteredFlows,
      sourceNodes: Array.from(sourceNodeMap.values()),
      targetNodes: Array.from(targetNodeMap.values()),
      totalMessages,
    };
  }, [icmFlowData, selectedChainNames]);

  // Filter ICTT transfers data based on selected chains
  const filteredIcttData = useMemo(() => {
    if (!icttData) return null;

    const filteredTransfers = icttData.transfers.filter(
      (transfer: any) =>
        selectedChainNames.has(transfer.homeChainName) ||
        selectedChainNames.has(transfer.remoteChainName) ||
        selectedChainNames.has(transfer.homeChainDisplayName) ||
        selectedChainNames.has(transfer.remoteChainDisplayName)
    );

    return {
      ...icttData,
      transfers: filteredTransfers,
    };
  }, [icttData, selectedChainNames]);

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
          <nav className="flex items-center gap-1.5 text-xs sm:text-sm mb-3 sm:mb-4 pb-1">
            <Link
              href="/stats/overview"
              className="inline-flex items-center gap-1 sm:gap-1.5 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors cursor-pointer whitespace-nowrap flex-shrink-0"
            >
              <Globe className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              <span>Ecosystem</span>
            </Link>
            <ChevronRight className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-zinc-300 dark:text-zinc-600 flex-shrink-0" />
            <span className="inline-flex items-center gap-1 sm:gap-1.5 font-medium text-zinc-900 dark:text-zinc-100 whitespace-nowrap flex-shrink-0">
              <MessageSquare className="w-3 h-3 sm:w-3.5 sm:h-3.5 flex-shrink-0 text-red-600 dark:text-red-500" />
              <span>Interchain Messaging</span>
            </span>
          </nav>

          <div className="flex flex-col sm:flex-row items-start justify-between gap-6 sm:gap-8">
            <div className="space-y-4 sm:space-y-6 flex-1">
              <div>
                <div className="flex items-center gap-2 sm:gap-3 mb-3">
                  <AvalancheLogo className="w-4 h-4 sm:w-5 sm:h-5" fill="#E84142"/>
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

              {/* Chain Filter */}
              <div className="mt-6">
                <ChainCategoryFilter
                  selectedChainIds={selectedChainIds}
                  onSelectionChange={handleSelectionChange}
                  showChainChips={true}
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                variant="outline"
                size="sm"
                asChild
                className="border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-zinc-400 dark:hover:border-zinc-600"
              >
                <a
                  href="/academy/avalanche-l1/avalanche-fundamentals/interoperability/icm-icmContracts-and-ictt"
                  className="flex items-center gap-2"
                >
                  <BookOpen className="h-4 w-4" />
                  <span className="hidden sm:inline">ICM Docs</span>
                  <span className="sm:hidden">ICM</span>
                </a>
              </Button>
              <Button
                variant="outline"
                size="sm"
                asChild
                className="border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-zinc-400 dark:hover:border-zinc-600"
              >
                <a
                  href="/docs/cross-chain/interchain-token-transfer/overview"
                  className="flex items-center gap-2"
                >
                  <ArrowUpRight className="h-4 w-4" />
                  <span className="hidden sm:inline">ICTT Docs</span>
                  <span className="sm:hidden">ICTT</span>
                </a>
              </Button>
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
        <section className="space-y-6">
          <div className="space-y-2">
            <LinkableHeading as="h2" id="overview" className="text-xl sm:text-2xl font-semibold text-zinc-900 dark:text-white">
              ICM Overview
            </LinkableHeading>
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
        <section className="space-y-6">
          <div className="space-y-2">
            <LinkableHeading as="h2" id="top-chains" className="text-xl sm:text-2xl font-semibold text-zinc-900 dark:text-white">
              Top Chains by ICM Activity
            </LinkableHeading>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Leading L1s by message volume over the past 365 days
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-xl overflow-hidden h-[500px]">
              {icmFlowLoading ? (
                <div className="h-full w-full flex items-center justify-center bg-zinc-100 dark:bg-zinc-900 rounded-xl">
                  <div className="animate-pulse text-zinc-500">
                    Loading ICM flows...
                  </div>
                </div>
              ) : (
                <ICMFlowChart data={filteredIcmFlowData} height={520} maxFlows={30} />
              )}
            </div>

            <div
              className="flex flex-col gap-4 h-[520px] overflow-y-auto pr-1"
              style={{ scrollbarWidth: "thin" }}
            >
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
                const topPeers = getTopPeers(chain.chainName);

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
                      "group relative rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm p-4 transition-all flex-shrink-0",
                      slug
                        ? "hover:border-zinc-300 dark:hover:border-zinc-700 hover:shadow-sm cursor-pointer"
                        : "cursor-default"
                    )}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        {/* Rank Badge */}
                        <div
                          className={cn(
                            "flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold",
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
                            {/* Chain name + Category on same line */}
                            <div className="flex items-center gap-2 flex-wrap">
                              <div className="font-semibold text-base text-zinc-900 dark:text-white truncate group-hover:text-red-600 dark:group-hover:text-red-500 transition-colors">
                                {chain.chainName}
                              </div>
                              <span
                                className={cn(
                                  "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium flex-shrink-0",
                                  getCategoryStyle(category)
                                )}
                              >
                                {category}
                              </span>
                            </div>
                            {/* Top Routes Chips */}
                            {topPeers.length > 0 && (
                              <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                                {topPeers.map((peer) => (
                                  <Badge
                                    key={peer.name}
                                    variant="secondary"
                                    className="px-1.5 py-0.5 h-5 text-[10px] font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border-0 gap-1 pointer-events-none"
                                    title={`${formatNumber(
                                      peer.count
                                    )} messages`}
                                  >
                                    {peer.logo ? (
                                      <Image
                                        src={peer.logo}
                                        alt={peer.name}
                                        width={12}
                                        height={12}
                                        className="rounded-full object-cover"
                                        unoptimized
                                      />
                                    ) : (
                                      <div
                                        className="w-3 h-3 rounded-full flex items-center justify-center text-[6px] text-white font-bold"
                                        style={{ backgroundColor: peer.color }}
                                      >
                                        {peer.name.charAt(0)}
                                      </div>
                                    )}
                                    {peer.name}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Message Count + Percentage */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <div className="text-right">
                            <div className="font-mono font-bold text-lg text-zinc-900 dark:text-white tabular-nums">
                              {formatNumber(chain.count)}
                            </div>
                            <div className="text-xs text-zinc-500 dark:text-zinc-400">
                              {percentage}%
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
        <section className="space-y-6">
          <div className="space-y-2">
            <LinkableHeading as="h2" id="ictt" className="text-xl sm:text-2xl font-semibold text-zinc-900 dark:text-white">
              Interchain Token Transfer (ICTT) Analytics
            </LinkableHeading>
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
        <section className="space-y-6">
          <div className="space-y-2">
            <LinkableHeading as="h2" id="transfers" className="text-xl sm:text-2xl font-semibold text-zinc-900 dark:text-white">
              Top Transfers
            </LinkableHeading>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Recent ICTT transfer activity details
            </p>
          </div>

          <ICTTTransfersTable data={filteredIcttData} onLoadMore={handleLoadMoreTransfers} loadingMore={loadingMoreTransfers} />
        </section>
      </main>

      <StatsBubbleNav />
    </div>
  );
}

// ChartCard component with camera, CSV export, and dropdown period selector
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
  const { resolvedTheme } = useTheme();
  const chartContainerRef = useRef<HTMLDivElement>(null);

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

  const handleScreenshot = async () => {
    const element = chartContainerRef.current;
    if (!element) return;

    try {
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

  // CSV download function
  const downloadCSV = () => {
    if (!displayData || displayData.length === 0) return;

    const headers = ["Date", config.title];
    const rows = displayData.map((point: any) => {
      return [point.day, point.value].join(",");
    });

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

  const Icon = config.icon;

  return (
    <Card className="border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm py-0 shadow-none" ref={chartContainerRef}>
      <CardContent className="p-0">
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 sm:py-4 border-b border-zinc-200 dark:border-zinc-700">
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
              <h3 className="text-base sm:text-lg font-normal text-zinc-900 dark:text-white">
                {config.title}
              </h3>
              <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 hidden sm:block">
                {config.description}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Select value={period} onValueChange={(value) => onPeriodChange(value as "D" | "W" | "M" | "Q" | "Y")}>
              <SelectTrigger className="h-7 w-auto px-2 gap-1 text-xs sm:text-sm border-0 bg-transparent hover:bg-zinc-100 dark:hover:bg-zinc-800 focus:ring-0 shadow-none">
                <SelectValue>
                  {period === "D" ? "Daily": period === "W" ? "Weekly": period === "M" ? "Monthly": period === "Q" ? "Quarterly": "Yearly"}
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
              className="p-1.5 sm:p-2 rounded-md text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors cursor-pointer"
              title="Download chart as image"
            >
              <Camera className="h-4 w-4" />
            </button>
            <button
              onClick={downloadCSV}
              className="p-1.5 sm:p-2 rounded-md text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors cursor-pointer"
              title="Download CSV"
            >
              <Download className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="px-5 pt-6 pb-6">
          <div className="flex items-center gap-2 sm:gap-4 mb-3 sm:mb-4 pl-2 flex-wrap">
            <div className="text-md sm:text-base font-mono break-all">
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
