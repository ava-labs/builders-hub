"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import {
  Bar,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Board, BoardHeader, SectionHeader, StatDash } from "@/components/explorer-v2/ui";
import {
  RANGE_DAYS,
  RANGE_LABEL,
  useExplorerTimeRange,
  type ExplorerRange,
} from "@/components/explorer-v2/time-range";
import {
  BandKey,
  DOW_LABELS,
  FEE_HISTORY_BLOCKS,
  FeeBandChart,
  GasStat,
  HistoryEmpty,
  TipPlate,
  UtilHistogram,
  fmtGas,
  fmtNano,
  nanoUnit,
  useFeeHistory,
} from "@/components/explorer/GasMarketPage";
import { GAS_METRICS, type GasMetricKey } from "@/components/explorer/gas-metrics";
import type { GasDayPoint, GasHistoryDays, GasMarket } from "@/lib/explorer-clickhouse";
import type { L1Chain } from "@/types/stats";

/* The per-metric detail sheets behind the Gas Market's stat cells: one
   figure, everything we know about it. The frame (eyebrow, title, blurb,
   methodology colophon) is shared; each metric composes its own sections
   from the market's chart idioms. The whole point of the top sheet staying
   quiet is that these pages don't have to. */

/* ---------------------------------------------------------------- */
/* data                                                              */
/* ---------------------------------------------------------------- */

function useGasMarket(evmChainId: number, rangeDays: number) {
  const [market, setMarket] = useState<GasMarket | null>(null);
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    if (!Number.isFinite(evmChainId)) return;
    let cancelled = false;
    setMarket(null);
    setMissing(false);
    fetch(`/api/gas-market/${evmChainId}?range=${rangeDays}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((data: GasMarket) => {
        if (!cancelled) setMarket(data);
      })
      .catch(() => {
        if (!cancelled) setMissing(true);
      });
    return () => {
      cancelled = true;
    };
  }, [evmChainId, rangeDays]);
  return { market, missing };
}

function useGasHistory(evmChainId: number, days: GasHistoryDays) {
  const [daily, setDaily] = useState<GasDayPoint[] | null>(null);
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    if (!Number.isFinite(evmChainId)) return;
    let cancelled = false;
    setDaily(null);
    setMissing(false);
    fetch(`/api/gas-history/${evmChainId}?days=${days}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((data: { daily: GasDayPoint[] }) => {
        if (!cancelled) setDaily(data.daily);
      })
      .catch(() => {
        if (!cancelled) setMissing(true);
      });
    return () => {
      cancelled = true;
    };
  }, [evmChainId, days]);
  return { daily, missing };
}

/* the clock's window, in the vocabularies this sheet's two feeds accept */
function historyDays(range: ExplorerRange): GasHistoryDays {
  const d = RANGE_DAYS[range];
  return d <= 7 ? 7 : d <= 30 ? 30 : d <= 90 ? 90 : 365;
}

/* ---------------------------------------------------------------- */
/* shared frame                                                      */
/* ---------------------------------------------------------------- */

function MetricFrame({
  base,
  chainName,
  metric,
  children,
}: {
  base: string;
  chainName: string;
  metric: GasMetricKey;
  children: React.ReactNode;
}) {
  const def = GAS_METRICS[metric];
  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-3">
        <Link
          href={`${base}/gas`}
          className="group flex w-fit items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-400 transition-colors hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-zinc-100"
        >
          <ArrowLeft className="h-3 w-3 transition-transform group-hover:-translate-x-0.5" />
          Gas Market · {chainName}
        </Link>
        <h2 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          {def.title}
        </h2>
        <p className="max-w-2xl text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
          {def.blurb}
        </p>
      </header>

      {children}

      {/* the colophon: how this figure is measured */}
      <div className="border-t border-zinc-200 pt-6 dark:border-zinc-800">
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-400 dark:text-zinc-500">
          How this is measured
        </p>
        {def.methodology.map((para) => (
          <p key={para.slice(0, 32)} className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
            {para}
          </p>
        ))}
      </div>
    </div>
  );
}

