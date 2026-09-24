"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { TipPlate } from "@/components/explorer-v2/staking/bits";
import { RANGE_DAYS, useExplorerTimeRange, type ExplorerRange } from "@/components/explorer-v2/time-range";
import { fmtCompact, metricSeries, useChainMetrics } from "./metric-charts";
import { ReadoutBlock } from "./EvmOverviewStats";

/* What the chain is FOR: the overview's activity, on the page clock, as
 * one large readout block. The daily transactions pour into the block as
 * liquid, the same vessel the readings above use. On the C-Chain the
 * liquid is layered by on-chain behavior (ClickHouse via
 * /api/cchain-activity?days=…), one ink per behavior, biggest at the
 * floor; everywhere else it is one layer in the chain's accent, off the
 * chain-stats indexer.
 * Either block doors into the Transactions tab. Both render nothing until
 * data exists, so unindexed chains lose no vertical space. */

interface CchainActivityDay {
  date: string;
  defi: number;
  nft: number;
  tokens: number;
  other: number;
}

type ActivityKey = keyof Omit<CchainActivityDay, "date">;

/* each behavior in an ink the page already speaks: tokens in the
   identifier blue, DeFi in the method violet, NFTs in amber, the rest in
   the block gray */
const ACTIVITY_SERIES: { key: ActivityKey; label: string; what: string; tone: string }[] = [
  { key: "tokens", label: "Tokens", what: "ERC-20 transfers", tone: "#0061E2" },
  { key: "other", label: "Other", what: "AVAX sends and calls with no token, NFT or swap event", tone: "#A2AFB2" },
  { key: "defi", label: "DeFi", what: "swaps on Uniswap-style pools and LFJ Liquidity Book", tone: "#7c3aed" },
  { key: "nft", label: "NFT", what: "ERC-721 and ERC-1155 transfers", tone: "#d97706" },
];

/* the served window per clock tick: the classification can't afford a
   year (it spills past 90d), and a 1-point day chart says nothing; both
   ends clamp and the label states the exception */
const ACTIVITY_DAYS: Record<ExplorerRange, 7 | 30 | 90> = {
  day: 7,
  week: 7,
  month: 30,
  quarter: 90,
  year: 90,
  all: 90,
};

/* the liquid's strengths: each layer poured translucent in its own ink so
   it still reads as fluid; a focused layer fills in, the rest recede */
const POUR = 0.55;
const SIDE_POUR = 0.8;
const FOCUSED = 0.9;
const RECEDED = 0.1;

/* the liquid's height in CSS px; the right face fills on the same scale */
const CHART_PX = 176;
const W = 1000;

interface Layer {
  key: string;
  label: string;
  what?: string;
  /** any CSS color, var() included */
  tone: string;
}
interface Day {
  date: string;
  v: Record<string, number>;
}

/** An SVG path through points as a monotone cubic (Fritsch-Carlson):
 *  the curve bends between samples but never rises above or dips below
 *  the neighbouring values, so a smooth line still tells the truth. */
