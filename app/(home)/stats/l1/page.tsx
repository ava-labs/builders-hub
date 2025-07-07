"use client";
import type React from "react";
import { useState, useEffect } from "react";
import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Activity,
  Users,
  FileCode,
  BarChart3,
  Loader2,
} from "lucide-react";
import { ChartContainer, ChartTooltip } from "@/components/ui/chart";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";

interface ChainMetrics {
  chainId: string;
  chainName: string;
  chainLogoURI: string;
  day1TxCount: number | string;
  day2TxCount: number | string;
  day3TxCount: number | string;
  day4TxCount: number | string;
  day5TxCount: number | string;
  day6TxCount: number | string;
  day7TxCount: number | string;
  weeklyTxCount: number | string;
  weeklyContractsDeployed: number | string;
  weeklyActiveAddresses: number | string;
  totalIcmMessages: number | string;
}

type SortField = keyof ChainMetrics;
type SortDirection = "asc" | "desc";

export default function AvalancheMetrics() {
  const [chainMetrics, setChainMetrics] = useState<ChainMetrics[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>("weeklyTxCount");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [visibleCount, setVisibleCount] = useState(25);

  const parseCSV = (csvText: string): ChainMetrics[] => {
    const lines = csvText.trim().split("\n");
    const headers = lines[0].split(",");
    const data: ChainMetrics[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      const values: string[] = [];
      let current = "";
      let inQuotes = false;

      for (let j = 0; j < line.length; j++) {
        const char = line[j];

        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === "," && !inQuotes) {
          values.push(current);
          current = "";
        } else {
          current += char;
        }
      }
      values.push(current);

      if (values.length >= headers.length) {
        const chainName = values[1].replace(/"/g, "");
        const chainLogoURI = values[2].replace(/"/g, "");

        // Helper function to parse metric values
        const parseMetricValue = (value: string): number | string => {
          if (value === "N/A" || value === "") return "N/A";
          const parsed = Number.parseInt(value);
          return isNaN(parsed) ? "N/A" : parsed;
        };

        data.push({
          chainId: values[0],
          chainName: chainName.toUpperCase(),
          chainLogoURI: chainLogoURI,
          day1TxCount: parseMetricValue(values[3]),
          day2TxCount: parseMetricValue(values[4]),
          day3TxCount: parseMetricValue(values[5]),
          day4TxCount: parseMetricValue(values[6]),
          day5TxCount: parseMetricValue(values[7]),
          day6TxCount: parseMetricValue(values[8]),
          day7TxCount: parseMetricValue(values[9]),
          weeklyTxCount: parseMetricValue(values[10]),
          weeklyContractsDeployed: parseMetricValue(values[11]),
          weeklyActiveAddresses: parseMetricValue(values[12]),
          totalIcmMessages: parseMetricValue(values[13]),
        });
      }
    }

    return data;
  };

  useEffect(() => {
    const fetchCSVData = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch("/data/chain-metrics.csv");

        if (!response.ok) {
          throw new Error(`Failed to fetch CSV: ${response.status}`);
        }

        const csvText = await response.text();
        const metrics = parseCSV(csvText);

        setChainMetrics(metrics);

        const lastModified = response.headers.get("last-modified");
        if (lastModified) {
          setLastUpdated(new Date(lastModified).toLocaleString());
        } else {
          setLastUpdated(new Date().toLocaleString());
        }
      } catch (err: any) {
        console.error("Error fetching CSV data:", err);
        setError(err?.message || "Failed to load metrics data");
      }

      setLoading(false);
    };

    fetchCSVData();
  }, []);

  const formatNumber = (num: number): string => {
    if (num === 0) return "0";
    if (num < 1000) return num.toLocaleString();
    if (num < 1000000) return `${(num / 1000).toFixed(1)}K`;
    return `${(num / 1000000).toFixed(1)}M`;
  };

  const formatFullNumber = (num: number): string => {
    return num.toLocaleString();
  };

  const getActivityStatus = (
    transactions: number | string,
    addresses: number | string,
    icmMessages: number | string
  ) => {
    const txCount = typeof transactions === "number" ? transactions : 0;
    const addrCount = typeof addresses === "number" ? addresses : 0;
    const icmCount = typeof icmMessages === "number" ? icmMessages : 0;

    if (txCount === 0 && addrCount === 0 && icmCount === 0)
      return { label: "Inactive", variant: "secondary" as const };
    if (txCount < 100 && addrCount < 1000 && icmCount < 10)
      return { label: "Low", variant: "outline" as const };
    if (txCount < 1000 && addrCount < 10000 && icmCount < 100)
      return { label: "Medium", variant: "default" as const };
    return { label: "High", variant: "default" as const };
  };

  const getChartData = () => {
    // Get top 5 chains by weekly transaction count
    const validChains = chainMetrics
      .filter(
        (chain) =>
          typeof chain.weeklyTxCount === "number" && chain.weeklyTxCount > 0
      )
      .sort((a, b) => (b.weeklyTxCount as number) - (a.weeklyTxCount as number))
      .slice(0, 5);

    // Create chart data for each day
    const days = [
      "Day 1",
      "Day 2",
      "Day 3",
      "Day 4",
      "Day 5",
      "Day 6",
      "Day 7",
    ];
    const dayKeys = [
      "day1TxCount",
      "day2TxCount",
      "day3TxCount",
      "day4TxCount",
      "day5TxCount",
      "day6TxCount",
      "day7TxCount",
    ] as const;

    const chartData = days.map((day, index) => {
      const dayKey = dayKeys[index];
      const dataPoint: any = { day };

      // Add top chains data
      let topChainsTotal = 0;
      validChains.forEach((chain) => {
        const chainKey =
          chain.chainName.length > 10
            ? chain.chainName.substring(0, 10) + "..."
            : chain.chainName;
        const value =
          typeof chain[dayKey] === "number" ? (chain[dayKey] as number) : 0;
        dataPoint[chainKey] = value;
        dataPoint[`${chainKey}_fullName`] = chain.chainName;
        topChainsTotal += value;
      });

      // Calculate total transactions for this day across ALL chains
      const totalDayTransactions = chainMetrics.reduce((sum, chain) => {
        const value =
          typeof chain[dayKey] === "number" ? (chain[dayKey] as number) : 0;
        return sum + value;
      }, 0);

      // Others = Total for this day - Top 5 chains for this day
      const othersTotal = totalDayTransactions - topChainsTotal;

      if (othersTotal > 0) {
        dataPoint["Others"] = othersTotal;
        dataPoint["Others_fullName"] = "Others";
      }

      return dataPoint;
    });

    return { chartData, topChains: validChains };
  };

  const chartConfig = {
    transactions: {
      label: "Daily Transactions",
    },
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
    // Reset visible count when sorting changes
    setVisibleCount(25);
  };

  const sortedData = [...chainMetrics].sort((a, b) => {
    const aValue = a[sortField];
    const bValue = b[sortField];

    if (typeof aValue === "string" && typeof bValue === "string") {
      return sortDirection === "asc"
        ? aValue.localeCompare(bValue)
        : bValue.localeCompare(aValue);
    }

    // Handle mixed types (number vs string)
    const aNum = typeof aValue === "number" ? aValue : 0;
    const bNum = typeof bValue === "number" ? bValue : 0;

    return sortDirection === "asc" ? aNum - bNum : bNum - aNum;
  });

  // Get visible data based on current pagination
  const visibleData = sortedData.slice(0, visibleCount);
  const hasMoreData = visibleCount < sortedData.length;

  const handleLoadMore = () => {
    setVisibleCount((prev) => Math.min(prev + 25, sortedData.length));
  };

  const SortButton = ({
    field,
    children,
  }: {
    field: SortField;
    children: React.ReactNode;
  }) => (
    <Button
      variant="ghost"
      size="sm"
      className="h-auto p-0 font-semibold hover:bg-transparent text-foreground"
      onClick={() => handleSort(field)}
    >
      <span className="flex items-center gap-1">
        {children}
        {sortField === field ? (
          sortDirection === "asc" ? (
            <ArrowUp className="h-3 w-3" />
          ) : (
            <ArrowDown className="h-3 w-3" />
          )
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-50" />
        )}
      </span>
    </Button>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <main className="container mx-auto px-4 py-12">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
              <p className="text-lg font-medium">Loading chain metrics...</p>
              <p className="text-sm text-muted-foreground mt-1">
                Fetching latest data from CSV
              </p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <main className="container mx-auto px-4 py-12">
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
      </div>
    );
  }

  if (chainMetrics.length === 0) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <main className="container mx-auto px-4 py-12">
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
                  No chain metrics found in the CSV file.
                </p>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    );
  }

  const { chartData, topChains } = getChartData();

  // Define beautiful colors similar to the screenshot
  const areaColors = [
    "#8dd3c7", // Soft teal/mint
    "#fdb462", // Warm orange/salmon
    "#b3de69", // Light green
    "#fccde5", // Soft pink
    "#80b1d3", // Light blue
    "#bebada", // Light purple
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="container mx-auto px-4 py-6 md:py-12 space-y-6">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
              Avalanche Mainnet L1 Stats
            </h1>
            <p className="text-muted-foreground mt-1">
              An opinionated collection of stats for the Avalanche Mainnet L1s.
              Updated daily.
            </p>
          </div>
          <div className="text-left sm:text-right">
            <p className="text-sm text-muted-foreground">Last updated</p>
            <p className="text-sm font-medium">{lastUpdated || "Just now"}</p>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 md:gap-4">
          <Card className="border-blue-200 dark:border-blue-800">
            <CardContent className="p-3 md:p-4">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 md:h-5 md:w-5 text-blue-600" />
                <span className="text-xs md:text-sm font-medium text-blue-600 dark:text-blue-400">
                  Total Mainnet L1s
                </span>
              </div>
              <p className="text-xl md:text-2xl font-bold text-blue-700 dark:text-blue-300 mt-1">
                {chainMetrics.length}
              </p>
            </CardContent>
          </Card>

          <Card className="border-green-200 dark:border-green-800">
            <CardContent className="p-3 md:p-4">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 md:h-5 md:w-5 text-green-600" />
                <span className="text-xs md:text-sm font-medium text-green-600 dark:text-green-400">
                  Weekly Active Chains
                </span>
              </div>
              <p className="text-xl md:text-2xl font-bold text-green-700 dark:text-green-300 mt-1">
                {
                  chainMetrics.filter((chain) => {
                    const txCount =
                      typeof chain.weeklyTxCount === "number"
                        ? chain.weeklyTxCount
                        : 0;
                    const addrCount =
                      typeof chain.weeklyActiveAddresses === "number"
                        ? chain.weeklyActiveAddresses
                        : 0;
                    return txCount > 0 || addrCount > 0;
                  }).length
                }
              </p>
            </CardContent>
          </Card>

          <Card className="border-purple-200 dark:border-purple-800">
            <CardContent className="p-3 md:p-4">
              <div className="flex items-center gap-2">
                <FileCode className="h-4 w-4 md:h-5 md:w-5 text-purple-600" />
                <span className="text-xs md:text-sm font-medium text-purple-600 dark:text-purple-400">
                  Weekly Deployed Contracts
                </span>
              </div>
              <p className="text-xl md:text-2xl font-bold text-purple-700 dark:text-purple-300 mt-1">
                {formatFullNumber(
                  chainMetrics.reduce((sum, chain) => {
                    const contracts =
                      typeof chain.weeklyContractsDeployed === "number"
                        ? chain.weeklyContractsDeployed
                        : 0;
                    return sum + contracts;
                  }, 0)
                )}
              </p>
            </CardContent>
          </Card>

          <Card className="border-orange-200 dark:border-orange-800">
            <CardContent className="p-3 md:p-4">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 md:h-5 md:w-5 text-orange-600" />
                <span className="text-xs md:text-sm font-medium text-orange-600 dark:text-orange-400">
                  Weekly Active Addresses
                </span>
              </div>
              <p className="text-xl md:text-2xl font-bold text-orange-700 dark:text-orange-300 mt-1">
                {formatFullNumber(
                  chainMetrics.reduce((sum, chain) => {
                    const addresses =
                      typeof chain.weeklyActiveAddresses === "number"
                        ? chain.weeklyActiveAddresses
                        : 0;
                    return sum + addresses;
                  }, 0)
                )}
              </p>
            </CardContent>
          </Card>

          <Card className="border-green-200 dark:border-green-800">
            <CardContent className="p-3 md:p-4">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 md:h-5 md:w-5 text-green-600" />
                <span className="text-xs md:text-sm font-medium text-green-600 dark:text-green-400">
                  All-time ICM Messages
                </span>
              </div>
              <p className="text-xl md:text-2xl font-bold text-green-700 dark:text-green-300 mt-1">
                {formatFullNumber(
                  chainMetrics.reduce((sum, chain) => {
                    const icmMessages =
                      typeof chain.totalIcmMessages === "number"
                        ? chain.totalIcmMessages
                        : 0;
                    return sum + icmMessages;
                  }, 0)
                )}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Daily Transaction Trends Chart */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg md:text-xl">
              <BarChart3 className="h-5 w-5 text-primary" />
              Daily Transaction Trends - Top L1s
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Stacked daily transaction volumes showing total activity across
              top L1s over the past 7 days
            </p>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[350px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={chartData}
                  margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
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
                          stopColor={areaColors[index]}
                          stopOpacity={0.6}
                        />
                        <stop
                          offset="95%"
                          stopColor={areaColors[index]}
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
                        stopColor={areaColors[5]}
                        stopOpacity={0.6}
                      />
                      <stop
                        offset="95%"
                        stopColor={areaColors[5]}
                        stopOpacity={0.1}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    className="stroke-muted/30"
                  />
                  <XAxis
                    dataKey="day"
                    className="text-xs"
                    tick={{ fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    className="text-xs"
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => formatNumber(value)}
                    axisLine={false}
                    tickLine={false}
                  />
                  <ChartTooltip
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
                              {label} Transactions
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
                                      {formatFullNumber(entry.value as number)}
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
                        stroke={areaColors[index]}
                        strokeWidth={2}
                        fill={`url(#gradient-${index})`}
                        fillOpacity={0.4}
                      />
                    );
                  })}
                  <Area
                    type="monotone"
                    dataKey="Others"
                    stackId="1"
                    stroke={areaColors[5]}
                    strokeWidth={2}
                    fill="url(#gradient-others)"
                    fillOpacity={0.4}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Main Table */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg md:text-xl">
              <BarChart3 className="h-5 w-5 text-primary" />
              L1 Metrics Overview
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-b-2">
                    <TableHead className="font-semibold py-4 min-w-[200px] px-4">
                      <SortButton field="chainName">L1 Name</SortButton>
                    </TableHead>
                    <TableHead className="font-semibold text-center min-w-[140px]">
                      <SortButton field="weeklyTxCount">
                        <span className="hidden lg:flex items-center gap-1">
                          <BarChart3 className="h-4 w-4 text-blue-600" />
                          Weekly Transactions
                        </span>
                        <span className="lg:hidden">Weekly Tx</span>
                      </SortButton>
                    </TableHead>
                    <TableHead className="font-semibold text-center min-w-[140px]">
                      <SortButton field="weeklyContractsDeployed">
                        <span className="hidden lg:flex items-center gap-1">
                          <FileCode className="h-4 w-4 text-purple-600" />
                          Contracts Deployed
                        </span>
                        <span className="lg:hidden">Contracts</span>
                      </SortButton>
                    </TableHead>
                    <TableHead className="font-semibold text-center min-w-[140px]">
                      <SortButton field="weeklyActiveAddresses">
                        <span className="hidden lg:flex items-center gap-1">
                          <Users className="h-4 w-4 text-orange-600" />
                          Active Addresses
                        </span>
                        <span className="lg:hidden">Addresses</span>
                      </SortButton>
                    </TableHead>
                    <TableHead className="font-semibold text-center min-w-[140px]">
                      <SortButton field="totalIcmMessages">
                        <span className="hidden lg:flex items-center gap-1">
                          <Activity className="h-4 w-4 text-green-600" />
                          Total ICM Count
                        </span>
                        <span className="lg:hidden">ICM</span>
                      </SortButton>
                    </TableHead>
                    <TableHead className="font-semibold text-center min-w-[100px]">
                      Activity
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleData.map((chain, index) => {
                    const activityStatus = getActivityStatus(
                      chain.weeklyTxCount,
                      chain.weeklyActiveAddresses,
                      chain.totalIcmMessages
                    );
                    return (
                      <TableRow
                        key={chain.chainId}
                        className="hover:bg-muted/50 transition-colors"
                      >
                        <TableCell className="font-medium py-4 p-4">
                          <div className="flex items-center gap-3">
                            {chain.chainLogoURI ? (
                              <Image
                                src={chain.chainLogoURI || "/placeholder.svg"}
                                alt={`${chain.chainName} logo`}
                                width={32}
                                height={32}
                                className="rounded-full ring-2 ring-border flex-shrink-0"
                                onError={(e) => {
                                  e.currentTarget.style.display = "none";
                                }}
                              />
                            ) : (
                              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                                {chain.chainName.charAt(0)}
                              </div>
                            )}
                            <span className="font-semibold text-sm md:text-base truncate">
                              {chain.chainName}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <span
                            className={`font-mono font-semibold text-sm ${
                              typeof chain.weeklyTxCount === "number" &&
                              chain.weeklyTxCount > 0
                                ? "text-blue-600 dark:text-blue-400"
                                : "text-muted-foreground"
                            }`}
                          >
                            {typeof chain.weeklyTxCount === "number"
                              ? formatFullNumber(chain.weeklyTxCount)
                              : chain.weeklyTxCount}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <span
                            className={`font-mono font-semibold text-sm ${
                              typeof chain.weeklyContractsDeployed ===
                                "number" && chain.weeklyContractsDeployed > 0
                                ? "text-purple-600 dark:text-purple-400"
                                : "text-muted-foreground"
                            }`}
                          >
                            {typeof chain.weeklyContractsDeployed === "number"
                              ? formatFullNumber(chain.weeklyContractsDeployed)
                              : chain.weeklyContractsDeployed}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <span
                            className={`font-mono font-semibold text-sm ${
                              typeof chain.weeklyActiveAddresses === "number" &&
                              chain.weeklyActiveAddresses > 0
                                ? "text-orange-600 dark:text-orange-400"
                                : "text-muted-foreground"
                            }`}
                          >
                            {typeof chain.weeklyActiveAddresses === "number"
                              ? formatFullNumber(chain.weeklyActiveAddresses)
                              : chain.weeklyActiveAddresses}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <span
                            className={`font-mono font-semibold text-sm ${
                              typeof chain.totalIcmMessages === "number" &&
                              chain.totalIcmMessages > 0
                                ? "text-green-600 dark:text-green-400"
                                : "text-muted-foreground"
                            }`}
                          >
                            {typeof chain.totalIcmMessages === "number"
                              ? formatFullNumber(chain.totalIcmMessages)
                              : chain.totalIcmMessages}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge
                            variant={activityStatus.variant}
                            className="font-medium text-xs"
                          >
                            {activityStatus.label}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Load More Button */}
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

        {/* Showing count indicator */}
        <div className="text-center">
          <p className="text-sm text-muted-foreground mb-2">
            Showing {Math.min(visibleCount, sortedData.length)} of{" "}
            {sortedData.length} chains
          </p>
          <p className="text-sm text-muted-foreground">
            Data is updated daily via automated script. Chain logos and metrics
            are fetched from CSV data source.
          </p>
        </div>
      </main>
    </div>
  );
}
