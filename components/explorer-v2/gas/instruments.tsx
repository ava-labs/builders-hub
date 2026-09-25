"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { TipPlate } from "@/components/explorer-v2/staking/bits";
import { FIGURE, FIG_UNIT, LABEL, ReadoutBlock, SUB } from "@/components/explorer-v2/evm/EvmOverviewStats";
import { monotonePath } from "@/components/explorer-v2/evm/EvmActivity";
import { fadeUpStyle, riseStyle, useReveal, wipeStyle } from "@/components/explorer-v2/motion";

/* The gas instruments, in the C-Chain home's grammar: every chart is an
 * extruded block like the Network Activity block. A header carries the
 * window's reading; the plot runs edge to edge at the block's foot; the
 * right face carries the latest value at the same scale, so the series
 * reads as a solid passing through the box. Bars are drawn as cuboids,
 * a block's fullness as a vessel, and the week's fee as a terrain. Each
 * plot moves once, the first time it comes into view: columns rise from
 * their base, a trace wipes in from the left, the week's cells fade up
 * in a wave. */

/* the x-axis strip under every plot */
export const AX = 24;
/* the path space of the stretched plots */
const W = 1000;

export interface Head {
  label: string;
  /** a clamp or exception the clock could not honor, said once */
  note?: string | null;
  figure?: ReactNode;
  unit?: string;
  sub?: ReactNode;
  /** a key or control, top right */
  legend?: ReactNode;
  /** the figure's detail sheet: the whole block becomes a door */
  href?: string;
  /** a window switch keeps the last payload on screen, dimmed */
  stale?: boolean;
}

export function Instrument({
  label,
  note,
  figure,
  unit,
  sub,
  legend,
  href,
  stale,
  side,
  children,
  bodyClass,
}: Head & { side?: ReactNode; children: ReactNode; bodyClass?: string }) {
  return (
    <div className={cn("min-w-0 pr-2 pt-2 transition-opacity", stale && "opacity-60")}>
      <ReadoutBlock href={href} side={side} className="flex-col">
        <div className="relative z-10 flex flex-wrap items-start justify-between gap-x-8 gap-y-3 px-5 pt-3 md:px-6">
          <span className="flex min-w-0 flex-col gap-1.5">
            <span className={LABEL}>
              {label}
              {note && <span className="font-normal text-zinc-400 dark:text-zinc-500"> · {note}</span>}
            </span>
            {(figure != null || sub != null) && (
              <span className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                {figure != null && (
                  <span className={FIGURE}>
                    {figure}
                    {unit && <span className={FIG_UNIT}>{unit}</span>}
                  </span>
                )}
                {sub != null && <span className={SUB}>{sub}</span>}
              </span>
            )}
          </span>
          {legend}
        </div>
        <div className={cn("relative mt-5", bodyClass)}>{children}</div>
      </ReadoutBlock>
    </div>
  );
}

/** the block's content width in CSS px, kept current */
export function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

/** the top of a scale that one spike cannot flatten: past three times the
 *  90th percentile the scale stops, and what rises above it is marked */
export function robustTop(vals: number[]): { top: number; clipped: boolean } {
  const s = vals.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  const max = s[s.length - 1] ?? 0;
  if (s.length < 5) return { top: max, clipped: false };
  const q = s[Math.floor(0.9 * (s.length - 1))];
  return q > 0 && max > 3 * q ? { top: q * 1.8, clipped: true } : { top: max, clipped: false };
}

/** up to `max` evenly spaced indices, both ends included */
export function tickIndices(n: number, max = 6): number[] {
  if (n <= 0) return [];
  if (n <= max) return Array.from({ length: n }, (_, i) => i);
  const out = new Set<number>();
  for (let k = 0; k < max; k++) out.add(Math.round((k * (n - 1)) / (max - 1)));
  return [...out];
}

/** the axis strip: labels at their x, the ends held inside the block */
export function XTicks({ items }: { items: { at: number; label: string }[] }) {
  // a phone keeps three labels: the ends and the middle
  const n = items.length;
  const keep = (i: number) => i === 0 || i === n - 1 || i === Math.floor((n - 1) / 2);
  return (
    <div className="relative" style={{ height: AX }}>
      {items.map((t, i) => (
        <span
          key={`${t.label}-${i}`}
          className={cn("absolute top-1.5 whitespace-nowrap font-mono text-[10px] tabular-nums text-zinc-400 dark:text-zinc-500", n > 4 && !keep(i) && "hidden sm:block")}
          style={{
            left: `${t.at * 100}%`,
            transform: i === 0 && t.at < 0.08 ? "translateX(12px)" : i === items.length - 1 && t.at > 0.92 ? "translateX(calc(-100% - 12px))" : "translateX(-50%)",
          }}
        >
          {t.label}
        </span>
      ))}
    </div>
  );
}

