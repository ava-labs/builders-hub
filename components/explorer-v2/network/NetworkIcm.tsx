"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import {
  Bar,
  ComposedChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { cn } from "@/lib/utils";
import {
  rangeWindowLabel,
  useExplorerTimeRange,
  type ExplorerRange,
} from "@/components/explorer-v2/time-range";
import { NetworkShell } from "@/components/explorer-v2/network/NetworkShell";
import {
  Board,
  BoardHeader,
  ChartBoard,
  HashChip,
  StatCell,
  StatFigure,
} from "@/components/explorer-v2/ui";
import { ChartEmpty, Stat, TipPlate } from "@/components/explorer-v2/staking/bits";
import { thin } from "@/components/explorer-v2/staking/data";
import l1ChainsData from "@/constants/l1-chains.json";
import type { L1Chain } from "@/types/stats";
import { formatNumber } from "@/app/(home)/stats/interchain-messaging/_components/helpers";
import type { ICTTStats } from "@/app/(home)/stats/interchain-messaging/_components/types";
import { useIcmStats } from "@/app/(home)/stats/interchain-messaging/_hooks/useIcmStats";
import { useIcttStats } from "@/app/(home)/stats/interchain-messaging/_hooks/useIcttStats";
import { useIcmFlows } from "@/app/(home)/stats/interchain-messaging/_hooks/useIcmFlows";

/* The network-scope ICM facet, rebuilt in the gas-page grammar. The old
   port carried the /stats page's furniture wholesale — rounded ChartCard,
   the starfield flow sankey, shadcn pie charts, a chain-category filter.
   All of that is gone: a lead board headlines the totals, then every
   instrument lives in a fully-outlined ChartBoard — one clock-driven bar
   chart, ledger boards for chains / routes / tokens (share bars instead of
   pies), and a hairline table for transfers. The page's time window is
   stated once, on the lead board; charts that follow the clock drop the
   range suffix, and only fixed / all-time windows carry their own label.
   Data feeds are unchanged. */

const SHELL_INTRO =
  "Every ICM message and token transfer across the network: volume, routes, and the chains doing the talking. Per-chain message feeds live on each chain's own ICM tab.";

/* The fetch window the /api/icm-stats route understands, one per clock tick. */
const ICM_TIME_RANGE: Record<ExplorerRange, string> = {
  day: "1d",
  week: "7d",
  month: "30d",
  quarter: "90d",
  year: "1y",
  // the route's widest window (730 days) predates the first ICM message,
  // so this tick really is all-time here
  all: "all",
};

const QUIET = "#A2AFB2";

/* the /api/ictt-stats payload carries pagination fields the shared
   ICTTStats type never declared */
type IcttPayload = ICTTStats & { totalCount?: number; hasMore?: boolean };

const usdCompact = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

/* mainnet catalog by display name — the ICM feeds key chains by name */
const catalogByName = new Map(
  (l1ChainsData as L1Chain[])
    .filter((c) => c.isTestnet !== true)
    .map((c) => [c.chainName, c]),
);

function chainIcmHref(chainName: string): string | null {
  const c = catalogByName.get(chainName);
  if (!c) return null;
  return c.rpcUrl ? `/explorer/mainnet/${c.slug}/icm` : `/explorer/mainnet/${c.slug}/accounts`;
}

/* logo with a monogram fallback — same rule as the chain directory */
function ChainLogo({ uri, name }: { uri?: string | null; name: string }) {
  const [broken, setBroken] = useState(false);
  if (!uri || broken) {
    return (
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-zinc-200 font-mono text-[9px] font-bold uppercase text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
        {name.charAt(0)}
      </span>
    );
  }
  return (
    <img
      src={uri}
      alt=""
      onError={() => setBroken(true)}
      className="h-5 w-5 shrink-0 rounded-full object-contain"
    />
  );
}

/* one ledger line: lead content, a quiet share bar, share %, count —
   the drafting replacement for both pie charts and the sankey */
