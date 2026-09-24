"use client";

import { useMemo, useState } from "react";
import { Area, Bar, Brush, CartesianGrid, Cell, ComposedChart, Line, Pie, PieChart, ReferenceArea, ReferenceLine, ResponsiveContainer, Scatter, Tooltip as RechartsTooltip, XAxis, YAxis } from "recharts";
import { ArrowDown, ArrowUp, ChartArea, ChartBar, ChartColumn, ChartLine, ChartPie, ChartScatter, Sigma, Table2, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { TipPlate } from "@/components/explorer-v2/staking/bits";
import { formatNumber, truncate } from "@/components/explorer-v2/format";
import type { Names } from "@/lib/explorer-query/types";
import type { Format, Panel, Series, Stat, VisualSpec } from "@/lib/explorer-query/visual";

/* Draws what the designer specified: a strip of headline figures, one
   to four panels, and the callouts. Every panel keeps the sheet's
   grammar: hover reads, click opens the records behind a point, a brush
   on a time series selects a range. */

/* ink for what is counted, red only for what failed, then the categorical
   inks for further series */
const TONES = ["currentColor", "#0061E2", "#0d9488", "#d97706", "#7c3aed"];
const FAIL = /revert|fail|error|drop/i;
const toneOf = (s: { column: string; label: string }, i: number) => (FAIL.test(`${s.column} ${s.label}`) ? "#E6212F" : TONES[i % TONES.length]);
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
      return axis
        ? compact(v)
        : Number.isInteger(v)
          ? formatNumber(v)
          : Math.abs(v) >= 1
            ? v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
            : v.toPrecision(3);
  }
}

export function nameFor(names: Names, col: string | undefined, v: unknown): string | undefined {
  return col && typeof v === "string" ? names[col]?.[v.toLowerCase()] : undefined;
}

const clip = (t: string, n = 26) => (t.length > n ? `${t.slice(0, n - 1)}…` : t);

