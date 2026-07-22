"use client";

import { useEffect, useState } from "react";
import {
  Area,
  Bar,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Board, SectionHeader } from "@/components/explorer-v2/ui";
import { TipPlate } from "@/components/explorer-v2/staking/bits";
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

/** a metric (and its overlay) windowed to the page clock and thinned */
export function metricSeries(
  m: Metrics,
  range: number,
  key: string,
  overlay?: string,
): DualPoint[] {
  return thin(windowSeries(joinSeries(m[key]?.data, overlay ? m[overlay]?.data : undefined), range), 200);
}

/**
 * The chain-stats fetch, one per (chain, window): sub-month windows ride
 * the 30d payload and slice client-side, so flipping the page clock
 * between 1D/1W/1M costs nothing after the first load.
 */
export function useChainMetrics(chainId: string, range: number, metricKeys: string) {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [failed, setFailed] = useState(false);
  const timeRange = range <= 30 ? "30d" : range <= 90 ? "90d" : "1y";

  useEffect(() => {
    let cancelled = false;
    setMetrics(null);
    setFailed(false);
    fetch(`/api/chain-stats/${chainId}?metrics=${metricKeys}&timeRange=${timeRange}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((data: Metrics) => {
        if (!cancelled) setMetrics(data);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [chainId, timeRange, metricKeys]);

  return { metrics, failed };
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
}: {
  data: DualPoint[];
  kind: "bars" | "area";
  fmt: (v: number) => string;
  aLabel: string;
  bLabel?: string;
  bFmt?: (v: number) => string;
  /** overlay rides its own (hidden) axis when scales are incompatible */
  bOwnAxis?: boolean;
}) {
  const hasB = !!bLabel && data.some((d) => d.b !== undefined);
  return (
    <div className="h-44 text-zinc-900 dark:text-zinc-100">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} barCategoryGap="22%">
          <XAxis dataKey="date" hide />
          <YAxis yAxisId="a" hide domain={[0, "dataMax"]} />
          {hasB && bOwnAxis && <YAxis yAxisId="b" hide domain={[0, "dataMax"]} />}
          <RechartsTooltip
            cursor={
              kind === "bars"
                ? { fill: "rgba(161,161,170,0.08)" }
                : { stroke: "rgba(161,161,170,0.35)" }
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
}: {
  label: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  note?: string;
}) {
  return (
    <section className="flex flex-col gap-4">
      <SectionHeader label={label} action={action} />
      <Board divide={false} className="px-5 py-5 md:px-6">
        {children}
      </Board>
      {note && <p className="font-mono text-[11px] text-zinc-400 dark:text-zinc-500">{note}</p>}
    </section>
  );
}
