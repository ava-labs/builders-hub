"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useParams } from "next/navigation";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, XAxis, YAxis, ComposedChart, Line, LineChart } from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { type ChartConfig, ChartContainer, ChartTooltip } from "@/components/ui/chart";
import { ArrowLeft, ArrowUpRight, Copy, Check, Activity, Shield, Clock, AlertTriangle, Blocks, TrendingUp, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { StatsBreadcrumb } from "@/components/navigation/StatsBreadcrumb";
import { ChartSkeletonLoader } from "@/components/ui/chart-skeleton";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";
import { L1Chain } from "@/types/stats";
import l1ChainsData from "@/constants/l1-chains.json";
import Link from "next/link";

interface ValidatorP2PDetail {
  node_id: string;
  current_p50_uptime: number;
  bench_observers: number;
  weight: number;
  delegator_weight: number;
  delegator_count: number;
  delegation_fee: number;
  potential_reward: number;
  version: string;
  public_ip: string;
  days_left: number;
  miss_rate_14d: number;
  missed_14d: number;
  proposed_14d: number;
  uptime_details: {
    count: number;
    min: number;
    max: number;
    avg: number;
    p50: number;
    p95: number;
  };
  uptime: { bucket: string; p50_uptime: number }[];
  bench: { bucket: string; bench_total: number }[];
  blocks: { hour: string; proposed: number; missed: number }[];
  slots: { slot: number; cnt: number }[];
}

interface ValidatorSDKDetails {
  txHash: string;
  nodeId: string;
  subnetId: string;
  amountStaked: string;
  delegationFee: string;
  startTimestamp: number;
  endTimestamp: number;
  blsCredentials?: {
    publicKey: string;
    proofOfPossession: string;
  };
  stakePercentage: number;
  validatorHealth?: {
    reachabilityPercent: number;
    benchedPChainRequestsPercent: number;
    benchedXChainRequestsPercent: number;
    benchedCChainRequestsPercent: number;
  };
  delegatorCount: number;
  amountDelegated: string;
  potentialRewards?: {
    validationRewardAmount: string;
    delegationRewardAmount: string;
    rewardAddresses: string[];
  };
  uptimePerformance: number;
  avalancheGoVersion?: string;
  delegationCapacity: string;
  validationStatus: string;
}

const formatNavaxToAvax = (navax: string | number): string => {
  const num = typeof navax === "string" ? parseFloat(navax) : navax;
  const avax = num / 1e9;
  if (avax >= 1e6) return `${(avax / 1e6).toFixed(2)}M AVAX`;
  if (avax >= 1e3) return `${(avax / 1e3).toFixed(2)}K AVAX`;
  return `${avax.toFixed(2)} AVAX`;
};

const formatTimestamp = (timestamp: number): string => {
  if (!timestamp) return "N/A";
  return new Date(timestamp * 1000).toLocaleDateString("en-US", {
    year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
};

const truncateNodeId = (nodeId: string) => {
  if (nodeId.length <= 24) return nodeId;
  return `${nodeId.slice(0, 16)}...${nodeId.slice(-8)}`;
};

export default function ValidatorNodeDetailPage() {
  const params = useParams();
  const nodeId = decodeURIComponent(params.nodeId as string);
  const [p2pData, setP2pData] = useState<ValidatorP2PDetail | null>(null);
  const [sdkData, setSdkData] = useState<ValidatorSDKDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { copiedId, copyToClipboard } = useCopyToClipboard();

  // C-Chain config from l1-chains.json (same as c-chain page)
  const cChainData = (l1ChainsData as L1Chain[]).find(c => c.slug === "c-chain");
  const chainLogoURI = cChainData?.chainLogoURI || "https://images.ctfassets.net/gcj8jwzm6086/5VHupNKwnDYJvqMENeV7iJ/3e4b8ff10b69bfa31e70080a4b142cd0/avalanche-avax-logo.svg";
  const themeColor = cChainData?.color || "#E57373";

  useEffect(() => {
    if (!nodeId) return;

    const fetchData = async () => {
      setLoading(true);
      setError(null);

      const results = await Promise.allSettled([
        fetch(`/api/validators/${encodeURIComponent(nodeId)}`).then(r => r.ok ? r.json() : null),
        fetch(`/api/validator-details/${encodeURIComponent(nodeId)}`).then(r => r.ok ? r.json().then(d => d.validatorDetails) : null),
      ]);

      const p2p = results[0].status === "fulfilled" ? results[0].value : null;
      const sdk = results[1].status === "fulfilled" ? results[1].value : null;

      if (!p2p && !sdk) {
        setError("Validator not found or unavailable");
      }

      setP2pData(p2p);
      setSdkData(sdk);
      setLoading(false);
    };

    fetchData();
  }, [nodeId]);

  const uptimeChartData = useMemo(() => {
    if (!p2pData?.uptime) return [];
    return p2pData.uptime.map((u) => ({
      time: u.bucket,
      uptime: u.p50_uptime,
    }));
  }, [p2pData]);

  const blocksChartData = useMemo(() => {
    if (!p2pData?.blocks) return [];
    return p2pData.blocks.map((b) => ({
      time: b.hour,
      proposed: b.proposed,
      missed: b.missed,
    }));
  }, [p2pData]);

  const benchChartData = useMemo(() => {
    if (!p2pData?.bench) return [];
    return p2pData.bench.map((b) => ({
      date: b.bucket,
      bench: b.bench_total,
    }));
  }, [p2pData]);

  // Shared axis formatting helpers
  const formatDateShort = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  /** Pick the first data point of each unique day, skip the first day, always include the last */
  const generateDayTicks = <T extends Record<string, unknown>>(data: T[], key: string): string[] => {
    const seen = new Set<string>();
    const ticks: string[] = [];
    for (const d of data) {
      const iso = d[key] as string;
      const day = new Date(iso).toDateString();
      if (!seen.has(day)) {
        seen.add(day);
        ticks.push(iso);
      }
    }
    return ticks;
  };

  if (loading) {
    return (
      <div className="w-full max-w-[1200px] mx-auto px-4 py-8 space-y-6">
        <StatsBreadcrumb
          showValidators
          chainSlug="c-chain"
          chainName="Avalanche C-Chain"
          chainLogoURI={chainLogoURI}
          themeColor={themeColor}
          breadcrumbItems={[{ label: truncateNodeId(nodeId) }]}
        />
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-96 bg-zinc-200 dark:bg-zinc-800 rounded" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 bg-zinc-200 dark:bg-zinc-800 rounded-lg" />
            ))}
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="h-72 bg-zinc-200 dark:bg-zinc-800 rounded-lg" />
            <div className="h-72 bg-zinc-200 dark:bg-zinc-800 rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full max-w-[1200px] mx-auto px-4 py-8 space-y-6">
        <StatsBreadcrumb
          showValidators
          chainSlug="c-chain"
          chainName="Avalanche C-Chain"
          chainLogoURI={chainLogoURI}
          themeColor={themeColor}
          breadcrumbItems={[{ label: truncateNodeId(nodeId) }]}
        />
        <Card className="p-8 text-center">
          <p className="text-zinc-500 dark:text-zinc-400">{error}</p>
          <Link
            href="/stats/validators/c-chain"
            className="inline-flex items-center gap-2 mt-4 text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Validators
          </Link>
        </Card>
      </div>
    );
  }

  const missRate = p2pData?.miss_rate_14d ?? 0;
  const missRateColor = missRate === 0 ? "text-emerald-600 dark:text-emerald-400" : missRate < 5 ? "text-yellow-600 dark:text-yellow-400" : "text-red-600 dark:text-red-400";
  const uptimeValue = p2pData?.current_p50_uptime ?? sdkData?.uptimePerformance ?? 0;
  const uptimeColor = uptimeValue >= 99 ? "text-emerald-600 dark:text-emerald-400" : uptimeValue >= 80 ? "text-yellow-600 dark:text-yellow-400" : "text-red-600 dark:text-red-400";

  return (
    <div className="w-full max-w-[1200px] mx-auto px-4 py-8 space-y-6">
      <StatsBreadcrumb
        showValidators
        chainSlug="c-chain"
        chainName="Avalanche C-Chain"
        chainLogoURI={chainLogoURI}
        themeColor={themeColor}
        breadcrumbItems={[{ label: truncateNodeId(nodeId) }]}
      />

      {/* Header */}
      <div className="space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          <Link
            href="/stats/validators/c-chain#validators"
            className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="text-xl sm:text-2xl font-semibold text-zinc-900 dark:text-zinc-100 font-mono break-all">
            {nodeId}
          </h1>
          <button
            onClick={() => copyToClipboard(nodeId, "nodeId")}
            className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded transition-colors shrink-0"
          >
            {copiedId === "nodeId" ? (
              <Check className="h-4 w-4 text-emerald-500" />
            ) : (
              <Copy className="h-4 w-4 text-zinc-400" />
            )}
          </button>
        </div>

        <div className="flex items-center gap-3 flex-wrap text-sm">
          {sdkData && (
            <span className={`px-2.5 py-1 text-xs font-medium rounded flex items-center gap-1.5 ${
              sdkData.validationStatus === "active"
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${sdkData.validationStatus === "active" ? "bg-emerald-500" : "bg-yellow-500"}`} />
              {sdkData.validationStatus.charAt(0).toUpperCase() + sdkData.validationStatus.slice(1)}
            </span>
          )}
          {(p2pData?.version || sdkData?.avalancheGoVersion) && (
            <span className="text-zinc-500 dark:text-zinc-400">
              {p2pData?.version || sdkData?.avalancheGoVersion}
            </span>
          )}
          {p2pData?.public_ip && (
            <span className="text-zinc-400 dark:text-zinc-500 font-mono text-xs">
              {p2pData.public_ip}
            </span>
          )}
          <a
            href={`https://subnets.avax.network/validators/${nodeId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"
          >
            Explorer <ArrowUpRight className="h-3 w-3" />
          </a>
        </div>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="h-4 w-4 text-zinc-400" />
            <span className="text-xs text-zinc-500 dark:text-zinc-400">Uptime (p50)</span>
          </div>
          <p className={`text-xl font-semibold ${uptimeColor}`}>
            {uptimeValue.toFixed(2)}%
          </p>
          {p2pData?.uptime_details && (
            <p className="text-xs text-zinc-400 mt-1">
              min {p2pData.uptime_details.min.toFixed(2)}% / p95 {p2pData.uptime_details.p95.toFixed(2)}%
            </p>
          )}
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Blocks className="h-4 w-4 text-zinc-400" />
            <span className="text-xs text-zinc-500 dark:text-zinc-400">Miss Rate (14d)</span>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3.5 w-3.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs text-xs">
                Each validator is selected to propose blocks in proportion to its stake (weight / totalWeight). A validator with 2x the stake appears roughly 2x as often on the proposer list. The miss rate is the percentage of assigned proposal slots where this validator failed to produce a block.
              </TooltipContent>
            </Tooltip>
          </div>
          <p className={`text-xl font-semibold ${missRateColor}`}>
            {missRate.toFixed(1)}%
          </p>
          {p2pData && (
            <p className="text-xs text-zinc-400 mt-1">
              {p2pData.missed_14d} missed / {p2pData.proposed_14d + p2pData.missed_14d} total
            </p>
          )}
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="h-4 w-4 text-zinc-400" />
            <span className="text-xs text-zinc-500 dark:text-zinc-400">Total Stake</span>
          </div>
          <p className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
            {p2pData ? formatNavaxToAvax(p2pData.weight) : sdkData ? formatNavaxToAvax(sdkData.amountStaked) : "N/A"}
          </p>
          {p2pData && p2pData.delegator_weight > 0 && (
            <p className="text-xs text-zinc-400 mt-1">
              + {formatNavaxToAvax(p2pData.delegator_weight)} delegated
            </p>
          )}
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="h-4 w-4 text-zinc-400" />
            <span className="text-xs text-zinc-500 dark:text-zinc-400">Days Left</span>
          </div>
          <p className={`text-xl font-semibold ${
            (p2pData?.days_left ?? 999) < 7
              ? "text-red-600 dark:text-red-400"
              : (p2pData?.days_left ?? 999) < 30
                ? "text-yellow-600 dark:text-yellow-400"
                : "text-zinc-900 dark:text-zinc-100"
          }`}>
            {p2pData?.days_left ?? "N/A"}
          </p>
          {sdkData && (
            <p className="text-xs text-zinc-400 mt-1">
              Ends {formatTimestamp(sdkData.endTimestamp)}
            </p>
          )}
        </Card>
      </div>

      {/* Uptime Details Card */}
      {p2pData?.uptime_details && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Uptime Statistics</CardTitle>
            <CardDescription>
              Across {p2pData.uptime_details.count.toLocaleString()} observer measurements
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
              {[
                { label: "Min", value: p2pData.uptime_details.min },
                { label: "Average", value: p2pData.uptime_details.avg },
                { label: "Median (p50)", value: p2pData.uptime_details.p50 },
                { label: "p95", value: p2pData.uptime_details.p95 },
                { label: "Max", value: p2pData.uptime_details.max },
              ].map((stat) => (
                <div key={stat.label} className="text-center">
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">{stat.label}</p>
                  <p className={`text-lg font-semibold ${
                    stat.value >= 99 ? "text-emerald-600 dark:text-emerald-400" :
                    stat.value >= 80 ? "text-yellow-600 dark:text-yellow-400" :
                    "text-red-600 dark:text-red-400"
                  }`}>
                    {stat.value.toFixed(4)}%
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Charts Row */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Uptime Time Series */}
        {uptimeChartData.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Uptime (Hourly)</CardTitle>
              <CardDescription>p50 uptime reported by network observers</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer
                config={{
                  uptime: { label: "Uptime %", color: "hsl(var(--chart-1))" },
                } satisfies ChartConfig}
                className="h-[250px] w-full"
              >
                <AreaChart data={uptimeChartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-zinc-200 dark:stroke-zinc-800" />
                  <XAxis
                    dataKey="time"
                    tick={{ fontSize: 10 }}
                    ticks={generateDayTicks(uptimeChartData, "time")}
                    tickFormatter={formatDateShort}
                  />
                  <YAxis domain={[95, 100]} tick={{ fontSize: 10 }} tickFormatter={(v: number) => `${v}%`} />
                  <ChartTooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      return (
                        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg p-2 shadow-lg text-xs">
                          <p className="text-zinc-500 mb-1">{formatDateShort(payload[0].payload.time)}</p>
                          <p className="font-medium">{Number(payload[0].value).toFixed(4)}%</p>
                        </div>
                      );
                    }}
                  />
                  <defs>
                    <linearGradient id="uptimeGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area
                    type="monotone"
                    dataKey="uptime"
                    stroke="hsl(var(--chart-1))"
                    fill="url(#uptimeGradient)"
                    strokeWidth={1.5}
                  />
                </AreaChart>
              </ChartContainer>
            </CardContent>
          </Card>
        )}

        {/* Block Production */}
        {blocksChartData.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Block Production (14d)</CardTitle>
              <CardDescription>Proposed vs missed blocks per day</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer
                config={{
                  proposed: { label: "Proposed", color: "hsl(142, 71%, 45%)" },
                  missed: { label: "Missed", color: "hsl(0, 84%, 60%)" },
                } satisfies ChartConfig}
                className="h-[250px] w-full"
              >
                <LineChart data={blocksChartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-zinc-200 dark:stroke-zinc-800" />
                  <XAxis
                    dataKey="time"
                    tick={{ fontSize: 10 }}
                    ticks={generateDayTicks(blocksChartData, "time")}
                    tickFormatter={formatDateShort}
                  />
                  <YAxis tick={{ fontSize: 10 }} />
                  <ChartTooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      return (
                        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg p-2 shadow-lg text-xs">
                          <p className="text-zinc-500 mb-1">{formatDateShort(payload[0].payload.time)}</p>
                          <p className="text-emerald-600">Proposed: {payload[0]?.value}</p>
                          <p className="text-red-500">Missed: {payload[1]?.value}</p>
                        </div>
                      );
                    }}
                  />
                  <Line type="linear" dataKey="proposed" stroke="hsl(142, 71%, 45%)" strokeWidth={1.5} dot={false} />
                  <Line type="linear" dataKey="missed" stroke="hsl(0, 84%, 60%)" strokeWidth={1.5} dot={false} />
                </LineChart>
              </ChartContainer>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Slot Distribution */}
      {p2pData && p2pData.slots.length > 0 && (() => {
        const totalBlocks = p2pData.slots.reduce((sum, s) => sum + s.cnt, 0);
        const slot0 = p2pData.slots.find(s => s.slot === 0)?.cnt ?? 0;
        const slot1 = p2pData.slots.find(s => s.slot === 1)?.cnt ?? 0;
        const slot2plus = p2pData.slots.filter(s => s.slot >= 2).reduce((sum, s) => sum + s.cnt, 0);
        const slot0Pct = totalBlocks > 0 ? (slot0 / totalBlocks) * 100 : 0;
        const slot1Pct = totalBlocks > 0 ? (slot1 / totalBlocks) * 100 : 0;
        const slot2Pct = totalBlocks > 0 ? (slot2plus / totalBlocks) * 100 : 0;

        return (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Proposal Timing (14d)</CardTitle>
              <CardDescription>
                Slot 0 is on-time (within 5s window). A healthy validator should have nearly all blocks in Slot 0.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Bar visualization */}
              <div className="flex h-8 rounded-lg overflow-hidden mb-4">
                {slot0 > 0 && (
                  <div
                    className="bg-emerald-500 dark:bg-emerald-400 transition-all"
                    style={{ width: `${slot0Pct}%` }}
                    title={`Slot 0: ${slot0.toLocaleString()} (${slot0Pct.toFixed(1)}%)`}
                  />
                )}
                {slot1 > 0 && (
                  <div
                    className="bg-yellow-500 dark:bg-yellow-400 transition-all"
                    style={{ width: `${Math.max(slot1Pct, 1)}%` }}
                    title={`Slot 1: ${slot1.toLocaleString()} (${slot1Pct.toFixed(1)}%)`}
                  />
                )}
                {slot2plus > 0 && (
                  <div
                    className="bg-red-500 dark:bg-red-400 transition-all"
                    style={{ width: `${Math.max(slot2Pct, 1)}%` }}
                    title={`Slot 2+: ${slot2plus.toLocaleString()} (${slot2Pct.toFixed(1)}%)`}
                  />
                )}
              </div>

              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="flex items-center justify-center gap-1.5 mb-1">
                    <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 dark:bg-emerald-400" />
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">Slot 0 (On-time)</span>
                  </div>
                  <p className="text-lg font-semibold text-emerald-600 dark:text-emerald-400">{slot0Pct.toFixed(1)}%</p>
                  <p className="text-[10px] text-zinc-400">{slot0.toLocaleString()} blocks</p>
                </div>
                <div>
                  <div className="flex items-center justify-center gap-1.5 mb-1">
                    <span className="w-2.5 h-2.5 rounded-sm bg-yellow-500 dark:bg-yellow-400" />
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">Slot 1 (+5s)</span>
                  </div>
                  <p className="text-lg font-semibold text-yellow-600 dark:text-yellow-400">{slot1Pct.toFixed(1)}%</p>
                  <p className="text-[10px] text-zinc-400">{slot1.toLocaleString()} blocks</p>
                </div>
                <div>
                  <div className="flex items-center justify-center gap-1.5 mb-1">
                    <span className="w-2.5 h-2.5 rounded-sm bg-red-500 dark:bg-red-400" />
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">Slot 2+ (+10s+)</span>
                  </div>
                  <p className="text-lg font-semibold text-red-600 dark:text-red-400">{slot2Pct.toFixed(1)}%</p>
                  <p className="text-[10px] text-zinc-400">{slot2plus.toLocaleString()} blocks</p>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })()}

      {/* Bench Observations */}
      {benchChartData.length > 0 && benchChartData.some(b => b.bench > 0) && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
              <CardTitle className="text-base">Bench Observations</CardTitle>
            </div>
            <CardDescription>Daily count of observers benching this node</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={{
                bench: { label: "Bench Count", color: "hsl(45, 93%, 47%)" },
              } satisfies ChartConfig}
              className="h-[200px] w-full"
            >
              <BarChart data={benchChartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-zinc-200 dark:stroke-zinc-800" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} ticks={generateDayTicks(benchChartData, "date")} tickFormatter={formatDateShort} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <ChartTooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    return (
                      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg p-2 shadow-lg text-xs">
                        <p className="text-zinc-500 mb-1">{formatDateShort(payload[0].payload.date)}</p>
                        <p className="font-medium text-yellow-600">Benched: {payload[0].value}</p>
                      </div>
                    );
                  }}
                />
                <Bar dataKey="bench" fill="hsl(45, 93%, 47%)" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}

      {/* Staking & Delegation Details */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Staking */}
        <Card className="p-4">
          <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-3">Staking</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-zinc-500 dark:text-zinc-400">Own Stake</span>
              <span className="font-medium">{p2pData ? formatNavaxToAvax(p2pData.weight) : sdkData ? formatNavaxToAvax(sdkData.amountStaked) : "N/A"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500 dark:text-zinc-400">Delegated</span>
              <span className="font-medium">{p2pData ? formatNavaxToAvax(p2pData.delegator_weight) : sdkData ? formatNavaxToAvax(sdkData.amountDelegated) : "N/A"}</span>
            </div>
            {sdkData && (
              <div className="flex justify-between">
                <span className="text-zinc-500 dark:text-zinc-400">Stake %</span>
                <span className="font-medium">{sdkData.stakePercentage.toFixed(4)}%</span>
              </div>
            )}
            {p2pData && (
              <div className="flex justify-between">
                <span className="text-zinc-500 dark:text-zinc-400">Potential Reward</span>
                <span className="font-medium text-emerald-600 dark:text-emerald-400">{formatNavaxToAvax(p2pData.potential_reward)}</span>
              </div>
            )}
          </div>
        </Card>

        {/* Delegation */}
        <Card className="p-4">
          <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-3">Delegation</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-zinc-500 dark:text-zinc-400">Fee</span>
              <span className="font-medium">{p2pData?.delegation_fee ?? (sdkData ? parseFloat(sdkData.delegationFee).toFixed(1) : "N/A")}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500 dark:text-zinc-400">Delegators</span>
              <span className="font-medium">{p2pData?.delegator_count ?? sdkData?.delegatorCount ?? "N/A"}</span>
            </div>
            {sdkData && (
              <div className="flex justify-between">
                <span className="text-zinc-500 dark:text-zinc-400">Capacity</span>
                <span className="font-medium">{formatNavaxToAvax(sdkData.delegationCapacity)}</span>
              </div>
            )}
          </div>
        </Card>

        {/* Validation Period */}
        <Card className="p-4">
          <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-3">Validation Period</h3>
          <div className="space-y-2 text-sm">
            {sdkData && (
              <>
                <div className="flex justify-between">
                  <span className="text-zinc-500 dark:text-zinc-400">Start</span>
                  <span className="font-medium">{formatTimestamp(sdkData.startTimestamp)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500 dark:text-zinc-400">End</span>
                  <span className="font-medium">{formatTimestamp(sdkData.endTimestamp)}</span>
                </div>
              </>
            )}
            <div className="flex justify-between">
              <span className="text-zinc-500 dark:text-zinc-400">Days Left</span>
              <span className={`font-medium ${
                (p2pData?.days_left ?? 999) < 7 ? "text-red-600 dark:text-red-400" :
                (p2pData?.days_left ?? 999) < 30 ? "text-yellow-600 dark:text-yellow-400" :
                ""
              }`}>{p2pData?.days_left ?? "N/A"}</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Performance & Health */}
      {(sdkData?.validatorHealth || p2pData) && (
        <Card className="p-4">
          <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-3">Performance & Health</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            {sdkData?.validatorHealth && (
              <div>
                <span className="text-zinc-500 dark:text-zinc-400 text-xs">Reachability</span>
                <p className={`font-medium ${sdkData.validatorHealth.reachabilityPercent >= 80 ? "text-emerald-600 dark:text-emerald-400" : "text-yellow-600 dark:text-yellow-400"}`}>
                  {sdkData.validatorHealth.reachabilityPercent}%
                </p>
              </div>
            )}
            {p2pData && (
              <>
                <div>
                  <span className="text-zinc-500 dark:text-zinc-400 text-xs">Bench Observers</span>
                  <p className={`font-medium ${p2pData.bench_observers > 0 ? "text-yellow-600 dark:text-yellow-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                    {p2pData.bench_observers}
                  </p>
                </div>
                <div>
                  <span className="text-zinc-500 dark:text-zinc-400 text-xs">Blocks Proposed (14d)</span>
                  <p className="font-medium">{p2pData.proposed_14d}</p>
                </div>
                <div>
                  <span className="text-zinc-500 dark:text-zinc-400 text-xs">Blocks Missed (14d)</span>
                  <p className={`font-medium ${p2pData.missed_14d > 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                    {p2pData.missed_14d}
                  </p>
                </div>
              </>
            )}
          </div>
        </Card>
      )}

      {/* Validator Metadata */}
      {sdkData && (
        <Card className="p-4">
          <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-3">Validator Metadata</h3>
          <div className="space-y-2">
            {sdkData.txHash && (
              <div className="flex items-center justify-between p-2.5 bg-zinc-50 dark:bg-neutral-900 border border-zinc-200 dark:border-zinc-700 rounded-lg">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs text-zinc-500 dark:text-zinc-400 shrink-0">TX Hash</span>
                  <a
                    href={`https://subnets.avax.network/p-chain/tx/${sdkData.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-mono text-xs text-blue-600 dark:text-blue-400 hover:underline truncate"
                  >
                    {sdkData.txHash.slice(0, 16)}...{sdkData.txHash.slice(-8)}
                    <ArrowUpRight className="h-3 w-3 shrink-0" />
                  </a>
                </div>
                <button
                  onClick={() => copyToClipboard(sdkData.txHash, "txHash")}
                  className="h-6 w-6 p-0 flex items-center justify-center hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded transition-colors shrink-0"
                >
                  {copiedId === "txHash" ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3 text-zinc-400" />}
                </button>
              </div>
            )}
            {sdkData.potentialRewards?.rewardAddresses?.[0] && (
              <div className="flex items-center justify-between p-2.5 bg-zinc-50 dark:bg-neutral-900 border border-zinc-200 dark:border-zinc-700 rounded-lg">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs text-zinc-500 dark:text-zinc-400 shrink-0">Payout Address</span>
                  <a
                    href={`https://subnets.avax.network/p-chain/address/${sdkData.potentialRewards.rewardAddresses[0]}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-mono text-xs text-blue-600 dark:text-blue-400 hover:underline truncate"
                  >
                    {sdkData.potentialRewards.rewardAddresses[0].slice(0, 16)}...{sdkData.potentialRewards.rewardAddresses[0].slice(-8)}
                    <ArrowUpRight className="h-3 w-3 shrink-0" />
                  </a>
                </div>
                <button
                  onClick={() => copyToClipboard(sdkData.potentialRewards!.rewardAddresses[0], "payout")}
                  className="h-6 w-6 p-0 flex items-center justify-center hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded transition-colors shrink-0"
                >
                  {copiedId === "payout" ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3 text-zinc-400" />}
                </button>
              </div>
            )}
            {sdkData.blsCredentials?.publicKey && (
              <div className="flex items-center justify-between p-2.5 bg-zinc-50 dark:bg-neutral-900 border border-zinc-200 dark:border-zinc-700 rounded-lg">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs text-zinc-500 dark:text-zinc-400 shrink-0">BLS Key</span>
                  <span className="font-mono text-xs text-zinc-700 dark:text-zinc-300 truncate">
                    {sdkData.blsCredentials.publicKey.slice(0, 16)}...{sdkData.blsCredentials.publicKey.slice(-8)}
                  </span>
                </div>
                <button
                  onClick={() => copyToClipboard(sdkData.blsCredentials!.publicKey, "bls")}
                  className="h-6 w-6 p-0 flex items-center justify-center hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded transition-colors shrink-0"
                >
                  {copiedId === "bls" ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3 text-zinc-400" />}
                </button>
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
