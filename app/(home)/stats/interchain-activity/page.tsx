"use client";
import { useState, useEffect, useMemo } from "react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis, Tooltip, Brush, ResponsiveContainer } from "recharts";
import {Card, CardContent, CardHeader, CardTitle, CardDescription} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MessageSquare, TrendingUp, Trophy, ArrowUpRight } from "lucide-react";
import { StatsBubbleNav } from "@/components/stats/stats-bubble.config";
import { ChartSkeletonLoader } from "@/components/ui/chart-skeleton";
import { ICMMetric } from "@/types/stats";
import { ICMGlobe } from "@/components/stats/ICMGlobe";
import Image from "next/image";
import l1ChainsData from "@/constants/l1-chains.json";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { ICTTDashboard } from "@/components/stats/ICTTDashboard";

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
  const [chartPeriod, setChartPeriod] = useState<"D" | "W" | "M" | "Q" | "Y">("D");

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

      const limit = offset === 0 ? 10 : 25;
      const response = await fetch(`/api/ictt-stats?limit=${limit}&offset=${offset}`);

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

  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-neutral-950 pt-8">
        <main className="container mx-auto px-6 py-10 pb-24 space-y-8">
          <div className="space-y-3">
            <div>
              <h1 className="text-4xl sm:text-4xl font-semibold tracking-tight text-black dark:text-white">
                Avalanche Interchain Activity
              </h1>
              <p className="text-base text-neutral-600 dark:text-neutral-400 max-w-2xl leading-relaxed mt-2">
                Loading comprehensive ICM statistics...
              </p>
            </div>
          </div>
          <ChartSkeletonLoader />
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
            <Card className="max-w-md border border-gray-200 dark:border-gray-700 rounded-md bg-card">
              <div className="p-6 text-center">
                <div className="w-12 h-12 bg-red-50 dark:bg-red-950 rounded-md flex items-center justify-center mx-auto mb-4">
                  <MessageSquare className="h-6 w-6 text-red-600 dark:text-red-400" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  Failed to Load Data
                </h3>
                <p className="text-red-600 dark:text-red-400 text-sm mb-4">{error}</p>
                <Button onClick={fetchData}>Retry</Button>
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
                Avalanche Interchain Activity
              </h1>
              <p className="text-base text-neutral-600 dark:text-neutral-400 max-w-2xl leading-relaxed mt-2">
                Comprehensive overview of the Avalanche Interchain Messaging activity across L1s
              </p>
            </div>
          </div>
        </div>

        <section className="space-y-4 sm:space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="flex justify-start items-start">
              <ICMGlobe />
            </div>

            <div className="flex flex-col gap-4">
              <Card className="w-full overflow-hidden border border-gray-200 dark:border-gray-700 rounded-md bg-card">
                <CardHeader className="pb-3 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg font-medium text-foreground">
                        Top 5 Chains by ICM Activity
                      </CardTitle>
                      <CardDescription className="mt-1.5 text-sm text-muted-foreground">
                        Total incoming and outgoing messages over the past 365 days
                      </CardDescription>
                    </div>
                    <div className="p-2 rounded-md" style={{ backgroundColor: "#E8414220" }}>
                      <Trophy className="w-4 h-4" style={{ color: "#E84142" }}/>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent border-gray-200 dark:border-gray-700">
                        <TableHead className="w-16 pl-4 text-xs font-medium tracking-wide text-muted-foreground uppercase">Rank</TableHead>
                        <TableHead className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Chain</TableHead>
                        <TableHead className="pr-4 text-xs font-medium tracking-wide text-right text-muted-foreground uppercase">Messages</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {getTopChains().map((chain, index) => (
                        <TableRow key={chain.chainName} className="group transition-colors hover:bg-muted/50 border-gray-200 dark:border-gray-700">
                          <TableCell className="pl-4 font-medium">
                            <div
                              className={cn(
                                "flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium",
                                index === 0 ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" : "text-muted-foreground"
                              )}
                            >
                              {index + 1}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              {chain.logo ? (
                                <Image
                                  src={chain.logo}
                                  alt={chain.chainName}
                                  width={28}
                                  height={28}
                                  className="rounded-full object-cover flex-shrink-0"
                                  onError={(e) => {e.currentTarget.style.display = "none"}}
                                />
                              ) : (
                                <div
                                  className="flex items-center justify-center w-7 h-7 rounded-full"
                                  style={{ backgroundColor: chain.color }}
                                >
                                  <span className="text-white text-xs font-semibold">
                                    {chain.chainName.charAt(0)}
                                  </span>
                                </div>
                              )}
                              <a
                                href={`/stats/l1/${l1ChainsData.find((c) => c.chainName === chain.chainName)?.slug || ""}`}
                                className="font-medium text-foreground group-hover:text-primary transition-colors hover:underline"
                                onClick={(e) => {
                                  const slug = l1ChainsData.find(
                                    (c) => c.chainName === chain.chainName
                                  )?.slug;
                                  if (!slug) e.preventDefault();
                                }}
                              >
                                {chain.chainName}
                              </a>
                            </div>
                          </TableCell>
                          <TableCell className="pr-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <span className="font-mono font-semibold text-foreground">{formatNumber(chain.count)}</span>
                              <ArrowUpRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        <section className="space-y-4 sm:space-y-6">
          <div className="space-y-2">
            <h2 className="text-lg sm:text-2xl font-medium text-left">Historical Trends</h2>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:gap-6">
            {chartConfigs.map((config) => {
              const rawData = getChartData();
              if (rawData.length === 0) return null;

              const currentValue = metrics?.dailyMessageVolume?.current_value || 0;

              return (
                <ChartCard
                  key={config.metricKey}
                  config={config}
                  rawData={rawData}
                  period={chartPeriod}
                  currentValue={currentValue}
                  onPeriodChange={(newPeriod) => setChartPeriod(newPeriod)}
                  formatTooltipValue={(value) =>formatNumber(Math.round(value))}
                  formatYAxisValue={formatNumber}
                />
              );
            })}
          </div>
        </section>

        <ICTTDashboard data={icttData} onLoadMore={handleLoadMoreTransfers} loadingMore={loadingMoreTransfers}/>
      </main>

      <StatsBubbleNav />
    </div>
  );
}

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

      if (!grouped.has(key)) { grouped.set(key, { sum: 0, count: 0, date: key, chainBreakdown: {} }); }

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

  const displayData = brushIndexes ? aggregatedData.slice(brushIndexes.startIndex, brushIndexes.endIndex + 1) : aggregatedData;

  const dynamicChange = useMemo(() => {
    if (!displayData || displayData.length < 2) {
      return { change: 0, isPositive: true };
    }

    const lastValue = displayData[displayData.length - 1].value;
    const secondLastValue = displayData[displayData.length - 2].value;

    if (secondLastValue === 0) {
      return { change: 0, isPositive: true };
    }

    const changePercentage = ((lastValue - secondLastValue) / secondLastValue) * 100;

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
    <Card className="border border-gray-200 dark:border-gray-700 rounded-md bg-card py-0">
      <CardContent className="p-0">
        <div className="flex items-center justify-between px-4 sm:px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div
              className="rounded-md p-2 flex items-center justify-center"
              style={{ backgroundColor: `${config.color}20` }}
            >
              <Icon className="h-4 w-4 sm:h-5 sm:w-5" style={{ color: config.color }}/>
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-medium">{config.title}</h3>
              <p className="text-xs sm:text-sm text-muted-foreground hidden sm:block">{config.description}</p>
            </div>
          </div>
          <div className="flex gap-1">
            {(["D", "W", "M", "Q", "Y"] as const).map((p) => (
              <button
                key={p}
                onClick={() => onPeriodChange(p)}
                className={`px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md transition-colors ${
                  period === p ? "text-white dark:text-white" : "text-muted-foreground hover:bg-muted"
                }`}
                style={period === p ? { backgroundColor: `${config.color}` } : {}}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        <div className="px-4 sm:px-5 pt-5 pb-5">
          <div className="flex items-center gap-3 sm:gap-4 mb-4 pl-0 flex-wrap">
            <div className="text-lg sm:text-xl font-mono font-semibold break-all">
              {formatTooltipValue(typeof currentValue === "string" ? parseFloat(currentValue) : currentValue)}
            </div>
            {dynamicChange.change > 0 && (
              <div
                className={`flex items-center gap-1 text-sm ${dynamicChange.isPositive ? "text-green-600" : "text-red-600"}`}
                title={`Change over selected time range`}
              >
                <TrendingUp className={`h-4 w-4 ${dynamicChange.isPositive ? "" : "rotate-180"}`}/>
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
              <BarChart data={displayData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
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
                    const formattedDate = formatTooltipDate(payload[0].payload.day);
                    const chainBreakdown = payload[0].payload.chainBreakdown;

                    // Sort chains by message count
                    const sortedChains = chainBreakdown
                      ? Object.entries(chainBreakdown)
                          .sort(([, a], [, b]) => (b as number) - (a as number))
                          .slice(0, 8) // Show top 8 chains
                      : [];

                    return (
                      <div className="rounded-md border border-gray-200 dark:border-gray-700 bg-card p-3 shadow-lg font-mono max-w-sm">
                        <div className="grid gap-2">
                          <div className="font-medium text-sm border-b border-gray-200 dark:border-gray-700 pb-2">
                            {formattedDate}
                          </div>
                          <div className="text-sm font-semibold">
                            Total:{" "}{formatTooltipValue(payload[0].value as number)}
                          </div>
                          {sortedChains.length > 0 && (
                            <div className="text-xs mt-2 space-y-1.5 max-h-64 overflow-y-auto">
                              {sortedChains.map(([chainName, count]) => {
                                const chain = l1ChainsData.find((c) => c.chainName === chainName);
                                const chainColor = chain?.color || "#E84142";
                                const chainLogo = chain?.chainLogoURI || "";

                                return (
                                  <div key={chainName} className="flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-2 min-w-0">
                                      {chainLogo && (
                                        <Image
                                          src={chainLogo}
                                          alt={chainName}
                                          width={16}
                                          height={16}
                                          className="rounded-full object-cover flex-shrink-0"
                                          onError={(e) => {e.currentTarget.style.display = "none"}}
                                        />
                                      )}
                                      <span className="truncate font-medium" style={{ color: chainColor }}>
                                        {chainName}
                                      </span>
                                    </div>
                                    <span className="font-semibold text-foreground flex-shrink-0">
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
                      return <rect x={x} y={y} width={width} height={height} fill={config.color} rx={0}/>;
                    }

                    // Get top chains for this bar
                    const sortedChains = Object.entries(payload.chainBreakdown).sort(([, a], [, b]) => (b as number) - (a as number));

                    const totalValue = payload.value;
                    let currentY = y + height; // Start from bottom

                    return (
                      <g>
                        {sortedChains.map(([chainName, count], idx) => {
                          const chain = l1ChainsData.find((c) => c.chainName === chainName);
                          const chainColor = chain?.color || config.color;
                          const segmentHeight = ((count as number) / totalValue) * height;
                          const segmentY = currentY - segmentHeight;

                          const rect = <rect key={chainName} x={x} y={segmentY} width={width} height={segmentHeight} fill={chainColor} rx={0}/>;

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
              <LineChart data={aggregatedData} margin={{ top: 0, right: 30, left: 0, bottom: 5 }}>
                <Brush
                  dataKey="day"
                  height={80}
                  stroke={config.color}
                  fill={`${config.color}20`}
                  alwaysShowText={false}
                  startIndex={brushIndexes?.startIndex ?? 0}
                  endIndex={brushIndexes?.endIndex ?? aggregatedData.length - 1}
                  onChange={(e: any) => {
                    if (e.startIndex !== undefined && e.endIndex !== undefined) setBrushIndexes({startIndex: e.startIndex, endIndex: e.endIndex});
                  }}
                  travellerWidth={8}
                  tickFormatter={formatBrushXAxis}
                >
                  <LineChart>
                    <Line type="monotone" dataKey="value" stroke={config.color} strokeWidth={1} dot={false}/>
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
