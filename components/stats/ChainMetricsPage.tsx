"use client";
import { useState, useEffect, useMemo } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis, Tooltip, Brush, ResponsiveContainer, ComposedChart } from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {Users, Activity, FileText, MessageSquare, TrendingUp, UserPlus, Hash, Code2, Gauge, DollarSign, Clock, Fuel, ArrowUpRight } from "lucide-react";
import { StatsBubbleNav } from "@/components/stats/stats-bubble.config";
import { ChartSkeletonLoader } from "@/components/ui/chart-skeleton";
import { ExplorerDropdown } from "@/components/stats/ExplorerDropdown";
import l1ChainsData from "@/constants/l1-chains.json";
import { L1Chain } from "@/types/stats";

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
  contracts: TimeSeriesMetric;
  deployers: TimeSeriesMetric;
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
  chainLogoURI?: string;
}

export default function ChainMetricsPage({
  chainId = "43114",
  chainName = "Avalanche C-Chain",
  description = "Real-time metrics and analytics for the Avalanche C-Chain",
  themeColor = "#E57373",
  chainLogoURI,
}: ChainMetricsPageProps) {
  const [metrics, setMetrics] = useState<CChainMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Find the current chain to get explorers
  const currentChain = useMemo(() => {
    return l1ChainsData.find((chain) => chain.chainId === chainId) as L1Chain | undefined;
  }, [chainId]);

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

    // values are already in nano terms, no conversion needed
    const isC_Chain = chainName.includes("C-Chain");
    const unit = isC_Chain ? " nAVAX" : "";

    if (priceValue < 1) {
      return `${priceValue.toFixed(3)}${unit}`;
    }
    return `${priceValue.toFixed(2)}${unit}`;
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

    if (rateValue >= 1e9) {
      return `${(rateValue / 1e9).toFixed(2)}B ${unit}`;
    } else if (rateValue >= 1e6) {
      return `${(rateValue / 1e6).toFixed(2)}M ${unit}`;
    } else if (rateValue >= 1e3) {
      return `${(rateValue / 1e3).toFixed(2)}K ${unit}`;
    }
    return `${rateValue.toFixed(2)} ${unit}`;
  };

  const formatEther = (avaxValue: number | string): string => {
    if (avaxValue === "N/A" || avaxValue === "") return "N/A";
    const value = typeof avaxValue === "string" ? Number.parseFloat(avaxValue) : avaxValue;
    if (isNaN(value)) return "N/A";
    const isC_Chain = chainName.includes("C-Chain");
    const unit = isC_Chain ? " AVAX" : "";

    if (value >= 1e6) {
      return `${(value / 1e6).toFixed(2)}M${unit}`;
    } else if (value >= 1e3) {
      return `${(value / 1e3).toFixed(2)}K${unit}`;
    } else if (value >= 1) {
      return `${value.toFixed(2)}${unit}`;
    } else {
      return `${value.toFixed(6)}${unit}`;
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
    const roundedValue = [
      "activeAddresses",
      "activeSenders",
      "txCount",
      "cumulativeAddresses",
      "cumulativeDeployers",
      "cumulativeTxCount",
      "cumulativeContracts",
      "contracts",
      "deployers",
      "icmMessages"
    ].includes(metricKey) ? Math.round(value) : value;

    switch (metricKey) {
      case "activeAddresses":
        return `${formatNumber(roundedValue)} Active Addresses`;
      case "activeSenders":
        return `${formatNumber(roundedValue)} Active Senders`;
      case "txCount":
        return `${formatNumber(roundedValue)} Transactions`;
      case "cumulativeAddresses":
        return `${formatNumber(roundedValue)} Total Addresses`;
      case "cumulativeDeployers":
        return `${formatNumber(roundedValue)} Total Deployers`;
      case "cumulativeTxCount":
        return `${formatNumber(roundedValue)} Total Transactions`;
      case "cumulativeContracts":
        return `${formatNumber(roundedValue)} Total Contracts`;
      case "contracts":
        return `${formatNumber(roundedValue)} Contracts Deployed`;
      case "deployers":
        return `${formatNumber(roundedValue)} Contract Deployers`;
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
        return `${formatNumber(roundedValue)} Interchain Messages`;
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
      title: "Transactions",
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
      title: "Total Transactions",
      icon: Hash,
      metricKey: "cumulativeTxCount" as const,
      description: "Cumulative transaction count since genesis",
      color: themeColor,
      chartType: "area" as const,
    },
    {
      title: "Smart Contracts",
      icon: FileText,
      metricKey: "contracts" as const,
      description: "New smart contracts deployed over time",
      color: themeColor,
      chartType: "bar" as const,
    },
    {
      title: "Contract Deployers",
      icon: Code2,
      metricKey: "deployers" as const,
      description: "Unique addresses deploying contracts",
      color: themeColor,
      chartType: "bar" as const,
    },
    {
      title: "Gas Used",
      icon: Fuel,
      metricKey: "gasUsed" as const,
      description: "Gas consumption over time",
      color: themeColor,
      chartType: "area" as const,
    },
    {
      title: "Gas Per Second",
      icon: Gauge,
      metricKey: "avgGps" as const,
      secondaryMetricKey: "maxGps" as const,
      description: "Average and peak gas per second",
      color: themeColor,
      chartType: "dual" as const,
    },
    {
      title: "Transactions Per Second",
      icon: Clock,
      metricKey: "avgTps" as const,
      secondaryMetricKey: "maxTps" as const,
      description: "Average and peak transactions per second",
      color: themeColor,
      chartType: "dual" as const,
    },
    {
      title: "Gas Price",
      icon: DollarSign,
      metricKey: "avgGasPrice" as const,
      secondaryMetricKey: "maxGasPrice" as const,
      description: "Average and peak gas price over time",
      color: themeColor,
      chartType: "dual" as const,
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
      title: "Interchain Messages",
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
      <div className="min-h-screen bg-gradient-to-br from-background to-muted/20 pt-8">
        <div className="container mx-auto mt-4 p-4 sm:p-6 pb-24 space-y-8 sm:space-y-12">
          {/* Hero Section Skeleton */}
          <div className="relative overflow-hidden rounded-2xl p-8 sm:p-12">
            {/* Multi-layer gradient background */}
            <div className="absolute inset-0 bg-black" />
            <div
              className="absolute inset-0 opacity-60"
              style={{
                background: `linear-gradient(140deg, ${themeColor}88 0%, transparent 70%)`
              }}
            />
            <div
              className="absolute inset-0 opacity-40"
              style={{
                background: `linear-gradient(to top left, ${themeColor}66 0%, transparent 50%)`
              }}
            />
            <div
              className="absolute inset-0 opacity-30"
              style={{
                background: `radial-gradient(circle at 50% 50%, ${themeColor}88 0%, ${themeColor}44 30%, transparent 70%)`
              }}
            />

            {/* Content */}
            <div className="relative z-10">
              {/* ExplorerDropdown Placeholder for L1s */}
              {!chainName.includes("C-Chain") && (
                <div className="flex justify-end mb-4">
                  <div className="h-8 w-28 bg-white/20 rounded-md animate-pulse" />
                </div>
              )}

              <div className="flex flex-col sm:flex-row items-start gap-6">
                {/* Chain Logo Skeleton - Only show if chainLogoURI exists */}
                {chainLogoURI && (
                  <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-white/20 animate-pulse shrink-0" />
                )}

                <div className="flex-1 min-w-0">
                  <h1 className="text-2xl sm:text-3xl md:text-4xl mb-3 text-white">
                    {chainName.includes("C-Chain")
                      ? "Avalanche C-Chain Metrics"
                      : `${chainName} L1 Metrics`}
                  </h1>
                  <p className="text-white/80 text-sm sm:text-base text-left">
                    {chainName.includes("C-Chain")
                      ? "Loading Avalanche C-chain activity and network usage..."
                      : `Loading ${chainName} metrics...`}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Network Overview Section */}
          <div className="space-y-4 sm:space-y-6">
            <div className="space-y-2">
              <h2 className="text-lg sm:text-2xl font-medium text-foreground">Network Overview</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              {/* Daily Active Addresses */}
              <Card className="border-border">
                <CardContent className="p-4 sm:p-6">
                  <div className="flex items-center gap-2 mb-2 sm:mb-3">
                    <div className="p-2 rounded-lg" style={{ backgroundColor: `${themeColor}20` }}>
                      <Users className="h-6 w-6" style={{ color: themeColor }} />
                    </div>
                    <div className="text-sm text-muted-foreground">Daily Active Addresses</div>
                  </div>
                  <div className="h-8 bg-muted rounded w-24 animate-pulse" />
                </CardContent>
              </Card>

              {/* Daily Transactions */}
              <Card className="border-border">
                <CardContent className="p-4 sm:p-6">
                  <div className="flex items-center gap-2 mb-2 sm:mb-3">
                    <div className="p-2 rounded-lg" style={{ backgroundColor: `${themeColor}20` }}>
                      <Activity className="h-6 w-6" style={{ color: themeColor }} />
                    </div>
                    <div className="text-sm text-muted-foreground">Daily Transactions</div>
                  </div>
                  <div className="h-8 bg-muted rounded w-24 animate-pulse" />
                </CardContent>
              </Card>

              {/* Total Contracts Deployed */}
              <Card className="border-border">
                <CardContent className="p-4 sm:p-6">
                  <div className="flex items-center gap-2 mb-2 sm:mb-3">
                    <div className="p-2 rounded-lg" style={{ backgroundColor: `${themeColor}20` }}>
                      <FileText className="h-6 w-6" style={{ color: themeColor }} />
                    </div>
                    <div className="text-sm text-muted-foreground">Total Contracts Deployed</div>
                  </div>
                  <div className="h-8 bg-muted rounded w-24 animate-pulse" />
                </CardContent>
              </Card>

              {/* Daily Interchain Messages */}
              <Card className="border-border">
                <CardContent className="p-4 sm:p-6">
                  <div className="flex items-center gap-2 mb-2 sm:mb-3">
                    <div className="p-2 rounded-lg" style={{ backgroundColor: `${themeColor}20` }}>
                      <MessageSquare className="h-6 w-6" style={{ color: themeColor }} />
                    </div>
                    <div className="text-sm text-muted-foreground">Daily Interchain Messages</div>
                  </div>
                  <div className="h-8 bg-muted rounded w-24 animate-pulse" />
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Historical Trends Section */}
          <div className="space-y-4 sm:space-y-6">
            <div className="space-y-2">
              <h2 className="text-lg sm:text-2xl font-medium text-foreground">Historical Trends</h2>
              <p className="text-zinc-400 text-sm sm:text-md text-left">
                Track {chainName} network growth and activity over time
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              {chartConfigs.slice(0, 8).map((config) => {
                const Icon = config.icon;
                return (
                  <Card key={config.metricKey} className="border-border overflow-hidden">
                    {/* Chart Header */}
                    <div className="px-4 sm:px-5 py-3 sm:py-4 border-b border-border">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2 sm:gap-3">
                          <Icon className="h-5 w-5" style={{ color: themeColor }} />
                          <div>
                            <h3 className="font-semibold text-foreground text-sm sm:text-base">{config.title}</h3>
                            <p className="text-xs text-muted-foreground">{config.description}</p>
                          </div>
                        </div>
                        {/* Period Buttons */}
                        <div className="flex gap-1">
                          {["D", "W", "M", "Q", "Y"].map((period) => (
                            <Button
                              key={period}
                              variant={period === "D" ? "default" : "ghost"}
                              size="sm"
                              disabled
                              className="h-7 w-8 p-0 text-xs"
                            >
                              {period}
                            </Button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Chart Content */}
                    <CardContent className="px-5 pt-6 pb-6">
                      {/* Current Value Skeleton */}
                      <div className="mb-3 sm:mb-4 flex items-baseline gap-2">
                        <div className="h-8 bg-muted rounded w-32 animate-pulse" />
                        <div className="h-4 bg-muted rounded w-16 animate-pulse" />
                      </div>

                      {/* Chart Area Skeleton */}
                      <div className="h-[400px] bg-muted/30 rounded-lg animate-pulse flex items-end justify-around p-4">
                        {[...Array(12)].map((_, barIndex) => (
                          <div
                            key={barIndex}
                            className="bg-muted rounded-t"
                            style={{
                              width: '6%',
                              height: `${30 + Math.random() * 70}%`
                            }}
                          />
                        ))}
                      </div>

                      {/* Brush Slider Skeleton */}
                      <div className="mt-4 h-20 bg-muted/20 rounded-lg animate-pulse" />
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </div>
        <StatsBubbleNav />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted/20 pt-8">
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
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/20 pt-8">
      <div className="container mx-auto mt-4 p-4 sm:p-6 pb-24 space-y-8 sm:space-y-12">
        {/* Header */}
        <div className="relative overflow-hidden rounded-2xl p-8 sm:p-12">
          {/* Multi-layer gradient background */}
          <div className="absolute inset-0 bg-black" />
          <div
            className="absolute inset-0 opacity-60"
            style={{
              background: `linear-gradient(140deg, ${themeColor}88 0%, transparent 70%)`
            }}
          />
          <div
            className="absolute inset-0 opacity-40"
            style={{
              background: `linear-gradient(to top left, ${themeColor}66 0%, transparent 50%)`
            }}
          />
          <div
            className="absolute inset-0 opacity-30"
            style={{
              background: `radial-gradient(circle at 50% 50%, ${themeColor}44 0%, transparent 70%)`
            }}
          />

          {/* Content */}
          <div className="relative z-10">
            {/* Top row with ExplorerDropdown */}
            {!chainName.includes("C-Chain") && currentChain?.explorers && (
              <div className="flex justify-end mb-4">
                <div className="[&_button]:border-neutral-300 dark:[&_button]:border-white/30 [&_button]:text-neutral-800 dark:[&_button]:text-white [&_button]:hover:bg-neutral-100 dark:[&_button]:hover:bg-white/10 [&_button]:hover:border-neutral-400 dark:[&_button]:hover:border-white/50">
                  <ExplorerDropdown
                    explorers={currentChain.explorers}
                    variant="outline"
                    size="sm"
                  />
                </div>
              </div>
            )}

            {/* Main content row */}
            <div className="flex flex-col sm:flex-row items-start gap-6">
              {/* Logo */}
              {chainLogoURI && (
                <div className="shrink-0">
                  <img
                    src={chainLogoURI}
                    alt={`${chainName} logo`}
                    className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl object-contain bg-white/10 p-2"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                </div>
              )}

              {/* Title and description */}
              <div className="flex-1 min-w-0">
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-semibold text-white mb-3 break-words">
                  {chainName.includes("C-Chain")
                    ? "Avalanche C-Chain Metrics"
                    : `${chainName} L1 Metrics`}
                </h1>
                <p className="text-white/80 text-sm sm:text-base max-w-3xl">
                  {description}
                </p>
              </div>
            </div>
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
                label: "Daily Active Addresses",
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
                label: "Total Contracts Deployed",
              },
              {
                key: "icmMessages",
                icon: MessageSquare,
                color: themeColor,
                label: "Daily Interchain Messages",
              },
            ].map((item) => {
              const currentValue = getCurrentValue(
                item.key as keyof Omit<CChainMetrics, "last_updated">
              );
              const Icon = item.icon;

              return (
                <div
                  key={item.key}
                  className="text-center p-4 sm:p-6 rounded-md bg-card border border-gray-200 dark:border-gray-700"
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
            {chartConfigs
              .filter(
                (config) =>
                  config.metricKey !== "cumulativeTxCount" &&
                  config.metricKey !== "cumulativeAddresses" &&
                  config.metricKey !== "activeSenders"
              )
              .map((config) => {
                const rawData =
                  config.metricKey === "icmMessages"
                    ? getICMChartData()
                    : getChartData(config.metricKey);
                if (rawData.length === 0) return null;

                const period = chartPeriods[config.metricKey];
                const currentValue = getCurrentValue(config.metricKey);

                // Get cumulative data for charts that need it
                let cumulativeData = null;
                if (config.metricKey === "txCount") {
                  cumulativeData = getChartData("cumulativeTxCount");
                } else if (config.metricKey === "activeAddresses") {
                  cumulativeData = getChartData("cumulativeAddresses");
                } else if (config.metricKey === "contracts") {
                  cumulativeData = getChartData("cumulativeContracts");
                } else if (config.metricKey === "deployers") {
                  cumulativeData = getChartData("cumulativeDeployers");
                }

                // secondary data for dual y-axis charts
                let secondaryData = null;
                let secondaryCurrentValue = null;
                if (config.chartType === "dual" && config.secondaryMetricKey) {
                  secondaryData = getChartData(config.secondaryMetricKey);
                  secondaryCurrentValue = getCurrentValue(config.secondaryMetricKey);
                }

                return (
                  <ChartCard
                    key={config.metricKey}
                    config={config}
                    rawData={rawData}
                    cumulativeData={cumulativeData}
                    secondaryData={secondaryData}
                    period={period}
                    currentValue={currentValue}
                    secondaryCurrentValue={secondaryCurrentValue}
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
  cumulativeData,
  secondaryData,
  period,
  currentValue,
  secondaryCurrentValue,
  onPeriodChange,
  formatTooltipValue,
  formatYAxisValue,
}: {
  config: any;
  rawData: any[];
  cumulativeData?: any[] | null;
  secondaryData?: any[] | null;
  period: "D" | "W" | "M" | "Q" | "Y";
  currentValue: number | string;
  secondaryCurrentValue?: number | string | null;
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
        value: group.sum,
      }))
      .sort((a, b) => a.day.localeCompare(b.day));
  }, [rawData, period]);

  // Aggregate cumulative data - take the last (max) value in each period
  const aggregatedCumulativeData = useMemo(() => {
    if (!cumulativeData || period === "D") return cumulativeData;

    const grouped = new Map<string, { maxValue: number; date: string }>();

    cumulativeData.forEach((point) => {
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
        grouped.set(key, { maxValue: point.value, date: key });
      } else {
        const group = grouped.get(key)!;
        group.maxValue = Math.max(group.maxValue, point.value);
      }
    });

    return Array.from(grouped.values())
      .map((group) => ({
        day: group.date,
        value: group.maxValue,
      }))
      .sort((a, b) => a.day.localeCompare(b.day));
  }, [cumulativeData, period]);

  // Aggregate secondary data for dual y-axis charts
  const aggregatedSecondaryData = useMemo(() => {
    if (!secondaryData || period === "D") return secondaryData;

    const grouped = new Map<
      string,
      { sum: number; count: number; date: string }
    >();

    secondaryData.forEach((point) => {
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
        value: group.sum,
      }))
      .sort((a, b) => a.day.localeCompare(b.day));
  }, [secondaryData, period]);

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

  // Merge actual cumulative transaction data with daily data
  const displayDataWithCumulative = useMemo(() => {
    let result = displayData;

    // Add cumulative data if available
    if (aggregatedCumulativeData && aggregatedCumulativeData.length > 0) {
      const cumulativeMap = new Map(
        aggregatedCumulativeData.map((point) => [point.day, point.value])
      );
      result = result.map((point) => ({
        ...point,
        cumulative: cumulativeMap.get(point.day) || null,
      }));
    }

    // Add secondary data for dual y-axis charts (stacked bars)
    if (aggregatedSecondaryData && aggregatedSecondaryData.length > 0) {
      const secondaryMap = new Map(
        aggregatedSecondaryData.map((point) => [point.day, point.value])
      );
      result = result.map((point) => {
        const secondary = secondaryMap.get(point.day) || null;
        const avg = point.value;
        const maxMinusAvg = secondary && avg ? secondary - avg : 0;
        return {
          ...point,
          secondary: secondary,
          maxMinusAvg: maxMinusAvg,
        };
      });
    }

    return result;
  }, [displayData, aggregatedCumulativeData, aggregatedSecondaryData]);

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
    if (period === "Q") {
      const parts = value.split("-");
      if (parts.length === 2) { return `${parts[1]} '${parts[0].slice(-2)}` }
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
      if (parts.length === 2) { return `${parts[1]} ${parts[0]}` }
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
    if (period === "Y") { return value }
    
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
          <div className="flex items-center gap-2 sm:gap-4 mb-3 sm:mb-4 pl-2 sm:pl-4 flex-wrap">
            {config.chartType === "dual" &&
            secondaryCurrentValue !== null &&
            secondaryCurrentValue !== undefined ? (
              <div className="text-md sm:text-base font-mono">
                Avg:{" "}
                {formatTooltipValue(
                  typeof currentValue === "string"
                    ? parseFloat(currentValue)
                    : currentValue
                )}{" "}
                / Max:{" "}
                {formatTooltipValue(
                  typeof secondaryCurrentValue === "string"
                    ? parseFloat(secondaryCurrentValue)
                    : secondaryCurrentValue
                )}
              </div>
            ) : (
              <div className="text-md sm:text-base font-mono break-all">
                {formatTooltipValue(
                  typeof currentValue === "string"
                    ? parseFloat(currentValue)
                    : currentValue
                )}
              </div>
            )}
            {dynamicChange.change > 0 && config.chartType !== "dual" && (
              <div
                className={`flex items-center gap-1 text-xs sm:text-sm ${dynamicChange.isPositive ? "text-green-600" : "text-red-600"}`}
                title={`Change over selected time range`}
              >
                <TrendingUp
                  className={`h-3 w-3 sm:h-4 sm:w-4 ${dynamicChange.isPositive ? "" : "rotate-180"}`}
                />
                {dynamicChange.change >= 1000
                  ? dynamicChange.change >= 1000000
                    ? `${(dynamicChange.change / 1000000).toFixed(1)}M%`
                    : `${(dynamicChange.change / 1000).toFixed(1)}K%`
                  : `${dynamicChange.change.toFixed(1)}%`}
              </div>
            )}
            {/* for cumulative charts */}
            {config.chartType === "bar" && (config.metricKey === "txCount" || config.metricKey === "activeAddresses" || config.metricKey === "contracts" || config.metricKey === "deployers") && (
                <div className="flex items-center gap-3 ml-auto text-xs">
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded" style={{ backgroundColor: config.color }}/>
                    <span className="text-muted-foreground">
                      {period === "D" ? "Daily": period === "W" ? "Weekly" : period === "M" ? "Monthly" : period === "Q" ? "Quarterly" : "Yearly"}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div
                      className="w-3 h-0.5"
                      style={{ backgroundColor: "#a855f7" }}
                    />
                    <span style={{ color: "#a855f7" }}>Total</span>
                  </div>
                </div>
              )}
            {/* for dual charts */}
            {config.chartType === "dual" && (
              <div className="flex items-center gap-3 ml-auto text-xs">
                <div className="flex items-center gap-1.5">
                  <div
                    className="w-3 h-3 rounded"
                    style={{ backgroundColor: config.color }}
                  />
                  <span className="text-muted-foreground">Avg</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div
                    className="w-3 h-3 rounded"
                    style={{ backgroundColor: "#a855f7" }}
                  />
                  <span style={{ color: "#a855f7" }}>Max</span>
                </div>
              </div>
            )}
          </div>

          <div className="mb-6">
            <ResponsiveContainer width="100%" height={400}>
              {config.chartType === "bar" &&
              (config.metricKey === "txCount" ||
                config.metricKey === "activeAddresses" ||
                config.metricKey === "contracts" ||
                config.metricKey === "deployers") ? (
                <ComposedChart
                  data={displayDataWithCumulative}
                  margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
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
                    yAxisId="left"
                    tickFormatter={formatYAxisValue}
                    className="text-xs text-gray-600 dark:text-gray-400"
                    tick={{ className: "fill-gray-600 dark:fill-gray-400" }}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
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
                            <div className="text-xs">
                              {formatTooltipValue(payload[0].value as number)}
                            </div>
                            {payload[0].payload.cumulative && (
                              <div className="text-xs text-muted-foreground">
                                Cumulative:{" "}
                                {formatYAxisValue(
                                  payload[0].payload.cumulative
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Bar
                    dataKey="value"
                    fill={config.color}
                    radius={[4, 4, 0, 0]}
                    yAxisId="left"
                    name={
                      config.metricKey === "txCount"
                        ? "Transactions"
                        : config.metricKey === "activeAddresses"
                          ? "Active Addresses"
                          : config.metricKey === "contracts"
                            ? "Contracts Deployed"
                            : "Contract Deployers"
                    }
                  />
                  <Line
                    type="monotone"
                    dataKey="cumulative"
                    stroke="#a855f7"
                    strokeWidth={1}
                    dot={false}
                    yAxisId="right"
                    name={
                      config.metricKey === "txCount"
                        ? "Total Transactions"
                        : config.metricKey === "activeAddresses"
                          ? "Total Addresses"
                          : config.metricKey === "contracts"
                            ? "Total Contracts"
                            : "Total Deployers"
                    }
                    strokeOpacity={0.9}
                  />
                </ComposedChart>
              ) : config.chartType === "bar" ? (
                <BarChart
                  data={displayDataWithCumulative}
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
                      const formattedDate = formatTooltipDate(payload[0].payload.day);
                      return (
                        <div className="rounded-lg border bg-background p-2 shadow-sm font-mono">
                          <div className="grid gap-2">
                            <div className="font-medium text-xs">
                              {formattedDate}
                            </div>
                            <div className="text-xs">
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
                  data={displayDataWithCumulative}
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
                      const formattedDate = formatTooltipDate(payload[0].payload.day);
                      return (
                        <div className="rounded-lg border bg-background p-2 shadow-sm font-mono">
                          <div className="grid gap-2">
                            <div className="font-medium text-xs">
                              {formattedDate}
                            </div>
                            <div className="text-xs">
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
                    strokeWidth={1}
                  />
                </AreaChart>
              ) : config.chartType === "dual" ? (
                <BarChart
                  data={displayDataWithCumulative}
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
                            {payload[0].payload.secondary && (
                              <div className="text-xs flex items-center gap-1.5">
                                <div
                                  className="w-2 h-2 rounded"
                                  style={{ backgroundColor: "#a855f7" }}
                                />
                                <span style={{ color: "#a855f7" }}>
                                  Max:{" "}
                                  {formatTooltipValue(
                                    payload[0].payload.secondary
                                  )}
                                </span>
                              </div>
                            )}
                            <div className="text-xs flex items-center gap-1.5">
                              <div
                                className="w-2 h-2 rounded"
                                style={{ backgroundColor: config.color }}
                              />
                              <span style={{ color: config.color }}>
                                Avg:{" "}
                                {formatTooltipValue(payload[0].payload.value)}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Bar
                    dataKey="value"
                    stackId="stack"
                    fill={config.color}
                    radius={[0, 0, 0, 0]}
                    name="Average"
                  />
                  <Bar
                    dataKey="maxMinusAvg"
                    stackId="stack"
                    fill="#a855f7"
                    radius={[4, 4, 0, 0]}
                    name="Max (additional)"
                  />
                </BarChart>
              ) : (
                <LineChart
                  data={displayDataWithCumulative}
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
                    cursor={{
                      stroke: config.color,
                      strokeWidth: 1,
                      strokeDasharray: "5 5",
                    }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.[0]) return null;
                      const formattedDate = formatTooltipDate(payload[0].payload.day);
                      return (
                        <div className="rounded-lg border bg-background p-2 shadow-sm font-mono">
                          <div className="grid gap-2">
                            <div className="font-medium text-xs">
                              {formattedDate}
                            </div>
                            <div className="text-xs">
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
                    strokeWidth={1}
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