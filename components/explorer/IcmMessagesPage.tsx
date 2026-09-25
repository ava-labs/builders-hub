"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useExplorer } from "@/components/explorer/ExplorerContext";
import { useExplorerNetwork } from "@/components/explorer/useExplorerNetwork";
import { LiveTag, getChainFromBlockchainId } from "@/components/explorer/L1ExplorerPage";
import { FeedDown } from "@/components/explorer-v2/evm/bits";
import { CellLabel, ChartBoard, idInk } from "@/components/explorer-v2/ui";
import { dayLong, dayShort, formatTime, timeAgo, truncate } from "@/components/explorer-v2/format";
import { TipPlate } from "@/components/explorer-v2/staking/bits";
import { RANGE_DAYS, rangeWindowLabel, useExplorerTimeRange } from "@/components/explorer-v2/time-range";
import { LiveReadout } from "@/components/explorer-v2/evm/EvmOverviewStats";
import { ShareMap, TAIL_TONE, type SharePart } from "@/components/explorer-v2/ShareMap";
import { buildTxUrl } from "@/utils/eip3091";
import { formatTokenValue } from "@/utils/formatTokenValue";
import l1ChainsData from "@/constants/l1-chains.json";
import type { L1Chain } from "@/types/stats";

/* The chain's ICM tab in the gas page's grammar: what the chain SAYS and
   what it HEARS, on the page clock, as readout blocks, a daily chart in
   human dates and a share map of who is on the other end. The chart
   floors at a week (a one-bar day chart says nothing) and labels that one
   exception. The totals count every Teleporter event on this chain; the
   route map counts only messages whose partner is in the chain catalog,
   so the remainder is drawn as its own part and the two always agree.
   The feed half is the live message stream off the recent block window.
   The network-wide observatory keeps the ecosystem lens; the daily chart
   doors into it. */

interface IcmTx {
  hash: string;
  value: string;
  timestamp: string;
  sourceBlockchainId?: string;
  destinationBlockchainId?: string;
}

function ChainCell({ chain }: { chain: ReturnType<typeof getChainFromBlockchainId> }) {
  if (!chain) return <span className="font-mono text-[10px] text-zinc-400">unknown</span>;
  return (
    <span className="flex min-w-0 items-center gap-2">
      {chain.chainLogoURI ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={chain.chainLogoURI} alt="" className="h-4 w-4 shrink-0 rounded-full object-contain" />
      ) : (
        <span className="h-4 w-4 shrink-0 rounded-full border border-zinc-200 dark:border-zinc-800" />
      )}
      <span className="truncate text-[12px] font-medium text-zinc-900 dark:text-zinc-100">
        {chain.chainName}
      </span>
    </span>
  );
}

