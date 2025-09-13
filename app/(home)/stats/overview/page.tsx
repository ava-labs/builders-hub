"use client";
import type React from "react";
import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowUpDown, ArrowUp, ArrowDown, Activity, Users, BarChart3, Search, ExternalLink } from "lucide-react";
import { ChartContainer, ChartTooltip } from "@/components/ui/chart";
import { Area, AreaChart, XAxis, YAxis, CartesianGrid } from "recharts";
import { StatsBubbleNav } from "@/components/stats/stats-bubble.config";
import l1ChainsData from "@/constants/l1-chains.json";
import DateRangeFilter from "@/components/ui/DateRangeFilter";
import { ChartSkeletonLoader } from "@/components/ui/chart-skeleton";
import { TimeSeriesMetric, ICMMetric, TimeRange } from "@/types/stats";

interface ChainOverviewMetrics {
  chainId: string;
  chainName: string;
  chainLogoURI: string;
  txCount: TimeSeriesMetric;
  activeAddresses: TimeSeriesMetric;
  icmMessages: ICMMetric;
  validatorCount: number | string;
}

interface OverviewMetrics {
  chains: ChainOverviewMetrics[];
  aggregated: {
    totalTxCount: TimeSeriesMetric;
    totalActiveAddresses: TimeSeriesMetric;
    totalICMMessages: ICMMetric;
    totalValidators: number;
    activeChains: number;
  };
  last_updated: number;
}

type SortDirection = "asc" | "desc";

