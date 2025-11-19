"use client";

import {
  ArrowUpRight,
  Activity,
  Layers,
  ArrowRight,
  ArrowLeft,
  Copy,
} from "lucide-react";
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import Image from "next/image";

interface OverviewData {
  totalTransfers: number;
  totalVolumeUsd: number;
  activeChains: number;
  activeRoutes: number;
  topToken: {
    name: string;
    percentage: string;
  };
}

interface TokenData {
  name: string;
  symbol: string;
  value: number;
  address: string;
}

interface RouteData {
  name: string;
  total: number;
  direction: string;
}

interface Transfer {
  homeChainName: string;
  remoteChainName: string;
  homeChainDisplayName?: string;
  remoteChainDisplayName?: string;
  homeChainLogo?: string;
  remoteChainLogo?: string;
  homeChainColor?: string;
  remoteChainColor?: string;
  direction: string;
  contractAddress: string;
  tokenName: string;
  coinAddress: string;
  transferCount: number;
  transferCoinsTotal: number;
}

interface ICTTDashboardProps {
  data: {
    overview: OverviewData;
    tokenDistribution: TokenData[];
    topRoutes: RouteData[];
    transfers: Transfer[];
  } | null;
}

const COLORS = [
  "#E84142",
  "#3B82F6",
  "#10B981",
  "#F59E0B",
  "#8B5CF6",
  "#EC4899",
  "#14B8A6",
  "#F97316",
  "#6366F1",
  "#6B7280",
];