interface IcmFeedPage {
  status: "ok" | "unavailable";
  messages: IcmTx[];
  nextBeforeBlock: number | null;
  exhausted: boolean;
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
const PAGE_SIZE = 25;

const RECEIVED_COLOR = "#A2AFB2";
const SENT_COLOR = "#E6212F";

function fmtCount(v: number): string {
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return v.toLocaleString("en-US");
}

/* per-chain daily sent/received off the ICM history, fetched wide enough
   for the clock and windowed client-side; complete UTC days only, so a
   partial today never reads as a collapse */
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
        const today = new Date().toISOString().slice(0, 10);
        const pts = (data.icmMessages?.data ?? []).filter((p) => p.date < today);
        // API is newest-first; charts read left to right in time
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

/* who this chain talks to, split by direction, plus the network total;
   the flow feed takes the clock's window directly */
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

/* daily received/sent stacked: steel is what arrived, red is what left */
const AXIS_TICK = { fontSize: 10, fill: "#a1a1aa", fontFamily: "monospace" } as const;

function DailyChart({ days }: { days: IcmDay[] }) {
  return (
    <div className="h-48">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={days} barCategoryGap="22%" margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="rgba(161,161,170,0.18)" />
          <XAxis
            dataKey="date"
            tickLine={false}
            axisLine={false}
            tick={AXIS_TICK}
            minTickGap={48}
            interval="preserveStartEnd"
            tickFormatter={(d: string) => dayShort(d)}
          />
          <YAxis
            orientation="right"
            width={44}
            tickCount={3}
            domain={[0, "dataMax"]}
            tickLine={false}
            axisLine={false}
            tick={AXIS_TICK}
            tickFormatter={(v: number) => fmtCount(v)}
          />
          <RechartsTooltip
            cursor={{ fill: "rgba(161,161,170,0.08)" }}
            content={({ active, payload }) => {
              if (!active || !payload?.[0]) return null;
              const d = payload[0].payload as IcmDay;
              return (
                <TipPlate>
                  <p className="text-[10px] text-zinc-500">{dayLong(d.date)}</p>
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
  const network = useExplorerNetwork();
  const { buildApiUrl } = useExplorer();
  const [messages, setMessages] = useState<IcmTx[] | null>(null);
  const [cursor, setCursor] = useState<number | null | undefined>(undefined);
  const [loadingMore, setLoadingMore] = useState(false);
  const [feedDown, setFeedDown] = useState(false);
  const [moreFailed, setMoreFailed] = useState(false);
  const [reload, setReload] = useState(0);
  const loadedOnce = useRef(false);

  // the page clock in the subnav: the totals, chart, and routes ride it;
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
        const res = await fetch(buildApiUrl(`/api/explorer/${chainId}/icm`, { limit: String(PAGE_SIZE) }));
        if (!res.ok) {
          if (!cancelled && !loadedOnce.current) setFeedDown(true);
          return;
        }
        const page = (await res.json()) as IcmFeedPage;
        if (cancelled) return;
        // A scan that completed no window knows nothing. Rendering that as
        // "no ICM messages" would state something about the chain we never saw.
        if (page.status === "unavailable" && page.messages.length === 0) {
          if (!loadedOnce.current) setFeedDown(true);
          return;
        }
        setFeedDown(false);
        loadedOnce.current = true;
        setMessages((prev) => {
          if (!prev) return page.messages;
          const known = new Set(prev.map((m) => m.hash));
          const fresh = page.messages.filter((m) => !known.has(m.hash));
          return fresh.length ? [...fresh, ...prev] : prev;
        });
        setCursor((prev) => (prev === undefined ? page.nextBeforeBlock : prev));
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
  }, [chainId, buildApiUrl, reload]);

  const loadOlder = async () => {
    if (cursor == null || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await fetch(
        buildApiUrl(`/api/explorer/${chainId}/icm`, {
          limit: String(PAGE_SIZE),
          beforeBlock: String(cursor),
        }),
      );
      if (!res.ok) {
        setMoreFailed(true);
        return;
      }
      const page = (await res.json()) as IcmFeedPage;
      // The cursor is left alone on a refused scan, so the same click retries.
      if (page.status === "unavailable") {
        setMoreFailed(true);
        return;
      }
      setMoreFailed(false);
      setMessages((prev) => {
        const known = new Set((prev ?? []).map((m) => m.hash));
        return [...(prev ?? []), ...page.messages.filter((m) => !known.has(m.hash))];
      });
      setCursor(page.nextBeforeBlock);
    } catch {
      setMoreFailed(true);
    } finally {
      setLoadingMore(false);
    }
  };

  // the fetched series is wider than the clock on sub-fetch windows:
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

  const partnerSlug = (id: string): string | null =>
    (l1ChainsData as L1Chain[]).find((c) => String(c.chainId) === id && c.isTestnet !== true)
      ?.slug ?? null;

  // the busiest day in the chart's window, for the caption
  const peak = useMemo(
    () => (chartSeries ?? []).reduce<IcmDay | null>((m, d) => (!m || d.incomingCount + d.outgoingCount > m.incomingCount + m.outgoingCount ? d : m), null),
    [chartSeries],
  );

  // the route map on the totals' basis: named partners first, then what
  // the flow feed could not place, so the map adds up to the headline
  const routeParts = useMemo<SharePart[]>(() => {
    if (!routes || !totals) return [];
    const parts: SharePart[] = routes.map((r) => {
      const slug = partnerSlug(r.chainId);
      return {
        key: r.chainId,
        label: r.name,
        value: r.sent + r.received,
        href: slug ? `/explorer/${network}/${slug}/txs/icm` : undefined,
        sub: `${r.received.toLocaleString("en-US")} received · ${r.sent.toLocaleString("en-US")} sent`,
      };
    });
    const placed = routes.reduce((s, r) => s + r.sent + r.received, 0);
    const rest = totals.received + totals.sent - placed;
    if (rest > 0) {
      parts.push({
        key: "unplaced",
        label: "Unlisted partners",
        value: rest,
        tone: TAIL_TONE,
        sub: "partner not in the chain catalog, or not yet delivered",
        detail: "counted on this chain, but the route feed cannot name the other end",
      });
    }
    return parts;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routes, totals, network]);

  const inWindow = clock === "all" ? "all time" : `in the ${rangeLabel.toLowerCase()}`;

  return (
    <div className="flex flex-col gap-12">
      {/* the chain's ICM readings, as blocks; the window is the clock's */}
      <LiveReadout
        chainId={String(chainId)}
        cells={[
          {
            label: "Messages",
            value: totals ? fmtCount(totals.received + totals.sent) : seriesFailed ? "—" : "…",
            sub: rangeLabel.toLowerCase(),
            values: windowed?.map((d) => d.incomingCount + d.outgoingCount),
          },
          {
            label: "Received",
            value: totals ? fmtCount(totals.received) : "—",
            sub: "delivered to this chain",
            values: windowed?.map((d) => d.incomingCount),
          },
          {
            label: "Sent",
            value: totals ? fmtCount(totals.sent) : "—",
            sub: "sent from this chain",
            values: windowed?.map((d) => d.outgoingCount),
          },
          {
            label: "Partner Chains",
            value: routes ? String(routes.length) : "—",
            sub: routes?.length ? `busiest: ${routes[0].name}` : undefined,
          },
          {
            label: "Latest Day",
            value: totals?.latest ? fmtCount(totals.latest.incomingCount + totals.latest.outgoingCount) : "—",
            sub: totals?.latest ? `${dayShort(totals.latest.date)} · avg ${fmtCount(Math.round((totals.received + totals.sent) / (windowed?.length || 1)))}/day` : undefined,
          },
        ]}
      />

      <div className="grid grid-cols-1 items-start gap-x-8 gap-y-10 lg:grid-cols-2">
        {/* the cadence: doors into the network-wide observatory */}
        <ChartBoard
          label={rangeDays < 7 ? "Daily Messages · 7 days" : "Daily Messages"}
          action={<DirectionKey />}
          href="/explorer/mainnet/chains"
          className="min-w-0"
        >
          {totals && peak && (
            <p className="mb-3 font-mono text-[12px] leading-relaxed text-zinc-500 dark:text-zinc-400">
              <span className="text-zinc-900 dark:text-zinc-50">{totals.received.toLocaleString("en-US")}</span> received and{" "}
              <span className="text-zinc-900 dark:text-zinc-50">{totals.sent.toLocaleString("en-US")}</span> sent {inWindow}; the busiest day was{" "}
              {dayLong(peak.date)}, with {(peak.incomingCount + peak.outgoingCount).toLocaleString("en-US")}.
            </p>
          )}
          {chartSeries?.length ? (
            <DailyChart days={chartSeries} />
          ) : (
            <p className="flex h-48 items-center justify-center font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-400 dark:text-zinc-500">
              {seriesFailed ? "No ICM history for this chain" : "Loading history…"}
            </p>
          )}
        </ChartBoard>

        {/* who is on the other end */}
        {routes === null ? (
          <div className="h-64 w-full animate-pulse bg-zinc-100 dark:bg-zinc-900" />
        ) : routeParts.length === 0 ? (
          <p className="px-5 py-10 text-center font-mono text-[11px] uppercase tracking-[0.22em] text-zinc-400 md:px-6 dark:text-zinc-500">
            No routed messages in the window
          </p>
        ) : (
          <ShareMap
            label="Routes"
            summary={totals ? `${fmtCount(totals.received + totals.sent)} messages · ${rangeLabel.toLowerCase()}` : undefined}
            parts={routeParts}
            fmt={(v) => `${v.toLocaleString("en-US")} msg${v === 1 ? "" : "s"}`}
            // every part named: the unplaced remainder is often the biggest
            legend={Math.min(routeParts.length, 10)}
            note={
              networkTotal > 0 ? (
                <>Partner chains by messages both ways. The route feed names {fmtCount(routes.reduce((s, r) => s + r.sent + r.received, 0))} of them; the rest are counted here but their other end is not in the chain catalog.</>
              ) : undefined
            }
          />
        )}
      </div>

      {/* the stream itself: live, so it wears the dot, not a window */}
      <section className="flex flex-col gap-4">
      <ChartBoard label="Live Messages" action={<LiveTag />} bodyClassName="p-0">
        {feedDown && (
          <FeedDown
            compact
            onRetry={() => {
              setFeedDown(false);
              setReload((n) => n + 1);
            }}
            label="The message index isn't answering right now"
          />
        )}

        {messages === null && !feedDown && (
          <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between px-5 py-4 md:px-6">
                <div className="h-3 w-48 animate-pulse bg-zinc-100 dark:bg-zinc-900" />
                <div className="h-3 w-16 animate-pulse bg-zinc-100 dark:bg-zinc-900" />
              </div>
            ))}
          </div>
        )}

        {messages !== null && messages.length === 0 && !feedDown && (
          <p className="px-6 py-14 text-center font-mono text-[11px] uppercase tracking-[0.22em] text-zinc-400 dark:text-zinc-500">
            No ICM messages in the recent block window
          </p>
        )}

        {messages !== null && messages.length > 0 && (
          <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
            <div className="hidden grid-cols-[1.4fr_1.2fr_1.2fr_0.9fr_0.7fr] gap-4 px-5 py-2.5 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 md:grid md:px-6 dark:text-zinc-500">
              <span>Hash</span>
              <span>Source</span>
              <span>Destination</span>
              <span className="text-right">Value</span>
              <span className="text-right">Age</span>
            </div>
            {messages.map((tx, index) => {
              const sourceChain = tx.sourceBlockchainId
                ? getChainFromBlockchainId(tx.sourceBlockchainId)
                : null;
              const destChain = tx.destinationBlockchainId
                ? getChainFromBlockchainId(tx.destinationBlockchainId)
                : null;
              return (
                <Link
                  key={`${tx.hash}-${index}`}
                  href={buildTxUrl(`/explorer/${network}/${chainSlug}`, tx.hash)}
                  className="grid grid-cols-2 gap-x-4 gap-y-1 px-5 py-3 transition-colors hover:bg-zinc-50 md:grid-cols-[1.4fr_1.2fr_1.2fr_0.9fr_0.7fr] md:items-center md:px-6 dark:hover:bg-zinc-900"
                >
                  <span className={`truncate font-mono text-[12px] ${idInk}`}>
                    {truncate(tx.hash, 18)}
                  </span>
                  <span className="min-w-0">
                    <CellLabel>Source</CellLabel>
                    <ChainCell chain={sourceChain} />
                  </span>
                  <span className="min-w-0">
                    <CellLabel>Destination</CellLabel>
                    <ChainCell chain={destChain} />
                  </span>
                  <span className="font-mono text-[11px] tabular-nums text-zinc-500 md:text-right dark:text-zinc-400">
                    <CellLabel>Value</CellLabel>
                    {/* a message usually carries no value: a quiet dash, not "0 AVAX" */}
                    {Number(tx.value) > 0 ? (
                      <>
                        {formatTokenValue(tx.value)} {tokenSymbol ?? ""}
                      </>
                    ) : (
                      <span className="text-zinc-300 dark:text-zinc-700">—</span>
                    )}
                  </span>
                  <span
                    className="font-mono text-[11px] tabular-nums text-zinc-500 md:text-right dark:text-zinc-400"
                    title={formatTime(Math.floor(new Date(tx.timestamp).getTime() / 1000))}
                  >
                    <CellLabel>Age</CellLabel>
                    {timeAgo(Math.floor(new Date(tx.timestamp).getTime() / 1000))}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </ChartBoard>
        {moreFailed && (
          <p className="text-center font-mono text-[10px] uppercase tracking-[0.16em] text-[#E6212F]">
            Couldn't load older messages. Try again.
          </p>
        )}
        {cursor != null && !feedDown && (
          <button
            onClick={loadOlder}
            disabled={loadingMore}
            className="mx-auto border border-zinc-200 px-5 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-zinc-600 transition-colors hover:border-zinc-900 hover:text-zinc-900 disabled:opacity-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:border-zinc-100 dark:hover:text-zinc-100"
          >
            {loadingMore ? "Loading…" : "Load more"}
          </button>
        )}
      </section>
    </div>
  );
}
