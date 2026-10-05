"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Area, AreaChart, Bar, BarChart, Brush, CartesianGrid, Line, LineChart, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { cn } from "@/lib/utils";
import { ChartBoard } from "@/components/explorer-v2/ui";
import { ChartEmpty, TipPlate } from "@/components/explorer-v2/staking/bits";
import { ViewSwitch } from "@/components/explorer-v2/network/icm-parts";
import { useChartZoom } from "@/lib/rwa/hooks/useChartZoom";
import type { TimeInterval } from "@/lib/rwa/types";
import { CHIP, OFF } from "./ProtocolFilters";

/* The pilot's chart, the old dashboard's instrument in the explorer's
   chrome: a line, bar or area view, a periodic or cumulative reading for
   a flow, drag to zoom with a reset, a brush to scrub the range, and a
   tooltip that follows the cursor across every chart sharing a syncId. */

export type ChartKind = "line" | "bar" | "area";

export interface RwaSeries {
  key: string;
  label: string;
  /** any CSS color; the RWA tones are --rwa-1 and --rwa-2 */
  color: string;
  dashed?: boolean;
}

export type ChartRow = { date: string } & Record<string, number | null | string>;

const KINDS: { v: ChartKind; label: string }[] = [
  { v: "line", label: "Line" },
  { v: "bar", label: "Bar" },
  { v: "area", label: "Area" },
];
const VIEWS: { v: "periodic" | "cumulative"; label: string }[] = [
  { v: "periodic", label: "Periodic" },
  { v: "cumulative", label: "Cumulative" },
];

/* full-strength ticks in the plot's ink: a 45% tick falls under 4.5:1 */
const TICK = { fontSize: 10, fill: "currentColor" } as const;
const SHORT_DAY = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const LONG_DAY = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const WEEK_DAY = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const SHORT_MONTH = new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
const LONG_MONTH = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
const asDay = (date: string) => new Date(`${date.slice(0, 10)}T00:00:00Z`);

/** an axis tick: "Oct 1" for a day or a week (its Monday), "Sep 2026" for a month */
export function tickLabel(date: string, interval: TimeInterval): string {
  return interval === "monthly" ? SHORT_MONTH.format(asDay(date)) : SHORT_DAY.format(asDay(date));
}

/** a tooltip's heading: the day, "Week of Sep 28, 2026", or "September 2026" */
export function tipLabel(date: string, interval: TimeInterval): string {
  if (interval === "monthly") return LONG_MONTH.format(asDay(date));
  if (interval === "weekly") return `Week of ${WEEK_DAY.format(asDay(date))}`;
  return LONG_DAY.format(asDay(date));
}

/** one row per bucket from named series that share their buckets */
export function zipRows(series: Record<string, { date: string; value: number | null }[]>): ChartRow[] {
  const keys = Object.keys(series);
  const base = keys.length ? series[keys[0]] : [];
  return base.map((p, i) => Object.assign({ date: p.date }, Object.fromEntries(keys.map((k) => [k, series[k][i]?.value ?? null]))) as ChartRow);
}

/** the cumulative view: each series' running total, row by row */
export function runningRows(rows: ChartRow[], keys: string[]): ChartRow[] {
  const totals = Object.fromEntries(keys.map((k) => [k, 0]));
  return rows.map((row) => {
    const next: ChartRow = { ...row };
    for (const k of keys) {
      const v = row[k];
      if (typeof v === "number") {
        totals[k] += v;
        next[k] = totals[k];
      }
    }
    return next;
  });
}

function ChartTip({ active, payload, series, interval, fmt }: { active?: boolean; payload?: { payload: ChartRow }[]; series: RwaSeries[]; interval: TimeInterval; fmt: (v: number) => string }) {
  const row = active ? payload?.[0]?.payload : undefined;
  if (!row) return null;
  return (
    <TipPlate>
      <p className="font-mono text-[10px] text-zinc-500 dark:text-zinc-400">{tipLabel(row.date, interval)}</p>
      {series.map((s) => {
        const v = row[s.key];
        return (
          <p key={s.key} className="flex items-center justify-between gap-4 font-mono text-[11px] tabular-nums text-zinc-900 dark:text-zinc-100">
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5" style={{ background: s.color }} />
              {s.label}
            </span>
            <span>{typeof v === "number" ? fmt(v) : "n/a"}</span>
          </p>
        );
      })}
    </TipPlate>
  );
}

/** the series' keys, as a swatch and a label each */
export function SeriesLegend({ series }: { series: RwaSeries[] }) {
  return (
    <span className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-500 dark:text-zinc-400">
      {series.map((s) => (
        <span key={s.key} className="flex items-center gap-1.5">
          <span className={cn("w-4", s.dashed ? "border-t border-dashed" : "border-t-2")} style={{ borderColor: s.color }} />
          {s.label}
        </span>
      ))}
    </span>
  );
}

