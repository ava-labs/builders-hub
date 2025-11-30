"use client";

import { useState } from "react";
import {
  ArrowUpRight,
  Activity,
  Layers,
  ArrowRight,
  Copy,
  Check,
  BadgeDollarSign,
  Trophy,
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
import l1ChainsData from "@/constants/l1-chains.json";

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
    totalCount?: number;
    hasMore?: boolean;
  } | null;
  onLoadMore?: () => void;
  loadingMore?: boolean;
  totalICMMessages?: number;
  showTitle?: boolean;
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

function OverviewCards({
  data,
  totalICMMessages,
}: {
  data: OverviewData | null;
  totalICMMessages?: number;
}) {
  const themeColor = "#E84142";

  const formatValue = (num: number): string => {
    if (num >= 1e9) {
      return `${(num / 1e9).toFixed(2)}B`;
    } else if (num >= 1e6) {
      return `${(num / 1e6).toFixed(1)}M`;
    } else if (num >= 1e3) {
      return `${(num / 1e3).toFixed(1)}K`;
    }
    return num.toLocaleString();
  };

  const formatUSD = (num: number): string => {
    if (num >= 1e9) {
      return `$${(num / 1e9).toFixed(2)}B`;
    } else if (num >= 1e6) {
      return `$${(num / 1e6).toFixed(1)}M`;
    } else if (num >= 1e3) {
      return `$${(num / 1e3).toFixed(1)}K`;
    }
    return `$${num.toLocaleString()}`;
  };

  const cardData = [
    {
      key: "totalTransfers",
      icon: Activity,
      label: "Total Transfers",
      getValue: () => formatValue(data?.totalTransfers || 0),
      getSubtext: () =>
        totalICMMessages && totalICMMessages > 0 && data
          ? `${((data.totalTransfers / totalICMMessages) * 100).toFixed(
              1
            )}% of all ICM`
          : "All-time",
    },
    {
      key: "totalVolume",
      icon: BadgeDollarSign,
      label: "Total Volume (USD)",
      getValue: () => formatUSD(data?.totalVolumeUsd || 0),
      getSubtext: () => "Estimated value",
    },
    {
      key: "activeChains",
      icon: Layers,
      label: "Active Chains",
      getValue: () => data?.activeChains?.toString() || "0",
      getSubtext: () => `${data?.activeRoutes || 0} routes`,
    },
    {
      key: "topToken",
      icon: Trophy,
      label: "Top Token",
      getValue: () => data?.topToken?.name || "—",
      getSubtext: () => `${data?.topToken?.percentage || 0}% of transfers`,
    },
  ];

  if (!data) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm border border-zinc-200 dark:border-zinc-800 rounded-lg"
          >
            <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 text-sm mb-2 p-4 pb-0">
              <div className="h-4 w-4 bg-zinc-200 dark:bg-zinc-700 rounded animate-pulse" />
              <div className="h-4 w-24 bg-zinc-200 dark:bg-zinc-700 rounded animate-pulse" />
            </div>
            <div className="px-4 pb-4">
              <div className="h-8 w-24 bg-zinc-200 dark:bg-zinc-700 rounded animate-pulse mb-1" />
              <div className="h-3 w-16 bg-zinc-200 dark:bg-zinc-700 rounded animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {cardData.map((item) => {
        const Icon = item.icon;
        return (
          <div
            key={item.key}
            className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm border border-zinc-200 dark:border-zinc-800 p-4 rounded-lg"
          >
            <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 text-sm mb-2">
              <Icon className="h-4 w-4" style={{ color: themeColor }} />
              <span>{item.label}</span>
            </div>
            <p className="text-2xl sm:text-3xl font-semibold text-zinc-900 dark:text-white tabular-nums">
              {item.getValue()}
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              {item.getSubtext()}
            </p>
          </div>
        );
      })}
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
      <Card className="col-span-4 h-full border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm shadow-none pt-6 pb-0">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-semibold text-zinc-900 dark:text-white">
            Top Tokens by Transfer Count
          </CardTitle>
          <CardDescription className="text-zinc-600 dark:text-zinc-400">
            Most transferred tokens across chains
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0 pb-0 px-1">
          <div className="h-[300px] w-full flex items-center justify-center">
            <div className="text-zinc-500 dark:text-zinc-400">Loading...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="col-span-4 h-full border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm shadow-none pt-6 pb-0">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold text-zinc-900 dark:text-white">
          Top Tokens by Transfer Count
        </CardTitle>
        <CardDescription className="text-zinc-600 dark:text-zinc-400">
          Most transferred tokens across chains
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0 pb-0 px-1">
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 5, right: 20, left: -10, bottom: 20 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                className="stroke-zinc-200 dark:stroke-zinc-700"
              />
              <XAxis
                dataKey="symbol"
                className="text-xs text-zinc-600 dark:text-zinc-400"
                tick={{ className: "fill-zinc-600 dark:fill-zinc-400" }}
                fontSize={12}
                tickLine={false}
                axisLine={false}
                interval={0}
              />
              <YAxis
                scale="log"
                domain={[100, "auto"]}
                ticks={[100, 1000, 10000, 100000]}
                className="text-xs text-zinc-600 dark:text-zinc-400"
                tick={{ className: "fill-zinc-600 dark:fill-zinc-400" }}
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
                    <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-card p-3 shadow-lg font-mono">
                      <div className="grid gap-2">
                        <div className="font-bold text-base text-zinc-900 dark:text-white">
                          {tokenSymbol}
                        </div>
                        <div className="text-xs text-zinc-600 dark:text-zinc-400">
                          {tokenName}
                        </div>
                        <div className="text-sm font-semibold pt-1 border-t border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white">
                          Transfers:{" "}
                          <span className="tabular-nums">
                            {formatNumber(value)}
                          </span>
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
  const chartData = data?.slice(0, 4) || [];

  if (data && data.length > 4) {
    const othersTotal = data
      .slice(4)
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

  // Custom legend renderer with logos and badges
  const renderCustomLegend = (props: any) => {
    const { payload } = props;

    return (
      <div className="flex flex-wrap items-center justify-center gap-2 mt-2">
        {payload.map((entry: any, index: number) => {
          const routeName = entry.value;

          // Handle "Others" category with simple pill badge
          if (routeName === "Others") {
            return (
              <div
                key={`legend-${index}`}
                className="flex items-center gap-2 px-3 py-2 rounded-full border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900"
              >
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: entry.color }}
                />
                <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  Others
                </span>
              </div>
            );
          }

          // Parse route name (e.g., "Echo → Beam")
          const parts = routeName.split(" → ");
          if (parts.length !== 2) return null;

          const [sourceChain, targetChain] = parts;
          const sourceData = l1ChainsData.find(
            (c) => c.chainName === sourceChain
          );
          const targetData = l1ChainsData.find(
            (c) => c.chainName === targetChain
          );

          return (
            <div
              key={`legend-${index}`}
              className="flex items-center gap-1.5 px-3 py-2 rounded-full border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900"
              title={routeName}
            >
              {sourceData?.chainLogoURI && (
                <div className="relative group/logo">
                  <Image
                    src={sourceData.chainLogoURI}
                    alt={sourceChain}
                    width={20}
                    height={20}
                    className="rounded-full object-cover flex-shrink-0"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs rounded whitespace-nowrap opacity-0 group-hover/logo:opacity-100 transition-opacity pointer-events-none z-50">
                    {sourceChain}
                  </div>
                </div>
              )}
              <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                →
              </span>
              {targetData?.chainLogoURI && (
                <div className="relative group/logo">
                  <Image
                    src={targetData.chainLogoURI}
                    alt={targetChain}
                    width={20}
                    height={20}
                    className="rounded-full object-cover flex-shrink-0"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs rounded whitespace-nowrap opacity-0 group-hover/logo:opacity-100 transition-opacity pointer-events-none z-50">
                    {targetChain}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  if (!data) {
    return (
      <Card className="col-span-3 h-full border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm shadow-none pt-6 pb-0">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-semibold text-zinc-900 dark:text-white">
            Route Distribution
          </CardTitle>
          <CardDescription className="text-zinc-600 dark:text-zinc-400">
            Transfer volume by route
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0 pb-0 px-1">
          <div className="h-[320px] w-full flex items-center justify-center">
            <div className="text-zinc-500 dark:text-zinc-400">Loading...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="col-span-3 h-full border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm shadow-none pt-6 pb-0">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold text-zinc-900 dark:text-white">
          Route Distribution
        </CardTitle>
        <CardDescription className="text-zinc-600 dark:text-zinc-400">
          Transfer volume by route
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0 pb-0 px-1">
        <div className="h-[320px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="45%"
                innerRadius={55}
                outerRadius={75}
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
                    <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-card p-3 shadow-lg font-mono">
                      <div className="grid gap-2">
                        <div className="font-medium text-sm border-b border-zinc-200 dark:border-zinc-700 pb-2 text-zinc-900 dark:text-white">
                          {routeName}
                        </div>
                        <div className="text-sm font-semibold text-zinc-900 dark:text-white">
                          Transfers:{" "}
                          <span className="tabular-nums">
                            {formatNumber(value)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                }}
              />
              <Legend
                content={renderCustomLegend}
                verticalAlign="bottom"
                height={55}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

function TransactionsTable({
  data,
  totalCount,
  hasMore,
  onLoadMore,
  loadingMore,
}: {
  data: Transfer[] | null;
  totalCount?: number;
  hasMore?: boolean;
  onLoadMore?: () => void;
  loadingMore?: boolean;
}) {
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedAddress(text);
    setTimeout(() => setCopiedAddress(null), 2000);
  };
  const formatAddress = (address: string) =>
    `${address.slice(0, 6)}...${address.slice(-4)}`;
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
      <Card className="overflow-hidden py-0 border-0 shadow-none rounded-lg">
        <div className="p-8 text-center text-zinc-500 dark:text-zinc-400 bg-white dark:bg-neutral-950">
          Loading transfers...
        </div>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden py-0 border-0 shadow-none rounded-lg">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead className="bg-[#fcfcfd] dark:bg-neutral-900">
            <tr>
              <th className="px-4 py-2 text-left">
                <span className="text-xs font-normal text-neutral-700 dark:text-neutral-300">
                  Route
                </span>
              </th>
              <th className="px-4 py-2 text-left">
                <span className="text-xs font-normal text-neutral-700 dark:text-neutral-300">
                  Contract
                </span>
              </th>
              <th className="px-4 py-2 text-left">
                <span className="text-xs font-normal text-neutral-700 dark:text-neutral-300">
                  Token
                </span>
              </th>
              <th className="px-4 py-2 text-right">
                <span className="text-xs font-normal text-neutral-700 dark:text-neutral-300">
                  Transfers
                </span>
              </th>
              <th className="px-4 py-2 text-right">
                <span className="text-xs font-normal text-neutral-700 dark:text-neutral-300">
                  Total Amount
                </span>
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-neutral-950">
            {data.map((tx, index) => (
              <tr
                key={`${tx.contractAddress}-${index}`}
                className="border-b border-slate-100 dark:border-neutral-800 hover:bg-blue-50/50 dark:hover:bg-neutral-800/50 transition-colors"
              >
                <td className="border-r border-slate-100 dark:border-neutral-800 px-4 py-2">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className="text-xs border-zinc-200 dark:border-zinc-700 flex items-center gap-1.5 pr-2 bg-zinc-50 dark:bg-zinc-900"
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
                    <ArrowRight className="h-3 w-3 text-zinc-400 dark:text-zinc-500" />
                    <Badge
                      variant="outline"
                      className="text-xs border-zinc-200 dark:border-zinc-700 flex items-center gap-1.5 pr-2 bg-zinc-50 dark:bg-zinc-900"
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
                </td>
                <td className="border-r border-slate-100 dark:border-neutral-800 px-4 py-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-zinc-600 dark:text-zinc-400">
                      {formatAddress(tx.contractAddress)}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                      onClick={() => handleCopy(tx.contractAddress)}
                    >
                      {copiedAddress === tx.contractAddress ? (
                        <Check className="h-3 w-3 text-green-600 dark:text-green-400" />
                      ) : (
                        <Copy className="h-3 w-3 text-zinc-500 dark:text-zinc-400" />
                      )}
                      <span className="sr-only">Copy contract address</span>
                    </Button>
                  </div>
                </td>
                <td className="border-r border-slate-100 dark:border-neutral-800 px-4 py-2">
                  <div className="flex flex-col">
                    <span className="font-medium text-zinc-900 dark:text-white">
                      {tx.tokenName}
                    </span>
                    <span className="font-mono text-xs text-zinc-600 dark:text-zinc-400">
                      {formatAddress(tx.coinAddress)}
                    </span>
                  </div>
                </td>
                <td className="border-r border-slate-100 dark:border-neutral-800 px-4 py-2 text-right">
                  <span className="font-mono text-sm font-medium text-neutral-900 dark:text-neutral-100 tabular-nums">
                    {tx.transferCount.toLocaleString()}
                  </span>
                </td>
                <td className="px-4 py-2 text-right">
                  <span className="font-mono text-sm font-medium text-neutral-900 dark:text-neutral-100 tabular-nums">
                    {formatAmount(tx.transferCoinsTotal)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {hasMore && (
        <div className="px-4 py-3 border-t border-slate-100 dark:border-neutral-800 flex items-center justify-center bg-[#fcfcfd] dark:bg-neutral-900">
          <Button
            variant="outline"
            size="lg"
            onClick={onLoadMore}
            disabled={loadingMore}
            className="w-full max-w-md border-[#e1e2ea] dark:border-neutral-700 bg-[#fcfcfd] dark:bg-neutral-900 text-black dark:text-white hover:border-black dark:hover:border-white"
          >
            {loadingMore ? (
              <>
                <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-zinc-300 dark:border-zinc-700 border-t-zinc-600 dark:border-t-zinc-300" />
                Loading...
              </>
            ) : (
              <>
                Load More Transfers
                {totalCount && (
                  <span className="ml-2 text-xs text-zinc-500 dark:text-zinc-400 tabular-nums">
                    (Showing {data.length} of {totalCount.toLocaleString()})
                  </span>
                )}
              </>
            )}
          </Button>
        </div>
      )}
    </Card>
  );
}

export function ICTTDashboard({
  data,
  onLoadMore,
  loadingMore,
  totalICMMessages,
  showTitle = true,
}: ICTTDashboardProps) {
  return (
    <div className="space-y-6">
      {showTitle && (
        <div className="space-y-2">
          <h2 className="text-xl sm:text-2xl font-semibold text-zinc-900 dark:text-white">
            Interchain Token Transfer (ICTT) Analytics
          </h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Comprehensive token transfer metrics across Avalanche L1s
          </p>
        </div>
      )}

      <OverviewCards
        data={data?.overview || null}
        totalICMMessages={totalICMMessages}
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <div className="col-span-4">
          <TokenTransferChart data={data?.tokenDistribution || null} />
        </div>
        <div className="col-span-3">
          <RouteDistributionChart data={data?.topRoutes || null} />
        </div>
      </div>
    </div>
  );
}

export function ICTTTransfersTable({
  data,
  onLoadMore,
  loadingMore,
}: {
  data: ICTTDashboardProps["data"];
  onLoadMore?: () => void;
  loadingMore?: boolean;
}) {
  return (
    <TransactionsTable
      data={data?.transfers || null}
      totalCount={data?.totalCount}
      hasMore={data?.hasMore}
      onLoadMore={onLoadMore}
      loadingMore={loadingMore}
    />
  );
}
