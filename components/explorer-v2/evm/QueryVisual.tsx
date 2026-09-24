"use client";

import { useMemo, useState } from "react";
import { Area, Bar, Brush, CartesianGrid, Cell, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis, YAxis } from "recharts";
import { cn } from "@/lib/utils";
import { INK } from "@/components/explorer-v2/ui";
import { TipPlate } from "@/components/explorer-v2/staking/bits";
import { formatNumber, truncate } from "@/components/explorer-v2/format";
import type { Names } from "@/lib/explorer-query/types";
import type { Format, Panel, Stat, VisualSpec } from "@/lib/explorer-query/visual";

/* Draws what the designer specified: a strip of headline figures, one
   to four panels, and the callouts. Every panel keeps the sheet's
   grammar: hover reads, click opens the records behind a point, a brush
   on a time series selects a range. */

const TONES = ["#E6212F", "#0061E2", "#0d9488", "#d97706", "#7c3aed"];
const MONO = { fontSize: 10, fontFamily: "var(--font-geist-mono)" };

type Row = Record<string, unknown>;
type Span = "minutes" | "hours" | "days" | "other";

const isAddress = (v: unknown): v is string => typeof v === "string" && /^0x[0-9a-fA-F]{40}$/.test(v);
const isHash = (v: unknown): v is string => typeof v === "string" && /^0x[0-9a-fA-F]{64}$/.test(v);
const isTime = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}([ T]\d{2}:\d{2}(:\d{2})?)?$/.test(v);

export function spanOf(xs: unknown[]): Span {
  const ts = xs.filter(isTime).map((s) => new Date(s.replace(" ", "T") + (s.length <= 10 ? "T00:00:00Z" : "Z")).getTime());
  if (ts.length < 2) return "other";
  const w = Math.max(...ts) - Math.min(...ts);
  return w <= 3 * 3600e3 ? "minutes" : w <= 3 * 86400e3 ? "hours" : "days";
}

export function fmtX(v: unknown, span: Span): string {
  if (isTime(v)) {
    const s = v.replace("T", " ");
    if (span === "days") return s.slice(5, 10);
    if (span === "hours") return s.slice(5, 16);
    return s.slice(11, 16);
  }
  return typeof v === "number" ? formatNumber(v) : String(v ?? "");
}