export default function AvalancheMetrics() {
  const [overviewMetrics, setOverviewMetrics] =
    useState<OverviewMetrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortField, setSortField] = useState<string>("weeklyTxCount");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [visibleCount, setVisibleCount] = useState(25);
  const [searchTerm, setSearchTerm] = useState("");
  const [timeRange, setTimeRange] = useState<TimeRange>("1y");

  const getChainSlug = (chainId: string, chainName: string): string | null => {
    const chain = l1ChainsData.find(
      (c) =>
        c.chainId === chainId ||
        c.chainName.toLowerCase() === chainName.toLowerCase()
    );
    return chain?.slug || null;
  };

  useEffect(() => {
    const fetchMetrics = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/overview-stats?timeRange=${timeRange}`
        );
        if (!response.ok) {
          throw new Error(`Failed to fetch metrics: ${response.status}`);
        }

        const metrics = await response.json();
        setOverviewMetrics(metrics);
      } catch (err: any) {
        console.error("Error fetching metrics data:", err);
        setError(err?.message || "Failed to load metrics data");
      }

      setLoading(false);
    };

    fetchMetrics();
  }, [timeRange]);

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

  const formatFullNumber = (num: number): string => {
    return num.toLocaleString();
  };

  const formatDateLabel = (dateString: string): string => {
    const date = new Date(dateString);

    if (timeRange === "all") {
      return date.toLocaleDateString("en-US", {
        month: "short",
        year: "numeric",
      });
    } else {
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
    }
  };

  const formatTooltipDate = (payload: any): string => {
    // Use the stored timestamp/date from chart data instead of parsing label
    const dataPoint = chartData.find((d) => d.day === payload);
    if (dataPoint && dataPoint.fullDate) {
      // Use ISO date string for reliable parsing
      const date = new Date(dataPoint.fullDate);

      if (timeRange === "all") {
        return date.toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric",
        });
      } else {
        return date.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        });
      }
    }

    // Fallback - try to parse the label directly with current year
    const currentYear = new Date().getFullYear();
    const date = new Date(`${payload}, ${currentYear}`);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const getChartData = () => {
    if (!overviewMetrics) {
      return { chartData: [], topChains: [] };
    }

    const allValidChains = overviewMetrics.chains
      .filter(
        (chain) => typeof chain.txCount.current_value === "number" && chain.txCount.current_value > 0
      )
      .sort(
        (a, b) => (b.txCount.current_value as number) - (a.txCount.current_value as number)
      );

    const validChains = allValidChains.slice(0, CHART_CONFIG.maxTopChains);
    const aggregatedData = overviewMetrics.aggregated.totalTxCount.data;
    const today = new Date().toISOString().split("T")[0];
    let finalizedData = aggregatedData.filter((dataPoint) => dataPoint.date !== today);

    if (timeRange === "all" && finalizedData.length > 365) {
      const sampleRate = Math.ceil(finalizedData.length / 365);
      finalizedData = finalizedData.filter((_, index) => index % sampleRate === 0);
    }
    
    const chartData = finalizedData.map((dataPoint) => {
      const day = new Date(dataPoint.timestamp * 1000).toLocaleDateString(
        "en-US",
        timeRange === "all"
          ? {
              month: "short",
              day: "numeric",
              year: "2-digit",
            }
          : {
              month: "short",
              day: "numeric",
            }
      );

      const result: any = {
        day,
        timestamp: dataPoint.timestamp,
        fullDate: dataPoint.date,
      };

      validChains.forEach((chain) => {
        const chainKey =
          chain.chainName.length > 10
            ? chain.chainName.substring(0, 10) + "..."
            : chain.chainName;
        const chainDataPoint = chain.txCount.data.find(
          (point) => point.date === dataPoint.date
        );
        const value =
          chainDataPoint && typeof chainDataPoint.value === "number"
            ? chainDataPoint.value
            : 0;
        result[chainKey] = value;
        result[`${chainKey}_fullName`] = chain.chainName;
      });

      result["Total"] =
        typeof dataPoint.value === "number" ? dataPoint.value : 0;
      result["Total_fullName"] = "Total";
      return result;
    });

    chartData.reverse();
    return { chartData, topChains: validChains };
  };

  const chartConfig = {
    transactions: {
      label: "Daily Transactions",
    },
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
    setVisibleCount(25);
  };

  const chains = overviewMetrics?.chains || [];

  const filteredData = chains.filter((chain) => {
    return chain.chainName.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const sortedData = [...filteredData].sort((a, b) => {
    let aValue: any;
    let bValue: any;

    switch (sortField) {
      case "chainName":
        aValue = a.chainName;
        bValue = b.chainName;
        break;
      case "weeklyTxCount":
        aValue =
          typeof a.txCount.current_value === "number"
            ? a.txCount.current_value
            : 0;
        bValue =
          typeof b.txCount.current_value === "number"
            ? b.txCount.current_value
            : 0;
        break;
      case "weeklyActiveAddresses":
        aValue =
          typeof a.activeAddresses.current_value === "number"
            ? a.activeAddresses.current_value
            : 0;
        bValue =
          typeof b.activeAddresses.current_value === "number"
            ? b.activeAddresses.current_value
            : 0;
        break;
      case "totalIcmMessages":
        aValue =
          typeof a.icmMessages.current_value === "number"
            ? a.icmMessages.current_value
            : 0;
        bValue =
          typeof b.icmMessages.current_value === "number"
            ? b.icmMessages.current_value
            : 0;
        break;
      case "validatorCount":
        aValue = typeof a.validatorCount === "number" ? a.validatorCount : 0;
        bValue = typeof b.validatorCount === "number" ? b.validatorCount : 0;
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

    const aNum = typeof aValue === "number" ? aValue : 0;
    const bNum = typeof bValue === "number" ? bValue : 0;
    return sortDirection === "asc" ? aNum - bNum : bNum - aNum;
  });

  const visibleData = sortedData.slice(0, visibleCount);
  const hasMoreData = visibleCount < sortedData.length;

  const handleLoadMore = () => {
    setVisibleCount((prev) => Math.min(prev + 25, sortedData.length));
  };

  const SortButton = ({
    field,
    children,
  }: {
    field: string;
    children: React.ReactNode;
  }) => (
    <Button
      variant="ghost"
      size="sm"
      className="h-auto p-0 font-medium hover:bg-transparent text-muted-foreground hover:text-foreground transition-colors"
      onClick={() => handleSort(field)}
    >
      <span className="flex items-center gap-1.5">
        {children}
        {sortField === field ? (
          sortDirection === "asc" ? (
            <ArrowUp className="h-3.5 w-3.5" />
          ) : (
            <ArrowDown className="h-3.5 w-3.5" />
          )
        ) : (
          <ArrowUpDown className="h-3.5 w-3.5 opacity-40" />
        )}
      </span>
    </Button>
  );

  const getActivityDots = (chain: ChainOverviewMetrics) => {
    const txCount =
      typeof chain.txCount.current_value === "number"
        ? chain.txCount.current_value
        : 0;
    const addrCount =
      typeof chain.activeAddresses.current_value === "number"
        ? chain.activeAddresses.current_value
        : 0;
    const icmCount =
      typeof chain.icmMessages.current_value === "number"
        ? chain.icmMessages.current_value
        : 0;

    if (txCount === 0 && addrCount === 0 && icmCount === 0) return 0;
    if (txCount < 100 && addrCount < 1000 && icmCount < 10) return 1;
    if (txCount < 1000 && addrCount < 10000 && icmCount < 100) return 2;

    return 3;
  };

  const ActivityIndicator = ({ count }: { count: number }) => {
    const getColor = (index: number) => {
      if (index >= count) return "bg-muted";
      if (count === 1) return "bg-red-500";
      if (count === 2) return "bg-yellow-500";
      return "bg-green-600";
    };

    return (
      <div className="flex items-center justify-center gap-1">
        {[...Array(3)].map((_, i) => (
          <div key={i} className={`w-3 h-1.5 rounded-full ${getColor(i)}`} />
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <div className="container mx-auto px-4 py-8 pb-24 space-y-12">
          <div className="space-y-2">
            <div>
              <h1 className="text-3xl lg:text-4xl font-bold tracking-tight">Avalanche Mainnet L1 Stats</h1>
              <p className="text-base text-muted-foreground max-w-2xl leading-relaxed">Loading comprehensive stats for Avalanche Mainnet L1s...</p>
            </div>
          </div>
          <ChartSkeletonLoader />
        </div>

        {/* Bubble Navigation */}
        <StatsBubbleNav />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <main className="container mx-auto px-4 py-8 pb-24 space-y-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <Card className="max-w-md">
              <CardContent className="p-6 text-center">
                <div className="w-12 h-12 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Activity className="h-6 w-6 text-destructive" />
                </div>
                <h3 className="text-lg font-semibold mb-2">
                  Failed to Load Data
                </h3>
                <p className="text-destructive text-sm">{error}</p>
              </CardContent>
            </Card>
          </div>
        </main>

        {/* Bubble Navigation */}
        <StatsBubbleNav />
      </div>
    );
  }

  if (!overviewMetrics || overviewMetrics.chains.length === 0) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <main className="container mx-auto px-4 py-8 pb-24 space-y-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <Card className="max-w-md">
              <CardContent className="p-6 text-center">
                <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                  <BarChart3 className="h-6 w-6 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-2">
                  No Data Available
                </h3>
                <p className="text-muted-foreground text-sm">
                  No chain metrics found from the API.
                </p>
              </CardContent>
            </Card>
          </div>
        </main>

        {/* Bubble Navigation */}
        <StatsBubbleNav />
      </div>
    );
  }

  const CHART_CONFIG = {
    colors: ["#0ea5e9", "#8b5cf6", "#f97316", "#22c55e", "#ec4899", "#f59e0b", "#ef4444", "#06b6d4", "#84cc16", "#a855f7", "#6b7280"],
    maxTopChains: 10,
  };

  const { chartData, topChains } = getChartData();

  const getYAxisDomain = (data: any[]): [number, number] => {
    if (data.length === 0) return [0, 100];
    const allValues = data.flatMap((dataPoint) => {
      return topChains
        .map((chain) => {
          const chainKey = chain.chainName.length > 10 ? chain.chainName.substring(0, 10) + "..." : chain.chainName;
          return dataPoint[chainKey] || 0;
        }).filter((val) => val > 0);
    });

    if (allValues.length === 0) return [0, 100];

    const min = Math.min(...allValues);
    const max = Math.max(...allValues);

    if (min > 100) {
      const baseStart = min * 0.7;
      const padding = (max - min) * 0.2; // More padding for better visibility
      console.log(`Applying Y-axis offset: ${baseStart} to ${max + padding}`);
      return [baseStart, max + padding];
    }
    const padding = (max - min) * 0.1;
    return [0, max + padding];
  };

  const yAxisDomain = getYAxisDomain(chartData);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="container mx-auto px-4 py-8 pb-24 space-y-8">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
          <div className="space-y-3">
            <h1 className="text-3xl lg:text-4xl font-bold tracking-tight">
              Avalanche Mainnet L1 Stats
            </h1>
            <p className="text-base text-muted-foreground max-w-2xl leading-relaxed">
              Opinionated stats for Avalanche Mainnet L1s. Click on any chain to
              view detailed metrics.
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <DateRangeFilter
              onRangeChange={(range) =>
                setTimeRange(range as "30d" | "90d" | "1y" | "all")
              }
              defaultRange={timeRange}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
          <Card className="py-0 bg-card hover:border-border transition-colors">
            <CardContent className="p-6">
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-muted-foreground">
                  Active Mainnet Avalanche L1s
                </h3>
                <div className="space-y-1">
                  <p className="text-3xl font-bold text-foreground">
                    {overviewMetrics.chains.length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="py-0 bg-card hover:border-border transition-colors">
            <CardContent className="p-6">
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-muted-foreground">
                  Total Transactions ({timeRange})
                </h3>
                <div className="space-y-1">
                  <p className="text-3xl font-bold text-foreground">
                    {formatNumber(
                      typeof overviewMetrics.aggregated.totalTxCount
                        .current_value === "number"
                        ? overviewMetrics.aggregated.totalTxCount.current_value
                        : 0
                    )}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="py-0 bg-card hover:border-border transition-colors">
            <CardContent className="p-6">
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-muted-foreground">
                  Active Addresses ({timeRange})
                </h3>
                <div className="space-y-1">
                  <p className="text-3xl font-bold text-foreground">
                    {formatNumber(
                      typeof overviewMetrics.aggregated.totalActiveAddresses
                        .current_value === "number"
                        ? overviewMetrics.aggregated.totalActiveAddresses
                            .current_value
                        : 0
                    )}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <Card className="py-0 bg-blue-500/10 border-blue-500/20">
            <CardContent className="p-4">
              <div className="text-center space-y-1">
                <p className="text-xs font-medium text-muted-foreground">
                  Active Chains ({timeRange})
                </p>
                <p className="text-lg font-bold text-foreground">
                  {overviewMetrics.aggregated.activeChains}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="py-0 bg-green-500/10 border-green-500/20">
            <CardContent className="p-4">
              <div className="text-center space-y-1">
                <p className="text-xs font-medium text-muted-foreground">
                  ICM Messages
                </p>
                <p className="text-lg font-bold text-foreground">
                  {formatNumber(
                    overviewMetrics.aggregated.totalICMMessages.current_value
                  )}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="py-0 bg-yellow-500/10 border-yellow-500/20">
            <CardContent className="p-4">
              <div className="text-center space-y-1">
                <p className="text-xs font-medium text-muted-foreground">
                  Total Validators
                </p>
                <p className="text-lg font-bold text-foreground">
                  {formatNumber(overviewMetrics.aggregated.totalValidators)}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg md:text-xl">
              <BarChart3 className="h-5 w-5 text-orange-500" />
              Daily Transaction Trends - Top L1s ({timeRange})
            </CardTitle>
            <p className="text-sm text-muted-foreground">Stacked daily transaction volumes showing total activity across top L1s for the selected time range</p>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[350px] w-full">
              <AreaChart
                data={chartData}
                margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
              >
                <defs>
                  {topChains.map((_, index) => (
                    <linearGradient
                      key={index}
                      id={`gradient-${index}`}
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="5%"
                        stopColor={CHART_CONFIG.colors[index]}
                        stopOpacity={0.8}
                      />
                      <stop
                        offset="95%"
                        stopColor={CHART_CONFIG.colors[index]}
                        stopOpacity={0.1}
                      />
                    </linearGradient>
                  ))}
                  <linearGradient
                    id="gradient-others"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="5%"
                      stopColor={CHART_CONFIG.colors[10]}
                      stopOpacity={0.8}
                    />
                    <stop
                      offset="95%"
                      stopColor={CHART_CONFIG.colors[10]}
                      stopOpacity={0.1}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  vertical={false}
                  strokeDasharray="3 3"
                  className="stroke-muted/30"
                />
                <XAxis
                  dataKey="day"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  minTickGap={32}
                  tickFormatter={(value) => formatDateLabel(value)}
                  tick={{
                    fontFamily:
                      'ui-monospace, SFMono-Regular, "SF Mono", Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                    fontSize: 12,
                  }}
                />
                <YAxis
                  domain={yAxisDomain}
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  tickFormatter={(value) => formatNumber(value)}
                  tick={{
                    fontFamily:
                      'ui-monospace, SFMono-Regular, "SF Mono", Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                    fontSize: 12,
                  }}
                />
                <ChartTooltip
                  cursor={false}
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      const validPayload = payload
                        .filter(
                          (entry) =>
                            typeof entry.value === "number" && entry.value > 0
                        )
                        .sort(
                          (a, b) => (b.value as number) - (a.value as number)
                        );

                      return (
                        <div className="bg-background border border-border rounded-lg shadow-lg p-4 min-w-[250px]">
                          <p className="font-semibold text-sm mb-3">
                            {formatTooltipDate(label)}
                          </p>
                          <div className="space-y-2">
                            {validPayload.map((entry, index) => {
                              const fullName =
                                chartData.find((d) => d.day === label)?.[
                                  `${entry.dataKey}_fullName`
                                ] || entry.dataKey;
                              return (
                                <div
                                  key={index}
                                  className="flex items-center justify-between gap-3"
                                >
                                  <div className="flex items-center gap-2">
                                    <div
                                      className="w-3 h-3 rounded-sm"
                                      style={{ backgroundColor: entry.color }}
                                    />
                                    <span className="text-sm font-medium">
                                      {fullName}
                                    </span>
                                  </div>
                                  <span className="text-sm font-mono font-semibold">
                                    {formatFullNumber(entry.value as number)} tx
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                {topChains.map((chain, index) => {
                  const key =
                    chain.chainName.length > 10
                      ? chain.chainName.substring(0, 10) + "..."
                      : chain.chainName;
                  return (
                    <Area
                      key={index}
                      type="monotone"
                      dataKey={key}
                      stackId="1"
                      stroke={CHART_CONFIG.colors[index]}
                      strokeWidth={2}
                      fill={`url(#gradient-${index})`}
                      fillOpacity={1}
                    />
                  );
                })}
                <Area
                  type="monotone"
                  dataKey="Others"
                  stackId="1"
                  stroke={CHART_CONFIG.colors[10]}
                  strokeWidth={2}
                  fill="url(#gradient-others)"
                  fillOpacity={1}
                />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 rounded-xl bg-white"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setSearchTerm("");
              setVisibleCount(25);
            }}
          >
            Clear Search
          </Button>
        </div>

        <div className="bg-card/50 backdrop-blur-sm rounded-lg border overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-b-2 bg-muted/30 hover:bg-muted/30">
                  <TableHead className="font-medium py-6 px-6 text-muted-foreground min-w-[200px]">
                    <SortButton field="chainName">L1 Name</SortButton>
                  </TableHead>
                  <TableHead className="font-medium text-center min-w-[140px] text-muted-foreground">
                    <SortButton field="weeklyTxCount">
                      <span className="hidden lg:flex items-center gap-1">
                        <BarChart3 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        Transactions ({timeRange})
                      </span>
                      <span className="lg:hidden">Transactions</span>
                    </SortButton>
                  </TableHead>
                  <TableHead className="font-medium text-center min-w-[140px] text-muted-foreground">
                    <SortButton field="weeklyActiveAddresses">
                      <span className="hidden lg:flex items-center gap-1">
                        <Users className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                        Active Addresses ({timeRange})
                      </span>
                      <span className="lg:hidden">Addresses</span>
                    </SortButton>
                  </TableHead>
                  <TableHead className="font-medium text-center min-w-[140px] text-muted-foreground">
                    <SortButton field="totalIcmMessages">
                      <span className="hidden lg:flex items-center gap-1">
                        <Activity className="h-4 w-4 text-green-600 dark:text-green-400" />
                        Total ICM Count
                      </span>
                      <span className="lg:hidden">ICM</span>
                    </SortButton>
                  </TableHead>
                  <TableHead className="font-medium text-center min-w-[140px] text-muted-foreground">
                    <SortButton field="validatorCount">
                      <span className="hidden lg:flex items-center gap-1">
                        <Users className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                        Validators
                      </span>
                      <span className="lg:hidden">Validators</span>
                    </SortButton>
                  </TableHead>
                  <TableHead className="font-medium text-center min-w-[100px] text-muted-foreground">
                    Activity
                  </TableHead>
                  <TableHead className="font-medium text-center min-w-[100px] text-muted-foreground">
                    Details
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleData.map((chain, index) => {
                  const chainSlug = getChainSlug(
                    chain.chainId,
                    chain.chainName
                  );
                  return (
                    <TableRow
                      key={chain.chainId}
                      className="border-b border-border/50 hover:bg-muted/30 transition-colors"
                    >
                      <TableCell className="py-4 px-6">
                        <div className="flex items-center gap-4">
                          <div className="relative">
                            {chain.chainLogoURI ? (
                              <Image
                                src={chain.chainLogoURI || "/placeholder.svg"}
                                alt={`${chain.chainName} logo`}
                                width={32}
                                height={32}
                                className="rounded-full flex-shrink-0 ring-2 ring-border/50"
                                onError={(e) => {
                                  e.currentTarget.style.display = "none";
                                }}
                              />
                            ) : (
                              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
                                {chain.chainName.charAt(0)}
                              </div>
                            )}
                          </div>
                          <div>
                            <div className="font-semibold text-foreground text-base">
                              {chain.chainName}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <span
                          className={`font-mono font-semibold text-sm ${
                            typeof chain.txCount.current_value === "number" &&
                            chain.txCount.current_value > 0
                              ? "text-foreground"
                              : "text-muted-foreground"
                          }`}
                        >
                          {typeof chain.txCount.current_value === "number"
                            ? formatFullNumber(chain.txCount.current_value)
                            : chain.txCount.current_value}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span
                          className={`font-mono font-semibold text-sm ${
                            typeof chain.activeAddresses.current_value ===
                              "number" &&
                            chain.activeAddresses.current_value > 0
                              ? "text-foreground"
                              : "text-muted-foreground"
                          }`}
                        >
                          {typeof chain.activeAddresses.current_value ===
                          "number"
                            ? formatFullNumber(
                                chain.activeAddresses.current_value
                              )
                            : chain.activeAddresses.current_value}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span
                          className={`font-mono font-semibold text-sm ${
                            typeof chain.icmMessages.current_value ===
                              "number" && chain.icmMessages.current_value > 0
                              ? "text-foreground"
                              : "text-muted-foreground"
                          }`}
                        >
                          {typeof chain.icmMessages.current_value === "number"
                            ? formatFullNumber(chain.icmMessages.current_value)
                            : chain.icmMessages.current_value}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span
                          className={`font-mono font-semibold text-sm ${
                            typeof chain.validatorCount === "number" &&
                            chain.validatorCount > 0
                              ? "text-foreground"
                              : "text-muted-foreground"
                          }`}
                        >
                          {typeof chain.validatorCount === "number"
                            ? formatFullNumber(chain.validatorCount)
                            : chain.validatorCount}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <ActivityIndicator count={getActivityDots(chain)} />
                      </TableCell>
                      <TableCell className="text-center">
                        {chainSlug ? (
                          <Link href={`/stats/l1/${chainSlug}`}>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 hover:bg-primary/10"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          </Link>
                        ) : (
                          <span className="text-muted-foreground text-xs">
                            —
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>

        {hasMoreData && (
          <div className="flex justify-center">
            <Button
              onClick={handleLoadMore}
              variant="outline"
              size="lg"
              className="px-8 py-3 bg-transparent"
            >
              Load More Chains ({sortedData.length - visibleCount} remaining)
            </Button>
          </div>
        )}

        <div className="text-center">
          <p className="text-sm text-muted-foreground mb-2">
            Showing {Math.min(visibleCount, sortedData.length)} of{" "}
            {sortedData.length} chains
          </p>
        </div>
      </main>

      {/* Bubble Navigation */}
      <StatsBubbleNav />
    </div>
  );
}
