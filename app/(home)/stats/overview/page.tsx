"use client";
import type React from "react";
import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Activity,
  Users,
  FileCode,
  BarChart3,
  Loader2,
  Search,
  ExternalLink,
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
import BubbleNavigation from "@/components/navigation/BubbleNavigation";
import l1ChainsData from "@/constants/l1-chains.json";

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
  validatorCount: number | string;
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
  const [searchTerm, setSearchTerm] = useState("");

  const getChainSlug = (chainId: string, chainName: string): string | null => {
    const chain = l1ChainsData.find(
      (c) =>
        c.chainId === chainId ||
        c.chainName.toLowerCase() === chainName.toLowerCase()
    );
    return chain?.slug || null;
  };

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
        const parseMetricValue = (value: string): number | string => {
          if (value === "N/A" || value === "") return "N/A";
          const parsed = Number.parseInt(value);
          return isNaN(parsed) ? "N/A" : parsed;
        };

        data.push({
          chainId: values[0],
          chainName: chainName.toUpperCase(),
          chainLogoURI: chainLogoURI,
          day1TxCount: parseMetricValue(values[4]),
          day2TxCount: parseMetricValue(values[5]),
          day3TxCount: parseMetricValue(values[6]),
          day4TxCount: parseMetricValue(values[7]),
          day5TxCount: parseMetricValue(values[8]),
          day6TxCount: parseMetricValue(values[9]),
          day7TxCount: parseMetricValue(values[10]),
          weeklyTxCount: parseMetricValue(values[11]),
          weeklyContractsDeployed: parseMetricValue(values[12]),
          weeklyActiveAddresses: parseMetricValue(values[13]),
          totalIcmMessages: parseMetricValue(values[14]),
          validatorCount: parseMetricValue(values[15]),
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
          setLastUpdated(new Date(lastModified).toLocaleDateString());
        } else {
          setLastUpdated(new Date().toLocaleDateString());
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

  const getChartData = () => {
    const validChains = chainMetrics
      .filter(
        (chain) =>
          typeof chain.weeklyTxCount === "number" && chain.weeklyTxCount > 0
      )
      .sort((a, b) => (b.weeklyTxCount as number) - (a.weeklyTxCount as number))
      .slice(0, 5);

    const today = new Date();
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      days.push(
        date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
      );
    }

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

      const totalDayTransactions = chainMetrics.reduce((sum, chain) => {
        const value =
          typeof chain[dayKey] === "number" ? (chain[dayKey] as number) : 0;
        return sum + value;
      }, 0);

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
    setVisibleCount(25);
  };

  const filteredData = chainMetrics.filter((chain) => {
    return chain.chainName.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const sortedData = [...filteredData].sort((a, b) => {
    const aValue = a[sortField];
    const bValue = b[sortField];

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
    field: SortField;
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

  const getActivityDots = (
    transactions: number | string,
    addresses: number | string,
    icmMessages: number | string
  ) => {
    const txCount = typeof transactions === "number" ? transactions : 0;
    const addrCount = typeof addresses === "number" ? addresses : 0;
    const icmCount = typeof icmMessages === "number" ? icmMessages : 0;

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
        <main className="container mx-auto px-4 py-8 pb-24 space-y-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <Loader2 className="h-12 w-12 animate-spin text-orange-500 mx-auto mb-4" />
              <p className="text-lg font-medium">Loading chain metrics...</p>
              <p className="text-sm text-muted-foreground mt-1">
                Fetching latest data from CSV
              </p>
            </div>
          </div>
        </main>

        {/* Bubble Navigation */}
        <BubbleNavigation />
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
        <BubbleNavigation />
      </div>
    );
  }

  if (chainMetrics.length === 0) {
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
                  No chain metrics found in the CSV file.
                </p>
              </CardContent>
            </Card>
          </div>
        </main>

        {/* Bubble Navigation */}
        <BubbleNavigation />
      </div>
    );
  }

  const { chartData, topChains } = getChartData();

  const areaColors = [
    "#667eea",
    "#764ba2",
    "#f093fb",
    "#4facfe",
    "#43e97b",
    "#38f9d7",
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="container mx-auto px-4 py-8 pb-24 space-y-8">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
          <div className="space-y-3">
            <h1 className="text-3xl lg:text-4xl font-bold tracking-tight">
              Avalanche Mainnet L1 Stats
            </h1>
            <p className="text-base text-muted-foreground max-w-2xl leading-relaxed">
              An opinionated collection of stats for the Avalanche Mainnet L1s.
              Updated daily. Click on any chain name to view detailed metrics.
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Last updated</span>
            <span className="font-medium">{lastUpdated || "Just now"}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
          <Card className="py-0 bg-card hover:border-border transition-colors">
            <CardContent className="p-6">
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-muted-foreground">
                  Total Mainnet L1s
                </h3>
                <div className="space-y-1">
                  <p className="text-3xl font-bold text-foreground">
                    {chainMetrics.length}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Active blockchain networks
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="py-0 bg-card hover:border-border transition-colors">
            <CardContent className="p-6">
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-muted-foreground">
                  Weekly Transactions
                </h3>
                <div className="space-y-1">
                  <p className="text-3xl font-bold text-foreground">
                    {formatNumber(
                      chainMetrics.reduce((sum, chain) => {
                        const tx =
                          typeof chain.weeklyTxCount === "number"
                            ? chain.weeklyTxCount
                            : 0;
                        return sum + tx;
                      }, 0)
                    )}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Across all L1 chains
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="py-0 bg-card hover:border-border transition-colors">
            <CardContent className="p-6">
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-muted-foreground">
                  Active Addresses
                </h3>
                <div className="space-y-1">
                  <p className="text-3xl font-bold text-foreground">
                    {formatNumber(
                      chainMetrics.reduce((sum, chain) => {
                        const addresses =
                          typeof chain.weeklyActiveAddresses === "number"
                            ? chain.weeklyActiveAddresses
                            : 0;
                        return sum + addresses;
                      }, 0)
                    )}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Weekly active users
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="py-0 bg-blue-500/10 border-blue-500/20">
            <CardContent className="p-4">
              <div className="text-center space-y-1">
                <p className="text-xs font-medium text-muted-foreground">
                  Weekly Active Chains
                </p>
                <p className="text-lg font-bold text-foreground">
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
              </div>
            </CardContent>
          </Card>

          <Card className="py-0 bg-purple-500/10 border-purple-500/20">
            <CardContent className="p-4">
              <div className="text-center space-y-1">
                <p className="text-xs font-medium text-muted-foreground">
                  Contracts Deployed
                </p>
                <p className="text-lg font-bold text-foreground">
                  {formatNumber(
                    chainMetrics.reduce((sum, chain) => {
                      const contracts =
                        typeof chain.weeklyContractsDeployed === "number"
                          ? chain.weeklyContractsDeployed
                          : 0;
                      return sum + contracts;
                    }, 0)
                  )}
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
                    chainMetrics.reduce((sum, chain) => {
                      const icmMessages =
                        typeof chain.totalIcmMessages === "number"
                          ? chain.totalIcmMessages
                          : 0;
                      return sum + icmMessages;
                    }, 0)
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
                  {formatNumber(
                    chainMetrics.reduce((sum, chain) => {
                      const validators =
                        typeof chain.validatorCount === "number"
                          ? chain.validatorCount
                          : 0;
                      return sum + validators;
                    }, 0)
                  )}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg md:text-xl">
              <BarChart3 className="h-5 w-5 text-orange-500" />
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
                        Weekly Transactions
                      </span>
                      <span className="lg:hidden">Weekly Tx</span>
                    </SortButton>
                  </TableHead>
                  <TableHead className="font-medium text-center min-w-[140px] text-muted-foreground">
                    <SortButton field="weeklyContractsDeployed">
                      <span className="hidden lg:flex items-center gap-1">
                        <FileCode className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                        Contracts Deployed
                      </span>
                      <span className="lg:hidden">Contracts</span>
                    </SortButton>
                  </TableHead>
                  <TableHead className="font-medium text-center min-w-[140px] text-muted-foreground">
                    <SortButton field="weeklyActiveAddresses">
                      <span className="hidden lg:flex items-center gap-1">
                        <Users className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                        Active Addresses
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
                            typeof chain.weeklyTxCount === "number" &&
                            chain.weeklyTxCount > 0
                              ? "text-foreground"
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
                            typeof chain.weeklyContractsDeployed === "number" &&
                            chain.weeklyContractsDeployed > 0
                              ? "text-foreground"
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
                              ? "text-foreground"
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
                              ? "text-foreground"
                              : "text-muted-foreground"
                          }`}
                        >
                          {typeof chain.totalIcmMessages === "number"
                            ? formatFullNumber(chain.totalIcmMessages)
                            : chain.totalIcmMessages}
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
                        <ActivityIndicator
                          count={getActivityDots(
                            chain.weeklyTxCount,
                            chain.weeklyActiveAddresses,
                            chain.totalIcmMessages
                          )}
                        />
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
          <p className="text-sm text-muted-foreground">
            Data is updated daily via automated script. Chain logos and metrics
            are fetched from CSV data source.
          </p>
        </div>
      </main>

      {/* Bubble Navigation */}
      <BubbleNavigation />
    </div>
  );
}