/** the hover plate, on the side of the hairline with room */
export function Tip({ at, children }: { at: number; children: ReactNode }) {
  return (
    <span
      className="pointer-events-none absolute top-2 z-20"
      style={at > 0.5 ? { right: `calc(${(1 - at) * 100}% + 10px)` } : { left: `calc(${at * 100}% + 10px)` }}
    >
      <TipPlate>{children}</TipPlate>
    </span>
  );
}

/** a labeled level across the plot: the scale said where it matters */
export function Level({ top, label, tone = "quiet", dashed = true, below = false }: { top: number; label: string; tone?: "quiet" | "ink"; dashed?: boolean; below?: boolean }) {
  return (
    <span
      className={cn(
        // above the plot: a solid that reaches its level must not cover its name
        "pointer-events-none absolute inset-x-0 z-10 border-t",
        dashed && "border-dashed",
        tone === "ink" ? "border-zinc-400 dark:border-zinc-500" : "border-zinc-200 dark:border-zinc-800",
      )}
      style={{ top }}
    >
      <span className={cn("absolute right-3 bg-white/85", below ? "top-[3px]" : "-top-[15px]", " px-1 font-mono text-[9px] tabular-nums text-zinc-500 md:right-4 dark:bg-zinc-950/85 dark:text-zinc-400")}>
        {label}
      </span>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Trace: one series over the clock, as liquid or as a percentile band */
/* ------------------------------------------------------------------ */

export interface TraceRow {
  key: string;
  /** the row's full name, for the plate */
  long: string;
  /** the axis form */
  tick: string;
  mid: number;
  lo?: number;
  hi?: number;
}

export function TraceBlock({
  rows,
  fmt,
  band = false,
  height = 176,
  tip,
  ...head
}: Head & {
  rows: TraceRow[];
  fmt: (v: number) => string;
  /** draw lo..hi as a band around the line, on a floating scale */
  band?: boolean;
  height?: number;
  tip: (r: TraceRow) => ReactNode;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const plot = useRef<HTMLDivElement>(null);
  const [seen, shown] = useReveal<HTMLDivElement>();
  const n = rows.length;
  const last = n - 1;

  const { y0, y1, hiIdx, loIdx, clipped } = useMemo(() => {
    const mids = rows.map((r) => r.mid);
    let hiIdx = 0;
    let loIdx = 0;
    mids.forEach((v, i) => {
      if (v > mids[hiIdx]) hiIdx = i;
      if (v < mids[loIdx]) loIdx = i;
    });
    if (!band) {
      const t = robustTop(mids);
      return { y0: 0, y1: t.top * 1.14 || 1, hiIdx, loIdx, clipped: t.clipped };
    }
    // the band floats: a fee that moves a few percent must not read flat
    // against zero, and the scale is stated on the plot
    const all = rows.flatMap((r) => [r.lo ?? r.mid, r.hi ?? r.mid, r.mid]);
    const lo = Math.min(...all);
    const t = robustTop(all);
    const hi = t.top;
    const pad = (hi - lo) * 0.14 || hi * 0.1 || 1;
    return { y0: Math.max(0, lo - pad), y1: hi + pad * 1.6, hiIdx, loIdx, clipped: t.clipped };
  }, [rows, band]);

  const x = (i: number) => (n > 1 ? (i / last) * W : W / 2);
  const y = (v: number) => Math.max(0, height - ((v - y0) / (y1 - y0)) * height);
  const pts = (vals: number[]) => vals.map((v, i) => [x(i), y(v)] as const);
  const midLine = monotonePath(pts(rows.map((r) => r.mid)));
  const fill = band
    ? `${monotonePath(pts(rows.map((r) => r.hi ?? r.mid)))} ${monotonePath(pts(rows.map((r) => r.lo ?? r.mid)).reverse()).replace(/^M/, "L")} Z`
    : `${midLine} L${W},${height} L0,${height} Z`;

  const onMove = (e: React.MouseEvent) => {
    const r = plot.current?.getBoundingClientRect();
    if (!r || n < 2) return;
    setHover(Math.round(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)) * last));
  };

  const end = rows[last];
  const side = end ? (
    <span className="absolute inset-x-0" style={{ bottom: AX, height }}>
      {band ? (
        <span
          className="absolute inset-x-0 bg-[#A2AFB2]/50 dark:bg-[#A2AFB2]/35"
          style={{ top: y(end.hi ?? end.mid), height: Math.max(1, y(end.lo ?? end.mid) - y(end.hi ?? end.mid)) }}
        />
      ) : (
        <span className="absolute inset-x-0 bottom-0 bg-[#A2AFB2]/70 dark:bg-[#A2AFB2]/50" style={{ top: y(end.mid) }} />
      )}
      <span className="absolute inset-x-0 border-t border-zinc-700/70 dark:border-zinc-300/70" style={{ top: y(end.mid) }} />
    </span>
  ) : null;

  const hr = hover !== null ? rows[hover] : null;
  const at = (i: number) => x(i) / W;
  const peak = rows[hiIdx];

  return (
    <Instrument {...head} side={side}>
      <div ref={seen}>
      <div ref={plot} className="relative" style={{ height }} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
        {n > 0 && (
          <>
            {clipped && peak.mid > y1 ? (
              <span className="pointer-events-none absolute top-0 -translate-x-1/2 border-t-2 border-[#E6212F]" style={{ left: `${(x(hiIdx) / W) * 100}%`, width: 14 }}>
                <span className={cn("absolute top-1 whitespace-nowrap bg-white/85 px-1 font-mono text-[9px] tabular-nums text-[#E6212F] dark:bg-zinc-950/85", x(hiIdx) / W > 0.5 ? "right-full mr-1" : "left-full ml-1")}>
                  {fmt(peak.mid)} off scale
                </span>
              </span>
            ) : (
              <Level top={y(peak.mid)} label={`${band ? "high " : "peak "}${fmt(peak.mid)} · ${peak.tick}`} />
            )}
            {band && loIdx !== hiIdx && <Level top={y(rows[loIdx].mid)} label={`low ${fmt(rows[loIdx].mid)} · ${rows[loIdx].tick}`} below />}
          </>
        )}
        <svg viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full" style={wipeStyle(shown)} aria-hidden>
          <path d={fill} className={band ? "fill-[#A2AFB2]/30 dark:fill-[#A2AFB2]/20" : "fill-[#A2AFB2]/40 dark:fill-[#A2AFB2]/30"} />
          <path d={midLine} fill="none" strokeWidth={band ? 1.75 : 1.25} vectorEffect="non-scaling-stroke" strokeLinejoin="round" className="stroke-zinc-800 dark:stroke-zinc-200" />
        </svg>
        {hr && hover !== null && (
          <>
            <span className="pointer-events-none absolute inset-y-0 w-px bg-zinc-900/40 dark:bg-zinc-100/40" style={{ left: `${at(hover) * 100}%` }} />
            <span
              className="pointer-events-none absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-zinc-900 dark:border-zinc-950 dark:bg-zinc-100"
              style={{ left: `${at(hover) * 100}%`, top: y(hr.mid) }}
            />
            <Tip at={at(hover)}>{tip(hr)}</Tip>
          </>
        )}
      </div>
      </div>
      <XTicks items={tickIndices(n).map((i) => ({ at: at(i), label: rows[i].tick }))} />
    </Instrument>
  );
}

/* ------------------------------------------------------------------ */
/* Columns: one cuboid per bucket, or a vessel filled to its level      */
/* ------------------------------------------------------------------ */

export interface Col {
  key: string;
  long: string;
  tick: string;
  v: number;
}

/* the block tape's faces: lit top, front, shaded side */
export const FACE = {
  quiet: ["fill-[#A2AFB2]/60 dark:fill-[#A2AFB2]/45", "fill-[#c9d1d3] dark:fill-[#5d6669]", "fill-[#86959a] dark:fill-[#3f4649]"],
  focus: ["fill-zinc-800 dark:fill-zinc-200", "fill-zinc-500 dark:fill-zinc-400", "fill-zinc-950 dark:fill-zinc-500"],
  live: ["fill-[#E6212F]", "fill-[#FF394A]", "fill-[#B20F2A]"],
} as const;

export function ColumnsBlock({
  cols,
  fmt,
  max,
  vessel = false,
  live = false,
  avg,
  marker,
  height = 160,
  tip,
  ticks,
  ...head
}: Head & {
  cols: Col[];
  fmt: (v: number) => string;
  /** a fixed top of scale, such as 100 for a percent */
  max?: number;
  /** each column is a vessel of the full scale, filled to its value */
  vessel?: boolean;
  /** the last column is the live one: it wears the red ramp */
  live?: boolean;
  avg?: { v: number; label: string };
  /** a dated event: a dashed rule before the column with this key */
  marker?: { key: string; label: string };
  height?: number;
  tip: (c: Col, i: number) => ReactNode;
  /** axis labels to show; default is up to six evenly spaced */
  ticks?: number[];
}) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const [seen, shown] = useReveal<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const n = cols.length;
  const robust = robustTop(cols.map((c) => c.v));
  const top = max ?? (robust.top * 1.12 || 1);
  const slot = n ? w / n : 0;
  const gap = n > 40 ? Math.max(1.5, slot * 0.22) : slot * 0.28;
  const d = Math.min(8, Math.max(2, slot * 0.3));
  const fw = Math.max(1, slot - gap - d);
  const room = height - d - 1;
  const hOf = (v: number) => (v <= 0 ? 0 : Math.max(1.5, (Math.min(v, top) / top) * room));
  const x0 = (i: number) => i * slot + gap / 2;
  const at = (i: number) => (n ? (i + 0.5) / n : 0.5);

  // the columns rise left to right, the wave no longer than a beat
  const delay = (i: number) => Math.min(i * (n > 30 ? 12 : 36), 640);
  const cuboid = (x: number, h: number, faces: readonly string[], key: string, i: number) => {
    const yb = height;
    const yt = yb - h;
    return (
      <g key={key} style={riseStyle(shown, delay(i))}>
        <rect x={x} y={yt} width={fw} height={h} className={faces[0]} />
        <polygon points={`${x},${yt} ${x + d},${yt - d} ${x + fw + d},${yt - d} ${x + fw},${yt}`} className={faces[1]} />
        <polygon points={`${x + fw},${yt} ${x + fw + d},${yt - d} ${x + fw + d},${yb - d} ${x + fw},${yb}`} className={faces[2]} />
      </g>
    );
  };

  const onMove = (e: React.MouseEvent) => {
    if (!slot) return;
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setHover(Math.min(n - 1, Math.max(0, Math.floor((e.clientX - r.left) / slot))));
  };

  const endV = cols[n - 1]?.v ?? 0;
  const side = n ? (
    <span className="absolute inset-x-0" style={{ bottom: AX, height }}>
      <span
        className={cn("absolute inset-x-0 bottom-0 border-t", live ? "border-[#B20F2A] bg-[#E6212F]/70" : "border-zinc-700/60 bg-[#A2AFB2]/70 dark:border-zinc-300/60 dark:bg-[#A2AFB2]/50")}
        style={{ height: hOf(endV) }}
      />
    </span>
  ) : null;

  const mIdx = marker ? cols.findIndex((c) => c.key === marker.key) : -1;
  const hc = hover !== null ? cols[hover] : null;

  return (
    <Instrument {...head} side={side}>
      <div ref={seen}>
      <div ref={ref} className="relative" style={{ height }} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
        {max === undefined && n > 0 && <Level top={height - room} label={robust.clipped ? `scale to ${fmt(top)} · red lids run past it` : `top ${fmt(top)}`} />}
        {max !== undefined && <Level top={height - room} label={fmt(max)} />}
        {w > 0 && (
          <svg width={w} height={height} viewBox={`0 0 ${w} ${height}`} className="absolute inset-0 overflow-visible" aria-hidden>
            {cols.map((c, i) => {
              const faces = hover === i ? FACE.focus : live && i === n - 1 ? FACE.live : FACE.quiet;
              // a column past the scale is cut at the lid and capped in red
              if (!vessel && c.v > top) return cuboid(x0(i), hOf(c.v), [faces[0], FACE.live[1], faces[2]], c.key, i);
              if (!vessel) return cuboid(x0(i), hOf(c.v), faces, c.key, i);
              // the glass: the full scale, drawn as an outline, the value poured in
              const x = x0(i);
              const yt = height - room;
              return (
                <g key={c.key}>
                  <polygon
                    points={`${x},${height} ${x},${yt} ${x + d},${yt - d} ${x + fw + d},${yt - d} ${x + fw + d},${height - d} ${x + fw},${height}`}
                    className="fill-zinc-100/70 dark:fill-zinc-900/70"
                  />
                  {cuboid(x, hOf(c.v), faces, `${c.key}-v`, i)}
                </g>
              );
            })}
          </svg>
        )}
        {mIdx > 0 && (
          <span className="pointer-events-none absolute inset-y-0 border-l border-dashed border-[#E6212F]/70" style={{ left: mIdx * slot }}>
            <span className="absolute bottom-1 right-1.5 whitespace-nowrap bg-white/85 px-1 font-mono text-[9px] uppercase tracking-[0.12em] text-[#E6212F] dark:bg-zinc-950/85">{marker!.label}</span>
          </span>
        )}
        {avg && <Level top={height - hOf(avg.v)} label={avg.label} tone="ink" />}
        {hc && hover !== null && <Tip at={at(hover)}>{tip(hc, hover)}</Tip>}
      </div>
      </div>
      <XTicks items={(ticks ?? tickIndices(n)).map((i) => ({ at: at(i), label: cols[i]?.tick ?? "" }))} />
    </Instrument>
  );
}

