"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CircleDotDashed, CircleFadingPlus, Lock, BadgeDollarSign, RefreshCw, Flame, Award, MessageSquareIcon, Server, Unlock, HandCoins, Info, ArrowUpRight } from "lucide-react";
import { useEffect, useState, useMemo } from "react";
import Image from "next/image";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, Brush, LineChart, Line } from "recharts";
import { StatsBubbleNav } from "@/components/stats/stats-bubble.config";
import { AvalancheLogo } from "@/components/navigation/avalanche-logo";

interface AvaxSupplyData {
  totalSupply: string;
  circulatingSupply: string;
  totalPBurned: string;
  totalCBurned: string;
  totalXBurned: string;
  totalStaked: string;
  totalLocked: string;
  totalRewards: string;
  lastUpdated: string;
  genesisUnlock: string;
  l1ValidatorFees: string;
  price: number;
  priceChange24h: number;
}

interface FeeDataPoint {
  date: string;
  timestamp: number;
  value: number;
}

interface CChainFeesResponse {
  feesPaid: {
    data: Array<{ date: string; timestamp: number; value: string | number }>;
  };
}

interface ICMFeesResponse {
  data: Array<{
    date: string;
    timestamp: number;
    feesPaid: number;
    txCount: number;
  }>;
  totalFees: number;
  lastUpdated: string;
}

type Period = "D" | "W" | "M";

