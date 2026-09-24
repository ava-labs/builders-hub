"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Board, BoardHeader, LiveDot, StatCell, StatDash } from "@/components/explorer-v2/ui";
import { RANGE_DAYS, rangeWindowLabel, useExplorerTimeRange } from "@/components/explorer-v2/time-range";
import {
  Delta,
  fmtCompact,
  num,
  pctOf,
  useChainMetrics,
  windowPair,
  type SeriesPoint,
  type WindowPair,
} from "./metric-charts";

/* The chain's readings, one uniform grid on the page clock: the live
   market row, then the clock's window with its move against the
   previous window of the same length. Every cell has the same anatomy,
   label over figure over one qualifying line, so the figures sit on one
   baseline across a row. A windowed figure carries its own trace: a
   hairline of the daily series behind it, the shape of the window the
   number sums. Every cell doors into the tab that charts it. */

const METRICS = [
  "activeAddresses",
  "txCount",
  "contracts",
  "gasUsed",
  "feesPaid",
  "avgGasPrice",
].join(",");

/* the fewest days a trace is worth drawing for */
const SPARK_MIN_DAYS = 7;
/* the most points a trace carries; longer series are bucketed */
const SPARK_MAX_POINTS = 60;

/* utilization off the blocks table, windowed on the clock; 404 = not ingested */
function useUtilization(chainId: string, n: number) {
  const days = 2 * n <= 7 ? 7 : 2 * n <= 30 ? 30 : 2 * n <= 90 ? 90 : 365;
  const [out, setOut] = useState<{ pair: WindowPair; series: number[] } | null>(null);
  useEffect(() => {
    let cancelled = false;
    setOut(null);
    fetch(`/api/gas-history/${chainId}?days=${days}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { daily?: { utilPct: number }[] } | null) => {
        const d = data?.daily;
        if (cancelled || !d || !d.length) return;
        const avg = (arr: { utilPct: number }[]) => arr.reduce((s, p) => s + p.utilPct, 0) / arr.length;
        const cur = d.slice(-n);
        const prev = d.slice(-2 * n, -n);
        setOut({
          pair: { cur: avg(cur.length ? cur : d), prev: prev.length === n ? avg(prev) : null },
          series: (cur.length ? cur : d).map((p) => p.utilPct),
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [chainId, days, n]);
  return out;
}

/* the native token's day-by-day price and market cap for the live row's
   traces; 404 = the chain has no listed token */
type MarketSeries = "price" | "marketCap";
function useMarketHistory(chainId: string, n: number, wanted: boolean) {
  // the upstream stops at a year, so the all-time clock traces the last year
  const days = !wanted ? null : n <= 7 ? "7" : n <= 30 ? "30" : n <= 90 ? "90" : "365";
  const [hist, setHist] = useState<Record<MarketSeries, number[]> | null>(null);
  useEffect(() => {
    if (!days) return;
    let cancelled = false;
    setHist(null);
    fetch(`/api/market-history/${chainId}?days=${days}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { prices?: number[]; marketCaps?: number[] } | null) => {
        if (cancelled || !data?.prices?.length) return;
        const cut = (arr: number[]) => arr.slice(-n);
        setHist({ price: cut(data.prices), marketCap: cut(data.marketCaps ?? []) });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [chainId, days, n]);
  return hist;
}

const FIG =
  "min-w-0 truncate font-mono text-xl tabular-nums tracking-tight text-zinc-900 sm:text-2xl dark:text-zinc-50";
const UNIT = "ml-1.5 text-sm font-normal tracking-normal text-zinc-400 dark:text-zinc-500";

/** the clock's window of a daily series, oldest first */
function windowSeries(points: SeriesPoint[] | undefined, n: number): number[] {
  if (!points?.length) return [];
  return [...points]
    .sort((a, b) => a.timestamp - b.timestamp)
    .slice(-n)
    .map((p) => num(p.value) ?? 0);
}

/** two daily series joined on their day, oldest first: a / b */
function ratioSeries(a: SeriesPoint[] | undefined, b: SeriesPoint[] | undefined, n: number): number[] {
  if (!a?.length || !b?.length) return [];
  const byDay = new Map(b.map((p) => [p.date, num(p.value) ?? 0]));
  return [...a]
    .sort((x, y) => x.timestamp - y.timestamp)
    .slice(-n)
    .map((p) => {
      const d = byDay.get(p.date) ?? 0;
      return d > 0 ? (num(p.value) ?? 0) / d : 0;
    });
}

/** bucket a long series down to the trace's point budget, by mean */
function bucket(values: number[], max: number): number[] {
  if (values.length <= max) return values;
  const size = values.length / max;
  const out: number[] = [];
  for (let i = 0; i < max; i++) {
    const slice = values.slice(Math.floor(i * size), Math.floor((i + 1) * size));
    out.push(slice.reduce((s, v) => s + v, 0) / slice.length);
  }
  return out;
}

/** a hairline of the series, no axes: the figure's shape, not its scale */
function Spark({ values, className }: { values: number[]; className?: string }) {
  const pts = bucket(values, SPARK_MAX_POINTS);
  if (pts.length < 2) return null;
  const W = 100;
  const H = 24;
  const min = Math.min(...pts);
  const span = Math.max(...pts) - min || 1;
  const xy = pts.map((v, i) => [((i / (pts.length - 1)) * W).toFixed(2), (H - 1 - ((v - min) / span) * (H - 2)).toFixed(2)]);
  const d = xy.map(([x, y]) => `${x},${y}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden className={cn("h-10 min-w-16 max-w-44 flex-1", className)}>
      {/* the floor under the line gives the eye a shape, not just a thread */}
      <polygon points={`0,${H} ${d} ${W},${H}`} className="fill-zinc-900/[0.09] dark:fill-zinc-50/[0.12]" />
      <polyline points={d} fill="none" strokeWidth={1.5} vectorEffect="non-scaling-stroke" strokeLinejoin="round" className="stroke-zinc-700 dark:stroke-zinc-200" />
    </svg>
  );
}

/* the trace band: 40 CSS px tall at the block's foot, under the text */
const BAND_PX = 40;
const BAND_H = 40;

/** where a series ends inside the band, as a share of the band's height:
 *  the block's right face fills to this level so the trace reads as a
 *  solid passing through the box, not a picture on its front */
function bandLevel(values: number[] | undefined): number | null {
  if (!values || values.length < 2) return null;
  const pts = bucket(values, SPARK_MAX_POINTS);
  const min = Math.min(...pts);
  const span = Math.max(...pts) - min || 1;
  return ((pts[pts.length - 1] - min) / span) * ((BAND_H - 4) / BAND_H) + 1 / BAND_H;
}

/** the trace as the block's liquid: the area under the line filled in
 *  the tape's block gray, one flat tone, a crisp top edge, the level
 *  carried onto the shaded right face. The same vessel the block tape
 *  draws, poured to a curve instead of a line. */
function SparkBand({ values }: { values: number[] }) {
  const pts = bucket(values, SPARK_MAX_POINTS);
  if (pts.length < 2) return null;
  const W = 100;
  const H = BAND_H;
  const min = Math.min(...pts);
  const span = Math.max(...pts) - min || 1;
  const yOf = (v: number) => H - 1 - ((v - min) / span) * (H - 4);
  const d = pts.map((v, i) => `${((i / (pts.length - 1)) * W).toFixed(2)},${yOf(v).toFixed(2)}`).join(" ");
  return (
    <span aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0" style={{ height: BAND_PX }}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-full w-full">
        <polygon points={`0,${H} ${d} ${W},${H}`} className="fill-[#A2AFB2]/40 dark:fill-[#A2AFB2]/30" />
        <polyline points={d} fill="none" strokeWidth={1.25} vectorEffect="non-scaling-stroke" strokeLinejoin="round" className="stroke-zinc-700 dark:stroke-zinc-300" />
      </svg>
    </span>
  );
}

/** figure, unit, trace on one line: the unit steps down beside the
 *  number, the trace sits right, on the number's baseline */
function Figure({ value, unit, spark }: { value: React.ReactNode; unit?: string; spark?: number[] }) {
  return (
    <span className="flex items-end justify-between gap-6">
      <span className={cn(FIG, "shrink-0")}>
        {value}
        {unit && <span className={UNIT}>{unit}</span>}
      </span>
      {spark && spark.length >= 2 && <Spark values={spark} />}
    </span>
  );
}

/* The live readout: one bar, four readings, what is true this second.
   Label and figure on one line so the bar stays short; the market cells
   carry their trace at right. It sits between the search and the live
   boards, so the page reads: identity, pulse, ledger, then the clocked
   readings below. */
export function LiveReadout({ chainId, cells }: { chainId: string; cells: LiveCell[] }) {
  const clock = useExplorerTimeRange();
  const n = RANGE_DAYS[clock];
  const market = useMarketHistory(chainId, n, cells.some((c) => c.series));
  if (cells.length === 0) return null;
  // the readings as blocks: each cell is an extruded cuboid in the sheet's
  // axonometric projection, the same faces the block tape draws, so the
  // live row reads as the digital-blocks motif rather than a table
  const DEPTH = "0.5rem";
  return (
    <div className={cn("grid grid-cols-2 gap-x-4 gap-y-5 pr-2 pt-2", cells.length >= 5 ? "lg:grid-cols-5" : "lg:grid-cols-4")}>
      {cells.map((c) => {
          const spark = c.values ?? (c.series && n >= SPARK_MIN_DAYS ? market?.[c.series] : undefined);
          const move = c.series ? windowMove(c, n, market?.[c.series]) : null;
          const level = bandLevel(spark);
          const body = (
            <>
              {c.live && <LiveDot className="mt-1.5 shrink-0" />}
              <span className="relative z-10 flex min-w-0 flex-col gap-1">
                <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">{c.label}</span>
                <span className="flex min-w-0 flex-wrap items-baseline gap-x-2">
                  <span className="text-[22px] font-bold leading-none tracking-[-0.02em] tabular-nums text-zinc-900 [font-family:Aeonik,var(--font-sans),sans-serif] dark:text-zinc-50">
                    {c.value}
                    {c.unit && <span className="ml-1 font-mono text-[12px] font-normal tracking-normal text-zinc-400 dark:text-zinc-500">{c.unit}</span>}
                  </span>
                  {move && (
                    <span className={cn("font-mono text-[10px] tabular-nums tracking-[0.04em]", move.pct >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-[#E6212F]")}>
                      {move.pct >= 0 ? "+" : ""}
                      {move.pct.toFixed(2)}% <span className="text-zinc-400 dark:text-zinc-500">{move.span}</span>
                    </span>
                  )}
                  {c.sub != null && <span className="font-mono text-[10px] tracking-[0.04em] text-zinc-400 dark:text-zinc-500">{c.sub}</span>}
                </span>
              </span>
              {spark && spark.length >= 2 && <SparkBand values={spark} />}
            </>
          );
          const face =
            "relative flex h-full items-start gap-3 overflow-hidden border border-zinc-200 bg-white px-5 pb-12 pt-3 transition-[background-color,translate] duration-200 ease-out group-hover:-translate-y-1 dark:border-zinc-800 dark:bg-zinc-950 md:px-6";
          return (
            <div key={c.label} className="group relative">
              {/* top face, lit */}
              <span
                aria-hidden
                className="absolute -top-2 left-0 w-full origin-bottom-left skew-x-[-45deg] border border-b-0 border-zinc-200 bg-zinc-100 transition-transform duration-200 ease-out group-hover:-translate-y-1 dark:border-zinc-800 dark:bg-zinc-800"
                style={{ height: DEPTH }}
              />
              {/* right face, shaded; the trace's level wraps onto it */}
              <span
                aria-hidden
                className="absolute -right-2 top-0 h-full origin-top-left skew-y-[-45deg] overflow-hidden border border-l-0 border-zinc-200 bg-zinc-200 transition-transform duration-200 ease-out group-hover:-translate-y-1 dark:border-zinc-800 dark:bg-zinc-900"
                style={{ width: DEPTH }}
              >
                {level !== null && (
                  <span
                    className="absolute inset-x-0 bottom-0 border-t border-zinc-700/60 bg-[#A2AFB2]/70 dark:border-zinc-300/60 dark:bg-[#A2AFB2]/50"
                    style={{ height: Math.round(level * BAND_PX) }}
                  />
                )}
              </span>
              {c.href ? (
                <Link href={c.href} className={cn(face, "hover:bg-zinc-50 dark:hover:bg-zinc-900")}>
                  {body}
                </Link>
              ) : (
                <div className={face}>{body}</div>
              )}
            </div>
          );
        })}
    </div>
  );
}

export interface LiveCell {
  label: string;
  value: React.ReactNode;
  unit?: string;
  sub?: React.ReactNode;
  href?: string;
  live?: boolean;
  /** which market series traces this figure over the clock's window */
  series?: MarketSeries;
  /** the live number behind `value`, for the move against the window's start */
  raw?: number;
  /** the exchange's own 24h move, used when the clock is on a day */
  change24h?: number;
  /** a series of the cell's own, oldest first, drawn as the block's trace */
  values?: number[];
}

/** how far a live figure has moved since the clock window opened: the
 *  window's first daily close against the live figure; on the day clock,
 *  the market's own 24h number */
function windowMove(c: LiveCell, n: number, series: number[] | undefined): { pct: number; span: string } | null {
  if (n <= 1) return c.change24h !== undefined ? { pct: c.change24h, span: "24h" } : null;
  if (c.raw === undefined || !series || series.length < 2 || series[0] <= 0) return null;
  const span = n <= 7 ? "7d" : n <= 30 ? "30d" : n <= 90 ? "90d" : "1y";
  return { pct: (c.raw / series[0] - 1) * 100, span };
}

export function EvmOverviewStats({
  chainId,
  base,
  symbol = "AVAX",
  usdPrice,
  usdSettled = true,
}: {
  chainId: string;
  base: string;
  symbol?: string;
  /** native token USD price when the token is listed; fees stay native without it */
  usdPrice: number | null;
  /** the price fetch resolved: USD-or-native cells hold until then so a
   *  late price never flips an already-painted native figure to dollars */
  usdSettled?: boolean;
}) {
  // the page clock: window sums/averages and their vs-prev move all ride it
  const clock = useExplorerTimeRange();
  const n = RANGE_DAYS[clock];
  const windowLabel = rangeWindowLabel(clock);
  // fetch double the window so the previous window is comparable; the
  // all-time tick fetches the genesis window as-is (there is no previous
  // window to face, so the deltas sit out)
  const { metrics, failed } = useChainMetrics(
    chainId,
    clock === "all" ? n : Math.min(n * 2, 365),
    METRICS,
  );
  const util = useUtilization(chainId, n);

  const m = metrics ?? {};
  const win = (key: string, mode: "sum" | "avg" = "sum") => windowPair(m[key]?.data, n, mode);
  const trace = (key: string) => (n >= SPARK_MIN_DAYS ? windowSeries(m[key]?.data, n) : undefined);

  const derived = useMemo(() => {
    const txs = windowPair(m["txCount"]?.data, n, "sum");
    const fees = windowPair(m["feesPaid"]?.data, n, "sum");
    const avgFee =
      fees && txs && txs.cur > 0
        ? {
            cur: fees.cur / txs.cur,
            prev: fees.prev !== null && txs.prev !== null && txs.prev > 0 ? fees.prev / txs.prev : null,
          }
        : null;
    const avgFeeTrace = n >= SPARK_MIN_DAYS ? ratioSeries(m["feesPaid"]?.data, m["txCount"]?.data, n) : undefined;
    return { avgFee, avgFeeTrace };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metrics, n]);

  if (failed) return null;

  /* one windowed reading. The sub line carries the qualifier, then the
     move against the previous window when there is one; a separator only
     ever stands between two things. */
  const cell = (
    label: string,
    href: string,
    p: WindowPair | null,
    fmt: (v: number) => React.ReactNode,
    opts: { unit?: string; sub?: React.ReactNode; spark?: number[] } = {},
  ) => {
    const delta = pctOf(p);
    return (
      <StatCell
        key={label}
        label={label}
        href={href}
        even
        sub={
          opts.sub != null || delta !== null ? (
            <>
              {opts.sub}
              {opts.sub != null && delta !== null ? " · " : null}
              <Delta value={delta} />
            </>
          ) : undefined
        }
      >
        {p ? (
          <Figure value={fmt(p.cur)} unit={opts.unit} spark={opts.spark} />
        ) : metrics ? (
          <StatDash />
        ) : (
          <span className={FIG}>…</span>
        )}
      </StatCell>
    );
  };

  const grid =
    "grid grid-cols-2 divide-x divide-y divide-zinc-200 max-lg:[&>*:nth-child(odd)]:border-l-0 lg:grid-cols-4 lg:divide-y-0 dark:divide-zinc-800";
  const rowRule = "border-b border-zinc-200 dark:border-zinc-800";
  const feesUsd = usdPrice !== null && win("feesPaid") ? `$${fmtCompact(win("feesPaid")!.cur * usdPrice)}` : undefined;

  return (
    <Board divide={false} className="border">
      {/* the window is stated once, up here; every cell below follows it */}
      <BoardHeader
        label="Chain Stats"
        display
        action={
          <span className="shrink-0 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-400 dark:text-zinc-500">
            {windowLabel}
          </span>
        }
      />
      {/* the clock's window, against the window before it */}
      <div className={cn(grid, rowRule)}>
        {cell(`Transactions`, `${base}/txs`, win("txCount"), fmtCompact, { spark: trace("txCount") })}
        {cell(`Active Addresses`, `${base}/accounts`, win("activeAddresses", "avg"), fmtCompact, {
          sub: n > 1 ? "daily average" : undefined,
          spark: trace("activeAddresses"),
        })}
        {cell(`Contracts Deployed`, `${base}/accounts`, win("contracts"), fmtCompact, { spark: trace("contracts") })}
        {cell(`Gas Used`, `${base}/gas`, win("gasUsed"), fmtCompact, { spark: trace("gasUsed") })}
      </div>
      <div className={grid}>
        {cell(
          // the C-Chain burns every fee; sovereign L1s choose their own
          // fee destination, so the generic label stays honest there
          chainId === "43114" ? `Fees Burned` : `Fees Paid`,
          `${base}/gas`,
          win("feesPaid"),
          fmtCompact,
          { unit: symbol, sub: feesUsd, spark: trace("feesPaid") },
        )}
        {cell(
          `Avg Tx Fee`,
          `${base}/gas`,
          derived.avgFee,
          // USD when listed, native once the price feed has SETTLED without
          // one; never native-then-dollars as the price straggles in
          (v) =>
            usdPrice !== null
              ? `$${(v * usdPrice).toFixed(4)}`
              : usdSettled
                ? `${v.toFixed(5)} ${symbol}`
                : "…",
          {
            sub: usdPrice !== null && derived.avgFee ? `${derived.avgFee.cur.toFixed(5)} ${symbol}` : undefined,
            spark: derived.avgFeeTrace,
          },
        )}
        {cell(`Avg Gas Price`, `${base}/gas/base-fee`, win("avgGasPrice", "avg"), (v) => v.toFixed(2), {
          unit: `n${symbol}`,
          spark: trace("avgGasPrice"),
        })}
        {cell(`Utilization`, `${base}/gas/utilization`, util?.pair ?? null, (v) => v.toFixed(1), {
          unit: "%",
          sub: "of gas limit",
          spark: n >= SPARK_MIN_DAYS ? util?.series : undefined,
        })}
      </div>
    </Board>
  );
}