function LedgerRow({
  lead,
  count,
  share,
  href,
}: {
  lead: React.ReactNode;
  count: number;
  share: number;
  href?: string | null;
}) {
  const inner = (
    <>
      <span className="flex min-w-0 flex-1 items-center gap-2.5">{lead}</span>
      <span className="hidden h-[3px] w-24 shrink-0 overflow-hidden bg-zinc-100 sm:block dark:bg-zinc-900">
        <span
          className="block h-full bg-[#A2AFB2] dark:bg-zinc-500"
          style={{ width: `${Math.max(2, Math.min(100, share))}%` }}
        />
      </span>
      <span className="w-12 shrink-0 text-right font-mono text-[11px] tabular-nums text-zinc-400 dark:text-zinc-500">
        {share.toFixed(1)}%
      </span>
      <span className="w-16 shrink-0 text-right font-mono text-[13px] tabular-nums text-zinc-900 dark:text-zinc-100">
        {formatNumber(count)}
      </span>
    </>
  );
  const cls = "flex items-center gap-3 px-5 py-3 md:px-6";
  return href ? (
    <Link href={href} className={cn(cls, "group transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900/50")}>
      {inner}
    </Link>
  ) : (
    <div className={cls}>{inner}</div>
  );
}

function LedgerSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center px-5 py-3 md:px-6">
          <span className="block h-5 w-3/4 animate-pulse bg-zinc-100 dark:bg-zinc-900" />
        </div>
      ))}
    </>
  );
}

function LedgerEmpty({ label }: { label: string }) {
  return (
    <p className="px-5 py-8 text-center font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-400 dark:text-zinc-500">
      {label}
    </p>
  );
}

/* the action-slot qualifier chip — the page clock, an all-time tag, or a
   count, in the quiet mono voice every board header shares */
function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
      {children}
    </span>
  );
}

/* the shared retry chip — same grammar as the page-level error state */
function RetryButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center border border-zinc-200 bg-white/80 px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-900 transition-colors hover:border-zinc-900 hover:bg-zinc-900 hover:text-white dark:border-zinc-800 dark:bg-zinc-950/80 dark:text-zinc-100 dark:hover:border-zinc-100 dark:hover:bg-zinc-100 dark:hover:text-zinc-900"
    >
      {children}
    </button>
  );
}

const TH =
  "px-5 py-3 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-400 dark:text-zinc-500 md:px-6";
const TD = "px-5 py-3.5 text-[13px] md:px-6";

interface VolumePoint {
  date: string;
  value: number;
  breakdown: Record<string, number>;
}