/* ------------------------------------------------------------------ */
/* Stacks: each bucket as one cuboid cut into layers, floor up          */
/* ------------------------------------------------------------------ */

export interface StackLayer {
  key: string;
  label: string;
  /** what the layer counts, for the key's title */
  what?: string;
  /** front, top, side: full static class strings so Tailwind keeps them */
  faces: readonly [string, string, string];
  /** the key's swatch and the right face's fill */
  swatch: string;
}

export interface StackCol {
  key: string;
  long: string;
  tick: string;
  parts: Record<string, number>;
}

export function StackBlock({
  cols,
  layers,
  fmt,
  marker,
  height = 200,
  tip,
  ticks,
  legend,
  ...head
}: Head & {
  cols: StackCol[];
  /** floor up */
  layers: StackLayer[];
  fmt: (v: number) => string;
  /** a dated event: a dashed rule before the column with this key */
  marker?: { key: string; label: string };
  height?: number;
  tip: (c: StackCol, i: number) => ReactNode;
  ticks?: number[];
}) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const [seen, shown] = useReveal<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const [focus, setFocus] = useState<string | null>(null);
  const n = cols.length;
  const sums = useMemo(() => Object.fromEntries(layers.map((l) => [l.key, cols.reduce((s, c) => s + (c.parts[l.key] ?? 0), 0)])), [cols, layers]);
  // a layer with nothing in the window stays out of the key and the solid
  const shownLayers = layers.filter((l) => sums[l.key] > 0);
  const all = shownLayers.reduce((s, l) => s + sums[l.key], 0);
  const totals = cols.map((c) => shownLayers.reduce((s, l) => s + (c.parts[l.key] ?? 0), 0));
  const robust = robustTop(totals);
  const top = robust.top * 1.12 || 1;
  const slot = n ? w / n : 0;
  const gap = n > 40 ? Math.max(1.5, slot * 0.22) : slot * 0.28;
  const d = Math.min(8, Math.max(2, slot * 0.3));
  const fw = Math.max(1, slot - gap - d);
  const room = height - d - 1;
  const yOf = (v: number) => height - (Math.min(v, top) / top) * room;
  const x0 = (i: number) => i * slot + gap / 2;
  const at = (i: number) => (n ? (i + 0.5) / n : 0.5);
  const delay = (i: number) => Math.min(i * (n > 30 ? 12 : 36), 640);
  const dim = (key: string) => (focus !== null && focus !== key ? 0.18 : 1);

  const onMove = (e: React.MouseEvent) => {
    if (!slot) return;
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setHover(Math.min(n - 1, Math.max(0, Math.floor((e.clientX - r.left) / slot))));
  };

  // the right face carries the last bucket's layers at the same scale
  const last = cols[n - 1];
  const side = last ? (
    <span className="absolute inset-x-0 flex flex-col-reverse" style={{ bottom: AX, height }}>
      {shownLayers.map((l, li) => (
        <span
          key={l.key}
          className={cn("w-full shrink-0 transition-opacity", l.swatch, li === shownLayers.length - 1 && "border-t border-zinc-700/60 dark:border-zinc-300/60")}
          style={{ height: height - yOf(last.parts[l.key] ?? 0), opacity: dim(l.key) }}
        />
      ))}
    </span>
  ) : null;

  const key =
    legend ??
    (shownLayers.length > 1 ? (
      <span className="flex flex-wrap items-center gap-x-5 gap-y-1 pt-0.5 font-mono text-[10px] uppercase tracking-[0.12em]" onMouseLeave={() => setFocus(null)}>
        {shownLayers.map((l) => (
          <button
            key={l.key}
            type="button"
            title={l.what}
            onMouseEnter={() => setFocus(l.key)}
            onFocus={() => setFocus(l.key)}
            onBlur={() => setFocus(null)}
            onClick={(e) => e.preventDefault()}
            className={cn("flex items-center gap-1.5 transition-opacity", focus && focus !== l.key ? "opacity-40" : "opacity-100")}
          >
            <span className={cn("h-2 w-2", l.swatch)} />
            <span className="text-zinc-500 dark:text-zinc-400">{l.label}</span>
            <span className="tabular-nums text-zinc-900 dark:text-zinc-50">{all > 0 ? `${((sums[l.key] / all) * 100).toFixed(0)}%` : ""}</span>
          </button>
        ))}
      </span>
    ) : undefined);

  const mIdx = marker ? cols.findIndex((c) => c.key === marker.key) : -1;
  const hc = hover !== null ? cols[hover] : null;

  return (
    <Instrument {...head} legend={key} side={side}>
      <div ref={seen}>
        <div ref={ref} className="relative" style={{ height }} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
          {n > 0 && <Level top={height - room} label={robust.clipped ? `scale to ${fmt(top)} · red lids run past it` : `top ${fmt(top)}`} />}
          {w > 0 && (
            <svg width={w} height={height} viewBox={`0 0 ${w} ${height}`} className="absolute inset-0 overflow-visible" aria-hidden>
              {cols.map((c, i) => {
                const x = x0(i);
                let acc = 0;
                const segs = shownLayers.map((l) => {
                  const lo = acc;
                  acc += c.parts[l.key] ?? 0;
                  return { l, lo, hi: acc };
                });
                const topSeg = [...segs].reverse().find((sg) => sg.hi > sg.lo);
                const over = acc > top;
                return (
                  <g key={c.key} style={riseStyle(shown, delay(i))}>
                    <g className="transition-opacity duration-150" style={{ opacity: hover !== null && hover !== i ? 0.35 : 1 }}>
                      {segs.map(({ l, lo, hi }) => {
                        if (hi <= lo) return null;
                        const yl = yOf(lo);
                        const yh = Math.min(yOf(hi), yl - 1);
                        return (
                          <g key={l.key} className="transition-opacity duration-200" style={{ opacity: dim(l.key) }}>
                            <rect x={x} y={yh} width={fw} height={yl - yh} className={l.faces[0]} />
                            <polygon points={`${x + fw},${yh} ${x + fw + d},${yh - d} ${x + fw + d},${yl - d} ${x + fw},${yl}`} className={l.faces[2]} />
                          </g>
                        );
                      })}
                      {topSeg && (
                        <polygon
                          points={`${x},${yOf(topSeg.hi)} ${x + d},${yOf(topSeg.hi) - d} ${x + fw + d},${yOf(topSeg.hi) - d} ${x + fw},${yOf(topSeg.hi)}`}
                          className={over ? FACE.live[1] : topSeg.l.faces[1]}
                          style={{ opacity: dim(topSeg.l.key) }}
                        />
                      )}
                    </g>
                  </g>
                );
              })}
            </svg>
          )}
          {mIdx > 0 && (
            <span className="pointer-events-none absolute inset-y-0 border-l border-dashed border-zinc-500/70 dark:border-zinc-400/70" style={{ left: mIdx * slot }}>
              {/* the name sits on the side of the rule with room */}
              <span className={cn("absolute top-5 whitespace-nowrap bg-white/85 px-1 font-mono text-[9px] uppercase tracking-[0.12em] text-zinc-500 dark:bg-zinc-950/85 dark:text-zinc-400", mIdx / n > 0.6 ? "right-1.5" : "left-1.5")}>{marker!.label}</span>
            </span>
          )}
          {hc && hover !== null && <Tip at={at(hover)}>{tip(hc, hover)}</Tip>}
        </div>
      </div>
      <XTicks items={(ticks ?? tickIndices(n)).map((i) => ({ at: at(i), label: cols[i]?.tick ?? "" }))} />
    </Instrument>
  );
}

