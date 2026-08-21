"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CircleDotDashed, CircleFadingPlus, Lock, BadgeDollarSign, RefreshCw, Flame, Award, MessageSquareIcon, Server, Unlock, HandCoins, Info, ArrowUpRight } from "lucide-react";
import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import Image from "next/image";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, Brush, LineChart, Line } from "recharts";
import { cn } from "@/lib/utils";
import { NetworkShell } from "@/components/explorer-v2/network/NetworkShell";
import { SectionHeader } from "@/components/explorer-v2/ui";
import { RANGE_DAYS, RANGE_LABEL, useExplorerTimeRange } from "@/components/explorer-v2/time-range";
import { DatEtfSection } from "@/app/(home)/stats/avax-token/_components/DatEtfSection";
import { ChartWatermark } from "@/components/stats/ChartWatermark";
import { LiveBlockBurns } from "@/components/stats/LiveBlockBurns";
import { parseDateString } from "@/components/stats/chart-axis-utils";

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

export function NetworkToken() {
  const [data, setData] = useState<AvaxSupplyData | null>(null);
  const [cChainFees, setCChainFees] = useState<FeeDataPoint[]>([]);
  const [icmFees, setICMFees] = useState<FeeDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // the page clock in the subnav windows the fee history; bucket width
  // follows it (daily bars up to a month, weekly for a quarter, monthly
  // for a year) so the chart stays readable at every window
  const clock = useExplorerTimeRange();
  const period: Period = clock === "year" || clock === "all" ? "M" : clock === "quarter" ? "W" : "D";
  const [brushIndexes, setBrushIndexes] = useState<{
    startIndex: number;
    endIndex: number;
  } | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  const fetchData = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      setLoading(true);
      setError(null);

      const [supplyRes, cChainRes, icmRes] = await Promise.all([
        fetch("/api/avax-supply", { signal: controller.signal }),
        fetch("/api/chain-stats/43114?timeRange=1y", { signal: controller.signal }),
        fetch("/api/icm-contract-fees?timeRange=1y", { signal: controller.signal }),
      ]);

      if (!supplyRes.ok || !cChainRes.ok) {
        throw new Error(
          `Failed to fetch required data (supply: HTTP ${supplyRes.status}, c-chain: HTTP ${cChainRes.status})`
        );
      }

      const supplyData = await supplyRes.json();
      const cChainData: CChainFeesResponse = await cChainRes.json();

      setData(supplyData);

      const cChainFeesRaw = cChainData?.feesPaid?.data;
      if (!Array.isArray(cChainFeesRaw)) {
        throw new Error("C-Chain fees response is missing expected shape");
      }
      const cChainFeesData: FeeDataPoint[] = cChainFeesRaw
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
              value: item.feesPaid / 1e18,
            }))
            .reverse();
          setICMFees(icmFeesData);
        }
      } else {
        // ICM data is non-critical — log and continue without breaking the page.
        console.warn(`ICM contract fees fetch failed: HTTP ${icmRes.status}`);
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    fetchData();
    return () => abortRef.current?.abort();
  }, [fetchData]);

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
      .sort((a, b) => a.date.localeCompare(b.date))
      // the fetch stays at the full year; the page clock slices the window
      .slice(-RANGE_DAYS[clock]);

    if (period === "D") return mergedData;

    const grouped = new Map<
      string,
      { cChainSum: number; icmSum: number; date: string }
    >();

    mergedData.forEach((point) => {
      const [year, month, day] = point.date.split("-").map(Number);
      let key: string;

      if (period === "W") {
        const weekStart = new Date(year, month - 1, day);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        const wy = weekStart.getFullYear();
        const wm = String(weekStart.getMonth() + 1).padStart(2, "0");
        const wd = String(weekStart.getDate()).padStart(2, "0");
        key = `${wy}-${wm}-${wd}`;
      } else {
        key = `${year}-${String(month).padStart(2, "0")}`;
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
  }, [cChainFees, icmFees, period, clock]);

  useEffect(() => {
    if (aggregatedFeeData.length === 0) return;

    // the clock already windowed the data; the brush opens on all of it
    // and stays available for zooming within the window
    setBrushIndexes({
      startIndex: 0,
      endIndex: aggregatedFeeData.length - 1,
    });
  }, [clock, aggregatedFeeData.length]);

  const displayData = brushIndexes ? aggregatedFeeData.slice(brushIndexes.startIndex, brushIndexes.endIndex + 1) : aggregatedFeeData;

  const formatXAxis = (value: string) => {
    const date = parseDateString(value);
    if (period === "M") {
      return date.toLocaleDateString("en-US", {
        month: "short",
        year: "2-digit",
      });
    }
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const formatTooltipDate = (value: string) => {
    const date = parseDateString(value);

    if (period === "M") {
      return date.toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      });
    }

    if (period === "W") {
      const endDate = new Date(date.getTime());
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

  // Price + 24h change ride in the shell's title row — the one figure a
  // reader wants before anything else. Only mounted once price is known.
  const priceAside =
    data && data.price > 0 ? (
      <div className="flex flex-col items-end gap-0.5">
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
          AVAX
        </span>
        <span className="font-mono text-xl tabular-nums text-zinc-900 sm:text-2xl dark:text-zinc-50">
          ${data.price.toFixed(2)}
        </span>
        <span
          className={cn(
            "font-mono text-xs tabular-nums",
            data.priceChange24h >= 0
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-[#E6212F]",
          )}
        >
          {data.priceChange24h >= 0 ? "+" : ""}
          {data.priceChange24h.toFixed(2)}% (24h)
        </span>
      </div>
    ) : undefined;

  return (
    <NetworkShell eyebrow="Avalanche Network Token" title="AVAX" aside={priceAside}>
      {error ? (
        // error lands inside the shell — chrome already rendered, only the
        // data column reports the failure. Retry is a squared mono chip.
        <div className="flex flex-col items-center gap-4 border border-zinc-200 bg-white/80 py-16 backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-950/80">
          <p className="max-w-md px-6 text-center text-[13px] text-[#E6212F]">{error}</p>
          <button
            onClick={fetchData}
            className="border border-zinc-300 px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-600 transition-colors hover:border-zinc-900 hover:text-zinc-900 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-zinc-100 dark:hover:text-zinc-100"
          >
            Retry
          </button>
        </div>
      ) : loading || !data ? (
        // the shell stands; the data slots pulse as squares
        <div className="flex flex-col gap-10">
          <div className="flex flex-wrap gap-2">
            <div className="h-6 w-28 animate-pulse bg-zinc-100 dark:bg-zinc-900" />
            <div className="h-6 w-44 animate-pulse bg-zinc-100 dark:bg-zinc-900" />
            <div className="h-6 w-44 animate-pulse bg-zinc-100 dark:bg-zinc-900" />
          </div>
          <section className="flex flex-col gap-4">
            <SectionHeader label="Supply, Staking & Burn" />
            <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-28 animate-pulse bg-zinc-100 dark:bg-zinc-900" />
              ))}
            </div>
          </section>
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="h-[480px] animate-pulse bg-zinc-100 lg:col-span-2 dark:bg-zinc-900" />
            <div className="h-[480px] animate-pulse bg-zinc-100 dark:bg-zinc-900" />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="h-64 animate-pulse bg-zinc-100 dark:bg-zinc-900" />
            <div className="h-64 animate-pulse bg-zinc-100 dark:bg-zinc-900" />
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-10">
          {/* Identity row — the shell carries the AVAX title, so this keeps
              only the informative badges: the native-token marker and the
              two on-chain addresses, restyled as squared mono chips. */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="border border-zinc-200 px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
              Native Token
            </span>
            <a
              href="https://explorer.avax.network/x-chain/tx/FvwEAhmxKfeiG8SnEvq42hc6whRyY3EFYAvebMqDNDGCgxN5Z"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 border border-zinc-200 px-2 py-1 transition-colors hover:border-zinc-400 dark:border-zinc-800 dark:hover:border-zinc-600"
            >
              <span className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
                X-Chain
              </span>
              <span className="font-mono text-[11px] text-[#0061E2] dark:text-[#5f9dff]">
                FvwEAhm…DGCgxN5Z
              </span>
              <ArrowUpRight className="h-3 w-3 text-zinc-400 dark:text-zinc-500" />
            </a>
            <a
              href="/explorer/mainnet/c-chain/address/0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 border border-zinc-200 px-2 py-1 transition-colors hover:border-zinc-400 dark:border-zinc-800 dark:hover:border-zinc-600"
            >
              <span className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
                WAVAX
              </span>
              <span className="font-mono text-[11px] text-[#0061E2] dark:text-[#5f9dff]">
                0xB31f…66c7
              </span>
              <ArrowUpRight className="h-3 w-3 text-zinc-400 dark:text-zinc-500" />
            </a>
            <button
              onClick={fetchData}
              className="ml-auto inline-flex items-center gap-1.5 border border-zinc-200 px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-500 transition-colors hover:border-zinc-400 hover:text-zinc-900 dark:border-zinc-800 dark:text-zinc-400 dark:hover:border-zinc-600 dark:hover:text-zinc-100"
            >
              <RefreshCw className="h-3 w-3" />
              Refresh
            </button>
          </div>

          {/* Supply / staking / burn metrics — the page's core figures.
              Framed with the drafting-sheet section header; tiles are
              functionally the original grid (redesign lands later). */}
          <section className="flex flex-col gap-4">
            <SectionHeader label="Supply, Staking & Burn" />
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
          </section>

          {/* Row 1: Chart (2/3) + Live Burns (1/3) */}
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <Card className="border-gray-200 dark:border-gray-700 rounded-md">
                <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between flex-wrap gap-4">
                    <div>
                      <h2 className="text-lg font-medium text-black dark:text-white">Network Fees Paid</h2>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        C-Chain and ICM contract fees ·{" "}
                        {clock === "all" ? `${RANGE_LABEL.year} · longest window` : RANGE_LABEL[clock]}
                      </p>
                    </div>
                  </div>
                </div>
                <CardContent className="p-2 pb-3">
                  <ChartWatermark>
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
                  </ChartWatermark>

                  {/* Brush slider */}
                  <div className="block pt-1 overflow-hidden pl-[50px] pr-8">
                    <ResponsiveContainer width="100%" height={50}>
                      <LineChart data={aggregatedFeeData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                        <Brush
                          dataKey="date"
                          height={50}
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

            <div className="lg:col-span-1">
              <LiveBlockBurns />
            </div>
          </div>

          {/* Row 2: Burn breakdown + Fee metrics */}
          <div className="grid gap-4 lg:grid-cols-2">
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

            {/* Combined Fee Metrics card */}
            <Card className="border-gray-200 dark:border-gray-700 rounded-md">
              <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-lg font-medium text-black dark:text-white">Ecosystem Fees</h2>
              </div>
              <CardContent className="p-4 space-y-4">
                {/* L1 Validator Fees row */}
                {data && (
                  <div className="flex items-center justify-between p-4 rounded-lg bg-gray-50 dark:bg-neutral-800/50">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-lg flex items-center justify-center bg-purple-100 dark:bg-purple-500/10">
                        <Server className="w-6 h-6 text-purple-500" />
                      </div>
                      <div>
                        <p className="font-medium text-sm text-black dark:text-white">L1 Validator Fees</p>
                        <p className="text-xs text-muted-foreground">All-time fees paid by L1 validators</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-mono font-semibold text-black dark:text-white">
                        {formatNumber(data.l1ValidatorFees)} AVAX
                      </p>
                      {data.price > 0 && (
                        <p className="text-xs text-muted-foreground">{formatUSD(data.l1ValidatorFees)}</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Total ICM Fees row */}
                <div className="flex items-center justify-between p-4 rounded-lg bg-gray-50 dark:bg-neutral-800/50">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg flex items-center justify-center bg-purple-100 dark:bg-purple-500/10">
                      <MessageSquareIcon className="w-6 h-6 text-purple-500" />
                    </div>
                    <div>
                      <p className="font-medium text-sm text-black dark:text-white">Total ICM Fees</p>
                      <p className="text-xs text-muted-foreground">All-time fees from Interchain Messages</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-mono font-semibold text-black dark:text-white">
                      {formatNumber(totalICMFees)} AVAX
                    </p>
                    {data && data.price > 0 && (
                      <p className="text-xs text-muted-foreground">{formatUSD(totalICMFees)}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* DATs & ETFs */}
          <div className="mt-8 sm:mt-12">
            <DatEtfSection />
          </div>
        </div>
      )}
    </NetworkShell>
  );
}
