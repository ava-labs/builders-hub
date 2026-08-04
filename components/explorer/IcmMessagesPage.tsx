"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bar,
  ComposedChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useExplorer } from "@/components/explorer/ExplorerContext";
import { useExplorerNetwork } from "@/components/explorer/useExplorerNetwork";
import {
  LiveTag,
  formatTimeAgo,
  getChainFromBlockchainId,
} from "@/components/explorer/L1ExplorerPage";
import { Board, BoardHeader, ChartBoard, StatDash } from "@/components/explorer-v2/ui";
import { Stat, TipPlate } from "@/components/explorer-v2/staking/bits";
import { RANGE_DAYS, rangeWindowLabel, useExplorerTimeRange } from "@/components/explorer-v2/time-range";
import { ChainChip } from "@/components/stats/ChainChip";
import { buildTxUrl } from "@/utils/eip3091";
import { formatTokenValue } from "@/utils/formatTokenValue";
import l1ChainsData from "@/constants/l1-chains.json";
import type { L1Chain } from "@/types/stats";

/* The chain's ICM tab in the gas page's grammar: what the chain SAYS and
   what it HEARS, on the page clock. The lead board states the window
   once; the daily chart and route ledger follow it (the chart floors at
   a week — a one-bar day chart says nothing — and labels that one
   exception). The stats half comes from the ClickHouse ICM history, the
   feed half is the live message stream off the recent block window. The
   network-wide observatory keeps the ecosystem lens; the daily chart
   doors into it. */

interface IcmTx {
  hash: string;
  value: string;
  timestamp: string;
  sourceBlockchainId?: string;
  destinationBlockchainId?: string;
}

interface IcmDay {
  timestamp: number;
  date: string;
  incomingCount: number;
  outgoingCount: number;
}

interface IcmFlow {
  sourceChain: string;
  sourceChainId: string;
  sourceLogo: string;
  targetChain: string;
  targetChainId: string;
  targetLogo: string;
  messageCount: number;
}

interface Route {
  chainId: string;
  name: string;
  logo: string;
  sent: number;
  received: number;
}

const POLL_MS = 15_000;

const RECEIVED_COLOR = "#A2AFB2";
const SENT_COLOR = "#E6212F";

function fmtCount(v: number): string {
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return v.toLocaleString("en-US");
}

/* per-chain daily sent/received off the ICM history, fetched wide enough
   for the clock and windowed client-side */