/* ------------------------------------------------------------------ */
/* the week: 168 hour cells, shaded by rank                             */
/* ------------------------------------------------------------------ */

export const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export interface HeatCell {
  dow: number;
  hour: number;
  p50: number;
}

/* six steps of the brand red: a cell's step is its rank among the week's
   hours, so one spike cannot wash the other 167 cells out */
const STEPS = [0.06, 0.16, 0.3, 0.46, 0.64, 0.86];
const STEP_MIX = [7, 18, 32, 50, 70, 100];

function useRanks(cells: HeatCell[]) {
  return useMemo(() => {
    const live = cells.filter((c) => c.p50 > 0);
    const sorted = live.map((c) => c.p50).sort((a, b) => a - b);
    const byKey = new Map(cells.map((c) => [`${c.dow}-${c.hour}`, c.p50]));
    const step = (v: number) => {
      if (sorted.length < 2) return STEPS.length - 1;
      // the share of hours at or below this one
      let lo = 0;
      let hi = sorted.length;
      while (lo < hi) {
        const m = (lo + hi) >> 1;
        if (sorted[m] <= v) lo = m + 1;
        else hi = m;
      }
      return Math.min(STEPS.length - 1, Math.floor(((lo - 1) / (sorted.length - 1)) * STEPS.length));
    };
    const cut = (k: number) => sorted[Math.min(sorted.length - 1, Math.floor((k / STEPS.length) * sorted.length))];
    const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
    const cheapest = live.reduce<HeatCell | null>((m, c) => (!m || c.p50 < m.p50 ? c : m), null);
    const priciest = live.reduce<HeatCell | null>((m, c) => (!m || c.p50 > m.p50 ? c : m), null);
    return { byKey, step, cut, sorted, median, cheapest, priciest };
  }, [cells]);
}

