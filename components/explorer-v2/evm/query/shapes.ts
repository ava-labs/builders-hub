/* The arithmetic behind the charts that are not a bar or a line: the bins of a histogram, the grid of a heatmap
   and the rectangles of a treemap. Pure, so each is tested without a page. */

import { MONTHS } from "@/lib/explorer-query/values";

type Row = Record<string, unknown>;

const num =(v: unknown): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
};

/* ------------------------------------------------------------------ */
/* Histogram */

export interface Bin {
  lo: number;
  hi: number;
  n: number;
}
export interface Histogram {
  bins: Bin[];
  /** the bins are equal on a log scale: the values span more than three orders of magnitude */
  log: boolean;
  median: number;
  count: number;
}

/** the most bins a histogram draws */
const BINS = 24;
/** max over min past this reads on a log scale: a few whales would put every other value in the first bin */
const LOG_SPREAD = 1000;

/** the values of a column in bins of equal width, or of equal ratio when they span orders of magnitude (all above
    zero); null when fewer than two distinct values leave nothing to spread */
export function histogramOf(rows: readonly Row[], column: string): Histogram | null {
  const vs = rows.map((r) => num(r[column])).filter((v): v is number => v !== null).sort((p, q) => p - q);
  if (vs.length < 2 || vs[0] === vs[vs.length - 1]) return null;
  const [min, max] = [vs[0], vs[vs.length - 1]];
  const log = min > 0 && max / min > LOG_SPREAD;
  const to = log ? Math.log10 : (v: number) => v;
  const from = log ? (v: number) => 10 ** v : (v: number) => v;
  const count = Math.min(BINS, Math.max(8, Math.ceil(Math.sqrt(vs.length))));
  const [a, b] = [to(min), to(max)];
  const step = (b - a) / count;
  const bins: Bin[] = Array.from({ length: count }, (_, i) => ({ lo: from(a + i * step), hi: from(a + (i + 1) * step), n: 0 }));
  for (const v of vs) bins[Math.min(count - 1, Math.floor((to(v) - a) / step))].n += 1;
  const mid = vs.length >> 1;
  return { bins, log, median: vs.length % 2 ? vs[mid] : (vs[mid - 1] + vs[mid]) / 2, count: vs.length };
}

/* ------------------------------------------------------------------ */
/* Heatmap */

export interface HeatGrid {
  xs: string[];
  ys: string[];
  /** value by `${y}\u0000${x}`; a pair the rows do not hold is absent */
  cells: Map<string, { value: number; row: Row }>;
  min: number;
  max: number;
}

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

/** where a category stands on an axis: a number by its value, a weekday or a month by the calendar, else as first seen */
function ordered(values: string[]): string[] {
  const seen = [...new Set(values)];
  if (seen.every((v) => v.trim() !== "" && Number.isFinite(Number(v)))) return seen.sort((p, q) => Number(p) - Number(q));
  for (const cal of [WEEKDAYS, MONTHS]) {
    const at = (v: string) => cal.findIndex((d) => d.toLowerCase().startsWith(v.toLowerCase().slice(0, 3)));
    if (seen.every((v) => v.length >= 3 && at(v) >= 0)) return seen.sort((p, q) => at(p) - at(q));
  }
  return seen;
}

export const cellKey = (y: string, x: string) => `${y}\u0000${x}`;

/** rows of (x, y, value) as a grid: each axis in its natural order; null when the rows hold no numbers or one axis
    has a single value (a row of cells is a bar chart) */
export function heatGridOf(rows: readonly Row[], x: string, y: string, value: string): HeatGrid | null {
  const cells = new Map<string, { value: number; row: Row }>();
  let [min, max] = [Infinity, -Infinity];
  for (const r of rows) {
    const v = num(r[value]);
    if (v === null) continue;
    cells.set(cellKey(String(r[y]), String(r[x])), { value: v, row: r });
    min = Math.min(min, v);
    max = Math.max(max, v);
  }
  const xs = ordered(rows.map((r) => String(r[x])));
  const ys = ordered(rows.map((r) => String(r[y])));
  if (!cells.size || xs.length < 2 || ys.length < 2) return null;
  return { xs, ys, cells, min, max };
}

/* ------------------------------------------------------------------ */
/* Treemap */

export interface TreeRect<T> {
  item: T;
  value: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** the worst aspect ratio of a strip of areas laid along a side of this length */
function worst(areas: number[], side: number): number {
  const sum = areas.reduce((p, q) => p + q, 0);
  const [hi, lo] = [Math.max(...areas), Math.min(...areas)];
  return Math.max((side * side * hi) / (sum * sum), (sum * sum) / (side * side * lo));
}

/** items as rectangles whose areas are their values, squarified: each strip is laid along the shorter side while
    that keeps its rectangles closest to square. Values at or below zero are left out */
export function treemapOf<T>(items: readonly T[], valueOf: (item: T) => number, width: number, height: number): TreeRect<T>[] {
  const live = items.map((item) => ({ item, value: valueOf(item) })).filter((d) => d.value > 0).sort((p, q) => q.value - p.value);
  const total = live.reduce((p, q) => p + q.value, 0);
  if (!live.length || !(total > 0) || !(width > 0) || !(height > 0)) return [];
  const scale = (width * height) / total;
  const out: TreeRect<T>[] = [];
  let [x, y, w, h] = [0, 0, width, height];
  let i = 0;
  while (i < live.length) {
    const side = Math.min(w, h);
    const strip = [live[i].value * scale];
    let j = i + 1;
    while (j < live.length && worst([...strip, live[j].value * scale], side) <= worst(strip, side)) strip.push(live[j++].value * scale);
    const sum = strip.reduce((p, q) => p + q, 0);
    // the strip takes its thickness off the longer side
    const thick = sum / side;
    let at = 0;
    for (let k = 0; k < strip.length; k++) {
      const len = strip[k] / thick;
      out.push(w >= h ? { ...live[i + k], x, y: y + at, w: thick, h: len } : { ...live[i + k], x: x + at, y, w: len, h: thick });
      at += len;
    }
    if (w >= h) [x, w] = [x + thick, w - thick];
    else [y, h] = [y + thick, h - thick];
    i = j;
  }
  return out;
}