/* a full-width door to a sibling metric sheet */
function SiblingDoor({ href, label, sub }: { href: string; label: string; sub: string }) {
  return (
    <Link
      href={href}
      className="group flex items-center justify-between gap-4 border border-zinc-200 px-5 py-4 transition-colors hover:bg-zinc-50 md:px-6 dark:border-zinc-800 dark:hover:bg-zinc-900"
    >
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-900 dark:text-zinc-100">
          {label}
        </span>
        <span className="truncate font-mono text-[11px] text-zinc-400 dark:text-zinc-500">{sub}</span>
      </span>
      <ArrowRight className="h-4 w-4 shrink-0 text-zinc-300 transition-all group-hover:translate-x-0.5 group-hover:text-[#E6212F] dark:text-zinc-600" />
    </Link>
  );
}

const dayLabel = (d: string) =>
  new Date(`${d}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric" });

/* ---------------------------------------------------------------- */
/* Base Fee                                                          */
/* ---------------------------------------------------------------- */

function BaseFeeSheet({ catalog, base }: { catalog: L1Chain; base: string }) {
  const evmChainId = Number(catalog.chainId);
  const unit = nanoUnit(catalog.networkToken?.symbol);
  const range = useExplorerTimeRange();
  const fee = useFeeHistory(catalog.rpcUrl);

  const days = historyDays(range);
  const { daily, missing } = useGasHistory(evmChainId, days);
  // the day view reads the 48h hourly series; the market payload's demand
  // range is irrelevant here, so pin it to the cheapest window
  const { market, missing: marketMissing } = useGasMarket(evmChainId, 1);

  const windowed = useMemo(() => (daily ?? []).slice(-RANGE_DAYS[range]), [daily, range]);
  const isHourly = range === "day";
  const windowLabel = isHourly ? "last 48 hours" : RANGE_LABEL[range];

  // the window's story in three numbers: typical, spike, floor
  const stats = useMemo(() => {
    const src = windowed;
    if (!src.length) return null;
    const medians = src.map((p) => p.p50).sort((a, b) => a - b);
    const typical = medians[Math.floor(medians.length / 2)];
    let high = src[0];
    let low = src[0];
    for (const p of src) {
      if (p.p95 > high.p95) high = p;
      if (p.p50 < low.p50) low = p;
    }
    return { typical, high, low };
  }, [windowed]);

  return (
    <MetricFrame base={base} chainName={catalog.chainName} metric="base-fee">
      <Board divide={false}>
        <BoardHeader label={`The Fee · ${windowLabel}`} />
        <div className="grid grid-cols-2 divide-x divide-y divide-zinc-200 lg:grid-cols-4 lg:divide-y-0 dark:divide-zinc-800">
          <GasStat label="Right Now" live>
            {fee.baseFeeWei !== null ? (
              <>
                {fmtNano(fee.baseFeeWei)}
                <span className="ml-1.5 text-sm text-zinc-400 dark:text-zinc-500">{unit}</span>
              </>
            ) : (
              <StatDash />
            )}
          </GasStat>
          <GasStat label="Typical · median of medians">
            {stats ? (
              <>
                {stats.typical}
                <span className="ml-1.5 text-sm text-zinc-400 dark:text-zinc-500">{unit}</span>
              </>
            ) : (
              <StatDash />
            )}
          </GasStat>
          <GasStat label="Spike · highest p95" sub={stats ? dayLabel(stats.high.d) : undefined}>
            {stats ? (
              <>
                {stats.high.p95}
                <span className="ml-1.5 text-sm text-zinc-400 dark:text-zinc-500">{unit}</span>
              </>
            ) : (
              <StatDash />
            )}
          </GasStat>
          <GasStat label="Floor · lowest median" sub={stats ? dayLabel(stats.low.d) : undefined}>
            {stats ? (
              <>
                {stats.low.p50}
                <span className="ml-1.5 text-sm text-zinc-400 dark:text-zinc-500">{unit}</span>
              </>
            ) : (
              <StatDash />
            )}
          </GasStat>
        </div>
      </Board>

      <section className="flex flex-col gap-4">
        <SectionHeader label={`Base Fee · ${windowLabel}`} action={<BandKey unit={unit} />} />
        <Board divide={false} className="px-5 py-5 md:px-6">
          {isHourly ? (
            market?.hourly.length ? (
              <FeeBandChart
                data={market.hourly}
                unit={unit}
                labelFor={(d) => d.t.replace("T", " · ") + " UTC"}
              />
            ) : (
              <HistoryEmpty missing={marketMissing} />
            )
          ) : windowed.length ? (
            <FeeBandChart data={windowed} unit={unit} labelFor={(d) => d.d} />
          ) : (
            <HistoryEmpty missing={missing} />
          )}
        </Board>
      </section>

      <SiblingDoor
        href={`${base}/gas/fee-seasonality`}
        label="Fee Seasonality"
        sub="when blockspace is cheap, hour by hour across the week"
      />
    </MetricFrame>
  );
}

/* ---------------------------------------------------------------- */
/* Utilization                                                       */
/* ---------------------------------------------------------------- */

function UtilTrendChart({ data }: { data: GasDayPoint[] }) {
  return (
    <div className="h-40 text-zinc-900 dark:text-zinc-100">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data}>
          <XAxis dataKey="d" hide />
          <YAxis hide domain={[0, "dataMax"]} />
          <YAxis yAxisId="gas" hide domain={[0, "dataMax"]} />
          <RechartsTooltip
            cursor={{ stroke: "rgba(161,161,170,0.35)" }}
            content={({ active, payload }) => {
              if (!active || !payload?.[0]) return null;
              const d = payload[0].payload as GasDayPoint;
              return (
                <TipPlate>
                  <p className="text-[10px] text-zinc-500">{d.d}</p>
                  <p className="text-xs font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                    {d.utilPct.toFixed(1)}% utilized
                  </p>
                  <p className="text-[10px] tabular-nums text-zinc-500">
                    {fmtGas(d.gas)} gas · {d.blocks.toLocaleString("en-US")} blocks
                  </p>
                </TipPlate>
              );
            }}
          />
          {/* gas volume rides under the utilization line — same demand, two units */}
          <Bar yAxisId="gas" dataKey="gas" fill="currentColor" fillOpacity={0.1} isAnimationActive={false} />
          <Line type="monotone" dataKey="utilPct" stroke="currentColor" strokeWidth={2} dot={false} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

function LiveUtilBars({ utilization }: { utilization: number[] }) {
  const data = utilization.map((u, i) => ({ i, pct: u * 100 }));
  return (
    <div className="h-40 text-zinc-900 dark:text-zinc-100">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} barCategoryGap="18%">
          <YAxis hide domain={[0, 100]} />
          <RechartsTooltip
            cursor={{ fill: "rgba(161,161,170,0.08)" }}
            content={({ active, payload }) => {
              if (!active || !payload?.[0]) return null;
              const d = payload[0].payload as { i: number; pct: number };
              return (
                <TipPlate>
                  <p className="text-xs font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                    {d.pct.toFixed(1)}% full
                  </p>
                  <p className="text-[10px] text-zinc-500">{data.length - d.i} blocks ago</p>
                </TipPlate>
              );
            }}
          />
          <Bar dataKey="pct" fill="currentColor" fillOpacity={0.55} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

function UtilizationSheet({ catalog, base }: { catalog: L1Chain; base: string }) {
  const evmChainId = Number(catalog.chainId);
  const range = useExplorerTimeRange();
  const fee = useFeeHistory(catalog.rpcUrl);

  const days = historyDays(range);
  const { daily, missing } = useGasHistory(evmChainId, days);
  // the fullness histogram is computed over the market's demand window,
  // which caps at 90d — the year view reads the quarter's distribution
  const histDays = Math.min(RANGE_DAYS[range], 90);
  const { market, missing: marketMissing } = useGasMarket(evmChainId, histDays);

  const windowed = useMemo(() => (daily ?? []).slice(-RANGE_DAYS[range]), [daily, range]);
  const windowLabel = RANGE_LABEL[range];
  const histLabel = RANGE_DAYS[range] > 90 ? `${RANGE_LABEL.quarter} · longest computed` : windowLabel;

  const liveUtil = fee.utilization.length
    ? (fee.utilization.reduce((s, u) => s + u, 0) / fee.utilization.length) * 100
    : null;

  const stats = useMemo(() => {
    if (!windowed.length) return null;
    const avg = windowed.reduce((s, p) => s + p.utilPct, 0) / windowed.length;
    let busiest = windowed[0];
    for (const p of windowed) if (p.utilPct > busiest.utilPct) busiest = p;
    const totalGas = windowed.reduce((s, p) => s + p.gas, 0);
    return { avg, busiest, totalGas };
  }, [windowed]);

  return (
    <MetricFrame base={base} chainName={catalog.chainName} metric="utilization">
      <Board divide={false}>
        <BoardHeader label={`Blockspace · ${windowLabel}`} />
        <div className="grid grid-cols-2 divide-x divide-y divide-zinc-200 lg:grid-cols-4 lg:divide-y-0 dark:divide-zinc-800">
          <GasStat label="Right Now" live sub={`last ${FEE_HISTORY_BLOCKS} blocks`}>
            {liveUtil !== null ? (
              <>
                {liveUtil.toFixed(1)}
                <span className="ml-1 text-sm text-zinc-400 dark:text-zinc-500">%</span>
              </>
            ) : (
              <StatDash />
            )}
          </GasStat>
          <GasStat label="Average">
            {stats ? (
              <>
                {stats.avg.toFixed(1)}
                <span className="ml-1 text-sm text-zinc-400 dark:text-zinc-500">%</span>
              </>
            ) : (
              <StatDash />
            )}
          </GasStat>
          <GasStat label="Busiest Day" sub={stats ? dayLabel(stats.busiest.d) : undefined}>
            {stats ? (
              <>
                {stats.busiest.utilPct.toFixed(1)}
                <span className="ml-1 text-sm text-zinc-400 dark:text-zinc-500">%</span>
              </>
            ) : (
              <StatDash />
            )}
          </GasStat>
          <GasStat label="Gas Used">{stats ? fmtGas(stats.totalGas) : <StatDash />}</GasStat>
        </div>
      </Board>

      <div className="grid items-start gap-x-8 gap-y-10 lg:grid-cols-2">
        <section className="flex flex-col gap-4">
          <SectionHeader
            label={
              range === "day"
                ? `Block by Block · last ${FEE_HISTORY_BLOCKS} blocks`
                : `Daily Utilization · ${windowLabel}`
            }
          />
          <Board divide={false} className="px-5 py-5 md:px-6">
            {range === "day" ? (
              fee.utilization.length ? (
                <LiveUtilBars utilization={fee.utilization} />
              ) : (
                <HistoryEmpty missing={false} />
              )
            ) : windowed.length ? (
              <UtilTrendChart data={windowed} />
            ) : (
              <HistoryEmpty missing={missing} />
            )}
          </Board>
        </section>

        <section className="flex flex-col gap-4">
          <SectionHeader label={`Block Fullness Distribution · ${histLabel}`} />
          <Board divide={false} className="px-5 py-5 md:px-6">
            {market?.histogram.length ? (
              <UtilHistogram histogram={market.histogram} />
            ) : (
              <HistoryEmpty missing={marketMissing} />
            )}
          </Board>
        </section>
      </div>

      <SiblingDoor
        href={`${base}/gas/base-fee`}
        label="Base Fee"
        sub="the price this demand sets, percentile by percentile"
      />
    </MetricFrame>
  );
}

/* ---------------------------------------------------------------- */
/* Fee Seasonality                                                   */
/* ---------------------------------------------------------------- */

/* the detail heatmap: same 168 cells as the market sheet's, but each one
   answers on hover — a reader line pins the cell's story under the grid
   instead of a floating tooltip, so comparisons don't chase the cursor */
function HeatmapReader({ cells, unit }: { cells: GasMarket["heatmap"]; unit: string }) {
  const [hovered, setHovered] = useState<{ dow: number; hour: number } | null>(null);
  const byKey = useMemo(() => new Map(cells.map((c) => [`${c.dow}-${c.hour}`, c.p50])), [cells]);
  const values = cells.map((c) => c.p50).filter((v) => v > 0);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(max - min, 1e-9);
  const sorted = [...values].sort((a, b) => a - b);
  const weekMedian = sorted[Math.floor(sorted.length / 2)] ?? 0;

  const reader = (() => {
    if (!hovered) return null;
    const v = byKey.get(`${hovered.dow}-${hovered.hour}`);
    if (v === undefined) return null;
    const vsPct = weekMedian > 0 ? ((v - weekMedian) / weekMedian) * 100 : 0;
    return {
      label: `${DOW_LABELS[hovered.dow - 1]} ${String(hovered.hour).padStart(2, "0")}:00 UTC`,
      value: v,
      vsPct,
    };
  })();

  return (
    <div className="flex flex-col gap-3" onMouseLeave={() => setHovered(null)}>
      <div className="grid grid-cols-[2.5rem_repeat(24,minmax(0,1fr))] gap-px">
        <span />
        {Array.from({ length: 24 }, (_, h) => (
          <span
            key={`h-${h}`}
            className="pb-1 text-center font-mono text-[9px] tabular-nums text-zinc-400 dark:text-zinc-500"
          >
            {h % 6 === 0 ? h : ""}
          </span>
        ))}
        {DOW_LABELS.map((label, i) => {
          const dow = i + 1;
          return (
            <HeatRow key={label} label={label}>
              {Array.from({ length: 24 }, (_, h) => {
                const v = byKey.get(`${dow}-${h}`);
                const t = v === undefined ? null : (v - min) / span;
                const active = hovered?.dow === dow && hovered?.hour === h;
                return (
                  <span
                    key={h}
                    onMouseEnter={() => setHovered({ dow, hour: h })}
                    className="aspect-square min-h-4 cursor-crosshair"
                    style={{
                      backgroundColor:
                        t === null
                          ? "rgba(161,161,170,0.08)"
                          : `rgba(230, 33, 47, ${(0.05 + 0.75 * t).toFixed(3)})`,
                      outline: active ? "1px solid currentColor" : undefined,
                      outlineOffset: active ? "-1px" : undefined,
                    }}
                  />
                );
              })}
            </HeatRow>
          );
        })}
      </div>
      {/* the reader line: pinned, so two cells can be compared without memory */}
      <div className="flex min-h-5 items-center justify-between font-mono text-[11px] tabular-nums">
        {reader ? (
          <>
            <span className="text-zinc-900 dark:text-zinc-100">
              {reader.label} · median {reader.value} {unit}
            </span>
            <span className={reader.vsPct > 0 ? "text-[#E6212F]" : "text-zinc-500 dark:text-zinc-400"}>
              {reader.vsPct > 0 ? "+" : ""}
              {reader.vsPct.toFixed(0)}% vs week median
            </span>
          </>
        ) : (
          <span className="text-zinc-400 dark:text-zinc-500">hover a cell · hours UTC</span>
        )}
      </div>
      <div className="flex items-center justify-end font-mono text-[10px] tabular-nums text-zinc-400 dark:text-zinc-500">
        <span className="flex items-center gap-2">
          cheap {min} {unit}
          <span
            className="h-2 w-24"
            style={{
              background: "linear-gradient(to right, rgba(230,33,47,0.05), rgba(230,33,47,0.8))",
            }}
          />
          {max} {unit} pricey
        </span>
      </div>
    </div>
  );
}

function HeatRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <span className="flex items-center pr-2 font-mono text-[9px] uppercase text-zinc-400 dark:text-zinc-500">
        {label}
      </span>
      {children}
    </>
  );
}

/* median fee by hour of day, all seven days collapsed — the daily rhythm
   the week grid hints at, as one line */
function HourProfileChart({ cells, unit }: { cells: GasMarket["heatmap"]; unit: string }) {
  const data = useMemo(() => {
    return Array.from({ length: 24 }, (_, h) => {
      const vals = cells
        .filter((c) => c.hour === h && c.p50 > 0)
        .map((c) => c.p50)
        .sort((a, b) => a - b);
      return { h, p50: vals.length ? vals[Math.floor(vals.length / 2)] : 0 };
    });
  }, [cells]);
  return (
    <div className="h-40 text-zinc-900 dark:text-zinc-100">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data}>
          <XAxis
            dataKey="h"
            tickLine={false}
            axisLine={false}
            interval={5}
            tick={{ fontSize: 9, fill: "currentColor", opacity: 0.5 }}
          />
          <YAxis hide domain={[0, "dataMax"]} />
          <RechartsTooltip
            cursor={{ stroke: "rgba(161,161,170,0.35)" }}
            content={({ active, payload }) => {
              if (!active || !payload?.[0]) return null;
              const d = payload[0].payload as { h: number; p50: number };
              return (
                <TipPlate>
                  <p className="text-[10px] text-zinc-500">
                    {String(d.h).padStart(2, "0")}:00 UTC · all days
                  </p>
                  <p className="text-xs font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                    {d.p50} {unit} median
                  </p>
                </TipPlate>
              );
            }}
          />
          <Line type="monotone" dataKey="p50" stroke="currentColor" strokeWidth={2} dot={false} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

function SeasonalitySheet({ catalog, base }: { catalog: L1Chain; base: string }) {
  const evmChainId = Number(catalog.chainId);
  const unit = nanoUnit(catalog.networkToken?.symbol);
  // the pattern is a fixed 30-day median — deliberately NOT on the page
  // clock, so the subnav control stays hidden here rather than lying
  const { market, missing } = useGasMarket(evmChainId, 1);

  const stats = useMemo(() => {
    const cells = (market?.heatmap ?? []).filter((c) => c.p50 > 0);
    if (!cells.length) return null;
    let cheapest = cells[0];
    let priciest = cells[0];
    for (const c of cells) {
      if (c.p50 < cheapest.p50) cheapest = c;
      if (c.p50 > priciest.p50) priciest = c;
    }
    const median = (vals: number[]) => {
      const s = [...vals].sort((a, b) => a - b);
      return s.length ? s[Math.floor(s.length / 2)] : 0;
    };
    const weekday = median(cells.filter((c) => c.dow <= 5).map((c) => c.p50));
    const weekend = median(cells.filter((c) => c.dow >= 6).map((c) => c.p50));
    const weekendVsWeekday = weekday > 0 ? ((weekend - weekday) / weekday) * 100 : 0;
    return { cheapest, priciest, weekendVsWeekday };
  }, [market]);

  const cellLabel = (c: { dow: number; hour: number }) =>
    `${DOW_LABELS[c.dow - 1]} ${String(c.hour).padStart(2, "0")}:00`;

  return (
    <MetricFrame base={base} chainName={catalog.chainName} metric="fee-seasonality">
      <Board divide={false}>
        <BoardHeader label="The Weekly Rhythm · 30 days" />
        <div className="grid grid-cols-2 divide-x divide-y divide-zinc-200 lg:grid-cols-3 lg:divide-y-0 dark:divide-zinc-800">
          <GasStat label="Cheapest Hour" sub={stats ? `${cellLabel(stats.cheapest)} UTC` : undefined}>
            {stats ? (
              <>
                {stats.cheapest.p50}
                <span className="ml-1.5 text-sm text-zinc-400 dark:text-zinc-500">{unit}</span>
              </>
            ) : (
              <StatDash />
            )}
          </GasStat>
          <GasStat label="Priciest Hour" sub={stats ? `${cellLabel(stats.priciest)} UTC` : undefined}>
            {stats ? (
              <>
                {stats.priciest.p50}
                <span className="ml-1.5 text-sm text-zinc-400 dark:text-zinc-500">{unit}</span>
              </>
            ) : (
              <StatDash />
            )}
          </GasStat>
          <GasStat label="Weekend vs Weekday" sub="median base fee">
            {stats ? (
              <>
                {stats.weekendVsWeekday > 0 ? "+" : ""}
                {stats.weekendVsWeekday.toFixed(0)}
                <span className="ml-1 text-sm text-zinc-400 dark:text-zinc-500">%</span>
              </>
            ) : (
              <StatDash />
            )}
          </GasStat>
        </div>
      </Board>

      <section className="flex flex-col gap-4">
        <SectionHeader label="Hour of Week · median base fee" />
        <Board divide={false} className="px-5 py-5 md:px-6">
          {market?.heatmap.length ? (
            <HeatmapReader cells={market.heatmap} unit={unit} />
          ) : (
            <HistoryEmpty missing={missing} />
          )}
        </Board>
      </section>

      <section className="flex flex-col gap-4">
        <SectionHeader label="Hour of Day Profile · all days collapsed" />
        <Board divide={false} className="px-5 py-5 md:px-6">
          {market?.heatmap.length ? (
            <HourProfileChart cells={market.heatmap} unit={unit} />
          ) : (
            <HistoryEmpty missing={missing} />
          )}
        </Board>
      </section>

      <SiblingDoor
        href={`${base}/gas/base-fee`}
        label="Base Fee"
        sub="the price this rhythm plays out in, hour by hour"
      />
    </MetricFrame>
  );
}

/* ---------------------------------------------------------------- */
/* entry                                                             */
/* ---------------------------------------------------------------- */

export function GasMetricContent({
  catalog,
  base,
  metric,
}: {
  catalog: L1Chain;
  base: string;
  metric: GasMetricKey;
}) {
  if (metric === "base-fee") return <BaseFeeSheet catalog={catalog} base={base} />;
  if (metric === "utilization") return <UtilizationSheet catalog={catalog} base={base} />;
  return <SeasonalitySheet catalog={catalog} base={base} />;
}
