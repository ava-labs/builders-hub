"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  XAxis,
  Label,
  Pie,
  PieChart,
  Sector,
} from "recharts";
import { PieSectorDataItem } from "recharts/types/polar/Pie";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartStyle,
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
  Activity,
  Users,
  Weight,
  Shield,
  Loader2,
  TrendingUp,
} from "lucide-react";

// Simplified interface for Primary Network metrics (no chain metadata)
interface PrimaryNetworkMetrics {
  // Validator versions JSON string
  validator_versions: string;
  // 30 days of delegator count
  delegator_count_day1: number | string;
  delegator_count_day2: number | string;
  delegator_count_day3: number | string;
  delegator_count_day4: number | string;
  delegator_count_day5: number | string;
  delegator_count_day6: number | string;
  delegator_count_day7: number | string;
  delegator_count_day8: number | string;
  delegator_count_day9: number | string;
  delegator_count_day10: number | string;
  delegator_count_day11: number | string;
  delegator_count_day12: number | string;
  delegator_count_day13: number | string;
  delegator_count_day14: number | string;
  delegator_count_day15: number | string;
  delegator_count_day16: number | string;
  delegator_count_day17: number | string;
  delegator_count_day18: number | string;
  delegator_count_day19: number | string;
  delegator_count_day20: number | string;
  delegator_count_day21: number | string;
  delegator_count_day22: number | string;
  delegator_count_day23: number | string;
  delegator_count_day24: number | string;
  delegator_count_day25: number | string;
  delegator_count_day26: number | string;
  delegator_count_day27: number | string;
  delegator_count_day28: number | string;
  delegator_count_day29: number | string;
  delegator_count_day30: number | string;
  // 30 days of delegator weight
  delegator_weight_day1: number | string;
  delegator_weight_day2: number | string;
  delegator_weight_day3: number | string;
  delegator_weight_day4: number | string;
  delegator_weight_day5: number | string;
  delegator_weight_day6: number | string;
  delegator_weight_day7: number | string;
  delegator_weight_day8: number | string;
  delegator_weight_day9: number | string;
  delegator_weight_day10: number | string;
  delegator_weight_day11: number | string;
  delegator_weight_day12: number | string;
  delegator_weight_day13: number | string;
  delegator_weight_day14: number | string;
  delegator_weight_day15: number | string;
  delegator_weight_day16: number | string;
  delegator_weight_day17: number | string;
  delegator_weight_day18: number | string;
  delegator_weight_day19: number | string;
  delegator_weight_day20: number | string;
  delegator_weight_day21: number | string;
  delegator_weight_day22: number | string;
  delegator_weight_day23: number | string;
  delegator_weight_day24: number | string;
  delegator_weight_day25: number | string;
  delegator_weight_day26: number | string;
  delegator_weight_day27: number | string;
  delegator_weight_day28: number | string;
  delegator_weight_day29: number | string;
  delegator_weight_day30: number | string;
  // 30 days of validator count
  validator_count_day1: number | string;
  validator_count_day2: number | string;
  validator_count_day3: number | string;
  validator_count_day4: number | string;
  validator_count_day5: number | string;
  validator_count_day6: number | string;
  validator_count_day7: number | string;
  validator_count_day8: number | string;
  validator_count_day9: number | string;
  validator_count_day10: number | string;
  validator_count_day11: number | string;
  validator_count_day12: number | string;
  validator_count_day13: number | string;
  validator_count_day14: number | string;
  validator_count_day15: number | string;
  validator_count_day16: number | string;
  validator_count_day17: number | string;
  validator_count_day18: number | string;
  validator_count_day19: number | string;
  validator_count_day20: number | string;
  validator_count_day21: number | string;
  validator_count_day22: number | string;
  validator_count_day23: number | string;
  validator_count_day24: number | string;
  validator_count_day25: number | string;
  validator_count_day26: number | string;
  validator_count_day27: number | string;
  validator_count_day28: number | string;
  validator_count_day29: number | string;
  validator_count_day30: number | string;
  // 30 days of validator weight
  validator_weight_day1: number | string;
  validator_weight_day2: number | string;
  validator_weight_day3: number | string;
  validator_weight_day4: number | string;
  validator_weight_day5: number | string;
  validator_weight_day6: number | string;
  validator_weight_day7: number | string;
  validator_weight_day8: number | string;
  validator_weight_day9: number | string;
  validator_weight_day10: number | string;
  validator_weight_day11: number | string;
  validator_weight_day12: number | string;
  validator_weight_day13: number | string;
  validator_weight_day14: number | string;
  validator_weight_day15: number | string;
  validator_weight_day16: number | string;
  validator_weight_day17: number | string;
  validator_weight_day18: number | string;
  validator_weight_day19: number | string;
  validator_weight_day20: number | string;
  validator_weight_day21: number | string;
  validator_weight_day22: number | string;
  validator_weight_day23: number | string;
  validator_weight_day24: number | string;
  validator_weight_day25: number | string;
  validator_weight_day26: number | string;
  validator_weight_day27: number | string;
  validator_weight_day28: number | string;
  validator_weight_day29: number | string;
  validator_weight_day30: number | string;
}

