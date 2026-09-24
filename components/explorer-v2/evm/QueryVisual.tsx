"use client";

import { useId, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent as ReactMouseEvent, type ReactNode } from "react";
import { Area, Bar, CartesianGrid, Cell, ComposedChart, Line, Pie, PieChart, ReferenceArea, ReferenceLine, ResponsiveContainer, Scatter, Tooltip as RechartsTooltip, XAxis, YAxis } from "recharts";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowDown, ArrowUp, ChartArea, ChartBar, ChartColumn, ChartLine, ChartPie, ChartScatter, ChevronRight, Sigma, Table2, X as XIcon, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { TipPlate } from "@/components/explorer-v2/staking/bits";
import { formatNumber, truncate } from "@/components/explorer-v2/format";
import type { Names } from "@/lib/explorer-query/types";
import { EMPTY, applySelection, clearColumn, matches, order, toggleValue, withPick, type Selection } from "@/lib/explorer-query/selection";
import type { Format, Panel, Series, Stat, VisualSpec } from "@/lib/explorer-query/visual";
import { CHART_MS, FADE_CLASS, MOTION, useNarrow, useReduced, useTween } from "./query/motion";

/* Draws what the designer specified: a strip of headline figures, one
   to four panels, and the callouts. The chart is the index of the rows:
   hover reads a mark, a drag across a time chart or a click on a bar or
   a slice selects, and every figure on the sheet follows the selection.
   Opening the records behind a mark is a small door (the chevron, a
   double click, Enter), so a plain click can mean select. */

/* ink for what is counted, red only for what failed, then the categorical
   inks for further series */
const TONES = ["currentColor", "#0061E2", "#0d9488", "#d97706", "#7c3aed"];
const FAIL = /revert|fail|error|drop/i;
const toneOf = (s: { column: string; label: string }, i: number) => (FAIL.test(`${s.column} ${s.label}`) ? "#E6212F" : TONES[i % TONES.length]);
const MONO = { fontSize: 10, fontFamily: "var(--font-geist-mono)" };
/** the selection's one accent: brush, picked range */
const ACCENT = "#0061E2";
/** how far an unselected mark recedes */
const DIM = 0.22;

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
/* selection helpers                                                   */

const inSelection = (sel: Selection, r: Row) => sel.every((p) => matches(r, p));
const pickValue = (v: unknown): string | number => (typeof v === "number" ? v : String(v ?? ""));

/** the column a panel's gestures select on, or undefined when it has none
    (tables, scatters: their x is a measure, not an index) */
