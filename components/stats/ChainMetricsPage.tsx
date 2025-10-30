"use client";
import { useState, useEffect, useMemo } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis, Tooltip, Brush, ResponsiveContainer } from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {Users, Activity, FileText, MessageSquare, TrendingUp, UserPlus, Hash, Code2, Zap, Gauge, DollarSign, TrendingDown, Clock, Fuel, ExternalLink } from "lucide-react";
import { StatsBubbleNav } from "@/components/stats/stats-bubble.config";
import { ChartSkeletonLoader } from "@/components/ui/chart-skeleton";

interface TimeSeriesDataPoint {
  date: string;
  value: number | string;
}

interface ICMDataPoint {
  date: string;
  messageCount: number;
}

interface TimeSeriesMetric {
  current_value: number | string;
  data: TimeSeriesDataPoint[];
}

interface ICMMetric {
  current_value: number;
  data: ICMDataPoint[];
}

interface CChainMetrics {
  activeAddresses: TimeSeriesMetric;
  activeSenders: TimeSeriesMetric;
  cumulativeAddresses: TimeSeriesMetric;
  cumulativeDeployers: TimeSeriesMetric;
  txCount: TimeSeriesMetric;
  cumulativeTxCount: TimeSeriesMetric;
  cumulativeContracts: TimeSeriesMetric;
  gasUsed: TimeSeriesMetric;
  avgGps: TimeSeriesMetric;
  maxGps: TimeSeriesMetric;
  avgTps: TimeSeriesMetric;
  maxTps: TimeSeriesMetric;
  avgGasPrice: TimeSeriesMetric;
  maxGasPrice: TimeSeriesMetric;
  feesPaid: TimeSeriesMetric;
  icmMessages: ICMMetric;
  last_updated: number;
}

interface ChainMetricsPageProps {
  chainId?: string;
  chainName?: string;
  description?: string;
  themeColor?: string;
}

