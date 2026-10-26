"use client";

import { useEffect, useState } from "react";
import {
  Area,
  Bar,
  ComposedChart,
  Curve,
  Line,
  Rectangle,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartBoard } from "@/components/explorer-v2/ui";
import { recall, remember } from "@/components/explorer-v2/page-data";
import { TipPlate, TOOLTIP_DEFAULTS } from "@/components/explorer-v2/staking/bits";
import { thin, windowSeries } from "@/components/explorer-v2/staking/data";

/* ------------------------------------------------------------------ */
/* The chain-metrics chart grammar, shared by every tab that plots the  */
/* /api/chain-stats series: a headline series paired with the overlay   */
/* that explains it, on the page clock. Extracted from EvmStats when    */
/* the stats tab dissolved into its subject tabs (Accounts,             */
/* Transactions) — the network-wide Stats surface still composes these  */
/* same pieces.                                                         */
/* ------------------------------------------------------------------ */

export interface SeriesPoint {
  timestamp: number;
  value: number;
  date: string;
}

export interface MetricPayload {
  data: SeriesPoint[];
  current_value: number | string;
}

export interface IcmPoint {
  timestamp: number;
  date: string;
  incomingCount: number;
  outgoingCount: number;
}

export type Metrics = Partial<Record<string, MetricPayload>> & {
  icmMessages?: { data: IcmPoint[] };
};

export const QUIET = "#A2AFB2";
export const PUNCH = "#E6212F";