export const cellName = (c: { dow: number; hour: number }) => `${DOW[c.dow - 1]} ${String(c.hour).padStart(2, "0")}:00 UTC`;

/** the pinned reader line under a week plot */
function WeekReader({ cell, median, fmt, unit, capped }: { cell: HeatCell | null; median: number; fmt: (v: number) => string; unit: string; capped?: boolean }) {
  if (!cell) return <span className="text-zinc-400 dark:text-zinc-500">Hover an hour · hours UTC</span>;
  const vs = median > 0 ? ((cell.p50 - median) / median) * 100 : 0;
  return (
    <>
      <span className="text-zinc-900 dark:text-zinc-100">
        {cellName(cell)} · median {fmt(cell.p50)} {unit}
        {capped && <span className="text-[#E6212F]"> · off the scale</span>}
      </span>
      <span className={vs > 0 ? "text-[#E6212F]" : "text-zinc-500 dark:text-zinc-400"}>
        {vs > 0 ? "+" : ""}
        {vs.toFixed(0)}% vs the week&apos;s median hour
      </span>
    </>
  );
}

function StepKey({ lo, hi, unit }: { lo: string; hi: string; unit: string }) {
  return (
    <span className="flex items-center gap-2 font-mono text-[10px] tabular-nums text-zinc-400 dark:text-zinc-500">
      cheapest {lo}
      <span className="flex gap-px">
        {STEPS.map((a) => (
          <span key={a} className="h-2 w-3" style={{ background: `rgba(230,33,47,${a})` }} />
        ))}
      </span>
      {hi} {unit} priciest
    </span>
  );
}