function xText(names: Names, x: string | undefined, v: unknown, span: Span): string {
  const name = nameFor(names, x, v);
  if (name) return clip(name);
  if (isAddress(v) || isHash(v)) return truncate(v, 6);
  if (typeof v === "string" && /^0x[0-9a-fA-F]{8}$/.test(v)) return v.toLowerCase();
  return clip(fmtX(v, span));
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
    <div className={cn("-mx-5 -mt-5 grid border-b border-zinc-200 md:-mx-6 dark:border-zinc-800", stats.length === 1 ? "sm:grid-cols-1" : stats.length === 2 ? "sm:grid-cols-2" : stats.length === 3 ? "sm:grid-cols-3" : "grid-cols-2 sm:grid-cols-4")}>
      {stats.map((s) => {
        const v = statValue(rows, s);
        const text = typeof v === "number" ? fmt(v, s.format, sym) : v === null ? "…" : (nameFor(names, s.column, v) ?? String(v));
        return (
          <div key={s.label} className="flex flex-col gap-2 border-zinc-200 px-5 py-5 [&:not(:first-child)]:border-l md:px-6 dark:border-zinc-800">
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">{s.label}</span>
            <span className="font-mono text-[26px] leading-none tabular-nums tracking-tight text-zinc-900 dark:text-zinc-50">{text}</span>
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
  selected,
  hoverKey,
  onHoverKey,
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
  /** the x value of the group whose records are open */
  selected?: unknown;
  /** the x value under the pointer anywhere on the page (a table row, another panel) */
  hoverKey?: unknown;
  onHoverKey?: (k: unknown) => void;
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
    // every series draws from its own key, so one column can appear raw
    // and transformed (bars and their rolling average) in the same panel
    const out = d.map((r) => ({ ...r }) as Row);
    // a scatter's x axis is numeric; a time column is plotted as epoch ms
    if (panel.kind === "scatter" && panel.x && out.some((r) => isTime(r[panel.x!]))) {
      for (const r of out) r.__x = isTime(r[panel.x]) ? Date.parse(String(r[panel.x]).replace(" ", "T") + (String(r[panel.x]).length <= 10 ? "T00:00:00Z" : "Z")) : null;
    }
    const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
    panel.series.forEach((sr, i) => {
      const k = `__s${i}`;
      const vals = out.map((r) => num(r[sr.column]));
      if (sr.transform === "cumulative") {
        let acc = 0;
        vals.forEach((v, j) => (out[j][k] = v === null ? null : (acc += v)));
      } else if (sr.transform === "indexed") {
        const first = vals.find((v) => v !== null && v !== 0) ?? null;
        vals.forEach((v, j) => (out[j][k] = v === null || first === null ? null : (v / first) * 100));
      } else if (sr.transform === "rolling") {
        vals.forEach((_, j) => {
          const win = vals.slice(Math.max(0, j - 4), j + 1).filter((v): v is number => v !== null);
          out[j][k] = win.length ? win.reduce((a, b) => a + b, 0) / win.length : null;
        });
      } else if (sr.transform === "share") {
        const parts = panel.series.map((p, pi) => ({ p, pi })).filter(({ p }) => p.transform === "share");
        out.forEach((r, j) => {
          const total = parts.reduce((a, { p }) => a + (num(r[p.column]) ?? 0), 0);
          out[j][k] = total > 0 ? ((num(r[sr.column]) ?? 0) / total) * 100 : null;
        });
      } else vals.forEach((v, j) => (out[j][k] = v));
    });
    return out;
  }, [rows, panel.sortBy, panel.sortDir, panel.topN, panel.series, panel.kind, panel.x]);
  const span = useMemo(() => spanOf(data.map((r) => r[x])), [data, x]);
  const horizontal = panel.kind === "hbar";
  const scatter = panel.kind === "scatter";
  const timeX = scatter && data.some((r) => typeof r.__x === "number");
  // a transformed series reads in its own unit: shares are percent, an index is a plain number
  const unitOf = (sr: Series): Format => (sr.transform === "share" ? "percent" : sr.transform === "indexed" ? "number" : sr.format);
  const markOf = (sr: Series): "bar" | "line" | "area" => (horizontal ? "bar" : sr.mark !== "auto" ? sr.mark : panel.kind === "line" ? "line" : panel.kind === "area" ? "area" : "bar");
  const left = panel.series.filter((s) => s.axis !== "right");
  const right = panel.series.filter((s) => s.axis === "right");
  const fmtL = left[0] ? unitOf(left[0]) : "number";
  const fmtR = right[0] ? unitOf(right[0]) : "number";
  // markers and bands name x values; match them to the drawn category
  const xOf = (v: string | number) => data.find((r) => String(r[x]) === String(v))?.[x] as string | number | undefined;
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
  const keyOf = (i: number) => `${panel.series[i]?.column}-${i}`;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1">
        {panel.title && <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">{panel.title}</span>}
        {(panel.series.length > 1 || panel.series.some((sr) => sr.dashed || sr.transform !== "none")) &&
          panel.series.map((s, i) => (
            <span key={`${s.column}-${i}`} className="flex items-center gap-1.5 font-mono text-[10px] text-zinc-500 dark:text-zinc-400">
              {s.dashed ? (
                <span className="w-3 border-t-2 border-dashed" style={{ borderColor: toneOf(s, i) }} />
              ) : markOf(s) === "line" ? (
                <span className="w-3 border-t-2" style={{ borderColor: toneOf(s, i) }} />
              ) : (
                <span className="h-2 w-2" style={{ background: toneOf(s, i) }} />
              )}
              {s.label}
              {s.transform !== "none" && <span className="text-zinc-300 dark:text-zinc-600">{s.transform === "indexed" ? "index" : s.transform}</span>}
            </span>
          ))}
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
            onMouseMove={(s) => {
              const i = (s as { activeTooltipIndex?: number })?.activeTooltipIndex;
              const idx = typeof i === "number" ? i : null;
              setHoverIdx(idx);
              onHoverKey?.(idx === null ? undefined : data[idx]?.[x]);
            }}
            onMouseLeave={() => {
              setHoverIdx(null);
              onHoverKey?.(undefined);
            }}
          >
            <CartesianGrid vertical={horizontal} horizontal={!horizontal} stroke="rgba(161,161,170,0.18)" />
            {/* recharts reads axes as direct children: no fragments here */}
            {horizontal && <XAxis type="number" tickFormatter={(v) => fmt(v, fmtL, sym, true)} tick={MONO} tickLine={false} axisLine={false} />}
            {horizontal && <YAxis type="category" dataKey={x} tickFormatter={label} tick={MONO} tickLine={false} axisLine={false} width={172} interval={0} />}
            {!horizontal && !scatter && <XAxis dataKey={x} tickFormatter={label} tick={MONO} tickLine={false} axisLine={false} minTickGap={28} interval={data.length <= 14 ? 0 : "preserveEnd"} />}
            {scatter && (
              <XAxis
                type="number"
                dataKey={timeX ? "__x" : x}
                domain={timeX ? ["dataMin", "dataMax"] : ["auto", "auto"]}
                tickFormatter={(v: number) => (timeX ? fmtX(new Date(v).toISOString().slice(0, 19).replace("T", " "), span) : fmt(v, "compact", sym, true))}
                tick={MONO}
                tickLine={false}
                axisLine={false}
                minTickGap={28}
                name={x}
              />
            )}
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
                    {scatter && !timeX && <p className="font-mono text-[11px] tabular-nums text-zinc-900 dark:text-zinc-100">{fmt(r[x], "number", sym)} <span className="text-zinc-400">{x.replace(/_/g, " ")}</span></p>}
                    {panel.series.map((s, i) => (
                      <p key={`${s.column}-${i}`} className="flex items-center gap-2 font-mono text-[11px] tabular-nums text-zinc-900 dark:text-zinc-100">
                        <span className="h-1.5 w-1.5" style={{ background: toneOf(s, i) }} />
                        {fmt(r[`__s${i}`], unitOf(s), sym)} <span className="text-zinc-400">{s.label}</span>
                        {s.transform !== "none" && s.transform !== "share" && typeof r[s.column] === "number" && <span className="text-zinc-300 dark:text-zinc-600">raw {fmt(r[s.column], s.format, sym)}</span>}
                      </p>
                    ))}

                  </TipPlate>
                );
              }}
            />
            {hoverIdx === null && hoverKey !== undefined && data.some((r) => r[x] === hoverKey) && (panel.kind === "line" || panel.kind === "area") && (
              <ReferenceLine yAxisId="left" x={hoverKey as string | number} stroke="currentColor" strokeOpacity={0.5} strokeDasharray="2 3" />
            )}
            {!horizontal &&
              !scatter &&
              panel.bands.map((b) => {
                const x1 = xOf(b.from);
                const x2 = xOf(b.to);
                return x1 !== undefined && x2 !== undefined ? (
                  <ReferenceArea key={b.label} yAxisId="left" x1={x1} x2={x2} fill="currentColor" fillOpacity={0.05} stroke="none" label={{ value: b.label, position: "insideTopLeft", fontSize: 10, fontFamily: "var(--font-geist-mono)", fill: "#71717a" }} />
                ) : null;
              })}
            {!horizontal &&
              !scatter &&
              panel.markers.map((m) => {
                const mx = xOf(m.x);
                return mx !== undefined ? (
                  <ReferenceLine key={`${m.label}-${String(m.x)}`} yAxisId="left" x={mx} stroke="#E6212F" strokeOpacity={0.7} strokeDasharray="3 3" label={{ value: m.label, position: "top", fontSize: 10, fontFamily: "var(--font-geist-mono)", fill: "#E6212F" }} />
                ) : null;
              })}
            {panel.referenceLines.map((l) =>
              horizontal ? (
                <ReferenceLine key={l.label} x={l.y} stroke="#E6212F" strokeDasharray="4 3" label={{ value: l.label, position: "top", fontSize: 10, fontFamily: "var(--font-geist-mono)", fill: "#E6212F" }} />
              ) : (
                <ReferenceLine key={l.label} yAxisId="left" y={l.y} stroke="#E6212F" strokeDasharray="4 3" label={{ value: l.label, position: "insideTopRight", fontSize: 10, fontFamily: "var(--font-geist-mono)", fill: "#E6212F" }} />
              ),
            )}
            {panel.series.map((s, i) => {
              const tone = toneOf(s, i);
              const key = `${s.column}-${i}`;
              const dataKey = `__s${i}`;
              // a ranking has one unnamed axis pair; an explicit undefined id
              // would not match it, so the prop is left out entirely
              const axis = horizontal ? {} : { yAxisId: s.axis === "right" ? "right" : "left" };
              const dash = s.dashed ? "5 4" : undefined;
              if (scatter)
                return (
                  <Scatter
                    key={key}
                    {...axis}
                    dataKey={dataKey}
                    fill={tone}
                    fillOpacity={0.7}
                    isAnimationActive={false}
                    onClick={(d: { payload?: Row }) => d?.payload && canDrill && onPick(d.payload)}
                  />
                );
              const mark = markOf(s);
              if (mark === "line")
                return <Line key={key} {...axis} type="monotone" dataKey={dataKey} stroke={tone} strokeWidth={s.transform === "rolling" ? 2 : 1.5} strokeDasharray={dash} dot={false} isAnimationActive={false} connectNulls />;
              if (mark === "area")
                return <Area key={key} {...axis} type="monotone" dataKey={dataKey} stroke={tone} fill={tone} fillOpacity={s.dashed ? 0.05 : 0.16} strokeWidth={1.5} strokeDasharray={dash} stackId={panel.stacked ? `s-${s.axis}` : undefined} isAnimationActive={false} />;
              return (
                <Bar key={key} {...axis} dataKey={dataKey} fill={tone} stroke={s.dashed ? tone : undefined} strokeDasharray={dash} stackId={panel.stacked ? `s-${s.axis}` : undefined} isAnimationActive={false} minPointSize={1}>
                  {/* the hovered bar keeps full ink; the rest recede */}
                  {data.map((_, j) => (
                    <Cell
                      key={j}
                      fillOpacity={
                        (s.dashed ? 0.35 : 1) *
                        (hoverIdx === null && hoverKey !== undefined
                          ? data[j]?.[x] === hoverKey
                            ? 0.95
                            : 0.3
                          : selected !== undefined
                            ? data[j]?.[x] === selected || hoverIdx === j
                              ? 0.9
                              : 0.25
                            : hoverIdx === null || hoverIdx === j
                              ? 0.85
                              : 0.35)
                      }
                    />
                  ))}
                </Bar>
              );
            })}
            {brush && !horizontal && !scatter && data.length > 12 && (
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
              <span key={keyOf(i)} className="text-zinc-500 dark:text-zinc-400">
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
  selected,
  hoverKey,
  onHoverKey,
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
  selected?: unknown;
  hoverKey?: unknown;
  onHoverKey?: (k: unknown) => void;
}) {
  const charts = visual.panels.filter((p) => p.kind !== "table" && p.x && p.series.length > 0);
  // one panel carries the brush: the first full-width time series
  const brushIdx = charts.findIndex((p) => p.kind !== "hbar" && p.kind !== "scatter" && p.width === "full" && spanOf(rows.map((r) => r[p.x!])) !== "other");
  return (
    <div className="flex flex-col gap-6">
      <StatsStrip stats={visual.stats} rows={rows} names={names} sym={sym} />
      {charts.length > 0 && (
        <div className="grid gap-x-8 gap-y-6 lg:grid-cols-2">
          {charts.map((p, i) => (
            <div key={i} className={cn(p.width === "full" && "lg:col-span-2")}>
              <PanelBlock panel={p} rows={rows} names={names} sym={sym} canDrill={canDrill} onPick={onPick} brush={i === brushIdx} range={range} onRange={onRange} onZoom={onZoom} selected={selected} hoverKey={hoverKey} onHoverKey={onHoverKey} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* one panel, seen any way the data allows                              */

type View = "line" | "area" | "bar" | "hbar" | "pie" | "scatter" | "table";

const VIEW_META: Record<View, { label: string; icon: LucideIcon }> = {
  line: { label: "Line", icon: ChartLine },
  area: { label: "Area", icon: ChartArea },
  bar: { label: "Columns", icon: ChartColumn },
  hbar: { label: "Bars", icon: ChartBar },
  pie: { label: "Pie", icon: ChartPie },
  scatter: { label: "Scatter", icon: ChartScatter },
  table: { label: "Table", icon: Table2 },
};

/** the views that fit a panel's shape: time reads as a line, an area,
    columns or a table; groups as bars, a pie or a table; two measures as
    a scatter or a table */
function viewsFor(panel: Panel, rows: Row[]): View[] {
  if (panel.kind === "scatter") return ["scatter", "table"];
  const time = spanOf(rows.map((r) => r[panel.x!])) !== "other";
  if (time) return ["line", "area", "bar", "table"];
  const first = panel.series[0]?.column;
  const parts = !!first && rows.length >= 2 && rows.every((r) => typeof r[first] !== "number" || (r[first] as number) >= 0) && panel.series[0].format !== "percent";
  return parts ? ["hbar", "pie", "table"] : ["hbar", "table"];
}

type PanelProps = Parameters<typeof PanelChart>[0];

function PanelBlock(props: PanelProps) {
  const { panel, rows } = props;
  const views = useMemo(() => viewsFor(panel, rows), [panel, rows]);
  const start: View = views.includes(panel.kind as View) ? (panel.kind as View) : panel.kind === "bar" && views.includes("hbar") ? "hbar" : views[0];
  const [view, setView] = useState<View>(start);
  // a running total, for counts over time; shares and rates do not add up
  const canRun = views.includes("line") && panel.series.some((s) => s.format !== "percent" && s.transform === "none");
  const [running, setRunning] = useState(false);
  const drawn: Panel = useMemo(
    () => ({
      ...panel,
      title: "",
      kind: view === "pie" || view === "table" ? panel.kind : view,
      // a view the reader picked applies to every series; the designer's
      // mixed marks (bars with a rate line) belong to its own view
      series: panel.series.map((s) => ({
        ...s,
        mark: view === start ? s.mark : ("auto" as const),
        transform: running && s.format !== "percent" && s.transform === "none" ? ("cumulative" as const) : s.transform,
      })),
    }),
    [panel, view, running, start],
  );

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <span className="min-w-0 truncate font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
          {panel.title}
          {running && <span className="ml-2 font-normal text-zinc-400 dark:text-zinc-500">running total</span>}
        </span>
        <div role="group" aria-label={`View ${panel.title || "panel"} as`} className="flex shrink-0 items-center gap-0.5 rounded-lg border border-zinc-200 p-0.5 dark:border-zinc-800">
          {views.map((v) => {
            const { label, icon: Icon } = VIEW_META[v];
            return (
              <button
                key={v}
                type="button"
                title={label}
                aria-label={label}
                aria-pressed={view === v}
                onClick={() => setView(v)}
                className={cn(
                  "flex h-6 w-6 items-center justify-center rounded-md transition-colors",
                  view === v ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900" : "text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-500 dark:hover:bg-zinc-900 dark:hover:text-zinc-100",
                )}
              >
                <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
              </button>
            );
          })}
          {canRun && view !== "table" && (
            <>
              <span className="mx-0.5 h-4 w-px bg-zinc-200 dark:bg-zinc-800" />
              <button
                type="button"
                title="Running total"
                aria-label="Running total"
                aria-pressed={running}
                onClick={() => setRunning((r) => !r)}
                className={cn(
                  "flex h-6 w-6 items-center justify-center rounded-md transition-colors",
                  running ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900" : "text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-500 dark:hover:bg-zinc-900 dark:hover:text-zinc-100",
                )}
              >
                <Sigma className="h-3.5 w-3.5" strokeWidth={1.75} />
              </button>
            </>
          )}
        </div>
      </div>
      {view === "pie" ? <PieView {...props} /> : view === "table" ? <PanelTable {...props} /> : <PanelChart {...props} panel={drawn} brush={props.brush && view !== "hbar"} />}
    </div>
  );
}

const PIE_TONES = ["currentColor", "#0061E2", "#0d9488", "#d97706", "#7c3aed", "#db2777", "#65a30d"];
const PIE_MAX = 7;

/** parts of a whole: the leaders as slices, the rest as one grey slice */
function PieView({ panel, rows, names, sym, canDrill, onPick, hoverKey, onHoverKey }: PanelProps) {
  const x = panel.x!;
  const s = panel.series[0];
  const { slices, total } = useMemo(() => {
    const sorted = [...rows].filter((r) => typeof r[s.column] === "number" && (r[s.column] as number) > 0).sort((a, b) => (b[s.column] as number) - (a[s.column] as number));
    const total = sorted.reduce((a, r) => a + (r[s.column] as number), 0);
    const head = sorted.slice(0, PIE_MAX).map((r, i) => ({ key: r[x], label: xText(names, x, r[x], "other"), value: r[s.column] as number, row: r as Row | null, tone: PIE_TONES[i] }));
    const rest = sorted.slice(PIE_MAX).reduce((a, r) => a + (r[s.column] as number), 0);
    if (rest > 0) head.push({ key: "__rest", label: `${sorted.length - PIE_MAX} more`, value: rest, row: null, tone: "#d4d4d8" });
    return { slices: head, total };
  }, [rows, s.column, x, names]);
  const lit = (k: unknown) => hoverKey === undefined || hoverKey === k;

  return (
    <div className="grid items-center gap-6 sm:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]">
      <div className="relative h-60 text-zinc-900 dark:text-zinc-100">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={slices}
              dataKey="value"
              nameKey="label"
              innerRadius="62%"
              outerRadius="96%"
              paddingAngle={1}
              stroke="none"
              isAnimationActive={false}
              onMouseEnter={(d: { payload?: { key: unknown } }) => onHoverKey?.(d?.payload?.key)}
              onMouseLeave={() => onHoverKey?.(undefined)}
              onClick={(d: { payload?: { row: Row | null } }) => d?.payload?.row && canDrill && onPick(d.payload.row)}
            >
              {slices.map((sl) => (
                <Cell key={String(sl.key)} fill={sl.tone} fillOpacity={lit(sl.key) ? 1 : 0.25} cursor={sl.row && canDrill ? "pointer" : "default"} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-mono text-[18px] tabular-nums text-zinc-900 dark:text-zinc-50">{fmt(total, s.format, sym)}</span>
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">{s.label}</span>
        </div>
      </div>
      <ul className="flex flex-col">
        {slices.map((sl) => (
          <li key={String(sl.key)}>
            <button
              type="button"
              disabled={!sl.row || !canDrill}
              onClick={() => sl.row && onPick(sl.row)}
              onMouseEnter={() => onHoverKey?.(sl.key)}
              onMouseLeave={() => onHoverKey?.(undefined)}
              className={cn("flex w-full items-center gap-3 border-b border-zinc-100 py-1.5 text-left transition-opacity dark:border-zinc-900", !lit(sl.key) && "opacity-40", sl.row && canDrill && "hover:bg-zinc-50 dark:hover:bg-zinc-900")}
            >
              <span className="h-2 w-2 shrink-0 rounded-[2px] text-zinc-900 dark:text-zinc-100" style={{ background: sl.tone }} />
              <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-zinc-800 dark:text-zinc-200">{sl.label}</span>
              <span className="font-mono text-[12px] tabular-nums text-zinc-900 dark:text-zinc-50">{fmt(sl.value, s.format, sym)}</span>
              <span className="w-12 text-right font-mono text-[11px] tabular-nums text-zinc-400 dark:text-zinc-500">{total ? `${((sl.value / total) * 100).toFixed(sl.value / total < 0.1 ? 1 : 0)}%` : ""}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** the panel's own rows as a table: its x and its series, sortable */
function PanelTable({ panel, rows, names, sym, canDrill, onPick, hoverKey, onHoverKey }: PanelProps) {
  const x = panel.x!;
  const span = useMemo(() => spanOf(rows.map((r) => r[x])), [rows, x]);
  const [sort, setSort] = useState<{ col: string; dir: "asc" | "desc" } | null>(null);
  const shown = useMemo(() => {
    if (!sort) return rows;
    const k = sort.col;
    return [...rows].sort((a, b) => {
      const va = a[k];
      const vb = b[k];
      const c = typeof va === "number" && typeof vb === "number" ? va - vb : String(va ?? "").localeCompare(String(vb ?? ""));
      return sort.dir === "asc" ? c : -c;
    });
  }, [rows, sort]);
  const cols = [{ column: x, label: x.replace(/_/g, " "), format: "number" as Format, isX: true }, ...panel.series.map((s) => ({ column: s.column, label: s.label, format: s.format, isX: false }))];
  const flip = (col: string) => setSort((cur) => (cur?.col === col ? (cur.dir === "desc" ? { col, dir: "asc" } : null) : { col, dir: "desc" }));

  return (
    <div className="max-h-[26rem] overflow-auto border-t border-zinc-200 dark:border-zinc-800">
      <table className="w-full border-collapse font-mono text-[12px] tabular-nums">
        <thead className="sticky top-0 bg-white dark:bg-zinc-950">
          <tr>
            {cols.map((c) => (
              <th key={c.column} className={cn("border-b border-zinc-200 px-3 py-2 font-normal dark:border-zinc-800", c.isX ? "text-left" : "text-right")}>
                <button type="button" onClick={() => flip(c.column)} className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.14em] text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100">
                  {c.label}
                  {sort?.col === c.column && (sort.dir === "desc" ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />)}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {shown.map((r, i) => (
            <tr
              key={i}
              onClick={() => canDrill && onPick(r)}
              onMouseEnter={() => onHoverKey?.(r[x])}
              onMouseLeave={() => onHoverKey?.(undefined)}
              className={cn("border-b border-zinc-100 transition-colors dark:border-zinc-900", canDrill && "cursor-pointer", hoverKey !== undefined && hoverKey === r[x] ? "bg-zinc-50 dark:bg-zinc-900" : canDrill && "hover:bg-zinc-50 dark:hover:bg-zinc-900")}
            >
              {cols.map((c) => (
                <td key={c.column} className={cn("px-3 py-1.5", c.isX ? "text-left text-zinc-800 dark:text-zinc-200" : "text-right text-zinc-900 dark:text-zinc-50")}>
                  {c.isX ? xText(names, x, r[x], span === "other" ? "other" : span) : fmt(r[c.column], c.format, sym)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