interface ChartDataPoint {
  day: string;
  value: number;
}

interface ValidatorInfo {
  txHash: string;
  nodeId: string;
  subnetId: string;
  amountStaked: string;
  delegationFee: string;
  startTimestamp: number;
  endTimestamp: number;
  blsCredentials: {
    publicKey: string;
    proofOfPossession: string;
  };
  delegatorCount: number;
  amountDelegated: string;
  rewards: {
    validationRewardAmount: string;
    delegationRewardAmount: string;
    rewardAddresses: string[];
    rewardTxHash: string;
  };
  validationStatus: string;
  avalancheGoVersion?: string; // This is what we're looking for
}

interface ValidatorsResponse {
  nextPageToken?: string;
  validators: ValidatorInfo[];
}

interface VersionCount {
  version: string;
  count: number;
  percentage: number;
  amountStaked: number; // in AVAX
  stakingPercentage: number;
}

export default function PrimaryNetworkMetrics() {
  const [metrics, setMetrics] = useState<PrimaryNetworkMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [timeRange, setTimeRange] = React.useState("30d");
  const [validatorVersions, setValidatorVersions] = useState<VersionCount[]>(
    []
  );
  const [versionsError, setVersionsError] = useState<string | null>(null);

  const parseCSV = (csvText: string): PrimaryNetworkMetrics | null => {
    const lines = csvText.trim().split("\n");
    if (lines.length < 2) return null;

    const headers = lines[0].split(",");

    // Since we only have one row of data (Primary Network only), parse the second line
    const dataLine = lines[1];
    const values: string[] = [];
    let current = "";
    let inQuotes = false;
    let i = 0;

    while (i < dataLine.length) {
      const char = dataLine[i];

      if (char === '"') {
        if (inQuotes && i + 1 < dataLine.length && dataLine[i + 1] === '"') {
          // Handle escaped quote ("")
          current += '"';
          i += 2; // Skip both quotes
        } else {
          // Toggle quote mode
          inQuotes = !inQuotes;
          i++;
        }
      } else if (char === "," && !inQuotes) {
        values.push(current);
        current = "";
        i++;
      } else {
        current += char;
        i++;
      }
    }
    values.push(current);

    console.log("Parsed CSV values count:", values.length);
    console.log("Headers count:", headers.length);
    console.log("Last few values:", values.slice(-3));

    if (values.length >= headers.length) {
      const rowData: any = {};
      headers.forEach((header, index) => {
        const cleanHeader = header.trim();
        let rawValue = values[index] || "";

        // Special handling for validator_versions (keep as JSON string)
        if (cleanHeader === "validator_versions") {
          console.log(
            "Raw validator_versions field from CSV:",
            JSON.stringify(rawValue)
          );
          console.log("Raw validator_versions length:", rawValue.length);

          // The enhanced CSV parser should have already handled the quotes properly
          // Just store the value as-is
          rowData[cleanHeader] = rawValue;
          return;
        }

        rawValue = rawValue.replace(/"/g, "");
        let value: string | number = rawValue;
        if (rawValue !== "N/A" && rawValue !== "" && !isNaN(Number(rawValue))) {
          value = Number(rawValue);
        }
        rowData[cleanHeader] = value;
      });

      return rowData as PrimaryNetworkMetrics;
    }

    return null;
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch("/data/primary-network-stats.csv");
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const csvText = await response.text();
      const primaryNetworkData = parseCSV(csvText);

      if (!primaryNetworkData) {
        throw new Error("Primary Network data not found in CSV");
      }

      setMetrics(primaryNetworkData);
      setLastUpdated(new Date().toLocaleString());

      if (primaryNetworkData.validator_versions) {
        try {
          const versionsData = JSON.parse(
            primaryNetworkData.validator_versions
          );

          const versionArray: VersionCount[] = Object.entries(versionsData)
            .map(([version, data]: [string, any]) => ({
              version,
              count: data.validatorCount,
              percentage: 0,
              amountStaked: parseInt(data.amountStaked) / 1e9, // Convert to AVAX
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
  }, []);

  const formatNumber = (num: number | string): string => {
    if (num === "N/A" || num === "") return "N/A";
    const numValue = typeof num === "string" ? parseFloat(num) : num;
    if (isNaN(numValue)) return "N/A";
    return numValue.toLocaleString();
  };

  const formatWeight = (weight: number | string): string => {
    if (weight === "N/A" || weight === "") return "N/A";
    const numValue = typeof weight === "string" ? parseFloat(weight) : weight;
    if (isNaN(numValue)) return "N/A";

    // Format large numbers in a more readable way
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

  const getChartData = (metricPrefix: string): ChartDataPoint[] => {
    if (!metrics) return [];

    const today = new Date();
    const chartData: ChartDataPoint[] = [];
    const daysToShow = timeRange === "7d" ? 7 : 30;

    for (let i = daysToShow - 1; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      const dayLabel = date.toISOString().split("T")[0]; // Use ISO format for consistency

      const dayKey =
        `${metricPrefix}_day${daysToShow - i}` as keyof PrimaryNetworkMetrics;
      const value = metrics[dayKey];
      const numValue = typeof value === "string" ? parseFloat(value) : value;

      chartData.push({
        day: dayLabel,
        value: isNaN(numValue as number) ? 0 : (numValue as number),
      });
    }

    return chartData;
  };

  const getCurrentValue = (metricPrefix: string): number | string => {
    if (!metrics) return "N/A";
    const currentKey = `${metricPrefix}_day1` as keyof PrimaryNetworkMetrics;
    return metrics[currentKey] || "N/A";
  };

  const getValueChange = (
    metricPrefix: string
  ): { change: number; isPositive: boolean } => {
    if (!metrics) return { change: 0, isPositive: true };

    const currentKey = `${metricPrefix}_day1` as keyof PrimaryNetworkMetrics;
    const previousKey = `${metricPrefix}_day2` as keyof PrimaryNetworkMetrics;

    const current =
      typeof metrics[currentKey] === "string"
        ? parseFloat(metrics[currentKey] as string)
        : metrics[currentKey];
    const previous =
      typeof metrics[previousKey] === "string"
        ? parseFloat(metrics[previousKey] as string)
        : metrics[previousKey];

    if (
      isNaN(current as number) ||
      isNaN(previous as number) ||
      previous === 0
    ) {
      return { change: 0, isPositive: true };
    }

    const change =
      (((((current as number) - previous) as number) / previous) as number) *
      100;
    return { change: Math.abs(change), isPositive: change >= 0 };
  };

  // Prepare pie chart data
  const getPieChartData = () => {
    if (!validatorVersions.length) return [];

    return validatorVersions.map((version, index) => ({
      version: version.version,
      count: version.count,
      percentage: version.percentage,
      amountStaked: version.amountStaked,
      stakingPercentage: version.stakingPercentage,
      fill: `var(--color-version-${index})`,
    }));
  };

  // Generate chart config for versions
  const getVersionsChartConfig = (): ChartConfig => {
    const config: ChartConfig = {
      count: {
        label: "Validators",
      },
    };

    validatorVersions.forEach((version, index) => {
      const key = `version-${index}`;
      config[key] = {
        label: version.version,
        color: `hsl(${195 + index * 15}, 100%, ${65 - index * 8}%)`, // Blue variations
      };
    });

    return config;
  };

  const pieChartData = getPieChartData();
  const versionsChartConfig = getVersionsChartConfig();

  const chartConfigs = [
    {
      title: "Validator Count",
      icon: Shield,
      metricPrefix: "validator_count",
      description: `Number of active validators over the past ${timeRange === "7d" ? "7" : "30"} days`,
      chartConfig: {
        value: {
          label: "Validator Count",
          color: "#40c9ff",
        },
      } satisfies ChartConfig,
    },
    {
      title: "Validator Weight",
      icon: Weight,
      metricPrefix: "validator_weight",
      description: `Total validator weight over the past ${timeRange === "7d" ? "7" : "30"} days`,
      chartConfig: {
        value: {
          label: "Validator Weight",
          color: "#40c9ff",
        },
      } satisfies ChartConfig,
    },
    {
      title: "Delegator Count",
      icon: Users,
      metricPrefix: "delegator_count",
      description: `Number of active delegators over the past ${timeRange === "7d" ? "7" : "30"} days`,
      chartConfig: {
        value: {
          label: "Delegator Count",
          color: "#40c9ff",
        },
      } satisfies ChartConfig,
    },
    {
      title: "Delegator Weight",
      icon: Activity,
      metricPrefix: "delegator_weight",
      description: `Total delegator weight over the past ${timeRange === "7d" ? "7" : "30"} days`,
      chartConfig: {
        value: {
          label: "Delegator Weight",
          color: "#40c9ff",
        },
      } satisfies ChartConfig,
    },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted/20">
        <div className="container mx-auto p-6">
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-muted-foreground">
                Loading Primary Network metrics...
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
      <div className="container mx-auto p-6 space-y-8">
        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {chartConfigs.map((config, index) => {
            const chartData = getChartData(config.metricPrefix);
            const currentValue = getCurrentValue(config.metricPrefix);
            const { change, isPositive } = getValueChange(config.metricPrefix);
            const Icon = config.icon;

            return (
              <Card key={config.metricPrefix} className="w-full">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Icon className="h-5 w-5" style={{ color: "#40c9ff" }} />
                    {config.title}
                  </CardTitle>
                  <CardDescription>{config.description}</CardDescription>
                  <CardAction>
                    <ToggleGroup
                      type="single"
                      value={timeRange}
                      onValueChange={setTimeRange}
                      variant="outline"
                      className="hidden sm:flex"
                    >
                      <ToggleGroupItem value="30d">
                        Last 30 days
                      </ToggleGroupItem>
                      <ToggleGroupItem value="7d">Last 7 days</ToggleGroupItem>
                    </ToggleGroup>
                    <Select value={timeRange} onValueChange={setTimeRange}>
                      <SelectTrigger
                        className="w-40 sm:hidden"
                        size="sm"
                        aria-label="Select a value"
                      >
                        <SelectValue placeholder="Last 30 days" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        <SelectItem value="30d" className="rounded-lg">
                          Last 30 days
                        </SelectItem>
                        <SelectItem value="7d" className="rounded-lg">
                          Last 7 days
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </CardAction>
                </CardHeader>
                <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="text-2xl font-bold">
                      {config.metricPrefix.includes("weight")
                        ? formatWeight(currentValue)
                        : formatNumber(currentValue)}
                    </div>
                    {change > 0 && (
                      <div
                        className={`flex items-center gap-1 text-sm ${
                          isPositive ? "text-green-600" : "text-red-600"
                        }`}
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
                    className="aspect-auto h-[250px] w-full"
                  >
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient
                          id={`fill-${config.metricPrefix}`}
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
                        tickFormatter={(value) => {
                          const date = new Date(value);
                          return date.toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          });
                        }}
                      />
                      <ChartTooltip
                        cursor={false}
                        content={
                          <ChartTooltipContent
                            labelFormatter={(value) => {
                              return new Date(value).toLocaleDateString(
                                "en-US",
                                {
                                  month: "short",
                                  day: "numeric",
                                }
                              );
                            }}
                            indicator="dot"
                            formatter={(value) => [
                              config.metricPrefix.includes("weight")
                                ? formatWeight(value as number)
                                : formatNumber(value as number),
                              config.title,
                            ]}
                          />
                        }
                      />
                      <Area
                        dataKey="value"
                        type="natural"
                        fill={`url(#fill-${config.metricPrefix})`}
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

        {/* Validator Version Distribution Charts */}
        {validatorVersions.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* By Validator Count */}
            <Card data-chart="pie-count" className="flex flex-col">
              <ChartStyle id="pie-count" config={versionsChartConfig} />
              <CardHeader className="flex-row items-start space-y-0 pb-0">
                <div className="grid gap-1">
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5" style={{ color: "#40c9ff" }} />
                    By Validator Count
                  </CardTitle>
                  <CardDescription>
                    Distribution by number of validators
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent className="flex flex-1 justify-center pb-0">
                <ChartContainer
                  id="pie-count"
                  config={versionsChartConfig}
                  className="mx-auto aspect-square w-full max-w-[350px]"
                >
                  <PieChart>
                    <ChartTooltip
                      cursor={false}
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="rounded-lg border bg-background p-2 shadow-sm">
                              <div className="grid gap-2">
                                <div className="flex flex-col">
                                  <span className="text-[0.70rem] uppercase text-muted-foreground">
                                    {data.version}
                                  </span>
                                  <span className="font-bold text-muted-foreground">
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
                      innerRadius={70}
                      strokeWidth={5}
                    >
                      <Label
                        content={({ viewBox }) => {
                          if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                            const totalValidators = pieChartData.reduce(
                              (sum, item) => sum + item.count,
                              0
                            );
                            return (
                              <text
                                x={viewBox.cx}
                                y={viewBox.cy}
                                textAnchor="middle"
                                dominantBaseline="middle"
                              >
                                <tspan
                                  x={viewBox.cx}
                                  y={viewBox.cy}
                                  className="fill-foreground text-2xl font-bold"
                                >
                                  {totalValidators.toLocaleString()}
                                </tspan>
                                <tspan
                                  x={viewBox.cx}
                                  y={(viewBox.cy || 0) + 24}
                                  className="fill-muted-foreground text-sm"
                                >
                                  Total Validators
                                </tspan>
                              </text>
                            );
                          }
                        }}
                      />
                    </Pie>
                  </PieChart>
                </ChartContainer>
              </CardContent>
            </Card>

            {/* By Stake Weight */}
            <Card data-chart="pie-stake" className="flex flex-col">
              <ChartStyle id="pie-stake" config={versionsChartConfig} />
              <CardHeader className="flex-row items-start space-y-0 pb-0">
                <div className="grid gap-1">
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5" style={{ color: "#40c9ff" }} />
                    By Stake Weight
                  </CardTitle>
                  <CardDescription>
                    Distribution by amount staked
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent className="flex flex-1 justify-center pb-0">
                <ChartContainer
                  id="pie-stake"
                  config={versionsChartConfig}
                  className="mx-auto aspect-square w-full max-w-[350px]"
                >
                  <PieChart>
                    <ChartTooltip
                      cursor={false}
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="rounded-lg border bg-background p-2 shadow-sm">
                              <div className="grid gap-2">
                                <div className="flex flex-col">
                                  <span className="text-[0.70rem] uppercase text-muted-foreground">
                                    {data.version}
                                  </span>
                                  <span className="font-bold text-muted-foreground">
                                    {data.amountStaked.toLocaleString(
                                      undefined,
                                      { maximumFractionDigits: 0 }
                                    )}{" "}
                                    AVAX ({data.stakingPercentage.toFixed(1)}%)
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
                      innerRadius={70}
                      strokeWidth={5}
                    >
                      <Label
                        content={({ viewBox }) => {
                          if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                            const totalStaked = pieChartData.reduce(
                              (sum, item) => sum + item.amountStaked,
                              0
                            );
                            return (
                              <text
                                x={viewBox.cx}
                                y={viewBox.cy}
                                textAnchor="middle"
                                dominantBaseline="middle"
                              >
                                <tspan
                                  x={viewBox.cx}
                                  y={viewBox.cy}
                                  className="fill-foreground text-lg font-bold"
                                >
                                  {(totalStaked / 1000000).toLocaleString(
                                    undefined,
                                    { maximumFractionDigits: 1 }
                                  )}
                                  M
                                </tspan>
                                <tspan
                                  x={viewBox.cx}
                                  y={(viewBox.cy || 0) + 24}
                                  className="fill-muted-foreground text-sm"
                                >
                                  AVAX Staked
                                </tspan>
                              </text>
                            );
                          }
                        }}
                      />
                    </Pie>
                  </PieChart>
                </ChartContainer>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Validator Software Versions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl flex items-center gap-2">
              <Shield className="h-5 w-5" style={{ color: "#40c9ff" }} />
              Validator Software Versions
            </CardTitle>
            <CardDescription>
              Distribution of AvalancheGo versions across Primary Network
              validators
            </CardDescription>
          </CardHeader>
          <CardContent>
            {versionsError ? (
              <div className="text-center py-8">
                <p className="text-destructive mb-4">Error: {versionsError}</p>
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
                          <span className="font-semibold">
                            {versionInfo.count} (
                            {versionInfo.percentage.toFixed(1)}%)
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">
                            Staked:
                          </span>
                          <span className="font-semibold">
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
                              opacity: 0.7 + (index === 0 ? 0.3 : -index * 0.1),
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

        {/* Summary Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Primary Network Summary</CardTitle>
            <CardDescription>
              Current state of the Avalanche Primary Network
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {chartConfigs.map((config) => {
                const currentValue = getCurrentValue(config.metricPrefix);
                const Icon = config.icon;

                return (
                  <div
                    key={config.metricPrefix}
                    className="text-center p-4 rounded-lg bg-muted/50"
                  >
                    <Icon
                      className="h-6 w-6 mx-auto mb-2"
                      style={{ color: "#40c9ff" }}
                    />
                    <p className="text-sm text-muted-foreground">
                      {config.title}
                    </p>
                    <p className="text-lg font-semibold">
                      {config.metricPrefix.includes("weight")
                        ? formatWeight(currentValue)
                        : formatNumber(currentValue)}
                    </p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