export function WeekGrid({ cells, feeUnit: unit, fmt, ...head }: Head & { cells: HeatCell[]; feeUnit: string; fmt: (v: number) => string }) {
  const r = useRanks(cells);
  const [hover, setHover] = useState<HeatCell | null>(null);
  const [seen, shown] = useReveal<HTMLDivElement>();
  const mark = (c: HeatCell) => (r.cheapest && c.dow === r.cheapest.dow && c.hour === r.cheapest.hour ? "cheap" : r.priciest && c.dow === r.priciest.dow && c.hour === r.priciest.hour ? "dear" : null);
  return (
    <Instrument {...head} bodyClass="px-5 pb-4 md:px-6" legend={r.sorted.length ? <StepKey lo={fmt(r.sorted[0])} hi={fmt(r.sorted[r.sorted.length - 1])} unit={unit} /> : undefined}>
      <div ref={seen} className="grid grid-cols-[2.25rem_repeat(24,minmax(0,1fr))] gap-[3px]" onMouseLeave={() => setHover(null)}>
        <span />
        {Array.from({ length: 24 }, (_, h) => (
          <span key={`h-${h}`} className="whitespace-nowrap pb-1 font-mono text-[9px] tabular-nums text-zinc-400 dark:text-zinc-500">
            {h % 6 === 0 ? String(h).padStart(2, "0") : ""}
          </span>
        ))}
        {DOW.map((label, i) => (
          <Row key={label} label={label}>
            {Array.from({ length: 24 }, (_, h) => {
              const v = r.byKey.get(`${i + 1}-${h}`);
              const cell = v === undefined ? null : { dow: i + 1, hour: h, p50: v };
              const m = cell && mark(cell);
              const on = hover?.dow === i + 1 && hover?.hour === h;
              return (
                <span
                  key={h}
                  onMouseEnter={() => cell && setHover(cell)}
                  className={cn(
                    "aspect-square min-h-3 rounded-[2px] transition-shadow",
                    on && "ring-2 ring-zinc-900 ring-offset-1 ring-offset-white dark:ring-zinc-100 dark:ring-offset-zinc-950",
                    !on && m === "cheap" && "ring-2 ring-zinc-900 dark:ring-zinc-100",
                  )}
                  // the week fades up in a wave, from Monday midnight to Sunday night
                  style={{ ...fadeUpStyle(shown, h * 16 + i * 44, 420), background: v === undefined || v <= 0 ? "rgba(161,161,170,0.1)" : `rgba(230,33,47,${STEPS[r.step(v)]})` }}
                />
              );
            })}
          </Row>
        ))}
      </div>
      <div className="mt-3 flex min-h-5 flex-wrap items-center justify-between gap-x-4 font-mono text-[11px] tabular-nums">
        <WeekReader cell={hover} median={r.median} fmt={fmt} unit={unit} />
      </div>
    </Instrument>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <span className="flex items-center font-mono text-[9px] uppercase text-zinc-400 dark:text-zinc-500">{label}</span>
      {children}
    </>
  );
}