function OverviewCards({ data }: { data: OverviewData | null }) {
  const formatNumber = (num: number): string => {
    if (num >= 1e9) {
      return `$${(num / 1e9).toFixed(2)}B`;
    } else if (num >= 1e6) {
      return `$${(num / 1e6).toFixed(1)}M`;
    } else if (num >= 1e3) {
      return `$${(num / 1e3).toFixed(1)}K`;
    }
    return `$${num.toLocaleString()}`;
  };

  if (!data) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="border-gray-200 dark:border-gray-700">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
              <div className="h-4 w-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            </CardHeader>
            <CardContent>
              <div className="h-8 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-2" />
              <div className="h-3 w-40 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card className="border-gray-200 dark:border-gray-700">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Transfers</CardTitle>
          <Activity className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {data.totalTransfers.toLocaleString()}
          </div>
          <p className="text-xs text-muted-foreground">All-time transfers</p>
        </CardContent>
      </Card>
      <Card className="border-gray-200 dark:border-gray-700">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Total Volume (USD)
          </CardTitle>
          <span className="text-muted-foreground font-mono text-lg">$</span>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {formatNumber(data.totalVolumeUsd)}
          </div>
          <p className="text-xs text-muted-foreground">Estimated total value</p>
        </CardContent>
      </Card>
      <Card className="border-gray-200 dark:border-gray-700">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Active Chains</CardTitle>
          <Layers className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{data.activeChains}</div>
          <p className="text-xs text-muted-foreground">
            Across {data.activeRoutes} active routes
          </p>
        </CardContent>
      </Card>
      <Card className="border-gray-200 dark:border-gray-700">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Top Token</CardTitle>
          <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{data.topToken.name}</div>
          <p className="text-xs text-muted-foreground">
            {data.topToken.percentage}% of total volume
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function TokenTransferChart({ data }: { data: TokenData[] | null }) {
  const chartData = data?.slice(0, 6) || [];

  const formatYAxis = (value: number) => {
    if (value >= 1000) {
      return `${(value / 1000).toFixed(0)}k`;
    }
    return value.toString();
  };

  const formatNumber = (num: number): string => {
    if (num >= 1e6) {
      return `${(num / 1e6).toFixed(2)}M`;
    } else if (num >= 1e3) {
      return `${(num / 1e3).toFixed(2)}K`;
    }
    return num.toLocaleString();
  };

  if (!data) {
    return (
      <Card className="col-span-4 h-full border-gray-200 dark:border-gray-700">
        <CardHeader>
          <CardTitle>Top Tokens by Transfer Count</CardTitle>
          <CardDescription>
            Most transferred tokens across chains
          </CardDescription>
        </CardHeader>
        <CardContent className="pl-2">
          <div className="h-[320px] w-full flex items-center justify-center">
            <div className="text-muted-foreground">Loading...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="col-span-4 h-full border-gray-200 dark:border-gray-700">
      <CardHeader>
        <CardTitle>Top Tokens by Transfer Count</CardTitle>
        <CardDescription>Most transferred tokens across chains</CardDescription>
      </CardHeader>
      <CardContent className="pl-2">
        <div className="h-[320px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 10, right: 30, left: 0, bottom: 20 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                className="stroke-gray-200 dark:stroke-gray-700"
              />
              <XAxis
                dataKey="symbol"
                className="text-xs text-gray-600 dark:text-gray-400"
                tick={{ className: "fill-gray-600 dark:fill-gray-400" }}
                fontSize={12}
                tickLine={false}
                axisLine={false}
                interval={0}
              />
              <YAxis
                scale="log"
                domain={[100, "auto"]}
                ticks={[100, 1000, 10000, 100000]}
                className="text-xs text-gray-600 dark:text-gray-400"
                tick={{ className: "fill-gray-600 dark:fill-gray-400" }}
                fontSize={12}
                tickLine={false}
                axisLine={false}
                tickFormatter={formatYAxis}
              />
              <Tooltip
                cursor={{ fill: "rgba(232, 65, 66, 0.1)" }}
                content={({ active, payload }) => {
                  if (!active || !payload?.[0]) return null;
                  const tokenSymbol = payload[0].payload.symbol;
                  const tokenName = payload[0].payload.name;
                  const value = payload[0].value as number;

                  return (
                    <div className="rounded-lg border bg-background p-3 shadow-sm font-mono">
                      <div className="grid gap-2">
                        <div className="font-bold text-base">{tokenSymbol}</div>
                        <div className="text-xs text-muted-foreground">
                          {tokenName}
                        </div>
                        <div className="text-sm font-semibold pt-1 border-t border-neutral-200 dark:border-neutral-700">
                          Transfers: {formatNumber(value)}
                        </div>
                      </div>
                    </div>
                  );
                }}
              />
              <Bar dataKey="value" fill="#E84142" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

function RouteDistributionChart({ data }: { data: RouteData[] | null }) {
  const chartData = data?.slice(0, 6) || [];

  if (data && data.length > 6) {
    const othersTotal = data
      .slice(6)
      .reduce((sum, route) => sum + route.total, 0);
    chartData.push({
      name: "Others",
      total: othersTotal,
      direction: "mixed",
    });
  }

  const formatNumber = (num: number): string => {
    if (num >= 1e6) {
      return `${(num / 1e6).toFixed(2)}M`;
    } else if (num >= 1e3) {
      return `${(num / 1e3).toFixed(2)}K`;
    }
    return num.toLocaleString();
  };

  if (!data) {
    return (
      <Card className="col-span-3 h-full border-gray-200 dark:border-gray-700">
        <CardHeader>
          <CardTitle>Route Distribution</CardTitle>
          <CardDescription>Transfer volume by route</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] w-full flex items-center justify-center">
            <div className="text-muted-foreground">Loading...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="col-span-3 h-full border-gray-200 dark:border-gray-700">
      <CardHeader>
        <CardTitle>Route Distribution</CardTitle>
        <CardDescription>Transfer volume by route</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={2}
                dataKey="total"
              >
                {chartData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={COLORS[index % COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.[0]) return null;
                  const routeName = payload[0].payload.name;
                  const value = payload[0].value as number;

                  return (
                    <div className="rounded-lg border bg-background p-3 shadow-sm font-mono">
                      <div className="grid gap-2">
                        <div className="font-medium text-sm border-b border-neutral-200 dark:border-neutral-700 pb-2">
                          {routeName}
                        </div>
                        <div className="text-sm font-semibold">
                          Transfers: {formatNumber(value)}
                        </div>
                      </div>
                    </div>
                  );
                }}
              />
              <Legend
                verticalAlign="bottom"
                height={36}
                iconType="circle"
                wrapperStyle={{
                  fontSize: "12px",
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

function TransactionsTable({ data }: { data: Transfer[] | null }) {
  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const formatAmount = (amount: number) => {
    if (amount >= 1e9) {
      return (amount / 1e9).toFixed(2) + "B";
    } else if (amount >= 1e6) {
      return (amount / 1e6).toFixed(2) + "M";
    } else if (amount >= 1e3) {
      return (amount / 1e3).toFixed(2) + "K";
    }
    return amount.toFixed(2);
  };

  if (!data) {
    return (
      <Card className="rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-neutral-900">
        <div className="p-8 text-center text-muted-foreground">
          Loading transfers...
        </div>
      </Card>
    );
  }

  const displayData = data.slice(0, 10);

  return (
    <Card className="rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-neutral-900">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent border-gray-200 dark:border-gray-700">
            <TableHead className="w-[280px] pl-6">Route</TableHead>
            <TableHead className="pl-8">Contract</TableHead>
            <TableHead>Token</TableHead>
            <TableHead className="text-right">Transfers</TableHead>
            <TableHead className="text-right pr-6">Total Amount</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {displayData.map((tx, index) => (
            <TableRow
              key={`${tx.contractAddress}-${index}`}
              className="border-gray-200 dark:border-gray-700"
            >
              <TableCell className="pl-6">
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className="text-xs border-gray-300 dark:border-gray-600 flex items-center gap-1.5 pr-2"
                  >
                    {tx.direction === "out" ? (
                      <>
                        {tx.homeChainLogo && (
                          <Image
                            src={tx.homeChainLogo}
                            alt={tx.homeChainDisplayName || tx.homeChainName}
                            width={16}
                            height={16}
                            className="rounded-full object-cover flex-shrink-0"
                            onError={(e) => {
                              e.currentTarget.style.display = "none";
                            }}
                          />
                        )}
                        <span>
                          {tx.homeChainDisplayName || tx.homeChainName}
                        </span>
                      </>
                    ) : (
                      <>
                        {tx.remoteChainLogo && (
                          <Image
                            src={tx.remoteChainLogo}
                            alt={
                              tx.remoteChainDisplayName || tx.remoteChainName
                            }
                            width={16}
                            height={16}
                            className="rounded-full object-cover flex-shrink-0"
                            onError={(e) => {
                              e.currentTarget.style.display = "none";
                            }}
                          />
                        )}
                        <span>
                          {tx.remoteChainDisplayName || tx.remoteChainName}
                        </span>
                      </>
                    )}
                  </Badge>
                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                  <Badge
                    variant="outline"
                    className="text-xs border-gray-300 dark:border-gray-600 flex items-center gap-1.5 pr-2"
                  >
                    {tx.direction === "out" ? (
                      <>
                        {tx.remoteChainLogo && (
                          <Image
                            src={tx.remoteChainLogo}
                            alt={
                              tx.remoteChainDisplayName || tx.remoteChainName
                            }
                            width={16}
                            height={16}
                            className="rounded-full object-cover flex-shrink-0"
                            onError={(e) => {
                              e.currentTarget.style.display = "none";
                            }}
                          />
                        )}
                        <span>
                          {tx.remoteChainDisplayName || tx.remoteChainName}
                        </span>
                      </>
                    ) : (
                      <>
                        {tx.homeChainLogo && (
                          <Image
                            src={tx.homeChainLogo}
                            alt={tx.homeChainDisplayName || tx.homeChainName}
                            width={16}
                            height={16}
                            className="rounded-full object-cover flex-shrink-0"
                            onError={(e) => {
                              e.currentTarget.style.display = "none";
                            }}
                          />
                        )}
                        <span>
                          {tx.homeChainDisplayName || tx.homeChainName}
                        </span>
                      </>
                    )}
                  </Badge>
                </div>
              </TableCell>
              <TableCell className="pl-8">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-muted-foreground">
                    {formatAddress(tx.contractAddress)}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => handleCopy(tx.contractAddress)}
                  >
                    <Copy className="h-3 w-3" />
                    <span className="sr-only">Copy contract address</span>
                  </Button>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex flex-col">
                  <span className="font-medium">{tx.tokenName}</span>
                  <span className="font-mono text-xs text-muted-foreground">
                    {formatAddress(tx.coinAddress)}
                  </span>
                </div>
              </TableCell>
              <TableCell className="text-right font-mono">
                {tx.transferCount.toLocaleString()}
              </TableCell>
              <TableCell className="text-right font-mono pr-6">
                {formatAmount(tx.transferCoinsTotal)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

export function ICTTDashboard({ data }: ICTTDashboardProps) {
  return (
    <section className="space-y-4 sm:space-y-6">
      <div className="space-y-2">
        <h2 className="text-lg sm:text-2xl font-medium text-left">
          Interchain Token Transfer (ICTT) Analytics
        </h2>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          Comprehensive token transfer metrics across Avalanche L1s
        </p>
      </div>

      <OverviewCards data={data?.overview || null} />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <div className="col-span-4">
          <TokenTransferChart data={data?.tokenDistribution || null} />
        </div>
        <div className="col-span-3">
          <RouteDistributionChart data={data?.topRoutes || null} />
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-xl font-semibold tracking-tight">Top Transfers</h3>
        <TransactionsTable data={data?.transfers || null} />
      </div>
    </section>
  );
}