export function NetworkIcm() {
  // the page clock in the subnav drives the fetch window; the flow feed is
  // a fixed 30-day window upstream and is labeled as such
  const range = useExplorerTimeRange();

  const {
    data: metrics,
    loading: icmLoading,
    error: icmError,
    retry: retryIcm,
  } = useIcmStats(ICM_TIME_RANGE[range]);
  const {
    data: icttRaw,
    loadingMore: loadingMoreTransfers,
    error: icttError,
    retry: retryIctt,
    loadMore: loadMoreTransfers,
  } = useIcttStats();
  const {
    data: flowData,
    loading: flowLoading,
    error: flowError,
    retry: retryFlow,
  } = useIcmFlows();
  const icttData = icttRaw as IcttPayload | null;

  /* ---- derivations, unfiltered (the chain-category filter is gone) ---- */

  // newest-first from the API → oldest-first for the chart, stride-sampled
  // so the year view stays light (same treatment as EvmStats)
  const volumeSeries = useMemo<VolumePoint[]>(() => {
    if (!metrics?.aggregatedData) return [];
    const pts = metrics.aggregatedData
      .map((p) => ({ date: p.date, value: p.totalMessageCount, breakdown: p.chainBreakdown }))
      .reverse();
    return thin(pts, 200);
  }, [metrics]);

  const totalICMMessages = useMemo(
    () => metrics?.aggregatedData?.reduce((sum, p) => sum + p.totalMessageCount, 0) ?? 0,
    [metrics],
  );
  const dailyICM = metrics?.aggregatedData?.[0]?.totalMessageCount ?? 0;
  // divide by the days the feed actually returned, not the clock's nominal
  // span: the all-time window would otherwise dilute the average to noise
  const avgDailyICM = Math.round(totalICMMessages / Math.max(1, metrics?.aggregatedData?.length ?? 1));

  const topChains = useMemo(() => {
    if (!metrics?.aggregatedData) return [];
    const totals = new Map<string, number>();
    for (const point of metrics.aggregatedData) {
      for (const [name, count] of Object.entries(point.chainBreakdown)) {
        totals.set(name, (totals.get(name) ?? 0) + count);
      }
    }
    return [...totals.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, count]) => ({ name, count }));
  }, [metrics]);

  const topRoutes = useMemo(() => {
    if (!flowData?.flows) return [];
    return [...flowData.flows].sort((a, b) => b.messageCount - a.messageCount).slice(0, 8);
  }, [flowData]);
  const flowTotal = flowData?.totalMessages ?? 0;

  const topTokens = useMemo(() => {
    if (!icttData?.tokenDistribution) return [];
    return [...icttData.tokenDistribution].sort((a, b) => b.value - a.value).slice(0, 8);
  }, [icttData]);
  const tokenTotal = topTokens.reduce((sum, t) => sum + t.value, 0);

  const icttRoutes = useMemo(() => {
    if (!icttData?.topRoutes) return [];
    return [...icttData.topRoutes].sort((a, b) => b.total - a.total).slice(0, 8);
  }, [icttData]);
  const icttRouteTotal = icttRoutes.reduce((sum, r) => sum + r.total, 0);

  const totalICTTTransfers = icttData?.overview?.totalTransfers || 0;
  const icttPercentage =
    totalICMMessages > 0 ? ((totalICTTTransfers / totalICMMessages) * 100).toFixed(1) : "0";

  let body: React.ReactNode;
  if (icmLoading) {
    body = (
      <div className="flex flex-col gap-10" aria-label="Loading interchain messaging data" role="status">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-64 animate-pulse bg-zinc-100 dark:bg-zinc-900" />
        ))}
      </div>
    );
  } else if (icmError) {
    body = (
      <div className="flex flex-col items-center gap-5 py-24 text-center">
        <p className="max-w-md font-mono text-[11px] font-bold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">
          {icmError || "Failed to load interchain messaging data"}
        </p>
        <RetryButton onClick={retryIcm}>Retry</RetryButton>
      </div>
    );
  } else {
    body = (
      <div className="flex flex-col gap-10">
        {/* the lead board: the page's three headline totals, and the one
            place the time window is named (the ICM figures follow it; the
            ICTT count is an all-time reading and says so in its own sub) */}
        <Board divide={false} className="border">
          <BoardHeader
            label="Interchain Messaging"
            display
            action={<Chip>{rangeWindowLabel(range)}</Chip>}
          />
          <div className="grid grid-cols-3 divide-x divide-zinc-200 dark:divide-zinc-800">
            <StatCell label="Total ICM">
              <StatFigure value={totalICMMessages} />
            </StatCell>
            <StatCell label="Latest Day ICM">
              <StatFigure value={dailyICM} suffix={`avg ${formatNumber(avgDailyICM)}`} />
            </StatCell>
            <StatCell
              label="ICTT Transfers"
              sub={icttData ? `all-time · ${icttPercentage}% of ICM` : "all-time"}
            >
              <StatFigure value={totalICTTTransfers} />
            </StatCell>
          </div>
        </Board>

        {/* the pulse: daily message volume on the page clock (no range
            suffix — the lead board's chip carries the window) */}
        <ChartBoard label="Messages">
          {volumeSeries.length ? (
            <div className="h-44 text-zinc-900 dark:text-zinc-100">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={volumeSeries} barCategoryGap="22%">
                    <XAxis dataKey="date" hide />
                    <YAxis hide domain={[0, "dataMax"]} />
                    <RechartsTooltip
                      cursor={{ fill: "rgba(161,161,170,0.08)" }}
                      content={({ active, payload }) => {
                        if (!active || !payload?.[0]) return null;
                        const d = payload[0].payload as VolumePoint;
                        const top = Object.entries(d.breakdown)
                          .sort((a, b) => b[1] - a[1])
                          .slice(0, 3);
                        return (
                          <TipPlate>
                            <p className="text-[10px] text-zinc-500">{d.date}</p>
                            <p className="text-xs font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                              {d.value.toLocaleString("en-US")} messages
                            </p>
                            {top.map(([name, count]) => (
                              <p key={name} className="text-[10px] tabular-nums text-zinc-500">
                                {formatNumber(count)} {name}
                              </p>
                            ))}
                          </TipPlate>
                        );
                      }}
                    />
                    <Bar
                      dataKey="value"
                      fill={QUIET}
                      fillOpacity={0.8}
                      minPointSize={1}
                      isAnimationActive={false}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
          ) : (
            <ChartEmpty failed={!!metrics} label={metrics ? "No ICM activity" : "Loading…"} />
          )}
        </ChartBoard>

        {/* who talks, and to whom — the leaderboard and the route ledger
            (the old flow sankey, flattened into rows) */}
        <div className="grid items-start gap-x-8 gap-y-10 lg:grid-cols-2">
          <ChartBoard label="Top Chains" bodyClassName="p-0" className="min-w-0">
            <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {topChains.length === 0 && <LedgerSkeleton />}
                {topChains.map((chain, i) => {
                  const catalog = catalogByName.get(chain.name);
                  return (
                    <LedgerRow
                      key={chain.name}
                      href={chainIcmHref(chain.name)}
                      count={chain.count}
                      share={totalICMMessages > 0 ? (chain.count / totalICMMessages) * 100 : 0}
                      lead={
                        <>
                          <span className="w-5 shrink-0 font-mono text-[11px] tabular-nums text-zinc-400 dark:text-zinc-500">
                            {i + 1}
                          </span>
                          <ChainLogo uri={catalog?.chainLogoURI} name={chain.name} />
                          <span className="truncate text-[13px] font-medium text-zinc-900 group-hover:text-[#0061E2] dark:text-zinc-100 dark:group-hover:text-[#5f9dff]">
                            {chain.name}
                          </span>
                        </>
                      }
                    />
                );
              })}
            </div>
          </ChartBoard>

          {/* fixed 30-day upstream window — the one ledger that keeps its
              own label, since it doesn't follow the page clock */}
          <ChartBoard label="Top Routes · 30 days" bodyClassName="p-0" className="min-w-0">
            <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {flowLoading && <LedgerSkeleton />}
                {!flowLoading && flowError && (
                  <div className="flex flex-col items-center gap-4 px-5 py-8 text-center">
                    <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-400 dark:text-zinc-500">
                      Route feed unavailable
                    </p>
                    <RetryButton onClick={retryFlow}>Retry</RetryButton>
                  </div>
                )}
                {!flowLoading && !flowError && topRoutes.length === 0 && (
                  <LedgerEmpty label="No routes in window" />
                )}
                {topRoutes.map((flow) => (
                  <LedgerRow
                    key={`${flow.sourceChainId}-${flow.targetChainId}`}
                    count={flow.messageCount}
                    share={flowTotal > 0 ? (flow.messageCount / flowTotal) * 100 : 0}
                    lead={
                      <>
                        <ChainLogo uri={flow.sourceLogo} name={flow.sourceChain} />
                        <span className="truncate text-[13px] font-medium text-zinc-900 dark:text-zinc-100">
                          {flow.sourceChain}
                        </span>
                        <ArrowRight className="h-3 w-3 shrink-0 text-zinc-300 dark:text-zinc-600" />
                        <ChainLogo uri={flow.targetLogo} name={flow.targetChain} />
                        <span className="truncate text-[13px] font-medium text-zinc-900 dark:text-zinc-100">
                          {flow.targetChain}
                        </span>
                      </>
                    }
                  />
              ))}
            </div>
          </ChartBoard>
        </div>

        {/* token transfers: the ICTT instrument panel. All-Time data, so it
            carries its own qualifier chip instead of following the clock */}
        {icttError && !icttData ? (
          <Board divide={false} className="border">
            <BoardHeader label="Token Transfers · ICTT" action={<Chip>All-Time</Chip>} />
            <div className="flex flex-col items-center gap-4 px-5 py-10 text-center">
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-400 dark:text-zinc-500">
                ICTT feed unavailable
              </p>
              <RetryButton onClick={retryIctt}>Retry</RetryButton>
            </div>
          </Board>
        ) : (
          <Board divide={false} className="border">
            <BoardHeader label="Token Transfers · ICTT" action={<Chip>All-Time</Chip>} />
            <div className="grid grid-cols-2 divide-x divide-y divide-zinc-200 max-lg:[&>*:nth-child(odd)]:border-l-0 lg:grid-cols-4 lg:divide-y-0 dark:divide-zinc-800">
                <Stat
                  label="Transfers"
                  sub={
                    totalICMMessages > 0 && icttData ? `${icttPercentage}% of all ICM` : undefined
                  }
                >
                  {icttData ? formatNumber(icttData.overview.totalTransfers) : "…"}
                </Stat>
                <Stat label="Volume">
                  {icttData && icttData.overview.totalVolumeUsd > 0
                    ? `$${usdCompact.format(icttData.overview.totalVolumeUsd)}`
                    : icttData
                      ? "—"
                      : "…"}
                </Stat>
                <Stat
                  label="Active Chains"
                  sub={icttData ? `${icttData.overview.activeRoutes} routes` : undefined}
                >
                  {icttData ? icttData.overview.activeChains.toLocaleString("en-US") : "…"}
                </Stat>
                <Stat
                  label="Top Token"
                  sub={icttData ? `${icttData.overview.topToken.percentage}% of transfers` : undefined}
                >
                {icttData ? icttData.overview.topToken.name : "…"}
              </Stat>
            </div>
          </Board>
        )}

        {/* what moves, and along which corridors — the two old pies as
            ledgers. Both read the all-time ICTT feed, so each carries its
            own All-Time chip rather than the page clock */}
        <div className="grid items-start gap-x-8 gap-y-10 lg:grid-cols-2">
          <ChartBoard
            label="Tokens by Transfers"
            bodyClassName="p-0"
            className="min-w-0"
            action={<Chip>All-Time</Chip>}
          >
            <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {!icttData && <LedgerSkeleton />}
              {icttData && topTokens.length === 0 && <LedgerEmpty label="No token data" />}
                {topTokens.map((token) => (
                  <LedgerRow
                    key={token.address || token.symbol}
                    count={token.value}
                    share={tokenTotal > 0 ? (token.value / tokenTotal) * 100 : 0}
                    lead={
                      <>
                        <span className="truncate text-[13px] font-medium text-zinc-900 dark:text-zinc-100">
                          {token.name}
                        </span>
                        <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.1em] text-zinc-400 dark:text-zinc-500">
                          {token.symbol}
                        </span>
                      </>
                    }
                  />
              ))}
            </div>
          </ChartBoard>

          <ChartBoard
            label="Routes by Transfers"
            bodyClassName="p-0"
            className="min-w-0"
            action={<Chip>All-Time</Chip>}
          >
            <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {!icttData && <LedgerSkeleton />}
              {icttData && icttRoutes.length === 0 && <LedgerEmpty label="No route data" />}
                {icttRoutes.map((route) => (
                  <LedgerRow
                    key={route.name}
                    count={route.total}
                    share={icttRouteTotal > 0 ? (route.total / icttRouteTotal) * 100 : 0}
                    lead={
                      <span className="truncate text-[13px] font-medium text-zinc-900 dark:text-zinc-100">
                        {route.name}
                      </span>
                    }
                  />
              ))}
            </div>
          </ChartBoard>
        </div>

        {/* the raw ledger: per-contract transfer rows, paginated */}
        <ChartBoard
          label="Top Transfers"
          bodyClassName="p-0 overflow-x-auto"
          action={
            icttData?.totalCount ? (
              <Chip>
                {icttData.transfers.length} of {icttData.totalCount.toLocaleString("en-US")}
              </Chip>
            ) : undefined
          }
        >
          <table className="w-full min-w-[52rem] border-collapse">
              <thead>
                <tr className="border-b border-zinc-200 text-left dark:border-zinc-800">
                  <th className={TH}>Route</th>
                  <th className={TH}>Token</th>
                  <th className={TH}>Contract</th>
                  <th className={cn(TH, "text-right")}>Transfers</th>
                  <th className={cn(TH, "text-right")}>Total Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {!icttData &&
                  Array.from({ length: 8 }, (_, i) => (
                    <tr key={i}>
                      <td className={TD} colSpan={5}>
                        <span className="block h-4 w-2/5 animate-pulse bg-zinc-100 dark:bg-zinc-900" />
                      </td>
                    </tr>
                  ))}
                {icttData?.transfers.map((tx, i) => {
                  const out = tx.direction === "out";
                  const fromName = out
                    ? tx.homeChainDisplayName || tx.homeChainName
                    : tx.remoteChainDisplayName || tx.remoteChainName;
                  const toName = out
                    ? tx.remoteChainDisplayName || tx.remoteChainName
                    : tx.homeChainDisplayName || tx.homeChainName;
                  const fromLogo = out ? tx.homeChainLogo : tx.remoteChainLogo;
                  const toLogo = out ? tx.remoteChainLogo : tx.homeChainLogo;
                  return (
                    <tr
                      key={`${tx.contractAddress}-${i}`}
                      className="transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900/50"
                    >
                      <td className={TD}>
                        <span className="flex items-center gap-2">
                          <ChainLogo uri={fromLogo} name={fromName} />
                          <span className="max-w-32 truncate font-medium text-zinc-900 dark:text-zinc-100">
                            {fromName}
                          </span>
                          <ArrowRight className="h-3 w-3 shrink-0 text-zinc-300 dark:text-zinc-600" />
                          <ChainLogo uri={toLogo} name={toName} />
                          <span className="max-w-32 truncate font-medium text-zinc-900 dark:text-zinc-100">
                            {toName}
                          </span>
                        </span>
                      </td>
                      <td className={TD}>
                        <span className="block max-w-40 truncate font-medium text-zinc-900 dark:text-zinc-100">
                          {tx.tokenName}
                        </span>
                        <span className="font-mono text-[11px] text-zinc-400 dark:text-zinc-500">
                          {tx.coinAddress.slice(0, 6)}…{tx.coinAddress.slice(-4)}
                        </span>
                      </td>
                      <td className={TD}>
                        <HashChip value={tx.contractAddress} len={10} />
                      </td>
                      <td className={cn(TD, "text-right font-mono tabular-nums text-zinc-900 dark:text-zinc-100")}>
                        {tx.transferCount.toLocaleString("en-US")}
                      </td>
                      <td className={cn(TD, "text-right font-mono tabular-nums text-zinc-700 dark:text-zinc-300")}>
                        {formatNumber(tx.transferCoinsTotal)}
                      </td>
                    </tr>
                  );
                })}
                {icttData && icttData.transfers.length === 0 && (
                  <tr>
                    <td className={TD} colSpan={5}>
                      <p className="py-6 text-center font-mono text-[11px] uppercase tracking-[0.22em] text-zinc-400 dark:text-zinc-500">
                        No transfers
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            {icttData?.hasMore && (
              <div className="flex justify-center border-t border-zinc-200 px-5 py-4 dark:border-zinc-800">
                <RetryButton onClick={loadMoreTransfers}>
                  {loadingMoreTransfers ? "Loading…" : "Load more transfers"}
                </RetryButton>
              </div>
            )}
        </ChartBoard>
      </div>
    );
  }

  return (
    <NetworkShell
      eyebrow="Avalanche Ecosystem"
      title="Interchain Messaging"
      intro={SHELL_INTRO}
      aside={
        <Link
          href="/explorer/mainnet/chains"
          className="inline-flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[#0061E2] transition-colors hover:text-[#E6212F] dark:text-[#5f9dff]"
        >
          Per-chain ICM feeds
          <ArrowRight className="h-3 w-3" />
        </Link>
      }
    >
      {body}
    </NetworkShell>
  );
}
