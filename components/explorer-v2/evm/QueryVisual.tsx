"use client";

import { useMemo, type ReactNode } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { Names, Totals } from "@/lib/explorer-query/types";
import { EMPTY, applySelection, type Selection } from "@/lib/explorer-query/selection";
import type { Panel, Stat, VisualSpec } from "@/lib/explorer-query/visual-spec";
import { isTime } from "@/lib/explorer-query/values";
import { wholeFigure } from "@/lib/explorer-query/stat-label";
import { MOTION, useReduced, useTween } from "./query/motion";
import { extremeOf, rowWords, statDoor } from "./stat-door";
import { FlowChart } from "./query/FlowChart";
import { PanelBlock } from "./query/panel-block";
import { SelectionChips } from "./query/selection-chips";
import { CARD, fails, pct, type Row } from "./query/sheet";
import { priorWords, statChange, statValue, type Prior } from "./query/stat-figures";
import { fmt, nameFor } from "./query-format";

export { fmt, fmtX, nameFor, spanOf, tipX, zoneOf } from "./query-format";
export { CARD } from "./query/sheet";

/* Draws what the designer specified: a strip of headline figures, one
   to four panels, and the callouts. The chart is the index of the rows:
   hover reads a mark, a drag across a time chart or a click on a bar or
   a slice selects, and every figure on the sheet follows the selection.
   Opening the records behind a mark is a small door (the chevron, a
   double click, Enter), so a plain click can mean select. */

/* ------------------------------------------------------------------ */
/* stats                                                               */

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

/** the figures that add up, average or count the whole answer, which a window line names */
const OVER_WINDOW = new Set(["sum", "avg", "count", "distinct"]);

function StatFigure({ s, rows, all, names, sym, active, totals, base, span, prior, x, onHoverKey, onOpen }: { s: Stat; rows: Row[]; all: Row[]; names: Names; sym: string; active: boolean; totals?: Totals | null; base?: string; span?: string | null; prior?: Prior | null; x?: string; onHoverKey?: (k: unknown) => void; onOpen?: (row: Row) => void }) {
  const reduced = useReduced();
  // with no selection the figure counts the whole answer, past any LIMIT; a selection counts its own rows
  const total = wholeFigure(totals, s);
  const v = !active && total !== null ? total : statValue(rows, s);
  const num = typeof v === "number" ? v : null;
  const t = useTween(num);
  const text = (x: number | string) => (typeof x === "number" ? fmt(x, s.format, sym) : (nameFor(names, s.column, x) ?? String(x)));
  const shown = num !== null ? fmt(t !== null && Number.isInteger(num) ? Math.round(t) : (t ?? num), s.format, sym) : v === null ? "…" : text(v);
  // a figure over the whole answer says the window it covers, so a total beside a title of periods reads as the window's
  // against the same figure over the period before, once that period is read; a selection has no period before
  const change = active ? null : statChange(s, v, prior);
  const sub = active ? compare(s, v, total ?? statValue(all, s), text) : (s.sub ?? (!change && span && OVER_WINDOW.has(s.agg) ? span : undefined));
  // a row's extreme opens that row's transaction; a figure the totals gave names no row the page holds
  const door = statDoor(s, rows, v, base);
  // else a max or a min names its row (the peak's bucket, the leader), lights the row's mark on the chart, and opens
  // the row as its mark does
  const at = x && x !== s.column ? extremeOf(s, rows, v) : null;
  const key = at && x ? at[x] : undefined;
  const which = at && x && !door ? rowWords(key, x, all, names) : undefined;
  const light = key !== undefined && onHoverKey ? { onMouseEnter: () => onHoverKey(key), onMouseLeave: () => onHoverKey(undefined) } : undefined;
  return (
    <div className="flex min-w-0 flex-col gap-1.5 px-4 py-4 sm:gap-2 sm:px-5 sm:py-5 md:px-6" {...light}>
      <span className="truncate font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">{s.label}</span>
      {door ? (
        <Link href={door.href} title={`Open transaction ${door.hash}`} className="group flex min-w-0 flex-col gap-1.5 sm:gap-2">
          <span className="truncate font-mono text-[21px] leading-none tabular-nums tracking-tight text-zinc-900 transition-colors group-hover:text-[#0061E2] sm:text-[26px] dark:text-zinc-50 dark:group-hover:text-[#5b9bff]">{shown}</span>
          <span className="truncate font-mono text-[11px] text-zinc-400 underline-offset-2 group-hover:underline dark:text-zinc-500">{door.short}</span>
        </Link>
      ) : which && at && onOpen ? (
        <button
          type="button"
          onClick={() => onOpen(at)}
          onFocus={light?.onMouseEnter}
          onBlur={light?.onMouseLeave}
          title={`Open ${s.label.toLowerCase()}, ${which}`}
          className="group flex min-w-0 flex-col gap-1.5 rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0061E2]/50 sm:gap-2"
        >
          <span className="truncate font-mono text-[21px] leading-none tabular-nums tracking-tight text-zinc-900 transition-colors group-hover:text-[#0061E2] sm:text-[26px] dark:text-zinc-50 dark:group-hover:text-[#5b9bff]">{shown}</span>
          <span className="truncate font-mono text-[11px] text-zinc-400 underline-offset-2 group-hover:underline dark:text-zinc-500">{which}</span>
        </button>
      ) : (
        <>
          <span className="truncate font-mono text-[21px] leading-none tabular-nums tracking-tight text-zinc-900 sm:text-[26px] dark:text-zinc-50">{shown}</span>
          {which && (
            <span title={which} className="truncate font-mono text-[11px] text-zinc-400 dark:text-zinc-500">
              {which}
            </span>
          )}
        </>
      )}
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
      {change && (
        <motion.span
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={reduced ? { duration: 0 } : MOTION}
          title={`${fmt(change.before, s.format, sym)} in the ${priorWords(span)}`}
          className="flex min-w-0 items-baseline gap-1.5 font-mono text-[11px] tabular-nums"
        >
          <span className={cn("shrink-0 font-bold", change.rose !== fails(s) ? "text-emerald-700 dark:text-emerald-400" : "text-[#C81B28] dark:text-red-400")}>{change.text}</span>
          <span className="truncate text-zinc-400 dark:text-zinc-500">vs {priorWords(span)}</span>
        </motion.span>
      )}
      <Spark s={s} rows={rows} all={all} />
    </div>
  );
}

