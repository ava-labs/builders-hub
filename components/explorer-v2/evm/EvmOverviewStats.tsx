"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { LiveDot, SectionHeader } from "@/components/explorer-v2/ui";
import { RANGE_DAYS, rangeWindowLabel, useExplorerTimeRange } from "@/components/explorer-v2/time-range";
import {
  fmtCompact,
  num,
  pctOf,
  useChainMetrics,
  windowPair,
  type SeriesPoint,
  type WindowPair,
} from "./metric-charts";

/* The chain's readings as blocks: the live row up top, then the clock's
   window below it with its move against the previous window of the same
   length. Every reading is the same cuboid: label, figure, one qualifying
   line, and the daily series poured into its foot as liquid. Every block
   doors into the tab that charts it. */

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

/* utilization and gas used off the blocks table, windowed on the clock;
   404 = not ingested. Complete UTC days only: today's partial day would
   read as a collapse at the window's end. Gas comes from here, not the
   chain-stats indexer, because the blocks table is what the RPC agrees
   with (the indexer's daily gasUsed lagged the chain on 2026-09-22/23). */
type GasDay = { d: string; utilPct: number; gas: number };
function useGasHistory(chainId: string, n: number) {
  const days = 2 * n <= 7 ? 7 : 2 * n <= 30 ? 30 : 2 * n <= 90 ? 90 : 365;
  const [out, setOut] = useState<Record<"util" | "gas", { pair: WindowPair; series: number[] }> | null>(null);
  useEffect(() => {
    let cancelled = false;
    setOut(null);
    fetch(`/api/gas-history/${chainId}?days=${days}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { daily?: GasDay[] } | null) => {
        const today = new Date().toISOString().slice(0, 10);
        const d = data?.daily?.filter((p) => p.d < today);
        if (cancelled || !d || !d.length) return;
        const cur = d.slice(-n);
        const prev = d.slice(-2 * n, -n);
        const read = (pick: (p: GasDay) => number, mode: "sum" | "avg") => {
          const take = (arr: GasDay[]) => {
            const total = arr.reduce((s, p) => s + pick(p), 0);
            return mode === "sum" ? total : total / arr.length;
          };
          return {
            pair: { cur: take(cur), prev: prev.length === n ? take(prev) : null },
            series: cur.map(pick),
          };
        };
        setOut({ util: read((p) => p.utilPct, "avg"), gas: read((p) => p.gas, "sum") });
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

/* the cuboid's depth: the same axonometric faces the block tape draws */
const DEPTH = "0.5rem";

/** One reading as an extruded block: a lit top face, a shaded right
 *  face, the front face holding the content. `side` pours into the right
 *  face from the bottom, so a trace inside reads as a solid passing
 *  through the box. The whole block lifts on hover when it is a door. */
export function ReadoutBlock({
  href,
  side,
  className,
  children,
}: {
  href?: string;
  /** what fills the right face, anchored to its bottom */
  side?: React.ReactNode;
  /** the front face's layout and padding */
  className?: string;
  children: React.ReactNode;
}) {
  const face = cn(
    "relative flex h-full overflow-hidden border border-zinc-200 bg-white transition-[background-color,translate] duration-200 ease-out group-hover:-translate-y-1 dark:border-zinc-800 dark:bg-zinc-950",
    className,
  );
  return (
    <div className="group relative">
      {/* top face, lit */}
      <span
        aria-hidden
        className="absolute -top-2 left-0 w-full origin-bottom-left skew-x-[-45deg] border border-b-0 border-zinc-200 bg-zinc-100 transition-transform duration-200 ease-out group-hover:-translate-y-1 dark:border-zinc-800 dark:bg-zinc-800"
        style={{ height: DEPTH }}
      />
      {/* right face, shaded */}
      <span
        aria-hidden
        className="absolute -right-2 top-0 h-full origin-top-left skew-y-[-45deg] overflow-hidden border border-l-0 border-zinc-200 bg-zinc-200 transition-transform duration-200 ease-out group-hover:-translate-y-1 dark:border-zinc-800 dark:bg-zinc-900"
        style={{ width: DEPTH }}
      >
        {side}
      </span>
      {href ? (
        <Link href={href} className={cn(face, "hover:bg-zinc-50 dark:hover:bg-zinc-900")}>
          {children}
        </Link>
      ) : (
        <div className={face}>{children}</div>
      )}
    </div>
  );
}

/** the trace's end level carried onto the right face */
function SideLevel({ level }: { level: number | null }) {
  if (level === null) return null;
  return (
    <span
      className="absolute inset-x-0 bottom-0 border-t border-zinc-700/60 bg-[#A2AFB2]/70 dark:border-zinc-300/60 dark:bg-[#A2AFB2]/50"
      style={{ height: Math.round(level * BAND_PX) }}
    />
  );
}

/* the readings' shared voices */
const LABEL = "font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400";
const FIGURE =
  "text-[22px] font-bold leading-none tracking-[-0.02em] tabular-nums text-zinc-900 [font-family:Aeonik,var(--font-sans),sans-serif] dark:text-zinc-50";
const FIG_UNIT = "ml-1 font-mono text-[12px] font-normal tracking-normal text-zinc-400 dark:text-zinc-500";
const SUB = "font-mono text-[10px] tracking-[0.04em] text-zinc-400 dark:text-zinc-500";
const BLOCK_FACE = "items-start gap-3 px-5 pb-12 pt-3 md:px-6";

/* The live readout: what is true this second, as a row of blocks. It
   sits between the search and the live boards, so the page reads:
   identity, pulse, ledger, then the clocked readings below. */
export function LiveReadout({ chainId, cells }: { chainId: string; cells: LiveCell[] }) {
  const clock = useExplorerTimeRange();
  const n = RANGE_DAYS[clock];
  const market = useMarketHistory(chainId, n, cells.some((c) => c.series));
  if (cells.length === 0) return null;
  return (
    <div className={cn("grid grid-cols-2 gap-x-4 gap-y-5 pr-2 pt-2", cells.length >= 5 ? "lg:grid-cols-5" : "lg:grid-cols-4")}>
      {cells.map((c) => {
        const spark = c.values ?? (c.series && n >= SPARK_MIN_DAYS ? market?.[c.series] : undefined);
        const move = c.series ? windowMove(c, n, market?.[c.series]) : null;
        return (
          <ReadoutBlock key={c.label} href={c.href} side={<SideLevel level={bandLevel(spark)} />} className={BLOCK_FACE}>
            {c.live && <LiveDot className="mt-1.5 shrink-0" />}
            <span className="relative z-10 flex min-w-0 flex-col gap-1">
              <span className={LABEL}>{c.label}</span>
              <span className="flex min-w-0 flex-wrap items-baseline gap-x-2">
                <span className={FIGURE}>
                  {c.value}
                  {c.unit && <span className={FIG_UNIT}>{c.unit}</span>}
                </span>
                {move && (
                  <span className={cn("font-mono text-[10px] tabular-nums tracking-[0.04em]", move.pct >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-[#E6212F]")}>
                    {move.pct >= 0 ? "+" : ""}
                    {move.pct.toFixed(2)}% <span className="text-zinc-400 dark:text-zinc-500">{move.span}</span>
                  </span>
                )}
                {c.sub != null && <span className={SUB}>{c.sub}</span>}
              </span>
            </span>
            {spark && spark.length >= 2 && <SparkBand values={spark} />}
          </ReadoutBlock>
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

/** the move against the previous window, in ink: an arrow and a number.
 *  Red is the burn's color on this page, so a falling count never reads
 *  as an alert. */
export function InkDelta({ value }: { value: number | null }) {
  if (value === null) return null;
  const flat = Math.abs(value) < 0.05;
  return (
    <span className="whitespace-nowrap text-zinc-700 dark:text-zinc-300">
      <span className="text-[8px]">{flat ? "■" : value > 0 ? "▲" : "▼"}</span>{" "}
      {Math.abs(value) >= 100 ? Math.abs(value).toFixed(0) : Math.abs(value).toFixed(1)}%
      <span className="text-zinc-400 dark:text-zinc-500"> vs prev</span>
    </span>
  );
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
  const gas = useGasHistory(chainId, n);

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

  // the window's actual days: the indexer's last complete day can trail
  // the calendar, so the header names the days the figures sum
  const span = useMemo(() => {
    const pts = [...(m["txCount"]?.data ?? [])].sort((a, b) => a.timestamp - b.timestamp).slice(-n);
    if (n < 2 || pts.length < 2) return null;
    const day = (iso: string) =>
      new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
    return `${day(pts[0].date)} to ${day(pts[pts.length - 1].date)}`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metrics, n]);

  if (failed) return null;

  /* one windowed reading as a block. The sub line carries the qualifier,
     then the move against the previous window; a separator only ever
     stands between two things. */
  const cell = (
    label: string,
    href: string,
    p: WindowPair | null,
    fmt: (v: number) => React.ReactNode,
    opts: { unit?: string; sub?: React.ReactNode; spark?: number[] } = {},
  ) => {
    const delta = pctOf(p);
    const spark = opts.spark && opts.spark.length >= 2 ? opts.spark : undefined;
    return (
      <ReadoutBlock key={label} href={href} side={<SideLevel level={bandLevel(spark)} />} className={BLOCK_FACE}>
        <span className="relative z-10 flex min-w-0 flex-col gap-1.5">
          <span className={LABEL}>{label}</span>
          <span className={cn(FIGURE, "truncate")}>
            {p ? fmt(p.cur) : metrics ? "—" : "…"}
            {p && opts.unit && <span className={FIG_UNIT}>{opts.unit}</span>}
          </span>
          {(opts.sub != null || delta !== null) && (
            <span className={cn(SUB, "truncate")}>
              {opts.sub}
              {opts.sub != null && delta !== null ? " · " : null}
              <InkDelta value={delta} />
            </span>
          )}
        </span>
        {spark && <SparkBand values={spark} />}
      </ReadoutBlock>
    );
  };

  const feesUsd = usdPrice !== null && win("feesPaid") ? `$${fmtCompact(win("feesPaid")!.cur * usdPrice)}` : undefined;
  // the blocks table's gas where it is ingested; the indexer elsewhere
  const gasPair = gas?.gas.pair ?? win("gasUsed");
  const gasTrace = gas ? (n >= SPARK_MIN_DAYS ? gas.gas.series : undefined) : trace("gasUsed");

  return (
    <section className="flex flex-col gap-4">
      {/* the window is stated once, up here; every block below follows it */}
      <SectionHeader
        label="Chain Stats"
        action={<span className="shrink-0 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-400 dark:text-zinc-500">{windowLabel}
            {span && <span className="font-normal tracking-[0.08em]"> · {span}</span>}
          </span>}
      />
      <div className="grid grid-cols-2 gap-x-4 gap-y-5 pr-2 pt-2 lg:grid-cols-4">
        {cell(`Transactions`, `${base}/txs`, win("txCount"), fmtCompact, { spark: trace("txCount") })}
        {cell(`Active Addresses`, `${base}/accounts`, win("activeAddresses", "avg"), fmtCompact, {
          sub: n > 1 ? "daily average" : undefined,
          spark: trace("activeAddresses"),
        })}
        {cell(`Contracts Deployed`, `${base}/accounts`, win("contracts"), fmtCompact, { spark: trace("contracts") })}
        {cell(`Gas Used`, `${base}/gas`, gasPair, fmtCompact, { spark: gasTrace })}
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
        {cell(`Utilization`, `${base}/gas/utilization`, gas?.util.pair ?? null, (v) => v.toFixed(1), {
          unit: "%",
          sub: "of gas limit",
          spark: n >= SPARK_MIN_DAYS ? gas?.util.series : undefined,
        })}
      </div>
    </section>
  );
}