function monotonePath(p: readonly (readonly [number, number])[]): string {
  const n = p.length;
  if (n === 0) return "";
  const f = (v: number) => v.toFixed(1);
  if (n < 3) return p.map(([px, py], i) => `${i ? "L" : "M"}${f(px)},${f(py)}`).join(" ");
  const dx: number[] = [];
  const m: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dx.push(p[i + 1][0] - p[i][0]);
    m.push(dx[i] === 0 ? 0 : (p[i + 1][1] - p[i][1]) / dx[i]);
  }
  const t: number[] = [m[0]];
  for (let i = 1; i < n - 1; i++) t.push(m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2);
  t.push(m[n - 2]);
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) {
      t[i] = 0;
      t[i + 1] = 0;
      continue;
    }
    const a = t[i] / m[i];
    const b = t[i + 1] / m[i];
    const h = a * a + b * b;
    if (h > 9) {
      const k = 3 / Math.sqrt(h);
      t[i] = k * a * m[i];
      t[i + 1] = k * b * m[i];
    }
  }
  let d = `M${f(p[0][0])},${f(p[0][1])}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3;
    d += ` C${f(p[i][0] + h)},${f(p[i][1] + t[i] * h)} ${f(p[i + 1][0] - h)},${f(p[i + 1][1] - t[i + 1] * h)} ${f(p[i + 1][0])},${f(p[i + 1][1])}`;
  }
  return d;
}

/** one day as "Aug 24", whether the feed sends a label or an ISO date */
function dayLabel(date: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

/** The activity as a large block: a header with the window's readings,
 *  the layered liquid at the foot, a hairline that follows the cursor and
 *  a plate with the day's breakdown. */
function ActivityBlock({
  label,
  href,
  days,
  layers,
  note,
  stale,
}: {
  label: string;
  href?: string;
  days: Day[];
  /** floor up; one layer draws a single fluid */
  layers: Layer[];
  /** a clamp the clock could not honor, said once beside the label */
  note?: string | null;
  stale?: boolean;
}) {
  const [focus, setFocus] = useState<string | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const plot = useRef<HTMLDivElement>(null);

  const total = (d: Day) => layers.reduce((s, l) => s + (d.v[l.key] ?? 0), 0);
  const sums = useMemo(() => {
    const out: Record<string, number> = { all: 0 };
    for (const l of layers) out[l.key] = days.reduce((s, d) => s + (d.v[l.key] ?? 0), 0);
    out.all = layers.reduce((s, l) => s + out[l.key], 0);
    return out;
  }, [days, layers]);
  const max = Math.max(1, ...days.map(total)) * 1.08;
  const perDay = days.length ? sums.all / days.length : 0;
  const multi = layers.length > 1;
  // the legend reads biggest first; the strata stay in floor-up order
  const bySize = [...layers].sort((a, b) => sums[b.key] - sums[a.key]);

  const x = (i: number) => (days.length > 1 ? (i / (days.length - 1)) * W : W / 2);
  const y = (v: number) => CHART_PX - (v / max) * CHART_PX;
  // cumulative tops per layer, floor up
  const stacks = useMemo(() => {
    const acc = days.map(() => 0);
    return layers.map((l) => {
      const lo = [...acc];
      days.forEach((d, i) => (acc[i] += d.v[l.key] ?? 0));
      return { key: l.key, lo, hi: [...acc] };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days, layers]);
  // each boundary as a monotone curve: smooth between days, never
  // overshooting a day's real value; a band is its top curve out and its
  // floor curve back, so neighbouring layers share one edge exactly
  const pts = (vals: number[]) => vals.map((v, i) => [x(i), y(v)] as const);
  const band = (lo: number[], hi: number[]) => {
    return `${monotonePath(pts(hi))} ${monotonePath(pts(lo).reverse()).replace(/^M/, "L")} Z`;
  };
  const topLine = stacks.length ? monotonePath(pts(stacks[stacks.length - 1].hi)) : "";
  const last = days.length - 1;

  const strength = (key: string, side = false) =>
    focus === null ? (side ? SIDE_POUR : POUR) : focus === key ? FOCUSED : RECEDED;

  const onMove = (e: React.MouseEvent) => {
    const r = plot.current?.getBoundingClientRect();
    if (!r || days.length < 2) return;
    const t = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    setHover(Math.round(t * last));
  };
  const hd = hover !== null ? days[hover] : null;

  // the right face carries the last day's strata at the same scale
  const side = (
    <span className="absolute inset-x-0 bottom-0 flex flex-col-reverse" style={{ height: CHART_PX }}>
      {layers.map((l, i) => (
        <span
          key={l.key}
          className={cn("relative w-full shrink-0", i === layers.length - 1 && "border-t border-zinc-700/60 dark:border-zinc-300/60")}
          style={{ height: days.length ? ((days[last].v[l.key] ?? 0) / max) * CHART_PX : 0 }}
        >
          <span className="absolute inset-0 transition-opacity" style={{ background: l.tone, opacity: strength(l.key, true) }} />
        </span>
      ))}
    </span>
  );

  return (
    <div className={cn("pr-2 pt-2 transition-opacity", stale && "opacity-60")}>
      <ReadoutBlock href={href} side={side} className="flex-col">
        {/* the window's readings: how much, how fast, and of what kind */}
        <div className="relative z-10 flex flex-wrap items-start justify-between gap-x-8 gap-y-3 px-5 pt-3 md:px-6">
          <span className="flex min-w-0 flex-col gap-1.5">
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
              {label}
              {note && <span className="font-normal text-zinc-400 dark:text-zinc-500"> · {note}</span>}
            </span>
            <span className="flex flex-wrap items-baseline gap-x-2">
              <span className="text-[22px] font-bold leading-none tracking-[-0.02em] tabular-nums text-zinc-900 [font-family:Aeonik,var(--font-sans),sans-serif] dark:text-zinc-50">
                {fmtCompact(sums.all)}
                <span className="ml-1 font-mono text-[12px] font-normal tracking-normal text-zinc-400 dark:text-zinc-500">txns</span>
              </span>
              <span className="font-mono text-[10px] tracking-[0.04em] text-zinc-400 dark:text-zinc-500">
                {fmtCompact(perDay)} per day{days.length > 1 ? ` · ${dayLabel(days[0].date)} to ${dayLabel(days[last].date)}` : ""}
              </span>
            </span>
          </span>
          {multi && (
            <span className="flex flex-wrap items-center gap-x-5 gap-y-1 pt-0.5 font-mono text-[10px] uppercase tracking-[0.12em]" onMouseLeave={() => setFocus(null)}>
              {bySize.map((l) => {
                return (
                  <button
                    key={l.key}
                    type="button"
                    onMouseEnter={() => setFocus(l.key)}
                    onFocus={() => setFocus(l.key)}
                    onBlur={() => setFocus(null)}
                    onClick={(e) => e.preventDefault()}
                    title={l.what}
                    className={cn("flex items-center gap-1.5 transition-opacity", focus && focus !== l.key ? "opacity-40" : "opacity-100")}
                  >
                    <span className="h-2 w-2" style={{ background: l.tone }} />
                    <span className="text-zinc-500 dark:text-zinc-400">{l.label}</span>
                    <span className="tabular-nums text-zinc-900 dark:text-zinc-50">{sums.all > 0 ? ((sums[l.key] / sums.all) * 100).toFixed(0) : 0}%</span>
                  </button>
                );
              })}
            </span>
          )}
        </div>

        {/* the liquid: the window's days, layered floor up, one top edge */}
        <div
          ref={plot}
          className="relative mt-6"
          style={{ height: CHART_PX }}
          onMouseMove={onMove}
          onMouseLeave={() => setHover(null)}
        >
          {/* the scale, said once: the window's peak */}
          <span className="pointer-events-none absolute inset-x-0 border-t border-dashed border-zinc-200 dark:border-zinc-800" style={{ top: y(max / 1.08) }}>
            <span className="absolute right-3 -top-4 font-mono text-[9px] tabular-nums text-zinc-400 md:right-4 dark:text-zinc-500">
              peak {fmtCompact(max / 1.08)}
            </span>
          </span>
          <svg viewBox={`0 0 ${W} ${CHART_PX}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden>
            {stacks.map((st, i) => (
              <path
                key={st.key}
                d={band(st.lo, st.hi)}
                fill={layers[i].tone}
                fillOpacity={strength(st.key)}
                className="transition-[fill-opacity] duration-200"
              />
            ))}
            <path d={topLine} fill="none" strokeWidth={1.25} vectorEffect="non-scaling-stroke" strokeLinejoin="round" className="stroke-zinc-700 dark:stroke-zinc-300" />
          </svg>
          {hd && (
            <>
              <span
                className="pointer-events-none absolute inset-y-0 w-px bg-zinc-900/40 dark:bg-zinc-100/40"
                style={{ left: `${(x(hover!) / W) * 100}%` }}
              />
              <span
                className="pointer-events-none absolute top-2 z-20"
                style={
                  hover! > last / 2
                    ? { right: `calc(${100 - (x(hover!) / W) * 100}% + 10px)` }
                    : { left: `calc(${(x(hover!) / W) * 100}% + 10px)` }
                }
              >
                <TipPlate>
                  <p className="font-mono text-[10px] text-zinc-500">
                    {dayLabel(hd.date)} · {total(hd).toLocaleString("en-US")} txns
                  </p>
                  {multi &&
                    bySize.map((l) => (
                      <p key={l.key} className="flex items-center justify-between gap-4 font-mono text-[11px] tabular-nums text-zinc-900 dark:text-zinc-100">
                        <span className="flex items-center gap-1.5">
                          <span className="h-1.5 w-1.5" style={{ background: l.tone }} />
                          {l.label}
                        </span>
                        <span>
                          {(hd.v[l.key] ?? 0).toLocaleString("en-US")}
                          <span className="ml-2 text-[10px] text-zinc-400">{total(hd) > 0 ? `${(((hd.v[l.key] ?? 0) / total(hd)) * 100).toFixed(0)}%` : ""}</span>
                        </span>
                      </p>
                    ))}
                </TipPlate>
              </span>
            </>
          )}
        </div>
      </ReadoutBlock>
    </div>
  );
}