function compact(v: number): string {
  const a = Math.abs(v);
  if (a >= 1e12) return `${(v / 1e12).toFixed(2)}T`;
  if (a >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
  if (a >= 1e4) return `${(v / 1e3).toFixed(1)}k`;
  return Number.isInteger(v) ? formatNumber(v) : v.toFixed(2);
}

/** a figure in the unit the designer named */
export function fmt(v: unknown, format: Format, sym: string, axis = false): string {
  if (typeof v !== "number" || !Number.isFinite(v)) return String(v ?? "");
  switch (format) {
    case "percent":
      return `${v >= 10 || v === 0 ? v.toFixed(1) : v.toFixed(2)}%`;
    case "avax":
      return `${v >= 1000 ? compact(v) : v >= 1 ? v.toFixed(3) : v >= 0.001 ? v.toFixed(5) : v.toPrecision(3)}${axis ? "" : ` ${sym}`}`;
    case "gas":
      return `${compact(v)}${axis ? "" : " gas"}`;
    case "seconds":
      return `${v.toFixed(2)} s`;
    case "usd":
      return `$${v >= 1000 ? compact(v) : v.toFixed(2)}`;
    case "compact":
      return compact(v);
    default:
      return axis ? compact(v) : Number.isInteger(v) ? formatNumber(v) : v >= 1 ? v.toFixed(2) : v.toPrecision(3);
  }
}

export function nameFor(names: Names, col: string | undefined, v: unknown): string | undefined {
  return col && typeof v === "string" ? names[col]?.[v.toLowerCase()] : undefined;
}

function xText(names: Names, x: string | undefined, v: unknown, span: Span): string {
  return nameFor(names, x, v) ?? (isAddress(v) || isHash(v) ? truncate(v, 6) : fmtX(v, span));
}

/* ------------------------------------------------------------------ */
/* stats                                                               */

function statValue(rows: Row[], s: Stat): number | string | null {
  const vals = rows.map((r) => r[s.column]);
  const nums = vals.filter((v): v is number => typeof v === "number");
  switch (s.agg) {
    case "sum":
      return nums.reduce((a, b) => a + b, 0);
    case "avg":
      return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
    case "max":
      return nums.length ? Math.max(...nums) : null;
    case "min":
      return nums.length ? Math.min(...nums) : null;
    case "first":
      return (vals[0] as number | string | undefined) ?? null;
    case "last":
      return (vals[vals.length - 1] as number | string | undefined) ?? null;
    case "count":
      return vals.length;
    case "distinct":
      return new Set(vals.map(String)).size;
  }
}

function StatsStrip({ stats, rows, names, sym }: { stats: Stat[]; rows: Row[]; names: Names; sym: string }) {
  if (stats.length === 0) return null;
  return (
    <div className={cn("grid divide-y divide-zinc-200 border border-zinc-200 sm:divide-x sm:divide-y-0 dark:divide-zinc-800 dark:border-zinc-800", stats.length === 1 ? "sm:grid-cols-1" : stats.length === 2 ? "sm:grid-cols-2" : stats.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-4")}>
      {stats.map((s) => {
        const v = statValue(rows, s);
        const text = typeof v === "number" ? fmt(v, s.format, sym) : v === null ? "…" : (nameFor(names, s.column, v) ?? String(v));
        return (
          <div key={s.label} className="flex flex-col gap-1.5 px-5 py-4">
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">{s.label}</span>
            <span className={cn("font-mono text-[22px] leading-none tabular-nums tracking-tight", INK)}>{text}</span>
            {s.sub && <span className="font-mono text-[11px] text-zinc-400 dark:text-zinc-500">{s.sub}</span>}
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* one panel                                                           */

function PanelChart({
  panel,
  rows,
  names,
  sym,
  canDrill,
  onPick,
  brush,
  range,
  onRange,
  onZoom,
}: {
  panel: Panel;
  rows: Row[];
  names: Names;
  sym: string;
  canDrill: boolean;
  onPick: (row: Row) => void;
  /** this panel carries the range brush */
  brush: boolean;
  range: [number, number] | null;
  onRange: (r: [number, number] | null) => void;
  onZoom: (lo: unknown, hi: unknown) => void;
}) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const x = panel.x!;
  // rankings: order and cut before drawing
  const data = useMemo(() => {
    let d = [...rows];
    if (panel.sortBy) {
      const k = panel.sortBy;
      d.sort((a, b) => ((b[k] as number) ?? 0) - ((a[k] as number) ?? 0));
      if (panel.sortDir === "asc") d.reverse();
    }
    if (panel.topN) d = d.slice(0, panel.topN);
    return d;
  }, [rows, panel.sortBy, panel.sortDir, panel.topN]);
  const span = useMemo(() => spanOf(data.map((r) => r[x])), [data, x]);
  const horizontal = panel.kind === "hbar";
  const left = panel.series.filter((s) => s.axis !== "right");
  const right = panel.series.filter((s) => s.axis === "right");
  const fmtL = left[0]?.format ?? "number";
  const fmtR = right[0]?.format ?? "number";
  const label = (v: unknown) => xText(names, x, v, span);
  const height = horizontal ? Math.max(160, data.length * 26 + 36) : 260;

  // the brush range, summed or averaged per series
  const isRatio = (f: Format) => f === "percent";
  const picked = range ? data.slice(range[0], range[1] + 1) : [];
  const sums = panel.series.map((s) => {
    const vals = picked.map((r) => r[s.column]).filter((v): v is number => typeof v === "number");
    const total = vals.reduce((a, b) => a + b, 0);
    return isRatio(s.format) && vals.length ? total / vals.length : total;
  });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          {panel.title && <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">{panel.title}</span>}
          <span className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-400 dark:text-zinc-500">
            {panel.series.map((s, i) => (
              <span key={s.column} className="flex items-center gap-1.5">
                <span className="h-2 w-2" style={{ background: TONES[i % TONES.length] }} />
                {s.label}
                {s.axis === "right" && <span className="text-zinc-300 dark:text-zinc-600">right</span>}
              </span>
            ))}
          </span>
        </span>
        <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-zinc-300 dark:text-zinc-600">hover reads{canDrill ? " · click opens the records" : ""}{brush ? " · drag the rail selects" : ""}</span>
      </div>
      <div style={{ height }} className={cn("text-zinc-900 dark:text-zinc-100", canDrill && "cursor-pointer")}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={data}
            layout={horizontal ? "vertical" : "horizontal"}
            margin={{ top: 4, right: right.length ? 8 : 12, left: 0, bottom: 0 }}
            barCategoryGap={horizontal ? "26%" : "18%"}
            onClick={(s) => {
              const r = (s as { activePayload?: { payload: Row }[] } | null)?.activePayload?.[0]?.payload;
              if (r && canDrill) onPick(r);
            }}
            onMouseMove={(s) => setHoverIdx(typeof (s as { activeTooltipIndex?: number })?.activeTooltipIndex === "number" ? ((s as { activeTooltipIndex?: number }).activeTooltipIndex as number) : null)}
            onMouseLeave={() => setHoverIdx(null)}
          >
            <CartesianGrid vertical={horizontal} horizontal={!horizontal} stroke="rgba(161,161,170,0.18)" />
            {/* recharts reads axes as direct children: no fragments here */}
            {horizontal && <XAxis type="number" tickFormatter={(v) => fmt(v, fmtL, sym, true)} tick={MONO} tickLine={false} axisLine={false} />}
            {horizontal && <YAxis type="category" dataKey={x} tickFormatter={label} tick={MONO} tickLine={false} axisLine={false} width={150} interval={0} />}
            {!horizontal && <XAxis dataKey={x} tickFormatter={label} tick={MONO} tickLine={false} axisLine={false} minTickGap={28} interval={data.length <= 14 ? 0 : "preserveEnd"} />}
            {!horizontal && <YAxis yAxisId="left" tickFormatter={(v) => fmt(v, fmtL, sym, true)} tick={MONO} tickLine={false} axisLine={false} width={56} />}
            {!horizontal && right.length > 0 && <YAxis yAxisId="right" orientation="right" tickFormatter={(v) => fmt(v, fmtR, sym, true)} tick={MONO} tickLine={false} axisLine={false} width={56} />}
            <RechartsTooltip
              cursor={panel.kind === "line" || panel.kind === "area" ? { stroke: "rgba(161,161,170,0.4)" } : { fill: "rgba(161,161,170,0.10)" }}
              content={({ active, payload }) => {
                if (!active || !payload?.[0]) return null;
                const r = payload[0].payload as Row;
                const name = nameFor(names, x, r[x]);
                return (
                  <TipPlate>
                    <p className="font-mono text-[10px] text-zinc-500">
                      {name ?? fmtX(r[x], span)}
                      {name && <span className="ml-2 text-zinc-300 dark:text-zinc-600">{String(r[x]).length > 20 ? truncate(String(r[x]), 6) : String(r[x])}</span>}
                    </p>
                    {panel.series.map((s, i) => (
                      <p key={s.column} className="flex items-center gap-2 font-mono text-[11px] tabular-nums text-zinc-900 dark:text-zinc-100">
                        <span className="h-1.5 w-1.5" style={{ background: TONES[i % TONES.length] }} />
                        {fmt(r[s.column], s.format, sym)} <span className="text-zinc-400">{s.label}</span>
                      </p>
                    ))}
                    {canDrill && <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-zinc-300 dark:text-zinc-600">click for the records</p>}
                  </TipPlate>
                );
              }}
            />
            {panel.referenceLines.map((l) =>
              horizontal ? (
                <ReferenceLine key={l.label} x={l.y} stroke="#E6212F" strokeDasharray="4 3" label={{ value: l.label, position: "top", fontSize: 10, fontFamily: "var(--font-geist-mono)", fill: "#E6212F" }} />
              ) : (
                <ReferenceLine key={l.label} yAxisId="left" y={l.y} stroke="#E6212F" strokeDasharray="4 3" label={{ value: l.label, position: "insideTopRight", fontSize: 10, fontFamily: "var(--font-geist-mono)", fill: "#E6212F" }} />
              ),
            )}
            {panel.series.map((s, i) => {
              const tone = TONES[i % TONES.length];
              // a ranking has one unnamed axis pair; an explicit undefined id
              // would not match it, so the prop is left out entirely
              const axis = horizontal ? {} : { yAxisId: s.axis === "right" ? "right" : "left" };
              if (panel.kind === "line") return <Line key={s.column} {...axis} type="monotone" dataKey={s.column} stroke={tone} strokeWidth={1.5} dot={false} isAnimationActive={false} connectNulls />;
              if (panel.kind === "area") return <Area key={s.column} {...axis} type="monotone" dataKey={s.column} stroke={tone} fill={tone} fillOpacity={0.16} strokeWidth={1.5} stackId={panel.stacked ? "s" : undefined} isAnimationActive={false} />;
              return (
                <Bar key={s.column} {...axis} dataKey={s.column} fill={tone} stackId={panel.stacked ? "s" : undefined} isAnimationActive={false} minPointSize={1}>
                  {/* the hovered bar keeps full ink; the rest recede */}
                  {data.map((_, j) => (
                    <Cell key={j} fillOpacity={hoverIdx === null || hoverIdx === j ? 0.85 : 0.35} />
                  ))}
                </Bar>
              );
            })}
            {brush && !horizontal && data.length > 12 && (
              <Brush
                dataKey={x}
                height={22}
                travellerWidth={8}
                stroke="#A2AFB2"
                fill="transparent"
                tickFormatter={label}
                onChange={(r) => {
                  const s = r?.startIndex ?? 0;
                  const e = r?.endIndex ?? data.length - 1;
                  onRange(s === 0 && e === data.length - 1 ? null : [s, e]);
                }}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      {brush && range && (
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border border-zinc-900 px-3 py-2 font-mono text-[11px] dark:border-zinc-100">
          <span className="flex flex-wrap items-baseline gap-x-3 tabular-nums text-zinc-900 dark:text-zinc-50">
            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#E6212F]">Selected</span>
            <span>{range[1] - range[0] + 1} points</span>
            <span className="text-zinc-500 dark:text-zinc-400">
              {label(data[range[0]]?.[x])} to {label(data[range[1]]?.[x])}
            </span>
            {panel.series.map((s, i) => (
              <span key={s.column} className="text-zinc-500 dark:text-zinc-400">
                {isRatio(s.format) ? "avg " : ""}
                {fmt(sums[i], s.format, sym)} {s.label}
              </span>
            ))}
          </span>
          <span className="flex items-center gap-4 text-[10px] uppercase tracking-[0.14em]">
            <button type="button" onClick={() => onZoom(data[range[0]]?.[x], data[range[1]]?.[x])} className="text-zinc-600 hover:text-[#E6212F] dark:text-zinc-300">
              Zoom in
            </button>
            <button type="button" onClick={() => onRange(null)} className="text-zinc-400 hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-zinc-50">
              Clear
            </button>
          </span>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

export function QueryVisual({
  visual,
  rows,
  names,
  sym,
  canDrill,
  onPick,
  range,
  onRange,
  onZoom,
}: {
  visual: VisualSpec;
  rows: Row[];
  names: Names;
  sym: string;
  canDrill: boolean;
  onPick: (row: Row) => void;
  range: [number, number] | null;
  onRange: (r: [number, number] | null) => void;
  onZoom: (lo: unknown, hi: unknown) => void;
}) {
  const charts = visual.panels.filter((p) => p.kind !== "table" && p.x && p.series.length > 0);
  // one panel carries the brush: the first full-width time series
  const brushIdx = charts.findIndex((p) => p.kind !== "hbar" && p.width === "full" && spanOf(rows.map((r) => r[p.x!])) !== "other");
  return (
    <div className="flex flex-col gap-6">
      <StatsStrip stats={visual.stats} rows={rows} names={names} sym={sym} />
      {charts.length > 0 && (
        <div className="grid gap-x-8 gap-y-6 lg:grid-cols-2">
          {charts.map((p, i) => (
            <div key={i} className={cn(p.width === "full" && "lg:col-span-2")}>
              <PanelChart panel={p} rows={rows} names={names} sym={sym} canDrill={canDrill} onPick={onPick} brush={i === brushIdx} range={range} onRange={onRange} onZoom={onZoom} />
            </div>
          ))}
        </div>
      )}
      {visual.callouts.length > 0 && (
        <ul className="flex flex-col gap-1.5 border-l-2 border-zinc-900 pl-4 dark:border-zinc-100">
          {visual.callouts.map((c, i) => (
            <li key={i} className="font-mono text-[12px] leading-relaxed text-zinc-700 dark:text-zinc-300">
              {c}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
