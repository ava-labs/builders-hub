"use client";

import { useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowUpRight, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { ChartBoard, INK, MUTED, RowSkeleton, EmptyRow } from "@/components/explorer-v2/ui";
import { TipPlate } from "@/components/explorer-v2/staking/bits";
import { ReadoutBlock } from "@/components/explorer-v2/evm/EvmOverviewStats";
import { MOTION, useReduced } from "@/components/explorer-v2/evm/query/motion";

/* The network facets' shared instruments, in the C-Chain home's voice:
   a large block chart with the series poured into it, an extruded share
   bar with its ledger, the removable chips that say how a table is cut,
   and the Query panels' view switch. ICM, Stablecoins and Stats use them,
   so a figure, a chart and a filter read the same on all three. */

export const BLOCK_GRAY = "#A2AFB2";
export const PICK_BLUE = "#0061E2";

/* ------------------------------------------------------------------ */
/* the block chart                                                     */

export interface BlockLayer {
  key: string;
  label: string;
  /** any CSS color, var() included */
  tone: string;
  what?: string;
}
export interface BlockDay {
  date: string;
  v: Record<string, number>;
}

/* the liquid's strengths: translucent pours, a focused layer fills in */
const POUR = 0.55;
const SIDE_POUR = 0.8;
const FOCUSED = 0.9;
const RECEDED = 0.12;
const CHART_PX = 176;
const W = 1000;

/** a monotone cubic through the points: smooth, never past a real value */
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
export function dayLabel(date: string): string {
  if (!/^\d{4}-\d{2}-\d{2}/.test(date)) return date;
  return new Date(`${date.slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

/** A series as one large readout block: the window's reading up top, the
 *  layers poured into the foot, a hairline that follows the cursor and a
 *  plate with the day's breakdown. A legend key focuses its layer on
 *  hover; with `onPick` a click picks it, and the pick stays lit. */
export function LayerBlock({
  label,
  days,
  layers,
  fmt,
  unit,
  headline = "sum",
  note,
  picked = null,
  onPick,
  overlay,
  href,
  stale,
  action,
}: {
  label: string;
  days: BlockDay[];
  /** floor up; one layer pours a single fluid */
  layers: BlockLayer[];
  fmt: (v: number) => string;
  unit?: string;
  /** "sum" reads the window's total, "avg" its daily mean, "last" the latest level */
  headline?: "sum" | "avg" | "last";
  note?: ReactNode;
  picked?: string | null;
  onPick?: (key: string) => void;
  /** a second series as a dashed ink line on its own scale */
  overlay?: { key: string; label: string; fmt: (v: number) => string };
  href?: string;
  stale?: boolean;
  /** a control beside the legend, such as a view switch */
  action?: ReactNode;
}) {
  const [hoverKey, setHoverKey] = useState<string | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const plot = useRef<HTMLDivElement>(null);
  const focus = hoverKey ?? picked;

  const total = (d: BlockDay) => layers.reduce((s, l) => s + (d.v[l.key] ?? 0), 0);
  const sums = useMemo(() => {
    const out: Record<string, number> = {};
    for (const l of layers) out[l.key] = days.reduce((s, d) => s + (d.v[l.key] ?? 0), 0);
    out.__all = layers.reduce((s, l) => s + out[l.key], 0);
    return out;
  }, [days, layers]);
  const last = days.length - 1;
  const lastTotal = days.length ? total(days[last]) : 0;
  const max = Math.max(1e-9, ...days.map(total)) * 1.08;
  const multi = layers.length > 1;
  // shares read off the window's sum, or off the last day for a level
  const shareOf = (key: string) => {
    if (headline === "last") return lastTotal > 0 ? ((days[last].v[key] ?? 0) / lastTotal) * 100 : 0;
    return sums.__all > 0 ? (sums[key] / sums.__all) * 100 : 0;
  };

  const x = (i: number) => (days.length > 1 ? (i / (days.length - 1)) * W : W / 2);
  const y = (v: number) => CHART_PX - (v / max) * CHART_PX;
  const stacks = useMemo(() => {
    const acc = days.map(() => 0);
    return layers.map((l) => {
      const lo = [...acc];
      days.forEach((d, i) => (acc[i] += d.v[l.key] ?? 0));
      return { key: l.key, lo, hi: [...acc] };
    });
  }, [days, layers]);
  const pts = (vals: number[]) => vals.map((v, i) => [x(i), y(v)] as const);
  const band = (lo: number[], hi: number[]) => `${monotonePath(pts(hi))} ${monotonePath(pts(lo).reverse()).replace(/^M/, "L")} Z`;
  const topLine = stacks.length ? monotonePath(pts(stacks[stacks.length - 1].hi)) : "";

  // the overlay rides its own scale, so a rate can sit over a volume
  const overlayVals = overlay ? days.map((d) => d.v[overlay.key] ?? 0) : null;
  const overlayMax = overlayVals ? Math.max(1e-9, ...overlayVals) * 1.12 : 1;
  const overlayLine = overlayVals ? monotonePath(overlayVals.map((v, i) => [x(i), CHART_PX - (v / overlayMax) * CHART_PX] as const)) : "";

  const strength = (key: string, side = false) => (focus === null ? (side ? SIDE_POUR : POUR) : focus === key ? FOCUSED : RECEDED);

  const onMove = (e: React.MouseEvent) => {
    const r = plot.current?.getBoundingClientRect();
    if (!r || days.length < 2) return;
    const t = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    setHover(Math.round(t * last));
  };
  const hd = hover !== null ? days[hover] : null;

  const figure = headline === "last" ? lastTotal : headline === "avg" ? sums.__all / Math.max(1, days.length) : sums.__all;
  const first = days.length ? total(days[0]) : 0;
  const move = headline === "last" && first > 0 ? (lastTotal / first - 1) * 100 : null;
  const span = days.length > 1 ? `${dayLabel(days[0].date)} to ${dayLabel(days[last].date)}` : "";

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
        <div className="relative z-10 flex flex-wrap items-start justify-between gap-x-8 gap-y-3 px-5 pt-3 md:px-6">
          <span className="flex min-w-0 flex-col gap-1.5">
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
              {label}
              {note && <span className="font-normal text-zinc-400 dark:text-zinc-500"> · {note}</span>}
            </span>
            <span className="flex flex-wrap items-baseline gap-x-2">
              <span className="text-[22px] font-bold leading-none tracking-[-0.02em] tabular-nums text-zinc-900 [font-family:Aeonik,var(--font-sans),sans-serif] dark:text-zinc-50">
                {fmt(figure)}
                {unit && <span className="ml-1 font-mono text-[12px] font-normal tracking-normal text-zinc-400 dark:text-zinc-500">{unit}</span>}
              </span>
              <span className="font-mono text-[10px] tracking-[0.04em] text-zinc-400 dark:text-zinc-500">
                {headline === "sum" && days.length ? `${fmt(sums.__all / days.length)} per day · ` : headline === "avg" ? "daily avg · " : ""}
                {move !== null ? `${move >= 0 ? "+" : ""}${move.toFixed(1)}% · ` : ""}
                {span}
              </span>
            </span>
          </span>
          {(multi || onPick || overlay || action) && (
            <span className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-0.5">
              {(multi || overlay) && (
                <span className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[10px] uppercase tracking-[0.12em]" onMouseLeave={() => setHoverKey(null)}>
                  {multi &&
                    [...layers].reverse().map((l) => (
                      <button
                        key={l.key}
                        type="button"
                        onMouseEnter={() => setHoverKey(l.key)}
                        onFocus={() => setHoverKey(l.key)}
                        onBlur={() => setHoverKey(null)}
                        onClick={(e) => {
                          e.preventDefault();
                          onPick?.(l.key);
                        }}
                        aria-pressed={onPick ? picked === l.key : undefined}
                        title={l.what}
                        className={cn(
                          "flex items-center gap-1.5 transition-opacity",
                          focus && focus !== l.key ? "opacity-40" : "opacity-100",
                          !onPick && "cursor-default",
                        )}
                      >
                        <span className="h-2 w-2" style={{ background: l.tone }} />
                        <span className={cn(picked === l.key ? "text-[#0061E2] dark:text-[#5f9dff]" : "text-zinc-500 dark:text-zinc-400")}>{l.label}</span>
                        <span className="tabular-nums text-zinc-900 dark:text-zinc-50">{shareOf(l.key).toFixed(0)}%</span>
                      </button>
                    ))}
                  {overlay && (
                    <span className="flex items-center gap-1.5 text-zinc-500 dark:text-zinc-400">
                      <span className="w-4 border-t border-dashed border-zinc-700 dark:border-zinc-300" />
                      {overlay.label}
                    </span>
                  )}
                </span>
              )}
              {action}
            </span>
          )}
        </div>

        <div ref={plot} className="relative mt-6" style={{ height: CHART_PX }} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
          <span className="pointer-events-none absolute inset-x-0 border-t border-dashed border-zinc-200 dark:border-zinc-800" style={{ top: y(max / 1.08) }}>
            <span className="absolute right-3 -top-4 font-mono text-[9px] tabular-nums text-zinc-400 md:right-4 dark:text-zinc-500">peak {fmt(max / 1.08)}</span>
          </span>
          <svg viewBox={`0 0 ${W} ${CHART_PX}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden>
            {stacks.map((st, i) => (
              <path key={st.key} d={band(st.lo, st.hi)} fill={layers[i].tone} fillOpacity={strength(st.key)} className="transition-[fill-opacity] duration-200" />
            ))}
            <path d={topLine} fill="none" strokeWidth={1.25} vectorEffect="non-scaling-stroke" strokeLinejoin="round" className="stroke-zinc-700 dark:stroke-zinc-300" />
            {overlay && (
              <path d={overlayLine} fill="none" strokeWidth={1} strokeDasharray="4 3" vectorEffect="non-scaling-stroke" className="stroke-zinc-900 dark:stroke-zinc-100" />
            )}
          </svg>
          {hd && (
            <>
              <span className="pointer-events-none absolute inset-y-0 w-px bg-zinc-900/40 dark:bg-zinc-100/40" style={{ left: `${(x(hover!) / W) * 100}%` }} />
              <span
                className="pointer-events-none absolute top-2 z-20"
                style={hover! > last / 2 ? { right: `calc(${100 - (x(hover!) / W) * 100}% + 10px)` } : { left: `calc(${(x(hover!) / W) * 100}% + 10px)` }}
              >
                <TipPlate>
                  <p className="font-mono text-[10px] text-zinc-500">
                    {dayLabel(hd.date)} · {fmt(total(hd))}
                    {unit ? ` ${unit}` : ""}
                  </p>
                  {multi &&
                    [...layers]
                      .reverse()
                      .filter((l) => (hd.v[l.key] ?? 0) > 0)
                      .map((l) => (
                        <p key={l.key} className="flex items-center justify-between gap-4 font-mono text-[11px] tabular-nums text-zinc-900 dark:text-zinc-100">
                          <span className="flex items-center gap-1.5">
                            <span className="h-1.5 w-1.5" style={{ background: l.tone }} />
                            {l.label}
                          </span>
                          <span>
                            {fmt(hd.v[l.key] ?? 0)}
                            <span className="ml-2 text-[10px] text-zinc-400">{total(hd) > 0 ? `${(((hd.v[l.key] ?? 0) / total(hd)) * 100).toFixed(0)}%` : ""}</span>
                          </span>
                        </p>
                      ))}
                  {overlay && (
                    <p className="flex items-center justify-between gap-4 font-mono text-[11px] tabular-nums text-zinc-900 dark:text-zinc-100">
                      <span className="text-zinc-500">{overlay.label}</span>
                      <span>{overlay.fmt(hd.v[overlay.key] ?? 0)}</span>
                    </p>
                  )}
                </TipPlate>
              </span>
            </>
          )}
        </div>
      </ReadoutBlock>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* the share bar and its ledger                                        */

export interface SharePart {
  key: string;
  label: string;
  value: number;
  /** the row's lead, when it wants more than the label (a logo, a ticker) */
  lead?: ReactNode;
  /** a page for this part, reached from the row's end */
  href?: string | null;
  /** a tone of its own, where the color carries meaning (a coin's slot) */
  tone?: string;
}

const tone = (p: SharePart, picked: string | null) => (picked === p.key ? PICK_BLUE : p.tone ?? BLOCK_GRAY);

/** the parts as one extruded bar: hover lights a cut, a click picks it */
function ShareSolid({
  parts,
  total,
  lit,
  picked,
  onHover,
  onPick,
}: {
  parts: SharePart[];
  total: number;
  lit: string | null;
  picked: string | null;
  onHover: (k: string | null) => void;
  onPick?: (k: string) => void;
}) {
  const shown = parts.filter((p) => p.value > 0);
  const lastPart = shown[shown.length - 1];
  const dim = (k: string) => lit !== null && lit !== k;
  return (
    <div className="relative mr-2 mt-2 h-7">
      <div aria-hidden className="absolute -top-2 left-0 flex h-2 w-full origin-bottom-left skew-x-[-45deg] overflow-hidden">
        {shown.map((p) => (
          <span key={p.key} className={cn("relative h-full transition-opacity duration-200", dim(p.key) && "opacity-30")} style={{ width: `${(p.value / total) * 100}%`, background: tone(p, picked) }}>
            <span className="absolute inset-0 bg-white/40 dark:bg-white/20" />
          </span>
        ))}
      </div>
      {lastPart && (
        <span aria-hidden className={cn("absolute -right-2 top-0 h-full w-2 origin-top-left skew-y-[-45deg] transition-opacity duration-200", dim(lastPart.key) && "opacity-30")} style={{ background: tone(lastPart, picked) }}>
          <span className="absolute inset-0 bg-black/25" />
        </span>
      )}
      <div className="relative flex h-full w-full">
        {shown.map((p) => (
          <button
            key={p.key}
            type="button"
            aria-label={`${p.label}: ${((p.value / total) * 100).toFixed(1)}%`}
            onMouseEnter={() => onHover(p.key)}
            onFocus={() => onHover(p.key)}
            onBlur={() => onHover(null)}
            onClick={() => onPick?.(p.key)}
            className={cn(
              "h-full min-w-px border-r border-white/70 transition-opacity duration-200 last:border-r-0 focus-visible:outline-none dark:border-black/50",
              dim(p.key) && "opacity-30",
              !onPick && "cursor-default",
            )}
            style={{ width: `${(p.value / total) * 100}%`, background: tone(p, picked) }}
          />
        ))}
      </div>
    </div>
  );
}

/** A share of something, drawn and listed: the extruded bar on top, one
 *  row a part below. Hover a cut or a row and it lights in both; click it
 *  and the table the panel feeds is cut to it. */
export function SharePanel({
  label,
  action,
  parts,
  total,
  fmt,
  picked = null,
  onPick,
  loading,
  empty = "No data",
  failed,
  className,
}: {
  label: string;
  action?: ReactNode;
  parts: SharePart[];
  /** the whole the shares read against; defaults to the parts' sum */
  total?: number;
  fmt: (v: number) => string;
  picked?: string | null;
  onPick?: (key: string) => void;
  loading?: boolean;
  empty?: string;
  /** a failed feed in place of the panel's body */
  failed?: ReactNode;
  className?: string;
}) {
  const [hover, setHover] = useState<string | null>(null);
  const lit = hover ?? picked;
  const whole = total ?? parts.reduce((s, p) => s + p.value, 0);
  const litPart = parts.find((p) => p.key === lit);
  return (
    <ChartBoard label={label} action={action} bodyClassName="p-0 md:px-0" className={cn("min-w-0", className)}>
      {failed ? (
        failed
      ) : loading ? (
        <RowSkeleton n={6} />
      ) : parts.length === 0 ? (
        <EmptyRow>{empty}</EmptyRow>
      ) : (
        <div onMouseLeave={() => setHover(null)}>
          <div className="flex flex-col gap-2 px-5 pb-4 pt-4 md:px-6">
            <div className="flex h-4 items-baseline justify-end gap-3 font-mono text-[10px] tabular-nums text-zinc-400 dark:text-zinc-500">
              {litPart ? (
                <span className="min-w-0 truncate">
                  <span className="text-zinc-900 dark:text-zinc-100">{litPart.label}</span> · {whole > 0 ? ((litPart.value / whole) * 100).toFixed(1) : "0.0"}%
                </span>
              ) : null}
            </div>
            <ShareSolid parts={parts} total={Math.max(whole, parts.reduce((s, p) => s + p.value, 0)) || 1} lit={lit} picked={picked} onHover={setHover} onPick={onPick} />
          </div>
          <ul className="border-t border-zinc-200 dark:border-zinc-800">
            {parts.map((p, i) => {
              const on = picked === p.key;
              const share = whole > 0 ? (p.value / whole) * 100 : 0;
              return (
                <li
                  key={p.key}
                  className={cn(
                    "flex items-center border-b border-zinc-100 transition-[background-color,opacity] duration-200 last:border-b-0 dark:border-zinc-900",
                    on ? "bg-[#0061E2]/[0.06] dark:bg-[#5b9bff]/10" : "hover:bg-zinc-50 dark:hover:bg-zinc-900",
                    lit !== null && lit !== p.key && "opacity-50",
                  )}
                >
                  <button
                    type="button"
                    onMouseEnter={() => setHover(p.key)}
                    onFocus={() => setHover(p.key)}
                    onBlur={() => setHover(null)}
                    onClick={() => onPick?.(p.key)}
                    aria-pressed={onPick ? on : undefined}
                    className={cn("grid min-w-0 flex-1 grid-cols-[0.625rem_minmax(0,1fr)_auto] items-center sm:grid-cols-[0.625rem_minmax(0,1fr)_auto_auto] gap-x-3 py-2.5 pl-5 text-left md:pl-6", !p.href && "pr-5 md:pr-6", !onPick && "cursor-default")}
                  >
                    <span className="h-2.5 w-2.5" style={{ background: tone(p, picked) }} />
                    <span className="flex min-w-0 items-center gap-2 text-[13px] font-medium text-zinc-900 dark:text-zinc-100">
                      <span className="w-4 shrink-0 font-mono text-[10px] tabular-nums text-zinc-400 dark:text-zinc-500">{i + 1}</span>
                      {p.lead ?? <span className="truncate">{p.label}</span>}
                    </span>
                    <span className={cn(MUTED, "hidden text-[11px] sm:block")}>{share.toFixed(1)}%</span>
                    <span className={cn(INK, "w-16 text-right")}>{fmt(p.value)}</span>
                  </button>
                  {p.href && (
                    <Link
                      href={p.href}
                      aria-label={`Open ${p.label}`}
                      className="flex h-10 w-10 shrink-0 items-center justify-center text-zinc-300 transition-colors hover:text-zinc-900 md:mr-2 dark:text-zinc-600 dark:hover:text-zinc-100"
                    >
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </ChartBoard>
  );
}

/* ------------------------------------------------------------------ */
/* the cut, as chips                                                   */

export interface CutChip {
  key: string;
  label: string;
}

/** each part of a table's cut as a removable blue chip, and a Clear */
export function CutChips({ chips, onDrop, onClear }: { chips: CutChip[]; onDrop: (key: string) => void; onClear: () => void }) {
  if (chips.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {chips.map((c) => (
        <button
          key={c.key}
          type="button"
          onClick={() => onDrop(c.key)}
          aria-label={`Remove filter ${c.label}`}
          className="group inline-flex max-w-full items-center gap-1.5 rounded-full bg-[#0061E2]/[0.08] py-1.5 pl-3 pr-2 font-mono text-[11px] text-[#0061E2] transition-colors hover:bg-[#0061E2]/[0.14] dark:bg-[#5b9bff]/15 dark:text-[#8db8ff]"
        >
          <span className="truncate">{c.label}</span>
          <X className="h-3 w-3 shrink-0 opacity-60 group-hover:opacity-100" />
        </button>
      ))}
      {chips.length > 1 && (
        <button type="button" onClick={onClear} className="px-1 font-mono text-[11px] text-zinc-400 transition-colors hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-zinc-100">
          Clear
        </button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* the Query panels' switch                                            */

const SEG =
  "relative flex h-7 min-w-7 shrink-0 items-center justify-center rounded-full px-2.5 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0061E2]/50";

/** a pill that slides to the choice; scrolls sideways when it runs long */
export function ViewSwitch<T extends string>({ id, value, onChange, options }: { id: string; value: T; onChange: (v: T) => void; options: { v: T; label: string }[] }) {
  const reduced = useReduced();
  return (
    <div
      role="group"
      className="flex max-w-full items-center gap-px overflow-x-auto rounded-full bg-zinc-100 p-0.5 ring-1 ring-inset ring-zinc-200/70 [scrollbar-width:none] dark:bg-zinc-900 dark:ring-zinc-800 [&::-webkit-scrollbar]:hidden"
    >
      {options.map(({ v, label }) => {
        const on = value === v;
        return (
          <button
            key={v}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(v)}
            className={cn(SEG, on ? "text-zinc-900 dark:text-zinc-50" : "text-zinc-500 hover:bg-white/60 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/60 dark:hover:text-zinc-100")}
          >
            {on && <motion.span layoutId={`${id}-pill`} transition={reduced ? { duration: 0 } : MOTION} className="absolute inset-0 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.12)] dark:bg-zinc-700" />}
            <span className="relative whitespace-nowrap font-mono text-[10.5px] font-medium">{label}</span>
          </button>
        );
      })}
    </div>
  );
}

/** a readout that picks what the chart below draws; the pick wears a blue rule */
export function PickReadout({ on, onPick, label, children }: { on: boolean; onPick: () => void; label: string; children: ReactNode }) {
  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={on}
      aria-label={`Chart ${label}`}
      onClick={onPick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onPick();
        }
      }}
      className="relative cursor-pointer focus-visible:outline-none"
    >
      {children}
      <span aria-hidden className={cn("absolute -bottom-2 left-0 right-2 h-0.5 transition-colors", on ? "bg-[#0061E2] dark:bg-[#5f9dff]" : "bg-transparent")} />
    </div>
  );
}