/* the same week as a terrain on a plate: Monday at the back, Sunday in
   front, each hour a column as tall as its fee and as red as its rank.
   Hours above the week's 95th percentile are clipped to the lid and
   capped in red, so one spike cannot flatten the rest. */
export function WeekTerrain({ cells, feeUnit: unit, fmt, ...head }: Head & { cells: HeatCell[]; feeUnit: string; fmt: (v: number) => string }) {
  const r = useRanks(cells);
  const [ref, w] = useWidth<HTMLDivElement>();
  const [seen, shown] = useReveal<HTMLDivElement>();
  const [hover, setHover] = useState<HeatCell | null>(null);
  const cap = r.sorted.length ? r.sorted[Math.floor(r.sorted.length * 0.95)] || r.sorted[r.sorted.length - 1] : 1;

  const LEFT = 4;
  const cw = Math.max(8, (w - LEFT - 40) / 27);
  const rdx = cw * 0.5;
  const rdy = cw * 0.42;
  const dx = rdx * 0.72;
  const dy = rdy * 0.72;
  const fw = cw * 0.72;
  const hMax = Math.min(180, cw * 3.4);
  const H = Math.round(hMax + 6 * rdy + dy + 34);
  const base = H - 22;

  const cols = useMemo(() => {
    const out: { cell: HeatCell; r: number; c: number }[] = [];
    for (let row = 0; row < 7; row++)
      for (let c = 0; c < 24; c++) {
        const v = r.byKey.get(`${row + 1}-${c}`);
        if (v !== undefined) out.push({ cell: { dow: row + 1, hour: c, p50: v }, r: row, c });
      }
    return out;
  }, [r]);

  return (
    <Instrument {...head} bodyClass="px-5 pb-4 md:px-6" legend={r.sorted.length ? <StepKey lo={fmt(r.sorted[0])} hi={fmt(r.sorted[r.sorted.length - 1])} unit={unit} /> : undefined}>
      <div ref={seen}>
      <div ref={ref} className="relative" style={{ height: H }} onMouseLeave={() => setHover(null)}>
        {w > 0 && (
          <svg width={w} height={H} viewBox={`0 0 ${w} ${H}`} className="absolute inset-0 overflow-visible [--tb:#f4f4f5] dark:[--tb:#27272a]" aria-hidden>
            {/* the plate */}
            <polygon
              points={`${LEFT - 4},${base + 3} ${LEFT - 4 + 6 * rdx + dx},${base - 6 * rdy - dy} ${LEFT + 24 * cw + 6 * rdx + dx - cw + fw + 4},${base - 6 * rdy - dy} ${LEFT + 24 * cw - cw + fw + 4},${base + 3}`}
              className="fill-zinc-100/70 dark:fill-zinc-900/70"
            />
            {DOW.map((label, row) => (
              <text key={label} x={LEFT + 23 * cw + fw + (6 - row) * rdx + dx + 8} y={base - (6 - row) * rdy - 2} className="fill-zinc-400 font-mono text-[9px] uppercase dark:fill-zinc-500">
                {label}
              </text>
            ))}
            {cols.map(({ cell, r: row, c }) => {
              const gx = LEFT + c * cw + (6 - row) * rdx;
              const gy = base - (6 - row) * rdy;
              const over = cell.p50 > cap;
              const h = cell.p50 <= 0 ? 1 : Math.max(2, (Math.min(cell.p50, cap) / cap) * hMax);
              const yt = gy - h;
              const mix = STEP_MIX[r.step(cell.p50)];
              const front = `color-mix(in srgb, #E6212F ${mix}%, var(--tb))`;
              const on = hover?.dow === cell.dow && hover?.hour === cell.hour;
              return (
                // the terrain rises in a wave, back row first, hour by hour
                <g key={`${cell.dow}-${cell.hour}`} onMouseEnter={() => setHover(cell)} className="cursor-crosshair" style={riseStyle(shown, row * 90 + c * 14, 640)}>
                  <rect x={gx} y={yt} width={fw} height={h} style={{ fill: front }} className={cn(on && "stroke-zinc-900 dark:stroke-zinc-100")} strokeWidth={on ? 1.25 : 0} />
                  <polygon
                    points={`${gx},${yt} ${gx + dx},${yt - dy} ${gx + fw + dx},${yt - dy} ${gx + fw},${yt}`}
                    style={{ fill: over ? "#B20F2A" : `color-mix(in srgb, ${front}, white 38%)` }}
                  />
                  <polygon
                    points={`${gx + fw},${yt} ${gx + fw + dx},${yt - dy} ${gx + fw + dx},${gy - dy} ${gx + fw},${gy}`}
                    style={{ fill: `color-mix(in srgb, ${front}, black 22%)` }}
                  />
                </g>
              );
            })}
            {Array.from({ length: 8 }, (_, k) => k * 3).map((hour) => (
              <text key={hour} x={LEFT + hour * cw + fw / 2} y={base + 16} textAnchor="middle" className="fill-zinc-400 font-mono text-[9px] tabular-nums dark:fill-zinc-500">
                {String(hour).padStart(2, "0")}
              </text>
            ))}
          </svg>
        )}
      </div>
      </div>
      <div className="mt-2 flex min-h-5 flex-wrap items-center justify-between gap-x-4 font-mono text-[11px] tabular-nums">
        <WeekReader cell={hover} median={r.median} fmt={fmt} unit={unit} capped={!!hover && hover.p50 > cap} />
      </div>
    </Instrument>
  );
}