function useIcmSeries(chainId: string, windowDays: number): { days: IcmDay[] | null; failed: boolean } {
  const [days, setDays] = useState<IcmDay[] | null>(null);
  const [failed, setFailed] = useState(false);
  const timeRange = windowDays <= 30 ? "30d" : windowDays <= 90 ? "90d" : windowDays <= 365 ? "1y" : "all";
  useEffect(() => {
    let cancelled = false;
    setDays(null);
    fetch(`/api/chain-stats/${chainId}?metrics=icmMessages&timeRange=${timeRange}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((data: { icmMessages?: { data?: IcmDay[] } }) => {
        if (cancelled) return;
        const pts = data.icmMessages?.data ?? [];
        // API is newest-first; charts read left→right in time
        setDays([...pts].sort((a, b) => a.timestamp - b.timestamp));
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [chainId, timeRange]);
  return { days, failed };
}

/* who this chain talks to, split by direction, plus the network total
   for the share figure — the flow feed takes the clock's window directly */
function useIcmRoutes(chainId: string, windowDays: number): { routes: Route[] | null; networkTotal: number } {
  const [routes, setRoutes] = useState<Route[] | null>(null);
  const [networkTotal, setNetworkTotal] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setRoutes(null);
    fetch(`/api/icm-flow?days=${windowDays}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((data: { flows?: IcmFlow[]; totalMessages?: number }) => {
        if (cancelled) return;
        const byPartner = new Map<string, Route>();
        for (const f of data.flows ?? []) {
          const sent = f.sourceChainId === chainId;
          const received = f.targetChainId === chainId;
          if (!sent && !received) continue;
          const partnerId = sent ? f.targetChainId : f.sourceChainId;
          const r = byPartner.get(partnerId) ?? {
            chainId: partnerId,
            name: sent ? f.targetChain : f.sourceChain,
            logo: sent ? f.targetLogo : f.sourceLogo,
            sent: 0,
            received: 0,
          };
          if (sent) r.sent += f.messageCount;
          else r.received += f.messageCount;
          byPartner.set(partnerId, r);
        }
        setRoutes(
          Array.from(byPartner.values()).sort(
            (a, b) => b.sent + b.received - (a.sent + a.received),
          ),
        );
        setNetworkTotal(data.totalMessages ?? 0);
      })
      .catch(() => {
        if (!cancelled) setRoutes([]);
      });
    return () => {
      cancelled = true;
    };
  }, [chainId, windowDays]);
  return { routes, networkTotal };
}

/* daily received/sent stacked — steel is what arrived, red is what left */
function DailyChart({ days }: { days: IcmDay[] }) {
  return (
    <div className="h-48">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={days} barCategoryGap="22%">
          <XAxis
            dataKey="date"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 10, fill: "#a1a1aa", fontFamily: "monospace" }}
            minTickGap={48}
            interval="preserveStartEnd"
          />
          <YAxis hide domain={[0, "dataMax"]} />
          <RechartsTooltip
            cursor={{ fill: "rgba(161,161,170,0.08)" }}
            content={({ active, payload }) => {
              if (!active || !payload?.[0]) return null;
              const d = payload[0].payload as IcmDay;
              return (
                <TipPlate>
                  <p className="text-[10px] text-zinc-500">{d.date}</p>
                  <p className="text-xs font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                    {d.incomingCount.toLocaleString()} received
                  </p>
                  <p className="text-[10px] tabular-nums text-zinc-500">
                    {d.outgoingCount.toLocaleString()} sent
                  </p>
                </TipPlate>
              );
            }}
          />
          <Bar
            dataKey="incomingCount"
            stackId="icm"
            fill={RECEIVED_COLOR}
            fillOpacity={0.8}
            minPointSize={1}
            isAnimationActive={false}
          />
          <Bar
            dataKey="outgoingCount"
            stackId="icm"
            fill={SENT_COLOR}
            fillOpacity={0.75}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

function DirectionKey() {
  return (
    <span className="flex shrink-0 items-center gap-3 font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-400 dark:text-zinc-500">
      <span className="flex items-center gap-1.5">
        <span className="h-2.5 w-4 bg-[#A2AFB2]/80" /> received
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-2.5 w-4 bg-[#E6212F]/75" /> sent
      </span>
    </span>
  );
}

export function IcmMessagesPage({
  chainId,
  chainSlug,
  tokenSymbol,
}: {
  chainId: string;
  chainSlug: string;
  tokenSymbol?: string;
}) {
  const router = useRouter();
  const network = useExplorerNetwork();
  const { buildApiUrl } = useExplorer();
  const [messages, setMessages] = useState<IcmTx[] | null>(null);

  // the page clock in the subnav — the totals, chart, and routes ride it;
  // the daily chart floors at a week (one bar says nothing) and labels it
  const clock = useExplorerTimeRange();
  const rangeDays = RANGE_DAYS[clock];
  const rangeLabel = rangeWindowLabel(clock);
  const chartDays = Math.max(7, rangeDays);

  const { days, failed: seriesFailed } = useIcmSeries(chainId, rangeDays);
  const { routes, networkTotal } = useIcmRoutes(chainId, rangeDays);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (document.visibilityState === "hidden") return;
      try {
        const res = await fetch(buildApiUrl(`/api/explorer/${chainId}`, { initialLoad: "true" }));
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setMessages(data.icmMessages ?? []);
      } catch {
        /* stale list stands */
      }
    };
    void load();
    const timer = setInterval(() => void load(), POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [chainId, buildApiUrl]);

  // the fetched series is wider than the clock on sub-fetch windows —
  // slice the window for the totals and the chart's floored window
  const windowed = useMemo(() => (days ? days.slice(-rangeDays) : null), [days, rangeDays]);
  const chartSeries = useMemo(() => (days ? days.slice(-chartDays) : null), [days, chartDays]);

  /* headline figures off the windowed daily history */
  const totals = useMemo(() => {
    if (!windowed?.length) return null;
    const received = windowed.reduce((s, d) => s + d.incomingCount, 0);
    const sent = windowed.reduce((s, d) => s + d.outgoingCount, 0);
    const latest = windowed[windowed.length - 1];
    return { received, sent, latest, avg: received / windowed.length };
  }, [windowed]);

  // share must come from ONE counting basis: the flow table counts each
  // routed message once, so both sides of the ratio use it — mixing in the
  // event-based daily series (send + receive both count) overshoots 100%
  const share = useMemo(() => {
    if (!routes?.length || networkTotal <= 0) return null;
    const involved = routes.reduce((s, r) => s + r.sent + r.received, 0);
    return Math.min(100, (involved / networkTotal) * 100);
  }, [routes, networkTotal]);

  const partnerSlug = (id: string): string | null =>
    (l1ChainsData as L1Chain[]).find((c) => String(c.chainId) === id && c.isTestnet !== true)
      ?.slug ?? null;

  const maxRoute = routes?.length ? routes[0].sent + routes[0].received : 0;

  return (
    <div className="mx-auto flex w-full max-w-[90rem] flex-col gap-10 px-5 pb-16 pt-2 md:px-6">
      {/* the chain's ICM ledger — the window is stated once, up here */}
      <Board divide={false} className="border">
        <BoardHeader
          label="Interchain Messaging"
          display
          action={
            <span className="shrink-0 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-400 dark:text-zinc-500">
              {rangeLabel}
            </span>
          }
        />
        <div className="grid grid-cols-2 divide-x divide-y divide-zinc-200 max-lg:[&>*:nth-child(odd)]:border-l-0 lg:grid-cols-4 lg:divide-y-0 dark:divide-zinc-800">
          <Stat
            label="Messages"
            sub={share !== null ? `${share.toFixed(1)}% of all routed messages` : undefined}
          >
            {totals ? fmtCount(totals.received + totals.sent) : seriesFailed ? <StatDash /> : "…"}
          </Stat>
          <Stat label="Received / Sent" sub="received on-chain · sent outward">
            {totals ? (
              <>
                {fmtCount(totals.received)}
                <span className="mx-1.5 text-sm text-zinc-400 dark:text-zinc-500">/</span>
                {fmtCount(totals.sent)}
              </>
            ) : (
              <StatDash />
            )}
          </Stat>
          <Stat label="Partner Chains" sub={routes?.length ? `busiest: ${routes[0].name}` : undefined}>
            {routes ? routes.length : <StatDash />}
          </Stat>
          {/* the one cell that doesn't follow the clock, labeled */}
          <Stat
            label="Latest Day"
            sub={totals ? `avg ${fmtCount(Math.round(totals.avg))}/day` : undefined}
          >
            {totals?.latest ? fmtCount(totals.latest.incomingCount) : <StatDash />}
          </Stat>
        </div>
      </Board>

      <div className="grid items-start gap-x-8 gap-y-10 lg:grid-cols-2">
        {/* the cadence — doors into the network-wide observatory */}
        <ChartBoard
          label={rangeDays < 7 ? "Daily Messages · 7 days" : "Daily Messages"}
          action={<DirectionKey />}
          href="/explorer/mainnet/icm"
          className="min-w-0"
        >
          {chartSeries?.length ? (
            <DailyChart days={chartSeries} />
          ) : (
            <p className="flex h-48 items-center justify-center font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-400 dark:text-zinc-500">
              {seriesFailed ? "No ICM history for this chain" : "Loading history…"}
            </p>
          )}
        </ChartBoard>

        {/* who's on the other end */}
        <ChartBoard label="Routes" bodyClassName="p-0" className="min-w-0">
          <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {routes === null &&
              Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between px-5 py-3.5 md:px-6">
                  <div className="h-3 w-40 animate-pulse bg-zinc-100 dark:bg-zinc-900" />
                  <div className="h-3 w-20 animate-pulse bg-zinc-100 dark:bg-zinc-900" />
                </div>
              ))}
            {routes !== null && routes.length === 0 && (
              <p className="px-5 py-10 text-center font-mono text-[11px] uppercase tracking-[0.22em] text-zinc-400 md:px-6 dark:text-zinc-500">
                No routed messages in the window
              </p>
            )}
            {routes?.slice(0, 8).map((r) => {
              const slug = partnerSlug(r.chainId);
              const total = r.sent + r.received;
              const width = maxRoute > 0 ? (total / maxRoute) * 100 : 0;
              const receivedShare = total > 0 ? (r.received / total) * 100 : 0;
              return (
                <div
                  key={r.chainId}
                  className="grid grid-cols-[minmax(0,11rem)_1fr_auto] items-center gap-4 px-5 py-3 md:px-6"
                >
                  <span className="flex min-w-0 items-center gap-2.5">
                    {r.logo ? (
                      <img src={r.logo} alt="" className="h-5 w-5 shrink-0 rounded-full object-contain" />
                    ) : (
                      <span className="h-5 w-5 shrink-0 rounded-full border border-zinc-200 dark:border-zinc-800" />
                    )}
                    {slug ? (
                      <Link
                        href={`/explorer/${network}/${slug}/icm`}
                        className="truncate text-[13px] font-medium text-[#0061E2] hover:underline dark:text-[#5f9dff]"
                      >
                        {r.name}
                      </Link>
                    ) : (
                      <span className="truncate text-[13px] font-medium text-zinc-900 dark:text-zinc-100">
                        {r.name}
                      </span>
                    )}
                  </span>
                  {/* the route's weight, split by direction */}
                  <span className="h-2 bg-zinc-100 dark:bg-zinc-900">
                    <span className="flex h-full" style={{ width: `${width.toFixed(1)}%` }}>
                      <span className="h-full bg-[#A2AFB2]/80" style={{ width: `${receivedShare.toFixed(1)}%` }} />
                      <span className="h-full flex-1 bg-[#E6212F]/75" />
                    </span>
                  </span>
                  <span className="whitespace-nowrap font-mono text-[11px] tabular-nums text-zinc-500 dark:text-zinc-400">
                    ↓ {fmtCount(r.received)} · ↑ {fmtCount(r.sent)}
                  </span>
                </div>
              );
            })}
          </div>
        </ChartBoard>
      </div>

      {/* the stream itself — live, so it wears the dot, not a window */}
      <ChartBoard label="Live Messages" action={<LiveTag />} bodyClassName="p-0">
        {messages === null && (
          <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between px-5 py-4 md:px-6">
                <div className="h-3 w-48 animate-pulse bg-zinc-100 dark:bg-zinc-900" />
                <div className="h-3 w-16 animate-pulse bg-zinc-100 dark:bg-zinc-900" />
              </div>
            ))}
          </div>
        )}

        {messages !== null && messages.length === 0 && (
          <p className="px-6 py-14 text-center font-mono text-[11px] uppercase tracking-[0.22em] text-zinc-400 dark:text-zinc-500">
            No ICM messages in the recent block window
          </p>
        )}

        {messages !== null && messages.length > 0 && (
          <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {messages.map((tx, index) => {
              const sourceChain = tx.sourceBlockchainId
                ? getChainFromBlockchainId(tx.sourceBlockchainId)
                : null;
              const destChain = tx.destinationBlockchainId
                ? getChainFromBlockchainId(tx.destinationBlockchainId)
                : null;
              return (
                <div
                  key={`${tx.hash}-${index}`}
                  onClick={() => router.push(buildTxUrl(`/explorer/${network}/${chainSlug}`, tx.hash))}
                  className="cursor-pointer px-5 py-3.5 transition-colors hover:bg-zinc-50 md:px-6 dark:hover:bg-zinc-900"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="min-w-0 truncate font-mono text-[13px] text-zinc-900 dark:text-zinc-100">
                      {tx.hash.slice(0, 22)}…
                    </span>
                    <span className="shrink-0 font-mono text-[12px] tabular-nums text-zinc-500 dark:text-zinc-400">
                      {formatTokenValue(tx.value)} {tokenSymbol ?? ""}
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-center justify-between gap-2">
                    <span className="flex min-w-0 flex-wrap items-center gap-1.5">
                      {sourceChain ? (
                        <ChainChip
                          chain={sourceChain}
                          size="xs"
                          onClick={() => router.push(`/explorer/${network}/${sourceChain.chainSlug}`)}
                        />
                      ) : (
                        <span className="font-mono text-[10px] text-zinc-400">unknown</span>
                      )}
                      <span className="text-zinc-400">→</span>
                      {destChain ? (
                        <ChainChip
                          chain={destChain}
                          size="xs"
                          onClick={() => router.push(`/explorer/${network}/${destChain.chainSlug}`)}
                        />
                      ) : (
                        <span className="font-mono text-[10px] text-zinc-400">unknown</span>
                      )}
                    </span>
                    <span className="shrink-0 font-mono text-[11px] tabular-nums text-zinc-400 dark:text-zinc-500">
                      {formatTimeAgo(tx.timestamp)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </ChartBoard>
    </div>
  );
}
