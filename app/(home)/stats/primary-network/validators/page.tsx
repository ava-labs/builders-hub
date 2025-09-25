"use client";
import * as React from "react";
import { useState, useEffect } from "react";
import {Area, AreaChart, CartesianGrid, XAxis, YAxis, Pie, PieChart, ReferenceLine } from "recharts";
import {Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {type ChartConfig, ChartContainer, ChartStyle, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from "@/components/ui/chart";
import DateRangeFilter from "@/components/ui/DateRangeFilter";
import {Landmark, Shield, TrendingUp, Monitor, HandCoins } from "lucide-react";
import { ValidatorWorldMap } from "@/components/stats/ValidatorWorldMap";
import { StatsBubbleNav } from "@/components/stats/stats-bubble.config";
import { ChartSkeletonLoader } from "@/components/ui/chart-skeleton";
import {TimeSeriesDataPoint, ChartDataPoint, TimeRange, PrimaryNetworkMetrics, VersionCount } from "@/types/stats";

export default function PrimaryNetworkValidatorMetrics() {
  const [metrics, setMetrics] = useState<PrimaryNetworkMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = React.useState<TimeRange>("1y");
  const [validatorVersions, setValidatorVersions] = useState<VersionCount[]>(
    []
  );
  const [versionsError, setVersionsError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(
        `/api/primary-network-stats?timeRange=${timeRange}`
      );
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const primaryNetworkData = await response.json();

      if (!primaryNetworkData) {
        throw new Error("Primary Network data not found");
      }

      setMetrics(primaryNetworkData);

      if (primaryNetworkData.validator_versions) {
        try {
          console.log(
            "Raw validator_versions data:",
            primaryNetworkData.validator_versions
          );
          const versionsData = JSON.parse(
            primaryNetworkData.validator_versions
          );
          console.log("Parsed validator versions data:", versionsData);

          const versionArray: VersionCount[] = Object.entries(versionsData)
            .map(([version, data]: [string, any]) => ({
              version,
              count: data.validatorCount,
              percentage: 0,
              amountStaked: Number(data.amountStaked) / 1e9,
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
        } catch (err) {
          setVersionsError(
            `Failed to parse validator versions data: ${
              err instanceof Error ? err.message : "Unknown error"
            }`
          );
        }
      }
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
    const finalizedData = metrics[metricKey].data.filter((point) => point.date !== today);

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
      case "validator_count":
        return `${formatNumber(value)} Validators`;

      case "validator_weight":
        return `${formatWeight(value)} Staked`;

      case "delegator_count":
        return `${formatNumber(value)} Delegators`;

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

  const getValueChange = (
    metricKey: keyof Pick<
      PrimaryNetworkMetrics,
      | "validator_count"
      | "validator_weight"
      | "delegator_count"
      | "delegator_weight"
    >
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
      case "30d":
        comparisonIndex = Math.min(30, data.length - 1);
        break;
      case "90d":
        comparisonIndex = Math.min(90, data.length - 1);
        break;
      case "1y":
        comparisonIndex = Math.min(365, data.length - 1);
        break;
      case "all":
        comparisonIndex = data.length - 1;
        break;
    }

    if (comparisonIndex >= data.length) {
      return { change: 0, isPositive: true };
    }

    const comparisonValue = data[comparisonIndex];

    const currentVal =
      typeof currentValue.value === "string"
        ? parseFloat(currentValue.value)
        : currentValue.value;
    const comparisonVal =
      typeof comparisonValue.value === "string"
        ? parseFloat(comparisonValue.value)
        : comparisonValue.value;

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

  const getPieChartData = () => {
    if (!validatorVersions.length) return [];

    return validatorVersions.map((version, index) => ({
      version: version.version,
      count: version.count,
      percentage: version.percentage,
      amountStaked: version.amountStaked,
      stakingPercentage: version.stakingPercentage,
      fill: `hsl(${195 + index * 15}, 100%, ${65 - index * 8}%)`,
    }));
  };

  const getVersionsChartConfig = (): ChartConfig => {
    const config: ChartConfig = {
      count: {
        label: "Validators",
      },
    };

    validatorVersions.forEach((version, index) => {
      config[version.version] = {
        label: version.version,
        color: `hsl(${195 + index * 15}, 100%, ${65 - index * 8}%)`,
      };
    });

    return config;
  };

  const pieChartData = getPieChartData();
  const versionsChartConfig = getVersionsChartConfig();

  const chartConfigs = [
    {
      title: "Validator Count",
      icon: Monitor,
      metricKey: "validator_count" as const,
      description: `Number of active validators over the past ${getTimeRangeLabel(
        timeRange
      )}`,
      chartConfig: {
        value: {
          label: "Validator Count",
          color: "#40c9ff",
        },
      } satisfies ChartConfig,
    },
    {
      title: "Validator Weight",
      icon: Landmark,
      metricKey: "validator_weight" as const,
      description: `Total validator weight over the past ${getTimeRangeLabel(
        timeRange
      )}`,
      chartConfig: {
        value: {
          label: "Validator Weight",
          color: "#40c9ff",
        },
      } satisfies ChartConfig,
    },
    {
      title: "Delegator Count",
      icon: HandCoins,
      metricKey: "delegator_count" as const,
      description: `Number of active delegators over the past ${getTimeRangeLabel(
        timeRange
      )}`,
      chartConfig: {
        value: {
          label: "Delegator Count",
          color: "#8b5cf6",
        },
      } satisfies ChartConfig,
    },
    {
      title: "Delegator Weight",
      icon: Landmark,
      metricKey: "delegator_weight" as const,
      description: `Total delegator weight over the past ${getTimeRangeLabel(
        timeRange
      )}`,
      chartConfig: {
        value: {
          label: "Delegator Weight",
          color: "#a855f7",
        },
      } satisfies ChartConfig,
    },
  ];

  function getTimeRangeLabel(range: string): string {
    switch (range) {
      case "30d":
        return "30 days";
      case "90d":
        return "90 days";
      case "1y":
        return "1 year";
      case "all":
        return "all time";
      default:
        return "1 year";
    }
  }

  function getComparisonPeriodLabel(range: string): string {
    switch (range) {
      case "30d":
        return "30 days ago";
      case "90d":
        return "90 days ago";
      case "1y":
        return "1 year ago";
      case "all":
        return "the beginning of the dataset";
      default:
        return "1 year ago";
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted/20">
        <div className="container mx-auto mt-4 p-6 pb-24 space-y-12">
          <div className="space-y-2">
            <div>
              <h1 className="text-2xl md:text-5xl mb-4">
                Primary Network Validator Metrics
              </h1>
              <p className="text-zinc-400 text-md text-left">
                Real-time insights into the Avalanche Primary Network
                performance and validator distribution
              </p>
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
      <div className="container mx-auto mt-4 p-4 sm:p-6 pb-24 space-y-8 sm:space-y-12">
        <div className="space-y-2">
          <div>
            <h1 className="text-xl sm:text-2xl md:text-5xl mb-2 sm:mb-4 break-words">
              Primary Network Validator Metrics
            </h1>
            <p className="text-zinc-400 text-sm sm:text-md text-left">
              Real-time insights into the Avalanche Primary Network performance
              and validator distribution
            </p>
          </div>
        </div>

        <section className="space-y-4 sm:space-y-6">
          <div className="space-y-2">
            <h2 className="text-lg sm:text-2xl font-medium text-left">
              Network Overview
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            {chartConfigs.map((config) => {
              const currentValue = getCurrentValue(config.metricKey);
              const Icon = config.icon;

              return (
                <div
                  key={config.metricKey}
                  className="text-center p-4 sm:p-6 rounded-lg bg-card border"
                >
                  <div className="flex items-center justify-center gap-2 mb-2 sm:mb-3">
                    <Icon
                      className="h-4 w-4 sm:h-5 sm:w-5"
                      style={{ color: config.chartConfig.value.color }}
                    />
                    <p className="text-xs sm:text-sm text-muted-foreground truncate">
                      {config.title}
                    </p>
                  </div>
                  <p className="text-xl sm:text-3xl font-mono font-semibold break-all">
                    {config.metricKey.includes("weight")
                      ? formatWeight(currentValue)
                      : formatNumber(currentValue)}
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
              Track network growth and validator activity over time
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            {chartConfigs.map((config, index) => {
              const chartData = getChartData(config.metricKey);
              const currentValue = getCurrentValue(config.metricKey);
              const { change, isPositive } = getValueChange(config.metricKey);
              const Icon = config.icon;

              return (
                <Card key={config.metricKey} className="w-full py-2 sm:py-0">
                  <CardHeader className="px-4 pt-2 pb-2 sm:px-6 sm:pt-4 sm:pb-3">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <CardTitle className="flex items-center gap-2 font-medium text-sm sm:text-base min-w-0 flex-1">
                          <Icon
                            className="h-4 w-4 sm:h-5 sm:w-5"
                            style={{ color: config.chartConfig.value.color }}
                          />
                          <span className="truncate">{config.title}</span>
                        </CardTitle>
                        <div className="shrink-0">
                          <DateRangeFilter
                            compact={true}
                            defaultRange={timeRange}
                            onRangeChange={(range) => {
                              if (
                                range === "30d" ||
                                range === "90d" ||
                                range === "1y" ||
                                range === "all"
                              ) {
                                setTimeRange(range);
                              }
                            }}
                          />
                        </div>
                      </div>
                      <CardDescription className="text-xs sm:text-sm">
                        {config.description}
                      </CardDescription>
                    </div>
                  </CardHeader>
                  <CardContent className="px-2 pt-2 sm:px-6 sm:pt-4">
                    <div className="flex items-center gap-2 sm:gap-4 mb-3 sm:mb-4 pl-2 sm:pl-4">
                      <div className="text-lg sm:text-2xl font-mono break-all">
                        {config.metricKey.includes("weight")
                          ? formatWeight(currentValue)
                          : formatNumber(currentValue)}
                      </div>
                      {change > 0 && (
                        <div
                          className={`flex items-center gap-1 text-xs sm:text-sm ${
                            isPositive ? "text-green-600" : "text-red-600"
                          }`}
                          title={`Change compared to ${getComparisonPeriodLabel(
                            timeRange
                          )}`}
                        >
                          <TrendingUp
                            className={`h-3 w-3 sm:h-4 sm:w-4 ${
                              isPositive ? "" : "rotate-180"
                            }`}
                          />
                          {change.toFixed(1)}%
                        </div>
                      )}
                    </div>
                    <ChartContainer
                      config={config.chartConfig}
                      className="aspect-auto w-full font-mono h-[180px] sm:h-[250px]"
                    >
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
                              stopColor={`var(--color-value)`}
                              stopOpacity={0.8}
                            />
                            <stop
                              offset="95%"
                              stopColor={`var(--color-value)`}
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
                        <YAxis
                          tickLine={false}
                          axisLine={false}
                          tickMargin={8}
                          tickFormatter={(value) =>
                            config.metricKey.includes("weight")
                              ? formatWeightForAxis(value)
                              : formatNumber(value)
                          }
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
                          getYearBoundaries(chartData).map(
                            (yearBoundary, idx) => (
                              <ReferenceLine
                                key={`year-${idx}`}
                                x={yearBoundary}
                                stroke="#d1d5db"
                                strokeWidth={1}
                                strokeDasharray="3 3"
                                opacity={0.6}
                              />
                            )
                          )}
                        <Area
                          dataKey="value"
                          type="natural"
                          fill={`url(#fill-${config.metricKey})`}
                          stroke={`var(--color-value)`}
                          strokeWidth={2}
                        />
                      </AreaChart>
                    </ChartContainer>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>

        <section className="space-y-6">
          <div className="space-y-2">
            <h2 className="text-2xl font-medium text-left">
              Software Versions
            </h2>
            <p className="text-zinc-400 text-md text-left">
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
                    <Shield className="h-5 w-5" style={{ color: "#40c9ff" }} />
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
                    <Shield className="h-5 w-5" style={{ color: "#40c9ff" }} />
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

          {/* Detailed Version Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-xl flex items-center gap-2 font-medium">
                <Shield className="h-5 w-5" style={{ color: "#40c9ff" }} />
                Detailed Version Breakdown
              </CardTitle>
              <CardDescription>
                Complete overview of validator software versions and their
                network impact
              </CardDescription>
            </CardHeader>
            <CardContent>
              {versionsError ? (
                <div className="text-center py-8">
                  <p className="text-destructive mb-4">
                    Error: {versionsError}
                  </p>
                  <button
                    onClick={fetchData}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
                  >
                    Retry
                  </button>
                </div>
              ) : validatorVersions.length > 0 ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {validatorVersions.map((versionInfo, index) => (
                      <div
                        key={versionInfo.version}
                        className="p-4 rounded-lg border bg-muted/30"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-medium text-sm">
                            {versionInfo.version || "Unknown Version"}
                          </h4>
                          <span className="text-xs text-muted-foreground">
                            #{index + 1}
                          </span>
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">
                              Validators:
                            </span>
                            <span className="font-mono font-semibold">
                              {versionInfo.count} (
                              {versionInfo.percentage.toFixed(1)}%)
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">
                              Staked:
                            </span>
                            <span className="font-mono font-semibold">
                              {versionInfo.amountStaked.toLocaleString(
                                undefined,
                                { maximumFractionDigits: 0 }
                              )}{" "}
                              AVAX ({versionInfo.stakingPercentage.toFixed(1)}%)
                            </span>
                          </div>
                          <div className="w-full bg-muted rounded-full h-2">
                            <div
                              className="h-2 rounded-full"
                              style={{
                                width: `${versionInfo.stakingPercentage}%`,
                                backgroundColor: "#40c9ff",
                                opacity:
                                  0.7 + (index === 0 ? 0.3 : -index * 0.1),
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {validatorVersions.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No version information available</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No validator versions data available</p>
                  <button
                    onClick={fetchData}
                    className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
                  >
                    Reload Data
                  </button>
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        {/* Global Validator Distribution Map */}
        <section className="space-y-6">
          <ValidatorWorldMap />
        </section>
      </div>

      {/* Bubble Navigation */}
      <StatsBubbleNav />
    </div>
  );
}