/* ------------------------------------------------------------------ */
/* ranked shares: a list whose bars share one scale                    */
/* ------------------------------------------------------------------ */

export function RankBars({ rows, ...head }: Head & { rows: { key: string; name: string; title?: string; value: number; share: string }[] }) {
  const max = rows[0]?.value || 1;
  return (
    <Instrument {...head} bodyClass="px-5 pb-5 md:px-6">
      <div className="flex flex-col gap-2">
        {rows.map((r, i) => (
          <div key={r.key} className="grid grid-cols-[minmax(0,11rem)_minmax(0,1fr)_minmax(0,8rem)] items-center gap-3">
            <span className="truncate font-mono text-[11px] text-zinc-700 dark:text-zinc-300" title={r.title}>
              {r.name}
            </span>
            <span className="relative h-3">
              <span
                className={cn("absolute inset-y-0 left-0", i === 0 ? "bg-zinc-800 dark:bg-zinc-200" : "bg-[#A2AFB2]/70 dark:bg-[#A2AFB2]/50")}
                style={{ width: `${Math.max(0.5, (r.value / max) * 100)}%` }}
              />
            </span>
            <span className="text-right font-mono text-[11px] tabular-nums text-zinc-500 dark:text-zinc-400">{r.share}</span>
          </div>
        ))}
      </div>
    </Instrument>
  );
}