export function panelFilterColumn(panel: Panel): string | undefined {
  return panel.kind === "table" || panel.kind === "scatter" ? undefined : panel.x;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** a time as a person says it: "Sep 3", or "Sep 3 14:00" inside a day */
function when(v: string): { day: string; hm: string } {
  const d = new Date(order(v) as number);
  const hm = v.length > 10 ? v.replace("T", " ").slice(11, 16) : "";
  return { day: `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`, hm: hm === "00:00" ? "" : hm };
}

function chipValue(names: Names, column: string, v: string | number): string {
  if (typeof v === "string" && isTime(v)) {
    const w = when(v);
    return w.hm ? `${w.day} ${w.hm}` : w.day;
  }
  return xText(names, column, v, "other");
}

function chipRange(names: Names, column: string, from: string | number, to: string | number): string {
  if (from === to) return chipValue(names, column, from);
  if (typeof from === "string" && typeof to === "string" && isTime(from) && isTime(to)) {
    const a = when(from);
    const b = when(to);
    if (a.day === b.day) return a.hm || b.hm ? `${a.day} ${a.hm || "00:00"} to ${b.hm || "24:00"}` : a.day;
    return `${a.hm ? `${a.day} ${a.hm}` : a.day} to ${b.hm ? `${b.day} ${b.hm}` : b.day}`;
  }
  return `${chipValue(names, column, from)} to ${chipValue(names, column, to)}`;
}

/* ------------------------------------------------------------------ */
/* the selection, as chips                                             */

export function SelectionChips({
  selection,
  onSelection,
  names,
  formatValue,
  onZoom,
  className,
}: {
  selection: Selection;
  onSelection: (s: Selection) => void;
  names: Names;
  /** a label for one picked value; return undefined to use the default */
  formatValue?: (column: string, value: string | number) => string | undefined;
  /** when given, a range pick offers to ask again inside that range */
  onZoom?: (lo: unknown, hi: unknown) => void;
  className?: string;
}) {
  const reduced = useReduced();
  const chips = selection.flatMap((p) =>
    p.kind === "range"
      ? [{ key: `${p.column}:range`, text: chipRange(names, p.column, p.from, p.to), column: p.column, drop: () => onSelection(clearColumn(selection, p.column)) }]
      : p.values.map((v) => ({
          key: `${p.column}:${v}`,
          text: formatValue?.(p.column, v) ?? chipValue(names, p.column, v),
          column: p.column,
          drop: () => onSelection(withPick(selection, { kind: "value", column: p.column, values: p.values.filter((q) => q !== v) })),
        })),
  );
  const range = selection.find((p) => p.kind === "range");
  const t = reduced ? { duration: 0 } : MOTION;
  return (
    <AnimatePresence initial={false}>
      {chips.length > 0 && (
        <motion.div key="chips" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={t} className={cn("overflow-hidden", className)}>
          <div role="list" aria-label="Selection" className="flex flex-wrap items-center gap-1.5 pb-1">
            <AnimatePresence initial={false} mode="popLayout">
              {chips.map((c) => (
                <motion.span
                  key={c.key}
                  role="listitem"
                  layout={!reduced}
                  initial={{ opacity: 0, scale: 0.92 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.92 }}
                  transition={t}
                  title={c.column.replace(/_/g, " ")}
                  className="inline-flex items-center gap-1 rounded-full bg-zinc-100 py-0.5 pr-0.5 pl-2.5 font-mono text-[11px] tabular-nums text-zinc-800 dark:bg-zinc-800/80 dark:text-zinc-100"
                >
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: ACCENT }} />
                  {c.text}
                  <button
                    type="button"
                    onClick={c.drop}
                    aria-label={`Remove ${c.text}`}
                    className="flex h-5 w-5 items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-zinc-200 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0061E2]/50 dark:text-zinc-500 dark:hover:bg-zinc-700 dark:hover:text-zinc-50"
                  >
                    <XIcon className="h-3 w-3" strokeWidth={2} />
                  </button>
                </motion.span>
              ))}
            </AnimatePresence>
            {range && onZoom && (
              <button
                type="button"
                onClick={() => onZoom(range.from, range.to)}
                className="rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500 transition-colors hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0061E2]/50 dark:text-zinc-400 dark:hover:text-zinc-50"
              >
                Zoom in
              </button>
            )}
            <button
              type="button"
              onClick={() => onSelection([])}
              className="rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 transition-colors hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0061E2]/50 dark:text-zinc-500 dark:hover:text-zinc-50"
            >
              Clear
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
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

const pct = (p: number) => (p >= 10 || p === 0 ? p.toFixed(0) : p.toFixed(1));

/** how the selection's figure stands against the whole answer's */
function compare(s: Stat, v: number | string | null, all: number | string | null, text: (v: number | string) => string): string | undefined {
  if (s.agg === "first" || s.agg === "last") return all === null ? undefined : `all ${text(all)}`;
  if (typeof v !== "number" || typeof all !== "number" || all === 0) return undefined;
  if (s.agg === "sum" || s.agg === "count" || s.agg === "distinct") return `${pct((v / all) * 100)}% of all`;
  const d = ((v - all) / Math.abs(all)) * 100;
  if (Math.abs(d) < 0.5) return `${s.agg} same as all`;
  return `${s.agg} ${pct(Math.abs(d))}% ${d > 0 ? "above" : "below"} all`;
}

/* the column behind a figure, as a strip of bars in row order: the
   peak (for max) or the selected rows (while selecting) carry the ink */
function Spark({ s, rows, all }: { s: Stat; rows: Row[]; all: Row[] }) {
  const bars = useMemo(() => {
    // only rows that run through time make a strip worth reading; a
    // ranking in row order is one tall bar and a slope
    const when = Object.keys(all[0] ?? {}).find((k) => isTime(all[0][k]));
    if (!when || all.length < 6) return null;
    const timed = [...all].sort((a, b) => String(a[when]).localeCompare(String(b[when]))).slice(-80);
    const nums = timed.map((r) => r[s.column]);
    if (!nums.every((v): v is number => typeof v === "number" && v >= 0)) return null;
    const hi = Math.max(...nums) || 1;
    const picked = new Set(rows);
    const peak = nums.indexOf(hi);
    // square root heights, so one spike leaves the rest readable
    return nums.map((v, i) => ({ h: Math.max(0.08, Math.sqrt(v / hi)), ink: rows.length < all.length ? picked.has(timed[i]) : s.agg === "max" ? i === peak : false }));
  }, [s.column, s.agg, rows, all]);
  if (!bars) return null;
  return (
    <span aria-hidden className="mt-1 flex h-5 items-end gap-px">
      {bars.map((b, i) => (
        <span
          key={i}
          className={cn("min-w-px flex-1 rounded-[1px] transition-colors duration-300", b.ink ? "bg-[#0061E2] dark:bg-[#5b9bff]" : "bg-zinc-200 dark:bg-zinc-800")}
          style={{ height: `${b.h * 100}%` }}
        />
      ))}
    </span>
  );
}

function StatFigure({ s, rows, all, names, sym, active }: { s: Stat; rows: Row[]; all: Row[]; names: Names; sym: string; active: boolean }) {
  const reduced = useReduced();
  const v = statValue(rows, s);
  const num = typeof v === "number" ? v : null;
  const t = useTween(num);
  const text = (x: number | string) => (typeof x === "number" ? fmt(x, s.format, sym) : (nameFor(names, s.column, x) ?? String(x)));
  const shown = num !== null ? fmt(t !== null && Number.isInteger(num) ? Math.round(t) : (t ?? num), s.format, sym) : v === null ? "…" : text(v);
  const sub = active ? compare(s, v, statValue(all, s), text) : s.sub;
  return (
    <div className="flex min-w-0 flex-col gap-1.5 px-4 py-4 sm:gap-2 sm:px-5 sm:py-5 md:px-6">
      <span className="truncate font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">{s.label}</span>
      <span className="truncate font-mono text-[21px] leading-none tabular-nums tracking-tight text-zinc-900 sm:text-[26px] dark:text-zinc-50">{shown}</span>
      <AnimatePresence mode="wait" initial={false}>
        {sub && (
          <motion.span
            key={`${active}-${sub.replace(/[\d.,]+/g, "#")}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={reduced ? { duration: 0 } : MOTION}
            className={cn("font-mono text-[11px] tabular-nums", active ? "text-[#0061E2] dark:text-[#5b9bff]" : "text-zinc-400 dark:text-zinc-500")}
          >
            {sub}
          </motion.span>
        )}
      </AnimatePresence>
      <Spark s={s} rows={rows} all={all} />
    </div>
  );
}

function StatsStrip({ stats, rows, all, names, sym, active }: { stats: Stat[]; rows: Row[]; all: Row[]; names: Names; sym: string; active: boolean }) {
  if (stats.length === 0) return null;
  return (
    <div
      className={cn(
        "-mx-5 -mt-5 grid grid-cols-2 border-b border-zinc-100 md:-mx-6 dark:border-zinc-900 [&>*]:border-zinc-100 dark:[&>*]:border-zinc-900 [&>*:nth-child(even)]:border-l sm:[&>*+*]:border-l",
        stats.length === 1 ? "grid-cols-1" : stats.length === 2 ? "sm:grid-cols-2" : stats.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-4",
        stats.length > 2 && "[&>*:nth-child(n+3)]:border-t sm:[&>*:nth-child(n+3)]:border-t-0",
      )}
    >
      {stats.map((s) => (
        <StatFigure key={s.label} s={s} rows={rows} all={all} names={names} sym={sym} active={active} />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* one panel                                                           */

type PanelProps = {
  panel: Panel;
  /** a control the page adds to the panel header, e.g. pin to a board */
  action?: ReactNode;
  /** draw the panel's own title; off where a tile already names it */
  titled?: boolean;
  /** every row of the answer; marks outside the selection dim, they do not leave */
  rows: Row[];
  names: Names;
  sym: string;
  canDrill: boolean;
  onPick: (row: Row) => void;
  /** the x value of the group whose records are open */
  selected?: unknown;
  /** the x value under the pointer anywhere on the page (a table row, another panel) */
  hoverKey?: unknown;
  onHoverKey?: (k: unknown) => void;
  /** the page's whole selection, for writing back */
  selection: Selection;
  /** the picks on columns these rows have: what dims and filters */
  live: Selection;
  onSelection?: (s: Selection) => void;
  compact: boolean;
  /** a log y axis: one outlier no longer flattens every other mark */
  log?: boolean;
};

/** the small door to a mark's records, drawn beside the hovered bar */
function OpenMark({ cx, cy, label, onOpen }: { cx: number; cy: number; label: string; onOpen: () => void }) {
  return (
    <g
      transform={`translate(${cx},${cy})`}
      role="button"
      aria-label={`Open ${label}`}
      className="cursor-pointer"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        onOpen();
      }}
    >
      <circle r={9} className="fill-white stroke-zinc-300 dark:fill-zinc-900 dark:stroke-zinc-600" strokeWidth={1} />
      <path d="M-1.5 -3.5 L2 0 L-1.5 3.5" fill="none" className="stroke-zinc-700 dark:stroke-zinc-200" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </g>
  );
}

function PanelChart({ panel, rows, names, sym, canDrill, onPick, selected, hoverKey, onHoverKey, selection, live, onSelection, compact, log = false }: PanelProps) {
  const reduced = useReduced();
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [kb, setKb] = useState<number | null>(null);
  const [inside, setInside] = useState(false);
  const [drag, setDrag] = useState<[number, number] | null>(null);
  const dragRef = useRef<{ a: number; b: number } | null>(null);
  const dragged = useRef(false);
  const x = panel.x!;
  // rankings: order and cut before drawing; src keeps the page's own row
  // objects, so a pick hands back a row the page can find
  const { base, src } = useMemo(() => {
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
    return { base: out, src: d };
  }, [rows, panel.sortBy, panel.sortDir, panel.topN, panel.series, panel.kind, panel.x]);
  const span = useMemo(() => spanOf(base.map((r) => r[x])), [base, x]);
  const horizontal = panel.kind === "hbar";
  const narrow = useNarrow();
  const scatter = panel.kind === "scatter";
  const timeX = scatter && base.some((r) => typeof r.__x === "number");
  // time or numeric buckets are a continuum: drag to select a range.
  // anything else is a set of categories: click to pick values
  const continuous = !horizontal && !scatter && (span !== "other" || (base.length > 0 && base.every((r) => typeof r[x] === "number")));
  const category = !continuous && !scatter;
  const selecting = !!onSelection && !scatter;
  // a transformed series reads in its own unit: shares are percent, an index is a plain number
  const unitOf = (sr: Series): Format => (sr.transform === "share" ? "percent" : sr.transform === "indexed" ? "number" : sr.format);
  const markOf = (sr: Series): "bar" | "line" | "area" => (horizontal ? "bar" : sr.mark !== "auto" ? sr.mark : panel.kind === "line" ? "line" : panel.kind === "area" ? "area" : "bar");
  const left = panel.series.filter((s) => s.axis !== "right");
  const right = panel.series.filter((s) => s.axis === "right");
  const fmtL = left[0] ? unitOf(left[0]) : "number";
  const fmtR = right[0] ? unitOf(right[0]) : "number";

  const hasSel = live.length > 0;
  const lit = useMemo(() => base.map((r) => !hasSel || inSelection(live, r)), [base, live, hasSel]);
  const litCount = lit.filter(Boolean).length;
  // lines and areas cannot dim point by point: the whole trace recedes and
  // the selected stretch is drawn again over it in full ink
  const traces = !scatter && panel.series.some((s) => markOf(s) !== "bar");
  const data = useMemo(() => {
    if (!hasSel || !traces) return base;
    return base.map((r, j) => {
      const o: Row = { ...r };
      panel.series.forEach((_, i) => (o[`__in${i}`] = lit[j] ? r[`__s${i}`] : null));
      return o;
    });
  }, [base, lit, hasSel, traces, panel.series]);

  // markers and bands name x values; match them to the drawn category
  const xOf = (v: string | number) => data.find((r) => String(r[x]) === String(v))?.[x] as string | number | undefined;
  const label = (v: unknown) => xText(names, x, v, span);
  const rowH = compact ? 22 : 26;
  const height = horizontal ? Math.max(compact ? 120 : 160, data.length * rowH + 36) : compact ? 180 : 260;
  const active = hoverIdx ?? kb;
  const drillMark = category && selecting && canDrill;
  // the chevron sits on the bar that ends the stack, or the first bar
  const barIdx = panel.series.map((s, i) => ({ s, i })).filter(({ s }) => markOf(s) === "bar");
  const doorSeries = drillMark && barIdx.length ? (panel.stacked ? barIdx[barIdx.length - 1].i : barIdx[0].i) : -1;
  const rangePick = live.find((p) => p.kind === "range" && p.column === x);

  const describe = (j: number) => {
    const r = data[j];
    if (!r) return "";
    const figures = panel.series.map((s, i) => `${fmt(r[`__s${i}`], unitOf(s), sym)} ${s.label}`).join(", ");
    return `${nameFor(names, x, r[x]) ?? label(r[x])}: ${figures}${hasSel && lit[j] ? ", selected" : ""}`;
  };

  /* gestures */
  const toggle = (j: number, additive: boolean) => {
    const r = data[j];
    if (!r || !onSelection) return;
    onSelection(toggleValue(selection, x, String(r[x] ?? ""), additive));
  };
  const setRange = (a: number, b: number) => {
    if (!onSelection) return;
    const vals = data.slice(Math.min(a, b), Math.max(a, b) + 1).map((r) => pickValue(r[x]));
    const sorted = [...vals].sort((p, q) => {
      const op = order(p);
      const oq = order(q);
      return op < oq ? -1 : op > oq ? 1 : 0;
    });
    if (sorted.length) onSelection(withPick(selection, { kind: "range", column: x, from: sorted[0], to: sorted[sorted.length - 1] }));
  };
  /** Space on a continuous chart: anchor a one-point range, then stretch it */
  const spaceRange = (j: number) => {
    if (!onSelection) return;
    const v = pickValue(data[j]?.[x]);
    const cur = selection.find((p) => p.column === x && p.kind === "range");
    if (!cur || cur.kind !== "range") return onSelection(withPick(selection, { kind: "range", column: x, from: v, to: v }));
    if (cur.from === v && cur.to === v) return onSelection(clearColumn(selection, x));
    const all = [cur.from, cur.to, v];
    const lo = all.reduce((m, q) => (order(q) < order(m) ? q : m));
    const hi = all.reduce((m, q) => (order(q) > order(m) ? q : m));
    onSelection(withPick(selection, { kind: "range", column: x, from: lo, to: hi }));
  };
  const drill = (j: number | null | undefined) => {
    if (typeof j === "number" && src[j] && canDrill) onPick(src[j]);
  };
  const walk = (j: number | null) => {
    setKb(j);
    onHoverKey?.(j === null ? undefined : data[j]?.[x]);
  };
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const n = data.length;
    if (!n) return;
    const next = e.key === "ArrowRight" || e.key === "ArrowDown";
    const prev = e.key === "ArrowLeft" || e.key === "ArrowUp";
    if (next || prev) {
      e.preventDefault();
      setHoverIdx(null);
      const cur = kb ?? (next ? -1 : n);
      walk(Math.max(0, Math.min(n - 1, cur + (next ? 1 : -1))));
    } else if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      walk(e.key === "Home" ? 0 : n - 1);
    } else if (e.key === "Enter") {
      if (kb !== null && canDrill) {
        e.preventDefault();
        drill(kb);
      }
    } else if (e.key === " ") {
      if (kb !== null && selecting) {
        e.preventDefault();
        if (category) toggle(kb, true);
        else spaceRange(kb);
      }
    } else if (e.key === "Escape") {
      if (onSelection && selection.length) {
        e.preventDefault();
        onSelection([]);
      }
      walk(null);
    }
  };

  const idxOf = (s: unknown) => {
    const i = (s as { activeTooltipIndex?: number } | null)?.activeTooltipIndex;
    return typeof i === "number" && i >= 0 && i < data.length ? i : null;
  };

  /** a bar's ink: the selection first, then the drill, then the pointer */
  const inkOf = (j: number, dashed: boolean) => {
    const r = data[j];
    let o = lit[j] ? 0.9 : DIM;
    if (selected !== undefined && r?.[x] !== selected) o = Math.min(o, 0.3);
    const focus = active !== null ? active === j : hoverKey !== undefined ? r?.[x] === hoverKey : null;
    if (focus === true) o = lit[j] ? 1 : 0.5;
    else if (focus === false && !hasSel && selected === undefined) o = 0.4;
    return (dashed ? 0.35 : 1) * o;
  };

  const anim = { isAnimationActive: !reduced, animationDuration: CHART_MS, animationEasing: "ease-out" as const };
  const traceInk = hasSel ? 0.3 : 1;
  const mode = scatter ? "scatter" : horizontal ? "ranking" : continuous ? "series" : "columns";
  const hint = selecting ? (category ? "Arrow keys move, Space selects, Enter opens, Escape clears." : "Arrow keys move, Space marks a range, Enter opens, Escape clears.") : "Arrow keys move, Enter opens.";

  return (
    <div className="flex flex-col gap-3">
      {(panel.series.length > 1 || panel.series.some((sr) => sr.dashed || sr.transform !== "none")) && (
        <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1">
          {panel.series.map((s, i) => (
            <span key={`${s.column}-${i}`} className="flex items-center gap-1.5 font-mono text-[10px] text-zinc-500 dark:text-zinc-400">
              {s.dashed ? (
                <span className="w-3 border-t-2 border-dashed" style={{ borderColor: toneOf(s, i) }} />
              ) : markOf(s) === "line" ? (
                <span className="w-3 border-t-2" style={{ borderColor: toneOf(s, i) }} />
              ) : (
                <span className="h-2 w-2 rounded-[2px]" style={{ background: toneOf(s, i) }} />
              )}
              {s.label}
              {s.transform !== "none" && <span className="text-zinc-300 dark:text-zinc-600">{s.transform === "indexed" ? "index" : s.transform}</span>}
            </span>
          ))}
        </div>
      )}
      <div
        style={{ height }}
        tabIndex={0}
        role="group"
        aria-roledescription="chart"
        aria-label={`${panel.title || "Chart"}, ${mode} of ${data.length} ${data.length === 1 ? "mark" : "marks"}. ${hint}`}
        onKeyDown={onKey}
        onBlur={() => walk(null)}
        onMouseEnter={() => setInside(true)}
        onMouseLeave={() => setInside(false)}
        onDoubleClick={() => selecting && category && drill(active)}
        className={cn(
          "relative rounded-md text-zinc-900 outline-none select-none focus-visible:ring-2 focus-visible:ring-[#0061E2]/40 focus-visible:ring-offset-4 focus-visible:ring-offset-white dark:text-zinc-100 dark:focus-visible:ring-offset-zinc-950",
          FADE_CLASS,
          selecting && continuous ? "cursor-crosshair" : (canDrill || (selecting && category)) && "cursor-pointer",
        )}
      >
        <span className="sr-only" aria-live="polite">
          {kb !== null ? describe(kb) : ""}
        </span>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={data}
            layout={horizontal ? "vertical" : "horizontal"}
            margin={{ top: drillMark && !horizontal ? 18 : 4, right: drillMark && horizontal ? 28 : right.length ? 8 : scatter ? 36 : 12, left: 0, bottom: 0 }}
            barCategoryGap={horizontal ? "26%" : "18%"}
            onMouseDown={(s) => {
              dragged.current = false;
              const i = idxOf(s);
              if (selecting && continuous && i !== null) dragRef.current = { a: i, b: i };
            }}
            onMouseUp={() => {
              const d = dragRef.current;
              dragRef.current = null;
              setDrag(null);
              if (d && d.a !== d.b) {
                dragged.current = true;
                setRange(d.a, d.b);
              }
            }}
            onClick={(s, e: ReactMouseEvent | undefined) => {
              if (dragged.current) {
                dragged.current = false;
                return;
              }
              const i = idxOf(s);
              if (i === null) return;
              if (selecting && category) toggle(i, !!(e && (e.shiftKey || e.metaKey || e.ctrlKey)));
              else drill(i);
            }}
            onMouseMove={(s) => {
              const idx = idxOf(s);
              // off the plot (the chevron's margin) the last mark stays in hand
              if (idx === null) return;
              setKb(null);
              setHoverIdx(idx);
              onHoverKey?.(data[idx]?.[x]);
              const d = dragRef.current;
              if (d && idx !== d.b) {
                d.b = idx;
                setDrag([d.a, idx]);
              }
            }}
            onMouseLeave={() => {
              const d = dragRef.current;
              dragRef.current = null;
              setDrag(null);
              if (d && d.a !== d.b) setRange(d.a, d.b);
              setHoverIdx(null);
              onHoverKey?.(undefined);
            }}
          >
            <CartesianGrid vertical={horizontal} horizontal={!horizontal} stroke="rgba(161,161,170,0.14)" />
            {/* recharts reads axes as direct children: no fragments here */}
            {horizontal && <XAxis type="number" tickFormatter={(v) => fmt(v, fmtL, sym, true)} tick={MONO} tickLine={false} axisLine={false} />}
            {horizontal && <YAxis type="category" dataKey={x} tickFormatter={label} tick={MONO} tickLine={false} axisLine={false} width={narrow ? 92 : compact ? 120 : 172} interval={0} />}
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
            {!horizontal && <YAxis yAxisId="left" scale={log ? "log" : "auto"} domain={log ? ["auto", "auto"] : undefined} tickFormatter={(v) => fmt(v, fmtL, sym, true)} tick={MONO} tickLine={false} axisLine={false} width={56} />}
            {!horizontal && right.length > 0 && <YAxis yAxisId="right" orientation="right" tickFormatter={(v) => fmt(v, fmtR, sym, true)} tick={MONO} tickLine={false} axisLine={false} width={56} />}
            <RechartsTooltip
              // the keyboard drives the tooltip through defaultIndex; off the
              // chart with no keyboard cursor it is forced shut
              defaultIndex={!scatter && kb !== null ? kb : undefined}
              active={drag ? false : !scatter && kb !== null ? true : inside ? undefined : false}
              isAnimationActive={false}
              cursor={continuous && markOf(panel.series[0]) !== "bar" ? { stroke: "rgba(161,161,170,0.4)" } : { fill: "rgba(161,161,170,0.08)" }}
              content={({ active: on, payload }) => {
                if (!on || !payload?.[0]) return null;
                const r = payload[0].payload as Row;
                const name = nameFor(names, x, r[x]);
                return (
                  <TipPlate>
                    <p className="font-mono text-[10px] text-zinc-500">
                      {name ?? fmtX(r[x], span)}
                      {name && <span className="ml-2 text-zinc-300 dark:text-zinc-600">{String(r[x]).length > 20 ? truncate(String(r[x]), 6) : String(r[x])}</span>}
                    </p>
                    {scatter && !timeX && (
                      <p className="font-mono text-[11px] tabular-nums text-zinc-900 dark:text-zinc-100">
                        {fmt(r[x], "number", sym)} <span className="text-zinc-400">{x.replace(/_/g, " ")}</span>
                      </p>
                    )}
                    {panel.series.map((s, i) => (
                      <p key={`${s.column}-${i}`} className="flex items-center gap-2 font-mono text-[11px] tabular-nums text-zinc-900 dark:text-zinc-100">
                        <span className="h-1.5 w-1.5 rounded-full" style={{ background: toneOf(s, i) }} />
                        {fmt(r[`__s${i}`], unitOf(s), sym)} <span className="text-zinc-400">{s.label}</span>
                        {s.transform !== "none" && s.transform !== "share" && typeof r[s.column] === "number" && <span className="text-zinc-300 dark:text-zinc-600">raw {fmt(r[s.column], s.format, sym)}</span>}
                      </p>
                    ))}
                    {(selecting || canDrill) && (
                      <p className="mt-1 font-mono text-[10px] text-zinc-400 dark:text-zinc-500">
                        {selecting && category ? `click selects${canDrill ? ", double-click opens" : ""}` : selecting && continuous ? `drag selects${canDrill ? ", click opens" : ""}` : "click opens"}
                      </p>
                    )}
                  </TipPlate>
                );
              }}
            />
            {hoverIdx === null && kb === null && hoverKey !== undefined && data.some((r) => r[x] === hoverKey) && continuous && (
              <ReferenceLine yAxisId="left" x={hoverKey as string | number} stroke="currentColor" strokeOpacity={0.5} strokeDasharray="2 3" />
            )}
            {!horizontal &&
              !scatter &&
              panel.bands.map((b) => {
                const x1 = xOf(b.from);
                const x2 = xOf(b.to);
                return x1 !== undefined && x2 !== undefined ? (
                  <ReferenceArea key={b.label} yAxisId="left" x1={x1} x2={x2} fill="currentColor" fillOpacity={0.04} stroke="none" label={{ value: b.label, position: "insideTopLeft", fontSize: 10, fontFamily: "var(--font-geist-mono)", fill: "#71717a" }} />
                ) : null;
              })}
            {continuous &&
              rangePick?.kind === "range" &&
              (() => {
                const x1 = xOf(rangePick.from);
                const x2 = xOf(rangePick.to);
                return x1 !== undefined && x2 !== undefined ? <ReferenceArea yAxisId="left" x1={x1} x2={x2} fill={ACCENT} fillOpacity={0.06} stroke="none" /> : null;
              })()}
            {drag && data[drag[0]] && data[drag[1]] && (
              <ReferenceArea yAxisId="left" x1={data[drag[0]][x] as string | number} x2={data[drag[1]][x] as string | number} fill={ACCENT} fillOpacity={0.12} stroke={ACCENT} strokeOpacity={0.5} />
            )}
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
            {panel.series.flatMap((s, i) => {
              const tone = toneOf(s, i);
              const key = `${s.column}-${i}`;
              const dataKey = `__s${i}`;
              // a ranking has one unnamed axis pair; an explicit undefined id
              // would not match it, so the prop is left out entirely
              const axis = horizontal ? {} : { yAxisId: s.axis === "right" ? "right" : "left" };
              const dash = s.dashed ? "5 4" : undefined;
              if (scatter)
                return [
                  <Scatter key={`${key}-dot`} {...axis} dataKey={dataKey} fill={tone} {...anim} onClick={(_d: unknown, j: number) => drill(j)}>
                    {data.map((_, j) => (
                      <Cell key={j} fillOpacity={active === j ? 1 : active !== null ? 0.35 : 0.7} />
                    ))}
                  </Scatter>,
                ];
              const mark = markOf(s);
              // keys carry the mark, so a view change mounts the new mark and
              // recharts grows it; the same mark keeps its key and morphs
              if (mark === "line")
                return [
                  <Line key={`${key}-line`} {...axis} type="monotone" dataKey={dataKey} stroke={tone} strokeOpacity={traceInk} strokeWidth={s.transform === "rolling" ? 2 : 1.5} strokeDasharray={dash} dot={false} {...anim} connectNulls />,
                  ...(hasSel
                    ? [<Line key={`${key}-line-in`} {...axis} type="monotone" dataKey={`__in${i}`} stroke={tone} strokeWidth={s.transform === "rolling" ? 2.25 : 1.75} strokeDasharray={dash} dot={litCount === 1 ? { r: 2.5, fill: tone, strokeWidth: 0 } : false} activeDot={false} isAnimationActive={false} legendType="none" />]
                    : []),
                ];
              if (mark === "area")
                return [
                  <Area key={`${key}-area`} {...axis} type="monotone" dataKey={dataKey} stroke={tone} strokeOpacity={traceInk} fill={tone} fillOpacity={(s.dashed ? 0.05 : 0.16) * (hasSel ? 0.4 : 1)} strokeWidth={1.5} strokeDasharray={dash} stackId={panel.stacked ? `s-${s.axis}` : undefined} {...anim} />,
                  ...(hasSel
                    ? [<Area key={`${key}-area-in`} {...axis} type="monotone" dataKey={`__in${i}`} stroke={tone} fill={tone} fillOpacity={s.dashed ? 0.06 : 0.2} strokeWidth={1.75} strokeDasharray={dash} stackId={panel.stacked ? `in-${s.axis}` : undefined} activeDot={false} isAnimationActive={false} legendType="none" />]
                    : []),
                ];
              return [
                <Bar
                  key={`${key}-bar`}
                  {...axis}
                  dataKey={dataKey}
                  fill={tone}
                  stroke={s.dashed ? tone : undefined}
                  strokeDasharray={dash}
                  stackId={panel.stacked ? `s-${s.axis}` : undefined}
                  {...anim}
                  minPointSize={1}
                  radius={panel.stacked ? 0 : horizontal ? [0, 2, 2, 0] : [2, 2, 0, 0]}
                  label={
                    i === doorSeries
                      ? (p: { x?: number | string; y?: number | string; width?: number | string; height?: number | string; index?: number }) => {
                          const j = p.index;
                          if (j === undefined || j !== active) return <g />;
                          const bx = Number(p.x);
                          const by = Number(p.y);
                          const bw = Number(p.width);
                          const bh = Number(p.height);
                          const cx = horizontal ? bx + Math.max(0, bw) + 13 : bx + bw / 2;
                          const cy = horizontal ? by + bh / 2 : Math.min(by, by + bh) - 11;
                          return <OpenMark cx={cx} cy={cy} label={label(data[j]?.[x])} onOpen={() => drill(j)} />;
                        }
                      : undefined
                  }
                >
                  {data.map((_, j) => (
                    <Cell key={j} fillOpacity={inkOf(j, s.dashed)} />
                  ))}
                </Bar>,
              ];
            })}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      {scatter && kb !== null && <p className="font-mono text-[11px] tabular-nums text-zinc-500 dark:text-zinc-400">{describe(kb)}</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ */

export type QueryVisualProps = {
  visual: VisualSpec;
  /** every row of the answer, unfiltered; the selection narrows them here */
  rows: Row[];
  names: Names;
  sym: string;
  canDrill: boolean;
  onPick: (row: Row) => void;
  /** @deprecated the old brush; the selection replaces it. kept so callers compile */
  range?: [number, number] | null;
  /** @deprecated the old brush; never called */
  onRange?: (r: [number, number] | null) => void;
  /** ask again inside a picked range; offered on the range chip */
  onZoom?: (lo: unknown, hi: unknown) => void;
  selected?: unknown;
  hoverKey?: unknown;
  onHoverKey?: (k: unknown) => void;
  /** the reader's picks; the page owns them (lib/explorer-query/selection.ts) */
  selection?: Selection;
  /** without it the visual is read-only: hover reads, clicks open, nothing selects */
  onSelection?: (s: Selection) => void;
  /** chips above the panels when selecting (default true); off when the page draws its own */
  chips?: boolean;
  /** a small tile: no stats strip, shorter charts */
  compact?: boolean;
  /** draw only visual.panels[panelIndex] */
  panelIndex?: number;
  /** a control for each panel's header, given its index in visual.panels */
  panelAction?: (index: number) => ReactNode;
  /** draw panel titles (default true) */
  titles?: boolean;
};

const isChart = (p: Panel | undefined): p is Panel => !!p && p.kind !== "table" && !!p.x && p.series.length > 0;

export function QueryVisual({ visual, rows, names, sym, canDrill, onPick, onZoom, selected, hoverKey, onHoverKey, selection, onSelection, chips = true, compact = false, panelIndex, panelAction, titles = true }: QueryVisualProps) {
  const whole = selection ?? EMPTY;
  // a pick on a column these rows lack (another answer's) cannot narrow them
  const live = useMemo(() => whole.filter((p) => rows.some((r) => p.column in r)), [whole, rows]);
  const picked = useMemo(() => applySelection(rows, live), [rows, live]);
  // each chart keeps its index in visual.panels, for the page's panel controls
  const charts = useMemo(
    () => (panelIndex !== undefined ? [panelIndex] : visual.panels.map((_, i) => i)).flatMap((idx) => { const p = visual.panels[idx]; return isChart(p) ? [{ p, idx }] : []; }),
    [visual, panelIndex],
  );
  const single = panelIndex !== undefined || charts.length === 1;
  return (
    <div className={cn("flex flex-col", compact ? "gap-3" : "gap-6")}>
      {!compact && <StatsStrip stats={visual.stats} rows={picked} all={rows} names={names} sym={sym} active={live.length > 0} />}
      {onSelection && chips && <SelectionChips selection={whole} onSelection={onSelection} names={names} onZoom={onZoom} className="-mb-2" />}
      {charts.length > 0 && (
        <div className={cn("grid gap-x-10 gap-y-8", !single && "lg:grid-cols-2")}>
          {charts.map(({ p, idx }, i) => (
            <div key={`${i}-${p.title}-${p.x}`} className={cn(!single && p.width === "full" && "lg:col-span-2")}>
              <PanelBlock
                panel={p}
                rows={rows}
                names={names}
                sym={sym}
                canDrill={canDrill}
                onPick={onPick}
                selected={selected}
                hoverKey={hoverKey}
                onHoverKey={onHoverKey}
                selection={whole}
                live={live}
                onSelection={onSelection}
                compact={compact}
                action={panelAction?.(idx)}
                titled={titles}
              />
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

const SEG = "relative flex h-7 min-w-7 items-center justify-center gap-1.5 rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0061E2]/50";

function PanelBlock(props: PanelProps) {
  const { panel, rows } = props;
  const reduced = useReduced();
  const id = useId();
  const views = useMemo(() => viewsFor(panel, rows), [panel, rows]);
  const start: View = views.includes(panel.kind as View) ? (panel.kind as View) : panel.kind === "bar" && views.includes("hbar") ? "hbar" : views[0];
  const [view, setView] = useState<View>(start);
  // a running total, for counts over time; shares and rates do not add up
  const canRun = views.includes("line") && panel.series.some((s) => s.format !== "percent" && s.transform === "none");
  const [running, setRunning] = useState(false);
  // one mark far above the rest (a 20M transfer among 1M ones) squeezes
  // the others onto the floor; such a panel opens on a log axis
  const skewed = useMemo(() => {
    const col = panel.series.find((x) => x.axis !== "right")?.column;
    if (!col || panel.series.some((x) => x.transform !== "none" || x.format === "percent")) return false;
    const v = rows.map((r) => r[col]).filter((n): n is number => typeof n === "number");
    if (v.length < 8 || v.some((n) => n <= 0)) return false;
    const sorted = [...v].sort((a, b) => a - b);
    return sorted[sorted.length - 1] / sorted[Math.floor(sorted.length / 2)] > 12;
  }, [panel.series, rows]);
  const [logOn, setLog] = useState<boolean | null>(null);
  const canLog = skewed && (view === "scatter" || view === "line");
  const log = canLog && !running && (logOn ?? true);
  const drawn: Panel = useMemo(
    () => ({
      ...panel,
      title: panel.title,
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
  // line, area and columns share one chart that morphs; a pie or a table
  // is a different object, so those crossfade
  const family = view === "pie" ? "pie" : view === "table" ? "table" : "chart";
  const t = reduced ? { duration: 0 } : MOTION;

  return (
    <section aria-label={panel.title || undefined} className="group/panel flex flex-col gap-3">
      <div className="flex min-h-7 items-center justify-between gap-3">
        <span className="min-w-0 truncate font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
          {props.titled !== false && panel.title}
          {running && <span className="ml-2 font-normal text-zinc-400 dark:text-zinc-500">running total</span>}
        </span>
        <div className="flex shrink-0 items-center gap-1.5">
        {props.action && <span className="hidden opacity-0 transition-opacity duration-200 group-hover/panel:opacity-100 group-focus-within/panel:opacity-100 sm:inline [@media(hover:none)]:opacity-100">{props.action}</span>}
        <div
          role="group"
          aria-label={`View ${panel.title || "panel"} as`}
          className="flex shrink-0 items-center gap-px rounded-full bg-zinc-100 p-0.5 ring-1 ring-inset ring-zinc-200/70 dark:bg-zinc-900 dark:ring-zinc-800"
        >
          {views.map((v) => {
            const { label, icon: Icon } = VIEW_META[v];
            const on = view === v;
            return (
              <button key={v} type="button" title={`See as ${label.toLowerCase()}`} aria-label={label} aria-pressed={on} onClick={() => setView(v)} className={cn(SEG, on ? "px-2.5 text-zinc-900 dark:text-zinc-50" : "px-1.5 text-zinc-500 hover:bg-white/60 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/60 dark:hover:text-zinc-100")}>
                {on && <motion.span layoutId={`${id}-pill`} transition={t} className="absolute inset-0 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.12)] dark:bg-zinc-700" />}
                <Icon className="relative h-3.5 w-3.5" strokeWidth={1.75} />
                {on && <span className="relative font-mono text-[10.5px] font-medium">{label}</span>}
              </button>
            );
          })}
          {canLog && !running && (
            <>
              <span className="mx-1 h-3.5 w-px bg-zinc-200 dark:bg-zinc-800" />
              <button
                type="button"
                title={log ? "Log scale: each step up is 10x. Click for a linear axis." : "Linear axis. Click for a log scale."}
                aria-label="Log scale"
                aria-pressed={log}
                onClick={() => setLog(!log)}
                className={cn(SEG, "px-2 font-mono text-[10.5px] font-medium", log ? "bg-white text-zinc-900 shadow-[0_1px_3px_rgba(0,0,0,0.12)] dark:bg-zinc-700 dark:text-zinc-50" : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100")}
              >
                log
              </button>
            </>
          )}
          {canRun && view !== "table" && (
            <>
              <span className="mx-1 h-3.5 w-px bg-zinc-200 dark:bg-zinc-800" />
              <button
                type="button"
                title="Running total"
                aria-label="Running total"
                aria-pressed={running}
                onClick={() => setRunning((r) => !r)}
                className={cn(SEG, running ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-50" : "text-zinc-400 hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-zinc-100")}
              >
                <Sigma className="h-3.5 w-3.5" strokeWidth={1.75} />
              </button>
            </>
          )}
        </div>
        </div>
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={family} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, transition: reduced ? { duration: 0 } : { ...MOTION, duration: 0.12 } }} transition={t}>
          {family === "pie" ? <PieView {...props} /> : family === "table" ? <PanelTable {...props} /> : <PanelChart {...props} panel={drawn} log={log} />}
        </motion.div>
      </AnimatePresence>
    </section>
  );
}

const PIE_TONES = ["currentColor", "#0061E2", "#0d9488", "#d97706", "#7c3aed", "#db2777", "#65a30d"];
const PIE_MAX = 7;

/** parts of a whole: the leaders as slices, the rest as one grey slice */
function PieView({ panel, rows, names, sym, canDrill, onPick, hoverKey, onHoverKey, selection, live, onSelection, compact }: PanelProps) {
  const reduced = useReduced();
  const x = panel.x!;
  const s = panel.series[0];
  const [kb, setKb] = useState<number | null>(null);
  const { slices, total } = useMemo(() => {
    const sorted = [...rows].filter((r) => typeof r[s.column] === "number" && (r[s.column] as number) > 0).sort((a, b) => (b[s.column] as number) - (a[s.column] as number));
    const total = sorted.reduce((a, r) => a + (r[s.column] as number), 0);
    const head = sorted.slice(0, PIE_MAX).map((r, i) => ({ key: r[x], label: xText(names, x, r[x], "other"), value: r[s.column] as number, row: r as Row | null, tone: PIE_TONES[i] }));
    const rest = sorted.slice(PIE_MAX).reduce((a, r) => a + (r[s.column] as number), 0);
    if (rest > 0) head.push({ key: "__rest", label: `${sorted.length - PIE_MAX} more`, value: rest, row: null, tone: "#d4d4d8" });
    return { slices: head, total };
  }, [rows, s.column, x, names]);
  const hasSel = live.length > 0;
  const on = slices.map((sl) => !hasSel || (sl.row ? inSelection(live, sl.row) : false));
  const selTotal = slices.reduce((a, sl, i) => a + (on[i] ? sl.value : 0), 0);
  const focusKey = kb !== null ? slices[kb]?.key : hoverKey;
  const focusIdx = focusKey === undefined ? -1 : slices.findIndex((sl) => sl.key === focusKey);
  const focus = focusIdx >= 0 ? slices[focusIdx] : undefined;
  const inkOf = (i: number) => {
    let o = on[i] ? 1 : DIM;
    if (focusIdx >= 0) o = focusIdx === i ? Math.max(o, 0.6) : hasSel ? o : 0.35;
    return o;
  };
  const selecting = !!onSelection;
  const toggle = (i: number, additive: boolean) => {
    const sl = slices[i];
    if (sl?.row && onSelection) onSelection(toggleValue(selection, x, String(sl.row[x] ?? ""), additive));
  };
  const drill = (i: number) => {
    const sl = slices[i];
    if (sl?.row && canDrill) onPick(sl.row);
  };
  const center = focus ? focus.value : hasSel ? selTotal : total;
  const tweened = useTween(center);
  const shown = tweened === null ? center : Number.isInteger(center) ? Math.round(tweened) : tweened;
  const walk = (i: number | null) => {
    setKb(i);
    onHoverKey?.(i === null ? undefined : slices[i]?.key);
  };
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const n = slices.length;
    if (!n) return;
    if (["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"].includes(e.key)) {
      e.preventDefault();
      const next = e.key === "ArrowRight" || e.key === "ArrowDown";
      walk(Math.max(0, Math.min(n - 1, (kb ?? (next ? -1 : n)) + (next ? 1 : -1))));
    } else if (e.key === "Enter" && kb !== null) {
      e.preventDefault();
      drill(kb);
    } else if (e.key === " " && kb !== null && selecting) {
      e.preventDefault();
      toggle(kb, true);
    } else if (e.key === "Escape") {
      if (onSelection && selection.length) {
        e.preventDefault();
        onSelection([]);
      }
      walk(null);
    }
  };

  return (
    <div className={cn("grid items-center gap-6 sm:gap-10", compact ? "sm:grid-cols-[minmax(0,10rem)_minmax(0,1fr)]" : "sm:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]")}>
      <div
        tabIndex={0}
        role="group"
        aria-roledescription="chart"
        aria-label={`${panel.title || "Pie"}, ${slices.length} slices. Arrow keys move${selecting ? ", Space selects" : ""}${canDrill ? ", Enter opens" : ""}.`}
        onKeyDown={onKey}
        onBlur={() => walk(null)}
        className={cn("relative mx-auto aspect-square w-full rounded-full text-zinc-900 outline-none focus-visible:ring-2 focus-visible:ring-[#0061E2]/40 focus-visible:ring-offset-4 focus-visible:ring-offset-white dark:text-zinc-100 dark:focus-visible:ring-offset-zinc-950", FADE_CLASS, compact ? "max-w-40" : "max-w-52 sm:max-w-60")}
      >
        <span className="sr-only" aria-live="polite">
          {kb !== null && slices[kb] ? `${slices[kb].label}: ${fmt(slices[kb].value, s.format, sym)}${hasSel && on[kb] ? ", selected" : ""}` : ""}
        </span>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={slices}
              dataKey="value"
              nameKey="label"
              innerRadius="64%"
              outerRadius="96%"
              paddingAngle={1}
              stroke="none"
              isAnimationActive={!reduced}
              animationDuration={CHART_MS}
              animationEasing="ease-out"
              onMouseEnter={(d: { payload?: { key: unknown } }) => onHoverKey?.(d?.payload?.key)}
              onMouseLeave={() => onHoverKey?.(undefined)}
              onClick={(_d: unknown, i: number, e: ReactMouseEvent) => (selecting ? toggle(i, e.shiftKey || e.metaKey || e.ctrlKey) : drill(i))}
            >
              {slices.map((sl, i) => (
                <Cell key={String(sl.key)} fill={sl.tone} fillOpacity={inkOf(i)} cursor={sl.row && (selecting || canDrill) ? "pointer" : "default"} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-0.5 px-6 text-center">
          <span className={cn("font-mono tabular-nums text-zinc-900 dark:text-zinc-50", compact ? "text-[14px]" : "text-[18px]")}>{fmt(shown, s.format, sym)}</span>
          <span className="max-w-full truncate font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
            {focus ? focus.label : hasSel ? `${total ? pct((selTotal / total) * 100) : 0}% of ${s.label}` : s.label}
          </span>
        </div>
      </div>
      <ul className="flex flex-col gap-0.5">
        {slices.map((sl, i) => {
          const pickable = !!sl.row && (selecting || canDrill);
          const share = total ? sl.value / total : 0;
          const lead = slices[0]?.value ? sl.value / slices[0].value : 0;
          return (
            <li key={String(sl.key)} className="group/row relative flex items-center">
              <button
                type="button"
                disabled={!pickable}
                aria-pressed={selecting && hasSel ? on[i] : undefined}
                onClick={(e) => (selecting ? toggle(i, e.shiftKey || e.metaKey || e.ctrlKey) : drill(i))}
                onDoubleClick={() => selecting && drill(i)}
                onMouseEnter={() => onHoverKey?.(sl.key)}
                onMouseLeave={() => onHoverKey?.(undefined)}
                style={{ opacity: inkOf(i) < 0.5 ? 0.45 : 1 }}
                className={cn(
                  "grid min-w-0 flex-1 grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-x-3 gap-y-1 rounded-lg py-1.5 pr-8 pl-2 text-left sm:grid-cols-[auto_minmax(0,11rem)_minmax(0,1fr)_auto_auto] transition-[opacity,background-color] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0061E2]/50",
                  pickable && "hover:bg-zinc-50 dark:hover:bg-zinc-900",
                  focusIdx === i && "bg-zinc-50 dark:bg-zinc-900",
                )}
              >
                <span className="h-2 w-2 shrink-0 rounded-full text-zinc-900 dark:text-zinc-100" style={{ background: sl.tone }} />
                <span className="min-w-0 truncate font-mono text-[12px] text-zinc-800 dark:text-zinc-200">{sl.label}</span>
                {/* the share as a bar: the room beside a legend says how big */}
                <span aria-hidden className="col-span-3 col-start-2 row-start-2 h-1 overflow-hidden rounded-full bg-zinc-100 sm:col-span-1 sm:col-start-3 sm:row-start-1 sm:h-1.5 dark:bg-zinc-900">
                  <span className="block h-full rounded-full text-zinc-900 transition-[width] duration-500 ease-out dark:text-zinc-100" style={{ width: `${Math.min(100, Math.max(1.5, lead * 100))}%`, background: sl.tone, opacity: sl.row ? 0.85 : 0.6 }} />
                </span>
                <span className="font-mono text-[12px] tabular-nums text-zinc-900 dark:text-zinc-50">{fmt(sl.value, s.format, sym)}</span>
                <span className="w-11 text-right font-mono text-[11px] tabular-nums text-zinc-400 dark:text-zinc-500">{total ? `${(share * 100).toFixed(share < 0.1 ? 1 : 0)}%` : ""}</span>
              </button>
              {selecting && canDrill && sl.row && (
                <button
                  type="button"
                  onClick={() => drill(i)}
                  aria-label={`Open ${sl.label}`}
                  title="Open"
                  className="absolute right-1 flex h-6 w-6 items-center justify-center rounded-full text-zinc-400 opacity-0 transition-opacity duration-200 group-hover/row:opacity-100 hover:bg-zinc-100 hover:text-zinc-900 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0061E2]/50 [@media(hover:none)]:opacity-100 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
                >
                  <ChevronRight className="h-3.5 w-3.5" strokeWidth={2} />
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** the panel's own rows as a table: its x and its series, sortable, and
    only the selected rows while a selection stands */
function PanelTable({ panel, rows, names, sym, canDrill, onPick, hoverKey, onHoverKey, live }: PanelProps) {
  const x = panel.x!;
  const span = useMemo(() => spanOf(rows.map((r) => r[x])), [rows, x]);
  const [sort, setSort] = useState<{ col: string; dir: "asc" | "desc" } | null>(null);
  const kept = useMemo(() => applySelection(rows, live), [rows, live]);
  const shown = useMemo(() => {
    if (!sort) return kept;
    const k = sort.col;
    return [...kept].sort((a, b) => {
      const va = a[k];
      const vb = b[k];
      const c = typeof va === "number" && typeof vb === "number" ? va - vb : String(va ?? "").localeCompare(String(vb ?? ""));
      return sort.dir === "asc" ? c : -c;
    });
  }, [kept, sort]);
  const cols = [{ column: x, label: x.replace(/_/g, " "), format: "number" as Format, isX: true }, ...panel.series.map((s) => ({ column: s.column, label: s.label, format: s.format, isX: false }))];
  const flip = (col: string) => setSort((cur) => (cur?.col === col ? (cur.dir === "desc" ? { col, dir: "asc" } : null) : { col, dir: "desc" }));

  return (
    <div className="flex flex-col gap-2">
      {live.length > 0 && (
        <span className="font-mono text-[10px] tabular-nums text-zinc-400 dark:text-zinc-500">
          {kept.length} of {rows.length} rows
        </span>
      )}
      <div className="max-h-[26rem] overflow-auto">
        <table className="w-full border-collapse font-mono text-[12px] tabular-nums">
          <thead className="sticky top-0 bg-white/90 backdrop-blur dark:bg-zinc-950/90">
            <tr>
              {cols.map((c) => (
                <th key={c.column} className={cn("border-b border-zinc-100 px-3 py-2 font-normal dark:border-zinc-900", c.isX ? "text-left" : "text-right")}>
                  <button type="button" onClick={() => flip(c.column)} className="inline-flex items-center gap-1 rounded text-[10px] uppercase tracking-[0.14em] text-zinc-500 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0061E2]/50 dark:text-zinc-400 dark:hover:text-zinc-100">
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
                className={cn("transition-colors", canDrill && "cursor-pointer", hoverKey !== undefined && hoverKey === r[x] ? "bg-zinc-50 dark:bg-zinc-900" : canDrill && "hover:bg-zinc-50 dark:hover:bg-zinc-900")}
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
    </div>
  );
}