function StatsStrip({ stats, rows, all, names, sym, active, cards, stack = false, totals, base, span, prior, x, onHoverKey, onOpen }: { stats: Stat[]; rows: Row[]; all: Row[]; names: Names; sym: string; active: boolean; cards: boolean; stack?: boolean; totals?: Totals | null; base?: string; span?: string | null; prior?: Prior | null; x?: string; onHoverKey?: (k: unknown) => void; onOpen?: (row: Row) => void }) {
  if (stats.length === 0) return null;
  if (cards) {
    return (
      <div className={cn("grid grid-cols-2 gap-3", stats.length === 1 ? "grid-cols-1" : stack ? "" : stats.length === 3 ? "sm:grid-cols-3" : stats.length === 4 ? "sm:grid-cols-4" : "")}>
        {stats.map((s) => (
          <div key={`${s.label}:${s.column}:${s.agg}`} className={cn(CARD, "min-w-0")}>
            <StatFigure s={s} rows={rows} all={all} names={names} sym={sym} active={active} totals={totals} base={base} span={span} prior={prior} x={x} onHoverKey={onHoverKey} onOpen={onOpen} />
          </div>
        ))}
      </div>
    );
  }
  return (
    <div
      className={cn(
        // a board tile's strip runs edge to edge across the tile's padding
        "-mx-4 -mt-2 grid grid-cols-2 border-b border-zinc-100 dark:border-zinc-900 [&>*]:border-zinc-100 dark:[&>*]:border-zinc-900 [&>*:nth-child(even)]:border-l sm:[&>*+*]:border-l",
        stats.length === 1 ? "grid-cols-1" : stats.length === 2 ? "sm:grid-cols-2" : stats.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-4",
        stats.length > 2 && "[&>*:nth-child(n+3)]:border-t sm:[&>*:nth-child(n+3)]:border-t-0",
      )}
    >
      {stats.map((s) => (
        <StatFigure key={`${s.label}:${s.column}:${s.agg}`} s={s} rows={rows} all={all} names={names} sym={sym} active={active} totals={totals} base={base} span={span} prior={prior} x={x} onHoverKey={onHoverKey} onOpen={onOpen} />
      ))}
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
  /** each figure and panel on its own card (default); off inside a board tile */
  cards?: boolean;
  /** draws a table panel (its rows) in its place; without it, table panels are left out */
  renderTable?: (panel: Panel, index: number) => ReactNode;
  /** one panel a row and two figures a row, for a narrow frame the viewport's breakpoints cannot see (the city's answer window) */
  stack?: boolean;
  /** when a LIMIT cut the rows: the whole answer's figures, which the figures across the top count */
  totals?: Totals | null;
  /** the rows stop at a LIMIT, from a caller that holds no totals to show it: a board tile after its refresh */
  cut?: boolean;
  /** the chain's explorer path: a figure that is one row's extreme opens that row's transaction */
  base?: string;
  /** the window the answer reads ("last 6 hours"), for the figures over all of it */
  span?: string | null;
  /** the same query over the period before its window: each figure says how it moved */
  prior?: Prior | null;
  /** what the page sets between the figures and the panels: the findings */
  lead?: ReactNode;
  /** make the selection the subject of the next question; offered beside its chips */
  onAskSelection?: () => void;
};

const isChart = (p: Panel | undefined): p is Panel => !!p && p.kind !== "table" && !!p.x && p.series.length > 0;

export function QueryVisual({ visual, rows, names, sym, canDrill, onPick, onZoom, selected, hoverKey, onHoverKey, selection, onSelection, chips = true, compact = false, panelIndex, panelAction, titles = true, cards = true, renderTable, stack = false, totals, cut: cutRows = false, base, span, prior, lead, onAskSelection }: QueryVisualProps) {
  const whole = selection ?? EMPTY;
  // a pick on a column these rows lack (another answer's) cannot narrow them
  const live = useMemo(() => whole.filter((p) => rows.some((r) => p.column in r)), [whole, rows]);
  const picked = useMemo(() => applySelection(rows, live), [rows, live]);
  // each panel keeps its index in visual.panels, for the page's panel controls;
  // a table stands where the designer put it, when the page can draw one
  const tables = !!renderTable;
  const charts = useMemo(
    () =>
      (panelIndex !== undefined ? [panelIndex] : visual.panels.map((_, i) => i)).flatMap((idx) => {
        const p = visual.panels[idx];
        return (tables && p?.kind === "table") || isChart(p) ? [{ p, idx }] : [];
      }),
    [visual, panelIndex, tables],
  );
  const single = panelIndex !== undefined || charts.length === 1;
  // the rows stop at a LIMIT: the whole result's size, or the query's own count of it, is past them
  const cut = cutRows || (!!totals && totals.rows > rows.length) || (typeof rows[0]?.of_total === "number" && rows[0].of_total > rows.length);
  // the column a chart names each row by: a figure that is one row finds that row's mark by it
  const rowX = charts.find(({ p }) => isChart(p))?.p.x;
  // one picked mark is one row: its records open from the chips, as its mark's own door does
  const one = live.length === 1 && live[0].kind === "value" && live[0].values.length === 1 && picked.length === 1 ? picked[0] : undefined;
  return (
    <div className={cn("flex flex-col", compact ? "gap-3" : cards ? "gap-3 sm:gap-4" : "gap-6")}>
      {!compact && <StatsStrip stats={visual.stats} rows={picked} all={rows} names={names} sym={sym} active={live.length > 0} cards={cards} stack={stack} totals={totals} base={base} span={span} prior={prior} x={rowX} onHoverKey={onHoverKey} onOpen={canDrill ? onPick : undefined} />}
      {lead}
      {onSelection && chips && <SelectionChips selection={whole} onSelection={onSelection} rows={rows} names={names} onZoom={onZoom} onOpen={one && canDrill ? () => onPick(one) : undefined} onAsk={live.length ? onAskSelection : undefined} className={cards ? "px-1" : "-mb-2"} />}
      {charts.length > 0 && (
        <div className={cn("grid", cards ? "gap-3 sm:gap-4" : "gap-x-10 gap-y-8", !single && !stack && "lg:grid-cols-2")}>
          {charts.map(({ p, idx }, i) => (
            <div key={`${i}-${p.title}-${p.x}-${p.kind}`} data-tile className={cn("min-w-0", cards && cn(CARD, "px-4 pb-4 pt-3.5 sm:px-5 sm:pb-5 sm:pt-4"), !single && !stack && p.width === "full" && "lg:col-span-2")}>
              {p.kind === "table" && renderTable ? (
                <section aria-label={p.title || undefined} className="group/panel flex flex-col gap-3">
                  <div className="flex min-h-7 items-center justify-between gap-3">
                    <span className="min-w-0 truncate font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">{titles && p.title}</span>
                    {panelAction && <span data-no-shot className="hidden shrink-0 opacity-0 transition-opacity duration-200 group-hover/panel:opacity-100 group-focus-within/panel:opacity-100 sm:inline [@media(hover:none)]:opacity-100">{panelAction(idx)}</span>}
                  </div>
                  {renderTable(p, idx)}
                </section>
              ) : p.kind === "flow" ? (
                <FlowChart panel={p} rows={rows} names={names} sym={sym} fmt={fmt} base={base} live={live} canDrill={canDrill} onPick={onPick} compact={compact} action={panelAction?.(idx)} titled={titles} />
              ) : (
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
                  cut={cut}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