export default function AvaxTokenPage() {
  const [data, setData] = useState<AvaxSupplyData | null>(null);
  const [cChainFees, setCChainFees] = useState<FeeDataPoint[]>([]);
  const [icmFees, setICMFees] = useState<FeeDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<Period>("D");
  const [brushIndexes, setBrushIndexes] = useState<{
    startIndex: number;
    endIndex: number;
  } | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [supplyRes, cChainRes, icmRes] = await Promise.all([
        fetch("/api/avax-supply"),
        fetch("/api/chain-stats/43114?timeRange=all"),
        fetch("/api/icm-contract-fees?timeRange=all"),
      ]);

      if (!supplyRes.ok || !cChainRes.ok) {
        throw new Error("Failed to fetch required data");
      }

      const supplyData = await supplyRes.json();
      const cChainData: CChainFeesResponse = await cChainRes.json();

      setData(supplyData);

      const cChainFeesData: FeeDataPoint[] = cChainData.feesPaid.data
        .map((item) => ({
          date: item.date,
          timestamp: item.timestamp,
          value: typeof item.value === "string" ? parseFloat(item.value) : item.value,
        }))
        .reverse();

      setCChainFees(cChainFeesData);

      if (icmRes.ok) {
        const icmData: ICMFeesResponse = await icmRes.json();
        if (icmData.data && Array.isArray(icmData.data)) {
          const icmFeesData: FeeDataPoint[] = icmData.data
            .map((item) => ({
              date: item.date,
              timestamp: item.timestamp,
              value: item.feesPaid,
            }))
            .reverse();
          setICMFees(icmFeesData);
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

  const formatNumber = (value: string | number): string => {
    const num = typeof value === "string" ? parseFloat(value) : value;
    if (isNaN(num)) return "N/A";

    if (num >= 1e9) {
      return `${(num / 1e9).toFixed(2)}B`;
    } else if (num >= 1e6) {
      return `${(num / 1e6).toFixed(2)}M`;
    } else if (num >= 1e3) {
      return `${(num / 1e3).toFixed(2)}K`;
    }
    return num.toLocaleString(undefined, { maximumFractionDigits: 2 });
  };

  const formatFullNumber = (value: string | number): string => {
    const num = typeof value === "string" ? parseFloat(value) : value;
    if (isNaN(num)) return "N/A";
    return num.toLocaleString(undefined, { maximumFractionDigits: 2 });
  };

  const formatUSD = (avaxAmount: string | number): string => {
    const amount = typeof avaxAmount === "string" ? parseFloat(avaxAmount) : avaxAmount;
    const price = data?.price || 0;
    if (isNaN(amount) || price === 0) return "";
    const usdValue = amount * price;

    if (usdValue >= 1e9) {
      return `$${(usdValue / 1e9).toFixed(1)} Billion USD`;
    } else if (usdValue >= 1e6) {
      return `$${(usdValue / 1e6).toFixed(1)} Million USD`;
    } else if (usdValue >= 1e3) {
      return `$${(usdValue / 1e3).toFixed(1)}K USD`;
    }
    return `$${usdValue.toLocaleString(undefined, {
      maximumFractionDigits: 2,
    })} USD`;
  };

  const calculatePercentage = (part: string, total: string): string => {
    const partNum = parseFloat(part);
    const totalNum = parseFloat(total);
    if (isNaN(partNum) || isNaN(totalNum) || totalNum === 0) return "0";
    return ((partNum / totalNum) * 100).toFixed(2);
  };

  const aggregatedFeeData = useMemo(() => {
    if (cChainFees.length === 0 && icmFees.length === 0) return [];

    const allDates = new Set([...cChainFees.map((d) => d.date), ...icmFees.map((d) => d.date)]);
    const cChainMap = new Map(cChainFees.map((d) => [d.date, d.value]));
    const icmMap = new Map(icmFees.map((d) => [d.date, d.value]));

    let mergedData = Array.from(allDates)
      .map((date) => ({
        date,
        cChainFees: cChainMap.get(date) || 0,
        icmFees: icmMap.get(date) || 0,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    if (period === "D") return mergedData;

    const grouped = new Map<
      string,
      { cChainSum: number; icmSum: number; date: string }
    >();

    mergedData.forEach((point) => {
      const date = new Date(point.date);
      let key: string;

      if (period === "W") {
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        key = weekStart.toISOString().split("T")[0];
      } else {
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
          2,
          "0"
        )}`;
      }

      if (!grouped.has(key)) {
        grouped.set(key, { cChainSum: 0, icmSum: 0, date: key });
      }

      const group = grouped.get(key)!;
      group.cChainSum += point.cChainFees;
      group.icmSum += point.icmFees;
    });

    return Array.from(grouped.values())
      .map((group) => ({
        date: group.date,
        cChainFees: group.cChainSum,
        icmFees: group.icmSum,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [cChainFees, icmFees, period]);

  useEffect(() => {
    if (aggregatedFeeData.length === 0) return;

    if (period === "D") {
      const daysToShow = 90;
      setBrushIndexes({
        startIndex: Math.max(0, aggregatedFeeData.length - daysToShow),
        endIndex: aggregatedFeeData.length - 1,
      });
    } else {
      setBrushIndexes({
        startIndex: 0,
        endIndex: aggregatedFeeData.length - 1,
      });
    }
  }, [period, aggregatedFeeData.length]);

  const displayData = brushIndexes ? aggregatedFeeData.slice(brushIndexes.startIndex, brushIndexes.endIndex + 1) : aggregatedFeeData;

  const formatXAxis = (value: string) => {
    const date = new Date(value);
    if (period === "M") {
      return date.toLocaleDateString("en-US", {
        month: "short",
        year: "2-digit",
      });
    }
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const formatTooltipDate = (value: string) => {
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

  const totalICMFees = useMemo(
    () => icmFees.reduce((sum, item) => sum + item.value, 0),
    [icmFees]
  );

  // show the actual total supply minus the total burned
  const actualTotalSupply = data ? 720000000 - (parseFloat(data.totalPBurned) + parseFloat(data.totalCBurned) + parseFloat(data.totalXBurned)) : 0;

  const metrics = data
    ? [
        {
          label: "AVAX Price",
          value: data.price > 0 ? `$${data.price.toFixed(2)}` : "N/A",
          fullValue: data.price > 0 ? `$${data.price.toFixed(4)}` : "N/A",
          icon: BadgeDollarSign,
          subtext:data.priceChange24h !== 0 ? `${data.priceChange24h > 0 ? "+" : ""}${data.priceChange24h.toFixed(2)}% (24h)` : "USD",
          color: data.priceChange24h >= 0 ? "#10B981" : "#EF4444",
          tooltip: "Current AVAX price in USD from CoinGecko",
        },
        {
          label: "Total Supply",
          value: formatNumber(actualTotalSupply),
          fullValue: formatFullNumber(actualTotalSupply),
          icon: CircleDotDashed,
          subtext: data.price > 0 ? formatUSD(actualTotalSupply) : "AVAX",
          subtextTooltip: data.price > 0 ? "at current prices" : undefined,
          color: "#E84142",
          tooltip: "Total supply minus the burned tokens from P-Chain, C-Chain, and X-Chain",
        },
        {
          label: "Circulating Supply",
          value: formatNumber(data.circulatingSupply),
          fullValue: formatFullNumber(data.circulatingSupply),
          icon: CircleFadingPlus,
          subtext: data.price > 0 ? formatUSD(data.circulatingSupply) : `${calculatePercentage(data.circulatingSupply, data.totalSupply)}% of total`,
          subtextTooltip: data.price > 0 ? "at current prices" : undefined,
          color: "#3752AC",
          tooltip: "AVAX tokens actively circulating in the market",
        },
        {
          label: "Genesis Unlock",
          value: formatNumber(data.genesisUnlock),
          fullValue: formatFullNumber(data.genesisUnlock),
          icon: Unlock,
          subtext: data.price > 0 ? formatUSD(data.genesisUnlock) : "AVAX",
          subtextTooltip: data.price > 0 ? "at current prices" : undefined,
          color: "#E84142",
          tooltip: "Amount of AVAX un during the genesis event",
        },
        {
          label: "Total Staked",
          value: formatNumber(data.totalStaked),
          fullValue: formatFullNumber(data.totalStaked),
          icon: HandCoins,
          subtext:data.price > 0 ? formatUSD(data.totalStaked) : `${calculatePercentage(data.totalStaked, data.circulatingSupply)}% of circulating`,
          subtextTooltip: data.price > 0 ? "at current prices" : undefined,
          color: "#8B5CF6",
          tooltip: "Total AVAX staked and delegated to validators on the Primary Network",
        },
        {
          label: "Total Locked",
          value: formatNumber(data.totalLocked),
          fullValue: formatFullNumber(data.totalLocked),
          icon: Lock,
          subtext: data.price > 0 ? formatUSD(data.totalLocked) : `${calculatePercentage(data.totalLocked, data.circulatingSupply)}% of circulating`,
          subtextTooltip: data.price > 0 ? "at current prices" : undefined,
          color: "#10B981",
          tooltip: "Total AVAX locked in UTXOs on P-Chain and X-Chain",
        },
        {
          label: "Total Rewards",
          value: formatNumber(data.totalRewards),
          fullValue: formatFullNumber(data.totalRewards),
          icon: Award,
          subtext: data.price > 0 ? formatUSD(data.totalRewards) : "AVAX",
          subtextTooltip: data.price > 0 ? "at current prices" : undefined,
          color: "#F59E0B",
          tooltip: "Cumulative staking rewards issued to validators and delegators",
        },
        {
          label: "Total Burned",
          value: formatNumber(parseFloat(data.totalPBurned) + parseFloat(data.totalCBurned) + parseFloat(data.totalXBurned)),
          fullValue: formatFullNumber(parseFloat(data.totalPBurned) + parseFloat(data.totalCBurned) + parseFloat(data.totalXBurned)),
          icon: Flame,
          subtext:
            data.price > 0
              ? formatUSD(parseFloat(data.totalPBurned) + parseFloat(data.totalCBurned) + parseFloat(data.totalXBurned))
              : `${calculatePercentage((parseFloat(data.totalPBurned) + parseFloat(data.totalCBurned) + parseFloat(data.totalXBurned)).toString(), data.totalSupply)}% of genesis supply`,
          subtextTooltip: data.price > 0 ? "at current prices" : undefined,
          color: "#F59E0B",
          tooltip: "Total AVAX burned across P-Chain, C-Chain, and X-Chain",
        },
      ]
    : [];

  const chainData = data
    ? [
        {
          chain: "C-Chain",
          burned: formatFullNumber(data.totalCBurned),
          percentage: parseFloat(calculatePercentage(data.totalCBurned,(parseFloat(data.totalPBurned) + parseFloat(data.totalCBurned) + parseFloat(data.totalXBurned)).toString())),
          color: "bg-[#E84142]",
          logo: "https://images.ctfassets.net/gcj8jwzm6086/5VHupNKwnDYJvqMENeV7iJ/3e4b8ff10b69bfa31e70080a4b142cd0/avalanche-avax-logo.svg",
        },
        {
          chain: "P-Chain",
          burned: formatFullNumber(data.totalPBurned),
          percentage: parseFloat(calculatePercentage(data.totalPBurned,(parseFloat(data.totalPBurned) + parseFloat(data.totalCBurned) + parseFloat(data.totalXBurned)).toString())),
          color: "bg-[#3752AC]",
          logo: "https://images.ctfassets.net/gcj8jwzm6086/42aMwoCLblHOklt6Msi6tm/1e64aa637a8cead39b2db96fe3225c18/pchain-square.svg",
        },
        {
          chain: "X-Chain",
          burned: formatFullNumber(data.totalXBurned),
          percentage: parseFloat(calculatePercentage(data.totalXBurned,(parseFloat(data.totalPBurned) + parseFloat(data.totalCBurned) + parseFloat(data.totalXBurned)).toString())),
          color: "bg-[#10B981]",
          logo: "https://images.ctfassets.net/gcj8jwzm6086/5xiGm7IBR6G44eeVlaWrxi/1b253c4744a3ad21a278091e3119feba/xchain-square.svg",
        },
      ]
    : [];

  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-neutral-950 pt-8">
        <div className="container mx-auto px-6 pt-6 pb-24 max-w-7xl">
          <div className="mb-8 space-y-8">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-muted animate-pulse" />
              <div className="flex-1">
                <div className="h-10 bg-muted rounded w-64 mb-3 animate-pulse" />
                <div className="h-4 bg-muted rounded w-32 animate-pulse" />
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div key={i} className="text-center p-4 sm:p-6 rounded-md bg-card border border-gray-200 dark:border-gray-700">
                <div className="animate-pulse space-y-2 sm:space-y-3">
                  <div className="h-4 bg-muted rounded w-24 mx-auto" />
                  <div className="h-8 bg-muted rounded w-32 mx-auto" />
                  <div className="h-3 bg-muted rounded w-28 mx-auto" />
                </div>
              </div>
            ))}
          </div>
        </div>
        <StatsBubbleNav />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-white dark:bg-neutral-950 pt-8">
        <div className="container mx-auto px-6 pt-6 pb-24 max-w-7xl">
          <Card className="max-w-md mx-auto border-gray-200 dark:border-gray-700 rounded-md">
            <CardContent className="p-4 text-center">
              <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>
              <Button onClick={fetchData}>Retry</Button>
            </CardContent>
          </Card>
        </div>
        <StatsBubbleNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-neutral-950 pt-8">
      <div className="container mx-auto px-6 pt-6 pb-24 max-w-7xl">
        <div className="mb-8">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-5">
              <div className="w-20 h-20 rounded-full bg-neutral-100 dark:bg-neutral-900 flex items-center justify-center border border-neutral-200 dark:border-neutral-800 p-4">
                <AvalancheLogo className="w-full h-full -mt-0.5" fill="currentColor"/>
              </div>
              <div>
                <h1 className="text-5xl font-semibold tracking-tight text-black dark:text-white mb-2">Avalanche (AVAX)</h1>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <Badge variant="outline" className="bg-neutral-50 dark:bg-neutral-900">Native Token</Badge>
                  <a
                    href="https://subnets.avax.network/x-chain/tx/FvwEAhmxKfeiG8SnEvq42hc6whRyY3EFYAvebMqDNDGCgxN5Z"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:opacity-80 transition-opacity"
                  >
                    <Badge variant="outline" className="bg-neutral-50 dark:bg-neutral-900 font-mono text-xs cursor-pointer flex items-center gap-1">
                      FvwEAhm...DGCgxN5Z
                      <ArrowUpRight className="w-3 h-3" />
                    </Badge>
                  </a>
                  <a
                    href="https://snowtrace.io/address/0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:opacity-80 transition-opacity"
                  >
                    <Badge variant="outline" className="bg-neutral-50 dark:bg-neutral-900 font-mono text-xs cursor-pointer flex items-center gap-1">
                      WAVAX: 0xB31f...66c7
                      <ArrowUpRight className="w-3 h-3" />
                    </Badge>
                  </a>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={fetchData} className="border-neutral-300 dark:border-neutral-700">
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
            </div>
          </div>
        </div>

        <div className="space-y-8">
          <TooltipProvider>
            <div className="grid gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {metrics.map((metric) => {
                const Icon = metric.icon;
                return (
                  <div key={metric.label} className="text-center p-4 sm:p-6 rounded-md bg-card border border-gray-200 dark:border-gray-700">
                    <UITooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center justify-center gap-2 mb-2 sm:mb-3 cursor-help">
                          <Icon className="h-4 w-4 sm:h-5 sm:w-5" style={{ color: metric.color }}/>
                          <p className="text-xs sm:text-sm text-muted-foreground truncate">
                            {metric.label}
                          </p>
                          <Info className="h-3 w-3 text-muted-foreground/50" />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-[250px] text-center">
                        <p>{metric.tooltip}</p>
                      </TooltipContent>
                    </UITooltip>
                    <p className="text-xl sm:text-3xl font-mono font-semibold break-all" title={metric.fullValue}>
                      {metric.value}
                    </p>
                    {metric.subtextTooltip ? (
                      <UITooltip>
                        <TooltipTrigger asChild>
                          <p
                            className={`text-xs mt-1 cursor-help ${
                              metric.label === "AVAX Price"
                                ? metric.color === "#10B981"
                                  ? "text-green-600 dark:text-green-400 font-semibold"
                                  : "text-red-600 dark:text-red-400 font-semibold"
                                : "text-muted-foreground"
                            }`}
                          >
                            {metric.subtext}
                          </p>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{metric.subtextTooltip}</p>
                        </TooltipContent>
                      </UITooltip>
                    ) : (
                      <p
                        className={`text-xs mt-1 ${
                          metric.label === "AVAX Price"
                            ? metric.color === "#10B981"
                              ? "text-green-600 dark:text-green-400 font-semibold"
                              : "text-red-600 dark:text-red-400 font-semibold"
                            : "text-muted-foreground"
                        }`}
                      >
                        {metric.subtext}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </TooltipProvider>

          <div className="grid gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <Card className="border-gray-200 dark:border-gray-700 rounded-md">
                <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between flex-wrap gap-4">
                    <div>
                      <h2 className="text-lg font-medium text-black dark:text-white">Network Fees Paid</h2>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        C-Chain and ICM contract fees over time
                      </p>
                    </div>
                    <div className="flex gap-1">
                      {(["D", "W", "M"] as const).map((p) => (
                        <button
                          key={p}
                          onClick={() => setPeriod(p)}
                          className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                            period === p
                              ? "bg-blue-600 text-white"
                              : "text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                          }`}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <CardContent className="p-2">
                  <div className="mb-3">
                    <ResponsiveContainer width="100%" height={400}>
                      <BarChart data={displayData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          className="stroke-gray-200 dark:stroke-gray-700"
                          vertical={false}
                        />
                        <XAxis
                          dataKey="date"
                          tickFormatter={formatXAxis}
                          className="text-xs text-neutral-600 dark:text-neutral-400"
                          tick={{
                            className: "fill-neutral-600 dark:fill-neutral-400",
                          }}
                          minTickGap={80}
                          interval="preserveStartEnd"
                        />
                        <YAxis
                          tickFormatter={(value) => formatNumber(value)}
                          className="text-xs text-neutral-600 dark:text-neutral-400"
                          tick={{
                            className: "fill-neutral-600 dark:fill-neutral-400",
                          }}
                        />
                        <Tooltip
                          cursor={{ fill: "#E8414220" }}
                          content={({ active, payload }) => {
                            if (!active || !payload?.[0]) return null;
                            const formattedDate = formatTooltipDate(payload[0].payload.date);
                            return (
                              <div className="rounded-lg border bg-white dark:bg-neutral-900 p-2 shadow-sm font-mono border-gray-200 dark:border-gray-700">
                                <div className="grid gap-2">
                                  <div className="font-medium text-sm text-black dark:text-white">
                                    {formattedDate}
                                  </div>
                                  <div className="text-xs flex items-center gap-1.5">
                                    <div className="w-2 h-2 rounded bg-[#E84142]" />
                                    <span className="text-muted-foreground">
                                      C-Chain:{" "}
                                    </span>
                                    <span className="font-semibold">
                                      {formatNumber(payload[0].payload.cChainFees)}{" "}AVAX
                                    </span>
                                  </div>
                                  <div className="text-xs flex items-center gap-1.5">
                                    <div className="w-2 h-2 rounded bg-[#8B5CF6]" />
                                    <span className="text-muted-foreground">
                                      ICM:{" "}
                                    </span>
                                    <span className="font-semibold">
                                      {formatNumber(payload[0].payload.icmFees)}{" "}AVAX
                                    </span>
                                  </div>
                                </div>
                              </div>
                            );
                          }}
                        />
                        <Bar
                          dataKey="cChainFees"
                          stackId="stack"
                          fill="#E84142"
                          radius={[0, 0, 0, 0]}
                          name="C-Chain Fees"
                        />
                        <Bar
                          dataKey="icmFees"
                          stackId="stack"
                          fill="#8B5CF6"
                          radius={[4, 4, 0, 0]}
                          name="ICM Fees"
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="mt-3 bg-white dark:bg-black pl-[60px]">
                    <ResponsiveContainer width="100%" height={80}>
                      <LineChart data={aggregatedFeeData} margin={{ top: 0, right: 30, left: 0, bottom: 5 }}>
                        <Brush
                          dataKey="date"
                          height={80}
                          stroke="#E84142"
                          fill="#E8414220"
                          alwaysShowText={false}
                          startIndex={brushIndexes?.startIndex ?? 0}
                          endIndex={
                            brushIndexes?.endIndex ??
                            aggregatedFeeData.length - 1
                          }
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
                              dataKey="cChainFees"
                              stroke="#E84142"
                              strokeWidth={1}
                              dot={false}
                            />
                          </LineChart>
                        </Brush>
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="lg:col-span-1 space-y-4">
              <Card className="border-gray-200 dark:border-gray-700 rounded-md">
                <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                  <h2 className="text-lg font-medium text-black dark:text-white">Fees Burned by Chain</h2>
                </div>
                <CardContent className="p-3">
                  <div className="space-y-3">
                    {chainData.map((chain) => (
                      <div key={chain.chain} className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center border border-neutral-200 dark:border-neutral-700">
                              <Image
                                src={chain.logo}
                                alt={`${chain.chain} logo`}
                                width={20}
                                height={20}
                                className="h-5 w-5"
                              />
                            </div>
                            <div>
                              <p className="font-medium text-sm text-black dark:text-white">
                                {chain.chain}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {chain.burned} AVAX
                              </p>
                            </div>
                          </div>
                          <Badge variant="secondary" className="font-mono text-xs bg-neutral-100 dark:bg-neutral-800 text-black dark:text-white">
                            {chain.percentage.toFixed(2)}%
                          </Badge>
                        </div>

                        <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${chain.color} rounded-full transition-all duration-500`}
                            style={{ width: `${chain.percentage}%` }}
                          />
                        </div>
                      </div>
                    ))}

                    <div className="pt-3 mt-3 border-t border-gray-200 dark:border-gray-700">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium text-black dark:text-white">Total Burned</span>
                        <span className="font-bold font-mono text-black dark:text-white">
                          {data && formatFullNumber(parseFloat(data.totalPBurned) + parseFloat(data.totalCBurned) + parseFloat(data.totalXBurned))}{" "}AVAX
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {data && (
                <Card className="border-gray-200 dark:border-gray-700 rounded-md">
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#8B5CF620" }}>
                          <Server className="w-5 h-5" style={{ color: "#8B5CF6" }}/>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-black dark:text-white">L1 Validator Fees</p>
                          <p className="text-xs text-muted-foreground">
                            All-time fees paid by L1 validators
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-mono font-semibold text-black dark:text-white">
                          {formatNumber(data.l1ValidatorFees)} AVAX
                        </p>
                        {data.price > 0 && (
                          <p className="text-xs text-neutral-600 dark:text-neutral-400 font-medium mt-0.5">
                            {formatUSD(data.l1ValidatorFees)}
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card className="border-gray-200 dark:border-gray-700 rounded-md">
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: "#8B5CF620" }}
                      >
                        <MessageSquareIcon className="w-5 h-5" style={{ color: "#8B5CF6" }}/>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-black dark:text-white">Total ICM Fees</p>
                        <p className="text-xs text-muted-foreground">
                          All-time fees from Interchain Messages
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-mono font-semibold text-black dark:text-white">
                        {formatNumber(totalICMFees)} AVAX
                      </p>
                      {data && data.price > 0 && (
                        <p className="text-xs text-neutral-600 dark:text-neutral-400 font-medium mt-0.5">
                          {formatUSD(totalICMFees)}
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>

      <StatsBubbleNav />
    </div>
  );
}