export function fmtCompact(v: number): string {
  if (v >= 1e12) return `${(v / 1e12).toFixed(2)}T`;
  if (v >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  if (v >= 10 || Number.isInteger(v)) return v.toLocaleString("en-US", { maximumFractionDigits: 0 });
  return v.toFixed(2);
}

export function num(v: number | string | undefined): number | null {
  if (v === undefined) return null;
  const n = typeof v === "string" ? Number.parseFloat(v) : v;
  return Number.isFinite(n) ? n : null;
}

export interface WindowPair {
  cur: number;
  /** null when the series is too short to hold the previous window */
  prev: number | null;
}

/* the clock's window vs the window before it — sums for volumes,
   means for rates. Needs 2N points for a delta; degrades to cur-only. */
export function windowPair(
  points: { timestamp: number; value: number | string }[] | undefined,
  n: number,
  mode: "sum" | "avg",
): WindowPair | null {
  if (!points || points.length < Math.min(n, 2)) return null;
  const sorted = [...points].sort((a, b) => a.timestamp - b.timestamp);
  const vals = sorted.map((p) => num(p.value) ?? 0);
  const take = (arr: number[]) =>
    mode === "sum" ? arr.reduce((s, v) => s + v, 0) : arr.reduce((s, v) => s + v, 0) / arr.length;
  const curSlice = vals.slice(-n);
  if (!curSlice.length) return null;
  const prevSlice = vals.slice(-2 * n, -n);
  return {
    cur: take(curSlice),
    prev: prevSlice.length === n ? take(prevSlice) : null,
  };
}

export function pctOf(p: WindowPair | null): number | null {
  if (!p || p.prev === null || p.prev === 0) return null;
  return ((p.cur - p.prev) / p.prev) * 100;
}

/* the move against the previous window, Etherscan's parenthetical */
export function Delta({ value }: { value: number | null }) {
  if (value === null) return null;
  const up = value >= 0;
  return (
    <span className={up ? "text-emerald-600 dark:text-emerald-400" : "text-[#E6212F]"}>
      {up ? "+" : ""}
      {Math.abs(value) >= 100 ? value.toFixed(0) : value.toFixed(1)}% vs prev
    </span>
  );
}

/* one day on the chart: the headline series plus an optional overlay */
export interface DualPoint {
  date: string;
  a: number;
  b?: number;
}

/* newest-first API series → oldest-first, joined on date */
export function joinSeries(a: SeriesPoint[] | undefined, b?: SeriesPoint[]): DualPoint[] {
  if (!a?.length) return [];
  const bByDate = b ? new Map(b.map((p) => [p.date, p.value])) : null;
  return a
    .map((p) => ({ date: p.date, a: p.value, b: bByDate?.get(p.date) }))
    .sort((x, y) => (x.date < y.date ? -1 : 1));
}

/* charts floor at a week — a one-point day chart renders as a lone dot.
   Callers append `weekFloor(range)` to the card title so the exception is
   stated, per the label doctrine. */
export const CHART_FLOOR_DAYS = 7;
export function weekFloor(range: number): string {
  return range < CHART_FLOOR_DAYS ? " · 7 days" : "";
}

/** a metric (and its overlay) windowed to the page clock (floored at a
 *  week) and thinned */
export function metricSeries(
  m: Metrics,
  range: number,
  key: string,
  overlay?: string,
): DualPoint[] {
  return thin(
    windowSeries(
      joinSeries(m[key]?.data, overlay ? m[overlay]?.data : undefined),
      Math.max(CHART_FLOOR_DAYS, range),
    ),
    200,
  );
}

/** exp-range-hold: the window to draw while the next one loads. The window on
 *  screen stays, marked stale, until the next one has landed; a first load
 *  has none to hold, and a failed read holds nothing, so its failure shows. */
export function heldWindow<T>(prev: T | null, next: T | null, loading: boolean): { data: T | null; stale: boolean } {
  if (next === null && loading && prev !== null) return { data: prev, stale: true };
  return { data: next, stale: false };
}

/** a chain-metrics read, as useChainMetrics answers it */
export interface MetricsRead {
  metrics: Metrics | null;
  failed: boolean;
}

/** exp-range-hold: what useChainMetrics answers for `url`. Each read keeps
 *  the url it answers: in the render between a new window and its read, the
 *  answer is that url's memory or nothing, never the last window's payload
 *  (exp-range-hold holds that window itself, dimmed) */
export function metricsReadFor(
  url: string,
  read: MetricsRead & { url: string },
  memory: (url: string) => Metrics | null,
): MetricsRead {
  return read.url === url ? { metrics: read.metrics, failed: read.failed } : { metrics: memory(url), failed: false };
}

/** exp-range-hold: one window of the network stats, the clock it was read
 *  on and the reads it draws. On Fuji the fee readings come from a second
 *  read, the C-Chain's: `fees` is its payload (null until it answers, or if
 *  it fails), and `complete` says every read the window waits for has answered. */
export interface StatsWindow<C> {
  clock: C;
  metrics: Metrics;
  fees: Metrics | null;
  complete: boolean;
}

/** exp-range-hold: the window Network Stats draws, and the one to keep as the
 *  last complete window. A window is complete once every read it waits for
 *  has answered, a failed fee read included, so a failing C-Chain read never
 *  holds the stats dimmed. The last complete window stays, stale, until the
 *  next one is complete; a first visit has none to hold, and draws each read
 *  as it lands. Windows compare by their reads, clock and completeness, not
 *  by object: a window built afresh is still the one kept, and `keep` is null
 *  unless the window to keep has changed. */
export function statsWindow<C>(
  kept: StatsWindow<C> | null,
  clock: C,
  main: MetricsRead,
  fees?: MetricsRead,
): { view: StatsWindow<C> | null; stale: boolean; keep: StatsWindow<C> | null } {
  const asked: StatsWindow<C> | null = main.metrics
    ? { clock, metrics: main.metrics, fees: fees?.metrics ?? null, complete: !fees || !!fees.metrics || fees.failed }
    : null;
  const same =
    asked !== null &&
    kept !== null &&
    asked.clock === kept.clock && asked.metrics === kept.metrics && asked.fees === kept.fees && asked.complete === kept.complete;
  const done = asked?.complete ? (same ? kept : asked) : null;
  const { data: view, stale } = heldWindow(kept, done ?? (kept ? null : asked), !main.failed);
  return { view, stale, keep: done !== kept ? done : null };
}

/**
 * The chain-stats fetch, one per (chain, window): sub-month windows ride
 * the 30d payload and slice client-side, so flipping the page clock
 * between 1D/1W/1M costs nothing after the first load.
 */
export function useChainMetrics(chainId: string, range: number, metricKeys: string) {
  // "all" rides the API's genesis-anchored window (STATS_CONFIG.TIME_RANGES
  // pins it to September 2020), so the widest clock tick is true all-time
  const timeRange = range <= 30 ? "30d" : range <= 90 ? "90d" : range <= 365 ? "1y" : "all";
  const url = `/api/chain-stats/${chainId}?metrics=${metricKeys}&timeRange=${timeRange}`;
  // the charts a page drew before open from memory while they are read again.
  // Each read keeps the url it answers, so a new window never draws on the
  // last one's payload (exp-range-hold holds that window itself, dimmed)
  const [read, setRead] = useState(() => ({ url, metrics: recall<Metrics>(url, false)?.data ?? null, failed: false }));

  useEffect(() => {
    let cancelled = false;
    let again: ReturnType<typeof setTimeout> | undefined;
    setRead({ url, metrics: recall<Metrics>(url, false)?.data ?? null, failed: false });
    const load = (first: boolean) =>
      fetch(url)
        .then(async (res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = (await res.json()) as Metrics;
          if (cancelled) return;
          remember(url, data);
          setRead({ url, metrics: data, failed: false });
          // a metric the stats API did not answer in time comes back missing, and the server keeps nothing: ask once more
          if (first && res.headers.get("X-Partial-Metrics")) again = setTimeout(() => void load(false), 10_000);
        })
        .catch(() => {
          // a second ask that fails leaves the first answer standing
          if (!cancelled && first) setRead((r) => ({ ...r, failed: true }));
        });
    void load(true);
    return () => {
      cancelled = true;
      if (again) clearTimeout(again);
    };
  }, [url]);

  return metricsReadFor(url, read, (asked) => recall<Metrics>(asked, false)?.data ?? null);
}

/** stats-bar-band: what recharts hands a ComposedChart's cursor: the line it
 *  would draw at the hovered day (top to bottom), the plot's width, and the
 *  day's index (-1 when a synced chart does not hold that date) */
interface CursorAt {
  points?: { x: number; y: number }[];
  width?: number;
  payloadIndex?: number;
}

/** stats-synced-days: the hovered day's line, top to bottom, or null where
 *  the chart holds no such day: a synced chart that lacks the date gets
 *  payloadIndex -1, and recharts would draw its cursor at the plot's left
 *  edge */
export function dayLine(cursor: CursorAt): [{ x: number; y: number }, { x: number; y: number }] | null {
  const [top, bottom] = cursor.points ?? [];
  return top && bottom && (cursor.payloadIndex ?? 0) >= 0 ? [top, bottom] : null;
}

/** stats-bar-band: the band behind a hovered bar, one day wide around the
 *  crosshair and as tall as the plot. A bar chart's days split the plot's
 *  width evenly; null where there is no day to mark. */
export function dayBand(cursor: CursorAt, days: number): { x: number; y: number; width: number; height: number } | null {
  const line = dayLine(cursor);
  if (!line || !cursor.width || days < 1) return null;
  const [top, bottom] = line;
  const width = cursor.width / days;
  return { x: top.x - width / 2, y: top.y, width, height: bottom.y - top.y };
}

/** stats-synced-days: an area chart's hover hairline, the 1px line recharts
 *  draws by default, drawn only on a day the chart holds */
function DayLine({ className, ...cursor }: CursorAt & { className?: string }) {
  const line = dayLine(cursor);
  return line ? <Curve points={line} className={className} stroke="rgba(161,161,170,0.35)" pointerEvents="none" /> : null;
}

/** stats-bar-band: a bar chart's hover mark, the soft band DualChart always
 *  asked for. A ComposedChart draws a cursor object as a 1px line, so the
 *  band is a Rectangle of its own; recharts draws it where the Tooltip sits
 *  among the chart's children, behind the bars. */
function DayBand({ days, className, ...cursor }: CursorAt & { days: number; className?: string }) {
  const band = dayBand(cursor, days);
  return band ? <Rectangle {...band} className={className} fill="rgba(161,161,170,0.08)" stroke="none" pointerEvents="none" /> : null;
}

/* the workhorse: bars or area for the headline, a line for the overlay */
export function DualChart({
  data,
  kind,
  fmt,
  aLabel,
  bLabel,
  bFmt,
  bOwnAxis = false,
  syncId,
}: {
  data: DualPoint[];
  kind: "bars" | "area";
  fmt: (v: number) => string;
  aLabel: string;
  bLabel?: string;
  bFmt?: (v: number) => string;
  /** overlay rides its own (hidden) axis when scales are incompatible */
  bOwnAxis?: boolean;
  /** stats-synced-days: charts on one time axis share an id, and the day
   *  hovered on one is read on all of them, matched by date */
  syncId?: string;
}) {
  const hasB = !!bLabel && data.some((d) => d.b !== undefined);
  return (
    <div className="h-44 text-zinc-900 dark:text-zinc-100">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} barCategoryGap="22%" syncId={syncId} syncMethod="value">
          <XAxis dataKey="date" hide />
          <YAxis yAxisId="a" hide domain={[0, "dataMax"]} />
          {hasB && bOwnAxis && <YAxis yAxisId="b" hide domain={[0, "dataMax"]} />}
          <RechartsTooltip {...TOOLTIP_DEFAULTS}
            cursor={
              kind === "bars"
                ? <DayBand days={data.length} />
                : <DayLine />
            }
            content={({ active, payload }) => {
              if (!active || !payload?.[0]) return null;
              const d = payload[0].payload as DualPoint;
              return (
                <TipPlate>
                  <p className="text-[10px] text-zinc-500">{d.date}</p>
                  <p className="text-xs font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                    {fmt(d.a)} {aLabel}
                  </p>
                  {hasB && d.b !== undefined && (
                    <p className="text-[10px] tabular-nums text-zinc-500">
                      {(bFmt ?? fmt)(d.b)} {bLabel}
                    </p>
                  )}
                </TipPlate>
              );
            }}
          />
          {kind === "bars" ? (
            <Bar
              yAxisId="a"
              dataKey="a"
              fill={QUIET}
              fillOpacity={0.8}
              minPointSize={1}
              isAnimationActive={false}
            />
          ) : (
            <Area
              yAxisId="a"
              type="monotone"
              dataKey="a"
              stroke="currentColor"
              strokeWidth={1.5}
              fill="currentColor"
              fillOpacity={0.1}
              isAnimationActive={false}
            />
          )}
          {hasB && (
            <Line
              yAxisId={bOwnAxis ? "b" : "a"}
              type="monotone"
              dataKey="b"
              stroke={PUNCH}
              strokeWidth={1.5}
              strokeDasharray={bOwnAxis ? "4 3" : undefined}
              dot={false}
              connectNulls
              isAnimationActive={false}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

/* legend chip for a chart's overlay line */
export function OverlayKey({ label, dashed = false }: { label: string; dashed?: boolean }) {
  return (
    <span className="flex shrink-0 items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-400 dark:text-zinc-500">
      <span className={dashed ? "h-0.5 w-4 border-b border-dashed border-[#E6212F]" : "h-0.5 w-4 bg-[#E6212F]"} />
      {label}
    </span>
  );
}

export function ChartSection({
  label,
  action,
  children,
  note,
  href,
}: {
  label: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  note?: string;
  /** the stat's detail page — the whole card becomes a door */
  href?: string;
}) {
  return (
    <section className="flex min-w-0 flex-col gap-3">
      <ChartBoard label={label} action={action} href={href}>
        {children}
      </ChartBoard>
      {note && (
        <p className="text-[13px] leading-relaxed text-zinc-500 dark:text-zinc-400">{note}</p>
      )}
    </section>
  );
}
