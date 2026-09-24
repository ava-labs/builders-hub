"use client";

import { useMemo, useState } from "react";
import { Area, Bar, Brush, CartesianGrid, Cell, ComposedChart, Line, ReferenceArea, ReferenceLine, ResponsiveContainer, Scatter, Tooltip as RechartsTooltip, XAxis, YAxis } from "recharts";
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
  }, [rows, panel.sortBy, panel.sortDir, panel.topN, panel.series]);
  const span = useMemo(() => spanOf(data.map((r) => r[x])), [data, x]);
  const horizontal = panel.kind === "hbar";
  const scatter = panel.kind === "scatter";
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
            {scatter && <XAxis type="number" dataKey={x} domain={["auto", "auto"]} tickFormatter={(v) => fmt(v, "compact", sym, true)} tick={MONO} tickLine={false} axisLine={false} name={x} />}
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
                    {scatter && <p className="font-mono text-[11px] tabular-nums text-zinc-900 dark:text-zinc-100">{fmt(r[x], "number", sym)} <span className="text-zinc-400">{x.replace(/_/g, " ")}</span></p>}
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
              <PanelChart panel={p} rows={rows} names={names} sym={sym} canDrill={canDrill} onPick={onPick} brush={i === brushIdx} range={range} onRange={onRange} onZoom={onZoom} selected={selected} hoverKey={hoverKey} onHoverKey={onHoverKey} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