export function RwaChart({
  id,
  title,
  series,
  rows,
  interval,
  fmt,
  kind: initialKind = "line",
  cumulative = false,
  cumulativeRows,
  defaultView = "periodic",
  syncId,
  loading = false,
  failed = false,
  extra,
  className,
}: {
  id: string;
  title: string;
  series: RwaSeries[];
  rows: ChartRow[];
  interval: TimeInterval;
  fmt: (v: number) => string;
  kind?: ChartKind;
  /** offer the periodic and cumulative readings of a flow */
  cumulative?: boolean;
  /** the cumulative reading when it is not the window's running sum, such as a running total kept upstream */
  cumulativeRows?: ChartRow[];
  defaultView?: "periodic" | "cumulative";
  syncId?: string;
  loading?: boolean;
  failed?: boolean;
  /** more controls beside the chart's own, such as a combined or split switch */
  extra?: ReactNode;
  className?: string;
}) {
  const [kind, setKind] = useState<ChartKind>(initialKind);
  const [view, setView] = useState<"periodic" | "cumulative">(defaultView);
  const [hovered, setHovered] = useState(false);
  const keys = useMemo(() => series.map((s) => s.key), [series]);
  const shown = useMemo(
    () => (cumulative && view === "cumulative" ? (cumulativeRows ?? runningRows(rows, keys)) : rows),
    [rows, keys, cumulative, cumulativeRows, view],
  );
  const zoom = useChartZoom(shown);

  const marks = series.map((s) =>
    kind === "bar" ? (
      <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color} isAnimationActive={false} />
    ) : kind === "area" ? (
      <Area key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={s.color} fill={s.color} fillOpacity={0.16} strokeWidth={1.5} strokeDasharray={s.dashed ? "4 3" : undefined} isAnimationActive={false} />
    ) : (
      <Line key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={s.color} strokeWidth={1.75} strokeDasharray={s.dashed ? "4 3" : undefined} dot={false} isAnimationActive={false} />
    ),
  );
  const plotProps = {
    data: zoom.zoomedData,
    // the tooltip follows the day across charts, so a zoomed chart, a slice of its rows, still lines up; it
    // leaves the group while the pointer is elsewhere, so another chart's brush cannot cut its slice
    syncId: zoom.isZoomed && !hovered ? undefined : syncId,
    syncMethod: "value" as const,
    margin: { top: 6, right: 8, bottom: 0, left: 0 },
    onMouseDown: zoom.handleMouseDown,
    onMouseMove: zoom.handleMouseMove,
    onMouseUp: zoom.handleMouseUp,
  };
  // direct children, not a Fragment or a wrapper component: recharts 2 finds its parts by type, and its
  // react-is cannot see through a React 19 Fragment, so a wrapped axis, grid or brush never draws
  const chrome = [
    <CartesianGrid key="grid" strokeDasharray="3 3" vertical={false} className="stroke-zinc-200 dark:stroke-zinc-800" />,
    <XAxis key="x" dataKey="date" tickFormatter={(d: string) => tickLabel(d, interval)} tick={TICK} tickLine={false} axisLine={false} minTickGap={32} />,
    <YAxis key="y" tickFormatter={fmt} tick={TICK} tickLine={false} axisLine={false} width={58} />,
    <Tooltip key="tip" cursor={{ stroke: "currentColor", strokeOpacity: 0.3 }} content={<ChartTip series={series} interval={interval} fmt={fmt} />} />,
    !zoom.isZoomed && <Brush key="brush" dataKey="date" height={22} stroke="currentColor" fill="transparent" travellerWidth={8} tickFormatter={(d: string) => tickLabel(d, interval)} />,
    zoom.zoomState.refAreaLeft && zoom.zoomState.refAreaRight && (
      <ReferenceArea key="zoom" x1={zoom.zoomState.refAreaLeft} x2={zoom.zoomState.refAreaRight} strokeOpacity={0.3} fill="currentColor" fillOpacity={0.12} />
    ),
  ];

  return (
    <ChartBoard
      label={title}
      className={className}
      action={
        <span className="flex flex-wrap items-center justify-end gap-2" data-export-hidden>
          {zoom.isZoomed && (
            <button type="button" onClick={zoom.resetZoom} className={cn(CHIP, OFF)}>
              Reset zoom
            </button>
          )}
          {cumulative && <ViewSwitch id={`${id}-view`} value={view} onChange={setView} options={VIEWS} />}
          <ViewSwitch id={`${id}-kind`} value={kind} onChange={setKind} options={KINDS} />
          {extra}
        </span>
      }
    >
      {series.length > 1 && (
        <div className="mb-3">
          <SeriesLegend series={series} />
        </div>
      )}
      {loading || failed || rows.length === 0 ? (
        <ChartEmpty failed={failed} label={loading ? "Loading…" : "No data in this range"} />
      ) : (
        // the marks draw in their own colors; ticks, grid and brush follow this ink
        <div className="h-[260px] select-none text-zinc-500 dark:text-zinc-400" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
          <ResponsiveContainer width="100%" height="100%">
            {kind === "bar" ? (
              <BarChart {...plotProps}>
                {chrome}
                {marks}
              </BarChart>
            ) : kind === "area" ? (
              <AreaChart {...plotProps}>
                {chrome}
                {marks}
              </AreaChart>
            ) : (
              <LineChart {...plotProps}>
                {chrome}
                {marks}
              </LineChart>
            )}
          </ResponsiveContainer>
        </div>
      )}
    </ChartBoard>
  );
}