export function CchainActivityChart({ href }: { href?: string }) {
  const clock = useExplorerTimeRange();
  const served = ACTIVITY_DAYS[clock];
  const exception = clock === "day" ? "7 days" : clock === "year" || clock === "all" ? "90 days, longest computed" : null;

  const [activity, setActivity] = useState<CchainActivityDay[] | null>(null);
  const [servedDays, setServedDays] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/cchain-activity?days=${served}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { days: CchainActivityDay[] } | null) => {
        if (!cancelled && data?.days?.length) {
          setActivity(data.days);
          setServedDays(served);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [served]);

  // floor up: the window's biggest behavior at the bottom of the liquid
  const layers = useMemo(() => {
    const sum = (k: ActivityKey) => (activity ?? []).reduce((s, d) => s + d[k], 0);
    return [...ACTIVITY_SERIES].sort((a, b) => sum(b.key) - sum(a.key));
  }, [activity]);
  const days = useMemo(
    () => (activity ?? []).map((d) => ({ date: d.date, v: { defi: d.defi, nft: d.nft, tokens: d.tokens, other: d.other } })),
    [activity],
  );

  if (!activity) return null;
  // a window switch keeps the last payload on screen, dimmed, until the
  // new one lands: same idiom as the gas market
  return <ActivityBlock label="Network Activity" href={href} days={days} layers={layers} note={exception} stale={servedDays !== served} />;
}

// the history charts ride the chain-stats indexer, which serves any clock
const TX_METRICS = "txCount";
const TX_LAYER: Layer[] = [{ key: "a", label: "Transactions", tone: "var(--chain-accent, #A2AFB2)" }];

export function TxHistoryChart({ chainId, href }: { chainId: number | string; href?: string }) {
  const clock = useExplorerTimeRange();
  const range = RANGE_DAYS[clock];
  // a 1-point day chart says nothing: floor at a week, label the exception
  const windowDays = Math.max(7, range);
  const { metrics } = useChainMetrics(String(chainId), windowDays, TX_METRICS);

  const days = useMemo(
    () => metricSeries(metrics ?? {}, windowDays, "txCount").map((p) => ({ date: p.date, v: { a: p.a } })),
    [metrics, windowDays],
  );

  if (!days.length) return null;
  return <ActivityBlock label="Transactions" href={href} days={days} layers={TX_LAYER} note={clock === "day" ? "7 days" : null} />;
}
