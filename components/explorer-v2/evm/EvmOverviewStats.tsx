"use client";

import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { Board, BoardHeader, StatCell, StatDash } from "@/components/explorer-v2/ui";
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
function Spark({ values }: { values: number[] }) {
  const pts = bucket(values, SPARK_MAX_POINTS);
  if (pts.length < 2) return null;
  const W = 100;
  const H = 24;
  const min = Math.min(...pts);
  const span = Math.max(...pts) - min || 1;
  const d = pts.map((v, i) => `${((i / (pts.length - 1)) * W).toFixed(2)},${(H - 1 - ((v - min) / span) * (H - 2)).toFixed(2)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden className="h-6 w-20 shrink-0">
      <polyline points={d} fill="none" strokeWidth={1} vectorEffect="non-scaling-stroke" className="stroke-zinc-300 dark:stroke-zinc-700" />
    </svg>
  );
}

/** figure, unit, trace on one line: the unit steps down beside the
 *  number, the trace sits right, on the number's baseline */
function Figure({ value, unit, spark }: { value: React.ReactNode; unit?: string; spark?: number[] }) {
  return (
    <span className="flex items-end justify-between gap-4">
      <span className={FIG}>
        {value}
        {unit && <span className={UNIT}>{unit}</span>}
      </span>
      {spark && spark.length >= 2 && <Spark values={spark} />}
    </span>
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
}

export function EvmOverviewStats({
  chainId,
  base,
  symbol = "AVAX",
  usdPrice,
  usdSettled = true,
  liveCells = [],
}: {
  chainId: string;
  base: string;
  symbol?: string;
  /** native token USD price when the token is listed; fees stay native without it */
  usdPrice: number | null;
  /** the price fetch resolved: USD-or-native cells hold until then so a
   *  late price never flips an already-painted native figure to dollars */
  usdSettled?: boolean;
  /** the live figures (price, block time, latest block …), the same small
   *  cells, first row of the grid */
  liveCells?: LiveCell[];
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
  const market = useMarketHistory(chainId, n, liveCells.some((c) => c.series));

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
      {/* the window is stated once, up here; cells only carry a label
          when they DON'T follow it (· Total, the live row, 24h subs) */}
      <BoardHeader
        label="Chain Stats"
        display
        action={
          <span className="shrink-0 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-400 dark:text-zinc-500">
            {windowLabel}
          </span>
        }
      />
      {/* right now: the live market row */}
      {liveCells.length > 0 && (
        <div className={cn(grid, rowRule)}>
          {liveCells.map((c) => (
            <StatCell key={c.label} label={c.label} href={c.href} sub={c.sub} live={c.live} even>
              <Figure value={c.value} unit={c.unit} spark={c.series && n >= SPARK_MIN_DAYS ? market?.[c.series] : undefined} />
            </StatCell>
          ))}
        </div>
      )}
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
