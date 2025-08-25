"use client";
import * as React from "react";
import { useState, useEffect } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  ReferenceLine,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Users,
  Activity,
  FileText,
  MessageSquare,
  Loader2,
  TrendingUp,
  UserPlus,
  Hash,
  Code2,
  Zap,
  Gauge,
  DollarSign,
  TrendingDown,
  Clock,
  Fuel,
} from "lucide-react";

interface TimeSeriesDataPoint {
  timestamp: number;
  value: number | string;
  date: string;
}

interface TimeSeriesMetric {
  data: TimeSeriesDataPoint[];
  current_value: number | string;
  change_24h: number;
  change_percentage_24h: number;
}

interface ICMDataPoint {
  timestamp: number;
  date: string;
  messageCount: number;
  incomingCount: number;
  outgoingCount: number;
}

interface ICMMetric {
  data: ICMDataPoint[];
  current_value: number;
  change_24h: number;
  change_percentage_24h: number;
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

interface ChartDataPoint {
  day: string;
  value: number;
}

interface ICMChartDataPoint {
  day: string;
  messageCount: number;
  incomingCount: number;
  outgoingCount: number;
}

export default function CChainMetrics() {
  const [metrics, setMetrics] = useState<CChainMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [timeRange, setTimeRange] = React.useState<
    "7d" | "30d" | "90d" | "all"
  >("30d");

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/c-chain-stats?timeRange=${timeRange}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const cChainData = await response.json();

      if (!cChainData) {
        throw new Error("C-Chain data not found");
      }

      setMetrics(cChainData);
      setLastUpdated(new Date().toLocaleString());
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [timeRange]);

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
    if (ether >= 1e6) {
      return `${(ether / 1e6).toFixed(2)}M AVAX`;
    } else if (ether >= 1e3) {
      return `${(ether / 1e3).toFixed(2)}K AVAX`;
    } else if (ether >= 1) {
      return `${ether.toFixed(2)} AVAX`;
    } else {
      return `${ether.toFixed(6)} AVAX`;
    }
  };

  const getChartData = (
    metricKey: keyof Omit<CChainMetrics, "last_updated" | "icmMessages">
  ): ChartDataPoint[] => {
    if (!metrics || !metrics[metricKey]?.data) return [];

    return metrics[metricKey].data
      .map((point: TimeSeriesDataPoint) => ({
        day: point.date,
        value:
          typeof point.value === "string"
            ? parseFloat(point.value)
            : point.value,
      }))
      .reverse();
  };

  const getICMChartData = (): ICMChartDataPoint[] => {
    if (!metrics?.icmMessages?.data) return [];

    return metrics.icmMessages.data
      .map((point: ICMDataPoint) => {
        // Check if we have meaningful incoming/outgoing data
        const hasBreakdownData =
          point.incomingCount > 0 || point.outgoingCount > 0;

        return {
          day: point.date,
          messageCount: point.messageCount,
          // If no breakdown data available, use messageCount as incomingCount for display
          incomingCount: hasBreakdownData
            ? point.incomingCount
            : point.messageCount,
          outgoingCount: hasBreakdownData ? point.outgoingCount : 0,
        };
      })
      .reverse();
  };

  const getYearBoundaries = (data: ChartDataPoint[]): string[] => {
    if (timeRange !== "all" || data.length === 0) return [];

    const yearMap = new Map<number, string>();

    data.forEach((point) => {
      const date = new Date(point.day);
      const year = date.getFullYear();
      if (!yearMap.has(year)) {
        yearMap.set(year, point.day);
      }
    });

    const sortedYears = Array.from(yearMap.keys()).sort((a, b) => a - b);
    return sortedYears.slice(1).map((year) => yearMap.get(year)!);
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

  const formatTooltipDate = (dateString: string): string => {
    const date = new Date(dateString);

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
  };

  const formatTooltipValue = (value: number, metricKey: string): string => {
    switch (metricKey) {
      case "activeAddresses":
        return `${formatNumber(value)} Active Addresses`;
      case "activeSenders":
        return `${formatNumber(value)} Active Senders`;
      case "cumulativeAddresses":
        return `${formatNumber(value)} Total Addresses`;
      case "cumulativeDeployers":
        return `${formatNumber(value)} Total Deployers`;
      case "txCount":
        return `${formatNumber(value)} Transactions`;
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

  const getValueChange = (
    metricKey: keyof Omit<CChainMetrics, "last_updated">
  ): { change: number; isPositive: boolean } => {
    if (
      !metrics ||
      !metrics[metricKey]?.data ||
      metrics[metricKey].data.length === 0
    ) {
      return { change: 0, isPositive: true };
    }

    const data = metrics[metricKey].data;
    const currentValue = data[0];

    let comparisonIndex = 1;
    switch (timeRange) {
      case "7d":
        comparisonIndex = Math.min(7, data.length - 1);
        break;
      case "30d":
        comparisonIndex = Math.min(30, data.length - 1);
        break;
      case "90d":
        comparisonIndex = Math.min(90, data.length - 1);
        break;
      case "all":
        comparisonIndex = data.length - 1;
        break;
    }

    if (comparisonIndex >= data.length) {
      return { change: 0, isPositive: true };
    }

    const comparisonValue = data[comparisonIndex];

    let currentVal: number;
    let comparisonVal: number;

    if (metricKey === "icmMessages") {
      const current = currentValue as ICMDataPoint;
      const comparison = comparisonValue as ICMDataPoint;
      currentVal = current.messageCount;
      comparisonVal = comparison.messageCount;
    } else {
      const current = currentValue as TimeSeriesDataPoint;
      const comparison = comparisonValue as TimeSeriesDataPoint;
      currentVal =
        typeof current.value === "string"
          ? parseFloat(current.value)
          : current.value;
      comparisonVal =
        typeof comparison.value === "string"
          ? parseFloat(comparison.value)
          : comparison.value;
    }

    if (isNaN(currentVal) || isNaN(comparisonVal) || comparisonVal === 0) {
      return { change: 0, isPositive: true };
    }

    const changePercentage =
      ((currentVal - comparisonVal) / comparisonVal) * 100;

    return {
      change: Math.abs(changePercentage),
      isPositive: changePercentage >= 0,
    };
  };

  const addressConfigs = [
    {
      title: "Active Addresses",
      icon: Users,
      metricKey: "activeAddresses" as const,
      description: `Distinct addresses active over the past ${getTimeRangeLabel(
        timeRange
      )}`,
      chartConfig: {
        value: { label: "Active Addresses", color: "#40c9ff" },
      } satisfies ChartConfig,
    },
    {
      title: "Active Senders",
      icon: UserPlus,
      metricKey: "activeSenders" as const,
      description: `Addresses sending transactions over the past ${getTimeRangeLabel(
        timeRange
      )}`,
      chartConfig: {
        value: { label: "Active Senders", color: "#10b981" },
      } satisfies ChartConfig,
    },
    {
      title: "Total Addresses",
      icon: Hash,
      metricKey: "cumulativeAddresses" as const,
      description: `Cumulative unique addresses since genesis`,
      chartConfig: {
        value: { label: "Total Addresses", color: "#8b5cf6" },
      } satisfies ChartConfig,
    },
    {
      title: "Total Deployers",
      icon: Code2,
      metricKey: "cumulativeDeployers" as const,
      description: `Cumulative contract deployers since genesis`,
      chartConfig: {
        value: { label: "Total Deployers", color: "#f59e0b" },
      } satisfies ChartConfig,
    },
  ];

  const transactionConfigs = [
    {
      title: "Daily Transactions",
      icon: Activity,
      metricKey: "txCount" as const,
      description: `Transaction volume over the past ${getTimeRangeLabel(
        timeRange
      )}`,
      chartConfig: {
        value: { label: "Daily Transactions", color: "#40c9ff" },
      } satisfies ChartConfig,
    },
    {
      title: "Total Transactions",
      icon: Hash,
      metricKey: "cumulativeTxCount" as const,
      description: `Cumulative transaction count since genesis`,
      chartConfig: {
        value: { label: "Total Transactions", color: "#10b981" },
      } satisfies ChartConfig,
    },
  ];

  const contractConfigs = [
    {
      title: "Total Contracts",
      icon: FileText,
      metricKey: "cumulativeContracts" as const,
      description: `Cumulative smart contracts deployed since genesis`,
      chartConfig: {
        value: { label: "Total Contracts", color: "#8b5cf6" },
      } satisfies ChartConfig,
    },
  ];

  const gasConfigs = [
    {
      title: "Gas Used",
      icon: Fuel,
      metricKey: "gasUsed" as const,
      description: `Gas consumption over the past ${getTimeRangeLabel(
        timeRange
      )}`,
      chartConfig: {
        value: { label: "Gas Used", color: "#40c9ff" },
      } satisfies ChartConfig,
    },
    {
      title: "Avg GPS",
      icon: Gauge,
      metricKey: "avgGps" as const,
      description: `Average gas per second over the past ${getTimeRangeLabel(
        timeRange
      )}`,
      chartConfig: {
        value: { label: "Avg GPS", color: "#10b981" },
      } satisfies ChartConfig,
    },
    {
      title: "Max GPS",
      icon: Zap,
      metricKey: "maxGps" as const,
      description: `Peak gas per second over the past ${getTimeRangeLabel(
        timeRange
      )}`,
      chartConfig: {
        value: { label: "Max GPS", color: "#ef4444" },
      } satisfies ChartConfig,
    },
    {
      title: "Avg TPS",
      icon: Clock,
      metricKey: "avgTps" as const,
      description: `Average transactions per second over the past ${getTimeRangeLabel(
        timeRange
      )}`,
      chartConfig: {
        value: { label: "Avg TPS", color: "#8b5cf6" },
      } satisfies ChartConfig,
    },
    {
      title: "Max TPS",
      icon: TrendingUp,
      metricKey: "maxTps" as const,
      description: `Peak transactions per second over the past ${getTimeRangeLabel(
        timeRange
      )}`,
      chartConfig: {
        value: { label: "Max TPS", color: "#f59e0b" },
      } satisfies ChartConfig,
    },
  ];

  const feeConfigs = [
    {
      title: "Avg Gas Price",
      icon: DollarSign,
      metricKey: "avgGasPrice" as const,
      description: `Average gas price over the past ${getTimeRangeLabel(
        timeRange
      )}`,
      chartConfig: {
        value: { label: "Avg Gas Price", color: "#40c9ff" },
      } satisfies ChartConfig,
    },
    {
      title: "Max Gas Price",
      icon: TrendingDown,
      metricKey: "maxGasPrice" as const,
      description: `Peak gas price over the past ${getTimeRangeLabel(
        timeRange
      )}`,
      chartConfig: {
        value: { label: "Max Gas Price", color: "#ef4444" },
      } satisfies ChartConfig,
    },
    {
      title: "Fees Paid",
      icon: DollarSign,
      metricKey: "feesPaid" as const,
      description: `Total transaction fees over the past ${getTimeRangeLabel(
        timeRange
      )}`,
      chartConfig: {
        value: { label: "Fees Paid", color: "#10b981" },
      } satisfies ChartConfig,
    },
  ];

  const icmConfigs = [
    {
      title: "ICM Messages",
      icon: MessageSquare,
      metricKey: "icmMessages" as const,
      description: `Interchain messaging activity over the past ${getTimeRangeLabel(
        timeRange
      )}`,
      chartConfig: {
        messageCount: { label: "ICM Messages", color: "#40c9ff" },
      } satisfies ChartConfig,
      isStackedBar: false,
    },
  ];

  const allConfigs = [
    ...addressConfigs,
    ...transactionConfigs,
    ...contractConfigs,
    ...gasConfigs,
    ...feeConfigs,
    ...icmConfigs,
  ];

  function getTimeRangeLabel(range: string): string {
    switch (range) {
      case "7d":
        return "7 days";
      case "30d":
        return "30 days";
      case "90d":
        return "90 days";
      case "all":
        return "all time";
      default:
        return "30 days";
    }
  }

  function getComparisonPeriodLabel(range: string): string {
    switch (range) {
      case "7d":
        return "7 days ago";
      case "30d":
        return "30 days ago";
      case "90d":
        return "90 days ago";
      case "all":
        return "the beginning of the dataset";
      default:
        return "30 days ago";
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted/20">
        <div className="container mx-auto p-6">
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-muted-foreground">
                Fetching real-time C-Chain data...
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted/20">
        <div className="container mx-auto p-6">
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-center">
              <p className="text-destructive text-lg mb-4">
                Error loading data: {error}
              </p>
              <button
                onClick={fetchData}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/20">
      <div className="container mx-auto mt-4 p-6 space-y-12">
        <div className="space-y-2">
          <div>
            <h1 className="text-2xl md:text-5xl mb-4">
              C-Chain Network Metrics
            </h1>
            <p className="text-zinc-400 text-md text-left">
              Real-time insights into Avalanche C-Chain activity and network
              usage
            </p>
          </div>
        </div>

        <section className="space-y-6">
          <div className="space-y-2">
            <h2 className="text-2xl font-medium text-left">Network Overview</h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              addressConfigs[0],
              transactionConfigs[0],
              contractConfigs[0],
              {
                title: "ICM Messages",
                icon: MessageSquare,
                metricKey: "icmMessages" as const,
                chartConfig: {
                  value: { label: "ICM Messages", color: "#8b5cf6" },
                },
              },
            ].map((config: any) => {
              const currentValue = getCurrentValue(config.metricKey);
              const Icon = config.icon;

              let displayValue = formatNumber(currentValue);
              if (config.metricKey === "gasUsed") {
                displayValue = formatGas(currentValue);
              } else if (config.metricKey === "icmMessages") {
                displayValue = `${formatNumber(currentValue)}`;
              }

              return (
                <div
                  key={config.metricKey}
                  className="text-center p-6 rounded-lg bg-card border"
                >
                  <div className="flex items-center justify-center gap-2 mb-3">
                    <Icon
                      className="h-5 w-5"
                      style={{ color: config.chartConfig.value.color }}
                    />
                    <p className="text-sm text-muted-foreground">
                      {config.title}
                    </p>
                  </div>
                  <p className="text-xl font-mono font-semibold">
                    {displayValue}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        <section className="space-y-6">
          <div className="space-y-2">
            <h2 className="text-2xl font-medium text-left">
              Historical Trends
            </h2>
            <p className="text-zinc-400 text-md text-left">
              Track C-Chain network growth and activity over time
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {allConfigs.map((config) => {
              const isICMChart = config.metricKey === "icmMessages";
              const chartData = isICMChart
                ? getICMChartData()
                : getChartData(
                    config.metricKey as keyof Omit<
                      CChainMetrics,
                      "last_updated" | "icmMessages"
                    >
                  );
              const currentValue = getCurrentValue(config.metricKey);
              const { change, isPositive } = getValueChange(config.metricKey);
              const Icon = config.icon;

              return (
                <Card key={config.metricKey} className="w-full">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <CardTitle className="flex items-center gap-2 font-medium">
                          <Icon
                            className="h-5 w-5"
                            style={{
                              color: isICMChart
                                ? config.chartConfig.messageCount.color
                                : config.chartConfig.value.color,
                            }}
                          />
                          {config.title}
                        </CardTitle>
                        <CardDescription>{config.description}</CardDescription>
                      </div>
                      <div className="flex items-center gap-2 px-2">
                        <ToggleGroup
                          type="single"
                          value={timeRange}
                          onValueChange={(value) => {
                            if (
                              value &&
                              (value === "7d" ||
                                value === "30d" ||
                                value === "90d" ||
                                value === "all")
                            ) {
                              setTimeRange(value);
                            }
                          }}
                          className="hidden sm:flex bg-gray-100 dark:bg-gray-800 border-0 rounded-full p-0.5 shadow-sm mx-2"
                        >
                          <ToggleGroupItem
                            value="7d"
                            className="text-xs px-3.5 py-0.5 font-medium rounded-full transition-all duration-200 ease-out text-gray-600 dark:text-gray-400 hover:text-white hover:bg-[#40c9ff] hover:shadow-md hover:scale-102 data-[state=on]:bg-[#40c9ff] data-[state=on]:text-white data-[state=on]:shadow-sm data-[state=on]:scale-100 min-w-[2.25rem]"
                          >
                            7d
                          </ToggleGroupItem>
                          <ToggleGroupItem
                            value="30d"
                            className="text-xs px-3.5 py-0.5 font-medium rounded-full transition-all duration-200 ease-out text-gray-600 dark:text-gray-400 hover:text-white hover:bg-[#40c9ff] hover:shadow-md hover:scale-102 data-[state=on]:bg-[#40c9ff] data-[state=on]:text-white data-[state=on]:shadow-sm data-[state=on]:scale-100 min-w-[2.25rem]"
                          >
                            30d
                          </ToggleGroupItem>
                          <ToggleGroupItem
                            value="90d"
                            className="text-xs px-3.5 py-0.5 font-medium rounded-full transition-all duration-200 ease-out text-gray-600 dark:text-gray-400 hover:text-white hover:bg-[#40c9ff] hover:shadow-md hover:scale-102 data-[state=on]:bg-[#40c9ff] data-[state=on]:text-white data-[state=on]:shadow-sm data-[state=on]:scale-100 min-w-[2.25rem]"
                          >
                            90d
                          </ToggleGroupItem>
                          <ToggleGroupItem
                            value="all"
                            className="text-xs px-3.5 py-0.5 font-medium rounded-full transition-all duration-200 ease-out text-gray-600 dark:text-gray-400 hover:text-white hover:bg-[#40c9ff] hover:shadow-md hover:scale-102 data-[state=on]:bg-[#40c9ff] data-[state=on]:text-white data-[state=on]:shadow-sm data-[state=on]:scale-100 min-w-[2.25rem]"
                          >
                            All
                          </ToggleGroupItem>
                        </ToggleGroup>
                        <Select
                          value={timeRange}
                          onValueChange={(value: string) => {
                            if (
                              value === "7d" ||
                              value === "30d" ||
                              value === "90d" ||
                              value === "all"
                            ) {
                              setTimeRange(value);
                            }
                          }}
                        >
                          <SelectTrigger
                            className="w-20 h-6 sm:hidden bg-gray-100 dark:bg-gray-800 border-0 rounded-full text-gray-700 dark:text-gray-300 shadow-sm font-medium hover:bg-[#40c9ff] hover:text-white hover:shadow-md hover:scale-102 transition-all duration-200 ease-out text-xs px-4 min-w-[2.5rem]"
                            size="sm"
                            aria-label="Select a value"
                          >
                            <SelectValue placeholder="30d" />
                          </SelectTrigger>
                          <SelectContent className="rounded-2xl bg-white dark:bg-gray-800 border-0 shadow-lg p-1 w-32">
                            <SelectItem
                              value="7d"
                              className="rounded-full mb-0.5 text-gray-700 dark:text-gray-300 font-medium hover:bg-[#40c9ff] hover:text-white hover:shadow-sm focus:bg-[#40c9ff] focus:text-white transition-all duration-200 text-xs py-0.5 px-4 justify-center hover:scale-102 min-w-[2.5rem]"
                            >
                              7d
                            </SelectItem>
                            <SelectItem
                              value="30d"
                              className="rounded-full mb-0.5 text-gray-700 dark:text-gray-300 font-medium hover:bg-[#40c9ff] hover:text-white hover:shadow-sm focus:bg-[#40c9ff] focus:text-white transition-all duration-200 text-xs py-0.5 px-4 justify-center hover:scale-102 min-w-[2.5rem]"
                            >
                              30d
                            </SelectItem>
                            <SelectItem
                              value="90d"
                              className="rounded-full mb-0.5 text-gray-700 dark:text-gray-300 font-medium hover:bg-[#40c9ff] hover:text-white hover:shadow-sm focus:bg-[#40c9ff] focus:text-white transition-all duration-200 text-xs py-0.5 px-4 justify-center hover:scale-102 min-w-[2.5rem]"
                            >
                              90d
                            </SelectItem>
                            <SelectItem
                              value="all"
                              className="rounded-full text-gray-700 dark:text-gray-300 font-medium hover:bg-[#40c9ff] hover:text-white hover:shadow-sm focus:bg-[#40c9ff] focus:text-white transition-all duration-200 text-xs py-0.5 px-4 justify-center hover:scale-102 min-w-[2.5rem]"
                            >
                              All
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
                    <div className="flex items-center gap-4 mb-4">
                      <div className="text-2xl font-mono">
                        {isICMChart
                          ? `${formatNumber(currentValue)} Messages`
                          : formatTooltipValue(
                              typeof currentValue === "string"
                                ? parseFloat(currentValue)
                                : currentValue,
                              config.metricKey
                            )}
                      </div>
                      {change > 0 && (
                        <div
                          className={`flex items-center gap-1 text-sm ${
                            isPositive ? "text-green-600" : "text-red-600"
                          }`}
                          title={`Change compared to ${getComparisonPeriodLabel(
                            timeRange
                          )}`}
                        >
                          <TrendingUp
                            className={`h-4 w-4 ${
                              isPositive ? "" : "rotate-180"
                            }`}
                          />
                          {change.toFixed(1)}%
                        </div>
                      )}
                    </div>
                    <ChartContainer
                      config={config.chartConfig}
                      className={`aspect-auto w-full font-mono ${
                        isICMChart ? "h-[300px]" : "h-[250px]"
                      }`}
                    >
                      {isICMChart ? (
                        <BarChart
                          data={chartData}
                          margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                        >
                          <CartesianGrid
                            strokeDasharray="3 3"
                            vertical={false}
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
                            }}
                          />
                          <ChartTooltip
                            cursor={false}
                            content={({ active, payload, label }) => {
                              if (active && payload && payload.length) {
                                const messageCount =
                                  payload[0]?.payload?.messageCount || 0;
                                return (
                                  <div className="rounded-lg border bg-background p-2 shadow-sm font-mono">
                                    <div className="grid gap-2">
                                      <div className="font-medium">
                                        {formatTooltipDate(label)}
                                      </div>
                                      <div className="flex items-center gap-2 text-sm">
                                        <div
                                          className="w-3 h-3 rounded-sm"
                                          style={{
                                            backgroundColor:
                                              config.chartConfig.messageCount
                                                .color,
                                          }}
                                        />
                                        <span>
                                          ICM Messages:{" "}
                                          {formatNumber(messageCount)}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                );
                              }
                              return null;
                            }}
                          />
                          <Bar
                            dataKey="messageCount"
                            fill={config.chartConfig.messageCount.color}
                            radius={[4, 4, 4, 4]}
                          />
                        </BarChart>
                      ) : (
                        <AreaChart data={chartData}>
                          <defs>
                            <linearGradient
                              id={`fill-${config.metricKey}`}
                              x1="0"
                              y1="0"
                              x2="0"
                              y2="1"
                            >
                              <stop
                                offset="5%"
                                stopColor={config.chartConfig.value.color}
                                stopOpacity={0.8}
                              />
                              <stop
                                offset="95%"
                                stopColor={config.chartConfig.value.color}
                                stopOpacity={0.1}
                              />
                            </linearGradient>
                          </defs>
                          <CartesianGrid vertical={false} />
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
                            }}
                          />
                          <ChartTooltip
                            cursor={false}
                            content={
                              <ChartTooltipContent
                                labelFormatter={(value) =>
                                  formatTooltipDate(value)
                                }
                                indicator="dot"
                                formatter={(value) => [
                                  formatTooltipValue(
                                    value as number,
                                    config.metricKey
                                  ),
                                  "",
                                ]}
                                className="font-mono"
                              />
                            }
                          />

                          {timeRange === "all" &&
                            getYearBoundaries(
                              chartData as ChartDataPoint[]
                            ).map((yearBoundary, idx) => (
                              <ReferenceLine
                                key={`year-${idx}`}
                                x={yearBoundary}
                                stroke="#d1d5db"
                                strokeWidth={1}
                                strokeDasharray="3 3"
                                opacity={0.6}
                              />
                            ))}
                          <Area
                            dataKey="value"
                            type="natural"
                            fill={`url(#fill-${config.metricKey})`}
                            stroke={config.chartConfig.value.color}
                            strokeWidth={2}
                          />
                        </AreaChart>
                      )}
                    </ChartContainer>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