export default function ChainMetricsPage({
  chainId = "43114",
  chainName = "Avalanche C-Chain",
  description = "Real-time metrics and analytics for the Avalanche C-Chain",
  themeColor = "#E57373",
}: ChainMetricsPageProps) {
  const [metrics, setMetrics] = useState<CChainMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/chain-stats/${chainId}?timeRange=all`);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const chainData = await response.json();
      setMetrics(chainData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [chainId]);

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

  const formatGasPrice = (price: number | string): string => {
    if (price === "N/A" || price === "") return "N/A";
    const priceValue =
      typeof price === "string" ? Number.parseFloat(price) : price;
    if (isNaN(priceValue)) return "N/A";

    const gwei = priceValue / 1e9;
    if (gwei < 1) {
      return `${gwei.toFixed(3)} gwei`;
    }
    return `${gwei.toFixed(2)} gwei`;
  };

  const formatGas = (gas: number | string): string => {
    if (gas === "N/A" || gas === "") return "N/A";
    const gasValue = typeof gas === "string" ? Number.parseFloat(gas) : gas;
    if (isNaN(gasValue)) return "N/A";

    if (gasValue >= 1e9) {
      return `${(gasValue / 1e9).toFixed(2)}B gas`;
    } else if (gasValue >= 1e6) {
      return `${(gasValue / 1e6).toFixed(2)}M gas`;
    } else if (gasValue >= 1e3) {
      return `${(gasValue / 1e3).toFixed(2)}K gas`;
    }
    return `${gasValue.toLocaleString()} gas`;
  };

  const formatRate = (rate: number | string, unit: string): string => {
    if (rate === "N/A" || rate === "") return "N/A";
    const rateValue = typeof rate === "string" ? Number.parseFloat(rate) : rate;
    if (isNaN(rateValue)) return "N/A";
    return `${rateValue.toFixed(2)} ${unit}`;
  };

  const formatEther = (wei: number | string): string => {
    if (wei === "N/A" || wei === "") return "N/A";
    const weiValue = typeof wei === "string" ? Number.parseFloat(wei) : wei;
    if (isNaN(weiValue)) return "N/A";

    const ether = weiValue / 1e18;
    const isC_Chain = chainName.includes("C-Chain");
    const unit = isC_Chain ? " AVAX" : "";

    if (ether >= 1e6) {
      return `${(ether / 1e6).toFixed(2)}M${unit}`;
    } else if (ether >= 1e3) {
      return `${(ether / 1e3).toFixed(2)}K${unit}`;
    } else if (ether >= 1) {
      return `${ether.toFixed(2)}${unit}`;
    } else {
      return `${ether.toFixed(6)}${unit}`;
    }
  };

  const getChartData = (
    metricKey: keyof Omit<CChainMetrics, "last_updated" | "icmMessages">
  ) => {
    if (!metrics || !metrics[metricKey]?.data) return [];

    return metrics[metricKey].data
      .map((point: TimeSeriesDataPoint) => ({
        day: point.date,
        value:
          typeof point.value === "string"
            ? Number.parseFloat(point.value)
            : point.value,
      }))
      .reverse();
  };

  const getICMChartData = () => {
    if (!metrics?.icmMessages?.data) return [];

    return metrics.icmMessages.data
      .map((point: ICMDataPoint) => ({
        day: point.date,
        value: point.messageCount,
      }))
      .reverse();
  };

  const formatTooltipValue = (value: number, metricKey: string): string => {
    switch (metricKey) {
      case "activeAddresses":
        return `${formatNumber(value)} Active Addresses`;
      case "activeSenders":
        return `${formatNumber(value)} Active Senders`;
      case "txCount":
        return `${formatNumber(value)} Transactions`;
      case "cumulativeAddresses":
        return `${formatNumber(value)} Total Addresses`;
      case "cumulativeDeployers":
        return `${formatNumber(value)} Total Deployers`;
      case "cumulativeTxCount":
        return `${formatNumber(value)} Total Transactions`;
      case "cumulativeContracts":
        return `${formatNumber(value)} Total Contracts`;
      case "gasUsed":
        return formatGas(value);
      case "avgGps":
        return formatRate(value, "GPS");
      case "maxGps":
        return formatRate(value, "GPS");
      case "avgTps":
        return formatRate(value, "TPS");
      case "maxTps":
        return formatRate(value, "TPS");
      case "avgGasPrice":
        return formatGasPrice(value);
      case "maxGasPrice":
        return formatGasPrice(value);
      case "feesPaid":
        return formatEther(value);
      case "icmMessages":
        return `${formatNumber(value)} ICM Messages`;
      default:
        return formatNumber(value);
    }
  };

  const getCurrentValue = (
    metricKey: keyof Omit<CChainMetrics, "last_updated">
  ): number | string => {
    if (!metrics || !metrics[metricKey]) return "N/A";
    return metrics[metricKey].current_value;
  };

  const chartConfigs = [
    {
      title: "Active Addresses",
      icon: Users,
      metricKey: "activeAddresses" as const,
      description: "Distinct addresses active on the network",
      color: themeColor,
      chartType: "bar" as const,
    },
    {
      title: "Active Senders",
      icon: UserPlus,
      metricKey: "activeSenders" as const,
      description: "Addresses sending transactions",
      color: themeColor,
      chartType: "area" as const,
    },
    {
      title: "Daily Transactions",
      icon: Activity,
      metricKey: "txCount" as const,
      description: "Transaction volume over time",
      color: themeColor,
      chartType: "bar" as const,
    },
    {
      title: "Total Addresses",
      icon: Hash,
      metricKey: "cumulativeAddresses" as const,
      description: "Cumulative unique addresses since genesis",
      color: themeColor,
      chartType: "area" as const,
    },
    {
      title: "Total Deployers",
      icon: Code2,
      metricKey: "cumulativeDeployers" as const,
      description: "Cumulative contract deployers since genesis",
      color: themeColor,
      chartType: "area" as const,
    },
    {
      title: "Total Transactions",
      icon: Hash,
      metricKey: "cumulativeTxCount" as const,
      description: "Cumulative transaction count since genesis",
      color: themeColor,
      chartType: "area" as const,
    },
    {
      title: "Total Contracts",
      icon: FileText,
      metricKey: "cumulativeContracts" as const,
      description: "Cumulative smart contracts deployed since genesis",
      color: themeColor,
      chartType: "area" as const,
    },
    {
      title: "Gas Used",
      icon: Fuel,
      metricKey: "gasUsed" as const,
      description: "Gas consumption over time",
      color: themeColor,
      chartType: "bar" as const,
    },
    {
      title: "Avg GPS",
      icon: Gauge,
      metricKey: "avgGps" as const,
      description: "Average gas per second",
      color: themeColor,
      chartType: "area" as const,
    },
    {
      title: "Max GPS",
      icon: Zap,
      metricKey: "maxGps" as const,
      description: "Peak gas per second",
      color: themeColor,
      chartType: "area" as const,
    },
    {
      title: "Avg TPS",
      icon: Clock,
      metricKey: "avgTps" as const,
      description: "Average transactions per second",
      color: themeColor,
      chartType: "area" as const,
    },
    {
      title: "Max TPS",
      icon: TrendingUp,
      metricKey: "maxTps" as const,
      description: "Peak transactions per second",
      color: themeColor,
      chartType: "area" as const,
    },
    {
      title: "Avg Gas Price",
      icon: DollarSign,
      metricKey: "avgGasPrice" as const,
      description: "Average gas price over time",
      color: themeColor,
      chartType: "area" as const,
    },
    {
      title: "Max Gas Price",
      icon: TrendingDown,
      metricKey: "maxGasPrice" as const,
      description: "Peak gas price over time",
      color: themeColor,
      chartType: "area" as const,
    },
    {
      title: "Fees Paid",
      icon: DollarSign,
      metricKey: "feesPaid" as const,
      description: "Total transaction fees over time",
      color: themeColor,
      chartType: "bar" as const,
    },
    {
      title: "ICM Messages",
      icon: MessageSquare,
      metricKey: "icmMessages" as const,
      description: "Interchain messaging activity",
      color: themeColor,
      chartType: "bar" as const,
    },
  ];

  const [chartPeriods, setChartPeriods] = useState<
    Record<string, "D" | "W" | "M" | "Q" | "Y">
  >(Object.fromEntries(chartConfigs.map((config) => [config.metricKey, "D"])));

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted/20">
        <div className="container mx-auto mt-4 p-6 pb-24 space-y-12">
          <div className="space-y-2">
            <div>
              <h1 className="text-2xl md:text-5xl mb-4">
                {chainName.includes("C-Chain")
                  ? "Avalanche C-Chain Metrics"
                  : `${chainName} L1 Metrics`}
              </h1>
              <p className="text-zinc-400 text-md text-left">{description}</p>
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
      <div className="min-h-screen bg-gradient-to-br from-background to-muted/20">
        <div className="container mx-auto p-6 pb-24">
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-center">
              <p className="text-destructive text-lg mb-4">
                Error loading data: {error}
              </p>
              <Button onClick={fetchData}>Retry</Button>
            </div>
          </div>
        </div>
        <StatsBubbleNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/20">
      <div className="container mx-auto mt-4 p-4 sm:p-6 pb-24 space-y-8 sm:space-y-12">
        {/* Header */}
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
            <div className="min-w-0 flex-1">
              <h1 className="text-xl sm:text-2xl md:text-5xl break-words mb-2">
                {chainName.includes("C-Chain")
                  ? "Avalanche C-Chain Metrics"
                  : `${chainName} L1 Metrics`}
              </h1>
              <p className="text-zinc-400 text-sm sm:text-md text-left">
                {description}
              </p>
            </div>
            {!chainName.includes("C-Chain") && (
              <div className="shrink-0 mt-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    window.open(`https://${chainId}.snowtrace.io`, "_blank")
                  }
                  className="flex items-center gap-2 text-xs sm:text-sm"
                >
                  <ExternalLink className="h-3 w-3 sm:h-4 sm:w-4" />
                  View Explorer
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Network Overview */}
        <section className="space-y-4 sm:space-y-6">
          <div className="space-y-2">
            <h2 className="text-lg sm:text-2xl font-medium text-left">
              Network Overview
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {[
              {
                key: "activeAddresses",
                icon: Users,
                color: themeColor,
                label: "Active Addresses",
              },
              {
                key: "txCount",
                icon: Activity,
                color: themeColor,
                label: "Daily Transactions",
              },
              {
                key: "cumulativeContracts",
                icon: FileText,
                color: themeColor,
                label: "Total Contracts",
              },
              {
                key: "icmMessages",
                icon: MessageSquare,
                color: themeColor,
                label: "ICM Messages",
              },
            ].map((item) => {
              const currentValue = getCurrentValue(
                item.key as keyof Omit<CChainMetrics, "last_updated">
              );
              const Icon = item.icon;

              return (
                <div
                  key={item.key}
                  className="text-center p-4 sm:p-6 rounded-lg bg-card border"
                >
                  <div className="flex items-center justify-center gap-2 mb-2 sm:mb-3">
                    <Icon
                      className="h-4 w-4 sm:h-5 sm:w-5"
                      style={{ color: item.color }}
                    />
                    <p className="text-xs sm:text-sm text-muted-foreground truncate">
                      {item.label}
                    </p>
                  </div>
                  <p className="text-xl sm:text-3xl font-mono font-semibold break-all">
                    {formatNumber(currentValue)}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        <section className="space-y-4 sm:space-y-6">
          <div className="space-y-2">
            <h2 className="text-lg sm:text-2xl font-medium text-left">
              Historical Trends
            </h2>
            <p className="text-zinc-400 text-sm sm:text-md text-left">
              Track {chainName} network growth and activity over time
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            {chartConfigs.map((config) => {
              const rawData =
                config.metricKey === "icmMessages"
                  ? getICMChartData()
                  : getChartData(config.metricKey);
              if (rawData.length === 0) return null;

              const period = chartPeriods[config.metricKey];
              const currentValue = getCurrentValue(config.metricKey);

              return (
                <ChartCard
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
                  formatYAxisValue={formatNumber}
                />
              );
            })}
          </div>
        </section>
      </div>

      {/* Bubble Navigation */}
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
  const [brushIndexes, setBrushIndexes] = useState<{
    startIndex: number;
    endIndex: number;
  } | null>(null);

  // Aggregate data based on selected period
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
        // Y
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

  // Set default brush range based on period
  useEffect(() => {
    if (aggregatedData.length === 0) return;

    if (period === "D") {
      // Show last 90 days for daily view only
      const daysToShow = 90;
      setBrushIndexes({
        startIndex: Math.max(0, aggregatedData.length - daysToShow),
        endIndex: aggregatedData.length - 1,
      });
    } else {
      // Show all data for W, M, Q, Y
      setBrushIndexes({
        startIndex: 0,
        endIndex: aggregatedData.length - 1,
      });
    }
  }, [period, aggregatedData.length]);

  const displayData = brushIndexes
    ? aggregatedData.slice(brushIndexes.startIndex, brushIndexes.endIndex + 1)
    : aggregatedData;

  // Calculate percentage change based on brush selection
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
    if (period === "Q") return value;
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

  const Icon = config.icon;

  return (
    <Card className="py-0 border-gray-200 dark:border-gray-700">
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
              <h3 className="text-base sm:text-lg font-semibold mb-0.5">
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
                className={`px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm rounded-md transition-colors ${
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
              {formatTooltipValue(typeof currentValue === "string" ? parseFloat(currentValue) : currentValue)}
            </div>
            {dynamicChange.change > 0 && (
              <div
                className={`flex items-center gap-1 text-xs sm:text-sm ${dynamicChange.isPositive ? "text-green-600" : "text-red-600"}`}
                title={`Change over selected time range`}
              >
                <TrendingUp
                  className={`h-3 w-3 sm:h-4 sm:w-4 ${dynamicChange.isPositive ? "" : "rotate-180"}`}
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
                    cursor={false}
                    content={({ active, payload }) => {
                      if (!active || !payload?.[0]) return null;
                      const date = new Date(payload[0].payload.day);
                      const formattedDate = date.toLocaleDateString("en-US", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      });
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
              ) : config.chartType === "area" ? (
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
                    cursor={false}
                    content={({ active, payload }) => {
                      if (!active || !payload?.[0]) return null;
                      const date = new Date(payload[0].payload.day);
                      const formattedDate = date.toLocaleDateString("en-US", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      });
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
              ) : (
                <LineChart
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
                    cursor={false}
                    content={({ active, payload }) => {
                      if (!active || !payload?.[0]) return null;
                      const date = new Date(payload[0].payload.day);
                      const formattedDate = date.toLocaleDateString("en-US", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      });
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
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke={config.color}
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
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
                  tickFormatter={formatXAxis}
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