"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/components/explorer-v2/format";
import { toggleValue, withPick } from "@/lib/explorer-query/selection";
import { fmt, xText } from "../query-format";
import { cellKey, heatGridOf, histogramOf, treemapOf } from "./shapes";
import { ACCENT, DIM, inSelection, type PanelProps, type Row } from "./sheet";

/* Charts of a whole field of rows: a histogram of how one figure is spread, a heatmap of one value over two
   categories, and a treemap of how a whole divides. Each reads every row of the answer, so none ranks only the
   first few. */

/* ------------------------------------------------------------------ */
/* Histogram */

/** how one column's values are spread: bins of equal width (of equal ratio when the values span orders of
    magnitude), with the median marked. A click on a bin picks its range */
export function HistogramView({ panel, rows, sym, selection, live, onSelection, compact }: PanelProps) {
  const x = panel.x!;
  const format = panel.series[0]?.format ?? "compact";
  const h = useMemo(() => histogramOf(rows, x), [rows, x]);
  const [hot, setHot] = useState<number | null>(null);
  if (!h) return <p className="px-2 py-6 font-mono text-[12px] text-zinc-500">These rows hold one value, so there is no spread to draw.</p>;
  const peak = Math.max(...h.bins.map((b) => b.n));
  const pick = live.find((p) => p.column === x);
  const on = (i: number) => !pick || (pick.kind === "range" && h.bins[i].hi >= Number(pick.from) && h.bins[i].lo <= Number(pick.to));
  // where the median stands along the bins
  const [a, b] = h.log ? [Math.log10(h.bins[0].lo), Math.log10(h.bins.at(-1)!.hi)] : [h.bins[0].lo, h.bins.at(-1)!.hi];
  const median = (((h.log ? Math.log10(h.median) : h.median) - a) / (b - a)) * 100;
  const focus = hot === null ? null : h.bins[hot];
  return (
    <div className="flex flex-col gap-2">
      <span className="min-h-4 px-1 font-mono text-[10.5px] tabular-nums text-zinc-500 dark:text-zinc-400">
        {focus ? `${formatNumber(focus.n)} of ${formatNumber(h.count)} between ${fmt(focus.lo, format, sym)} and ${fmt(focus.hi, format, sym)}` : `${formatNumber(h.count)} values · median ${fmt(h.median, format, sym)}${h.log ? " · log scale" : ""}`}
      </span>
      <div className={cn("relative flex items-end gap-px", compact ? "h-36" : "h-56")}>
        {h.bins.map((bin, i) => (
          <button
            key={i}
            type="button"
            aria-label={`${formatNumber(bin.n)} between ${fmt(bin.lo, format, sym)} and ${fmt(bin.hi, format, sym)}`}
            onMouseEnter={() => setHot(i)}
            onMouseLeave={() => setHot(null)}
            onFocus={() => setHot(i)}
            onBlur={() => setHot(null)}
            onClick={() => {
              if (!onSelection) return;
              const same = pick?.kind === "range" && pick.from === bin.lo && pick.to === bin.hi;
              onSelection(same ? selection.filter((p) => p.column !== x) : withPick(selection, { kind: "range", column: x, from: bin.lo, to: bin.hi }));
            }}
            className="group flex h-full min-w-0 flex-1 items-end focus-visible:outline-none"
          >
            <span
              className="w-full rounded-t-[2px] bg-zinc-900 transition-[opacity,background-color] duration-200 group-hover:bg-[#0061E2] group-focus-visible:bg-[#0061E2] motion-reduce:transition-none dark:bg-zinc-100"
              style={{ height: `${bin.n ? Math.max(1.5, (bin.n / peak) * 100) : 0}%`, opacity: on(i) ? 1 : DIM }}
            />
          </button>
        ))}
        <span aria-hidden className="pointer-events-none absolute inset-y-0 border-l border-dashed" style={{ left: `${Math.max(0, Math.min(100, median))}%`, borderColor: ACCENT }} />
      </div>
      <div className="relative flex justify-between border-t border-zinc-200 px-1 pb-4 pt-1.5 font-mono text-[10px] tabular-nums text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
        <span>{fmt(h.bins[0].lo, format, sym, true)}</span>
        <span>{fmt(h.bins.at(-1)!.hi, format, sym, true)}</span>
        <span className="absolute top-5 -translate-x-1/2 whitespace-nowrap" style={{ left: `${Math.max(8, Math.min(92, median))}%`, color: ACCENT }}>
          median {fmt(h.median, format, sym, true)}
        </span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Treemap */

/** the box the rectangles are laid out in; the drawing scales with the panel and keeps this shape */
const BOX = { w: 1000, h: 440 };
/** the most parts drawn on their own; the rest are one part */
const PARTS = 14;
/** an ink for each part: each holds white text at 4.5 to 1 or more */
const PART_INKS = ["#52525b", "#0061E2", "#0f766e", "#b45309", "#6d28d9", "#be185d", "#4d7c0f", "#0e7490", "#9f1239", "#3f6212", "#1e40af", "#7e22ce", "#92400e", "#115e59"];
const REST_INK = "#71717a";

interface Part {
  key: unknown;
  label: string;
  value: number;
  row: Row | null;
  ink: string;
}

/** how a whole divides among many parts: each part a rectangle of its share, the largest first, with the parts
    past the first few as one. A click picks a part; a second click on a picked part with records opens them */
export function TreemapView({ panel, rows, names, sym, canDrill, onPick, hoverKey, onHoverKey, selection, live, onSelection }: PanelProps) {
  const x = panel.x!;
  const s = panel.series[0];
  // the drawing's width on the page: a part shows its words only where they fit
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const seen = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    seen.observe(el);
    return () => seen.disconnect();
  }, []);
  const px = width / BOX.w;
  const { rects, total } = useMemo(() => {
    const sized = rows.filter((r) => typeof r[s.column] === "number" && (r[s.column] as number) > 0).sort((p, q) => (q[s.column] as number) - (p[s.column] as number));
    const head: Part[] = sized.slice(0, panel.topN ?? PARTS).map((r, i) => ({ key: r[x], label: xText(names, x, r[x], "other"), value: r[s.column] as number, row: r, ink: PART_INKS[i % PART_INKS.length] }));
    const rest = sized.slice(head.length);
    if (rest.length) head.push({ key: "__rest", label: `${formatNumber(rest.length)} more`, value: rest.reduce((n, r) => n + (r[s.column] as number), 0), row: null, ink: REST_INK });
    return { rects: treemapOf(head, (p) => p.value, BOX.w, BOX.h), total: head.reduce((n, p) => n + p.value, 0) };
  }, [rows, s.column, x, names, panel.topN]);
  const share = (v: number) => {
    const p = (v / total) * 100;
    return `${p >= 10 ? p.toFixed(0) : p >= 0.1 ? p.toFixed(1) : "<0.1"}%`;
  };
  return (
    <div ref={box} className="relative w-full overflow-hidden rounded-xl" style={{ aspectRatio: `${BOX.w} / ${BOX.h}` }}>
      {rects.map(({ item, x: rx, y: ry, w, h }, i) => {
        const on = !live.length || (item.row ? inSelection(live, item.row) : false);
        const picked = live.length > 0 && on;
        // a part too small for words still shows on hover and to a screen reader
        const [wide, tall] = [w * px >= 72, h * px >= 44];
        const words = `${item.label}: ${fmt(item.value, s.format, sym)}, ${share(item.value)}`;
        return (
          <button
            key={i}
            type="button"
            disabled={!item.row}
            title={words}
            aria-label={words}
            aria-pressed={item.row && onSelection ? picked : undefined}
            onMouseEnter={() => onHoverKey?.(item.key)}
            onMouseLeave={() => onHoverKey?.(undefined)}
            onClick={(e) => {
              if (!item.row) return;
              if (picked && canDrill) onPick(item.row);
              else onSelection?.(toggleValue(selection, x, String(item.row[x] ?? ""), e.shiftKey));
            }}
            className={cn(
              "absolute flex flex-col justify-between overflow-hidden border border-white p-2 text-left font-mono text-white transition-opacity duration-200 focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0061E2] motion-reduce:transition-none dark:border-zinc-950",
              hoverKey !== undefined && hoverKey === item.key && "brightness-125",
            )}
            style={{ left: `${(rx / BOX.w) * 100}%`, top: `${(ry / BOX.h) * 100}%`, width: `${(w / BOX.w) * 100}%`, height: `${(h / BOX.h) * 100}%`, background: item.ink, opacity: on ? 1 : DIM }}
          >
            {wide && tall && <span className="truncate text-[11px] font-medium">{item.label}</span>}
            {wide && tall && (
              <span className="flex items-baseline gap-2 text-[10.5px] tabular-nums">
                <span className="font-bold">{share(item.value)}</span>
                {w * px >= 132 && <span className="truncate opacity-80">{fmt(item.value, s.format, sym)}</span>}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Heatmap */

/** the most labels drawn along the top side; past that, every nth */
const X_LABELS = 12;

/** one value for each pair of two categories: the ink of a cell is its value between the lowest and the highest. A
    cell the rows do not hold stays empty. A click on a cell opens its records */
export function HeatmapView({ panel, rows, names, sym, canDrill, onPick, live }: PanelProps) {
  const [x, y, s] = [panel.x!, panel.y!, panel.series[0]];
  const g = useMemo(() => heatGridOf(rows, x, y, s.column), [rows, x, y, s.column]);
  const [hot, setHot] = useState<{ x: string; y: string } | null>(null);
  if (!g) return <p className="px-2 py-6 font-mono text-[12px] text-zinc-500">These rows do not make a grid: one side holds a single value.</p>;
  const ink = (v: number) => 0.08 + 0.92 * (g.max > g.min ? (v - g.min) / (g.max - g.min) : 1);
  const every = Math.ceil(g.xs.length / X_LABELS);
  const focus = hot ? g.cells.get(cellKey(hot.y, hot.x)) : undefined;
  const word = (column: string, v: string) => xText(names, column, v, "other");
  return (
    <div className="flex flex-col gap-2">
      <span className="flex min-h-4 items-center gap-2 px-1 font-mono text-[10.5px] tabular-nums text-zinc-500 dark:text-zinc-400">
        {hot && focus ? (
          `${word(y, hot.y)}, ${word(x, hot.x)}: ${fmt(focus.value, s.format, sym)}`
        ) : (
          <>
            {fmt(g.min, s.format, sym, true)}
            <span aria-hidden className="flex h-2 w-24 overflow-hidden rounded-full">
              {[0.08, 0.3, 0.54, 0.77, 1].map((o) => (
                <span key={o} className="flex-1 bg-zinc-900 dark:bg-zinc-100" style={{ opacity: o }} />
              ))}
            </span>
            {fmt(g.max, s.format, sym, true)}
          </>
        )}
      </span>
      <div className="grid items-center gap-px overflow-x-auto" style={{ gridTemplateColumns: `minmax(3.5rem, max-content) repeat(${g.xs.length}, minmax(0.75rem, 1fr))` }}>
        {g.ys.map((yv) => (
          <div key={yv} className="contents">
            <span className="truncate pr-2 text-right font-mono text-[10.5px] text-zinc-600 dark:text-zinc-300" title={word(y, yv)}>
              {word(y, yv)}
            </span>
            {g.xs.map((xv) => {
              const cell = g.cells.get(cellKey(yv, xv));
              if (!cell) return <span key={xv} className="h-6 rounded-[2px] bg-zinc-50 dark:bg-zinc-900/40" />;
              const on = !live.length || inSelection(live, cell.row);
              return (
                <button
                  key={xv}
                  type="button"
                  aria-label={`${word(y, yv)}, ${word(x, xv)}: ${fmt(cell.value, s.format, sym)}`}
                  onMouseEnter={() => setHot({ x: xv, y: yv })}
                  onMouseLeave={() => setHot(null)}
                  onFocus={() => setHot({ x: xv, y: yv })}
                  onBlur={() => setHot(null)}
                  onClick={() => canDrill && onPick(cell.row)}
                  className={cn("h-6 rounded-[2px] bg-zinc-900 transition-opacity duration-200 hover:ring-2 hover:ring-[#0061E2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0061E2] motion-reduce:transition-none dark:bg-zinc-100", !canDrill && "cursor-default")}
                  style={{ opacity: on ? ink(cell.value) : ink(cell.value) * DIM }}
                />
              );
            })}
          </div>
        ))}
        <span />
        {g.xs.map((xv, i) => (
          <span key={xv} className="overflow-visible whitespace-nowrap pt-1 text-center font-mono text-[10px] tabular-nums text-zinc-500 dark:text-zinc-400">
            {i % every === 0 ? word(x, xv) : ""}
          </span>
        ))}
      </div>
    </div>
  );
}
