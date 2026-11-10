"use client";

import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { toggleValue } from "@/lib/explorer-query/selection";
import type { Panel } from "@/lib/explorer-query/visual-spec";
import { fmt, xText } from "../query-format";
import { DIM, inSelection, type PanelProps, type Row } from "./sheet";

/* Rankings that compare. A dumbbell sets each row's figure beside the same figure of the period before; diverging
   bars set gains and losses either side of zero. The figure and its change stand on the row, so no axis is read.
   A click on a row picks it, and its arrow opens its records. */

/** a rise and a fall: the two inks that mean a direction */
const UP = "#15803d";
const DOWN = "#E6212F";
/** the most rows a ranking draws when the panel names no count */
const ROWS = 14;

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** the rows that hold a figure in a column, in the panel's own order, its first N */
function ranked(panel: Panel, rows: Row[], column: string): Row[] {
  const by = panel.sortBy ?? column;
  const dir = panel.sortDir === "asc" ? 1 : -1;
  return rows
    .filter((r) => num(r[column]) !== null)
    .sort((a, b) => dir * ((num(a[by]) ?? 0) - (num(b[by]) ?? 0)))
    .slice(0, panel.topN ?? ROWS);
}

/** a change as a reader says it: +50.6%, -8.8%, +203%; a figure with nothing before it is new */
export function changeText(now: number, before: number | null): string {
  if (before === null || before === 0) return now === 0 ? "0%" : "new";
  const p = ((now - before) / Math.abs(before)) * 100;
  const a = Math.abs(p);
  return `${p >= 0 ? "+" : "-"}${a >= 100 ? Math.round(a) : a.toFixed(1)}%`;
}

/** one row of a ranking: its name, its drawing, its figure, and the arrow to its records */
function RankRow({ props, r, value, note, rose, children }: { props: PanelProps; r: Row; value: string; note?: string; rose?: boolean; children: ReactNode }) {
  const { panel, names, canDrill, onPick, hoverKey, onHoverKey, selection, live, onSelection } = props;
  const x = panel.x!;
  const label = xText(names, x, r[x], "other");
  const on = !live.length || inSelection(live, r);
  const picked = live.length > 0 && on;
  return (
    <li
      onMouseEnter={() => onHoverKey?.(r[x])}
      onMouseLeave={() => onHoverKey?.(undefined)}
      className={cn("flex items-center gap-1 rounded-lg transition-[opacity,background-color] duration-200 motion-reduce:transition-none", hoverKey !== undefined && hoverKey === r[x] && "bg-zinc-50 dark:bg-zinc-900")}
      style={{ opacity: on ? 1 : DIM }}
    >
      <button
        type="button"
        aria-pressed={onSelection ? picked : undefined}
        onClick={(e) => onSelection?.(toggleValue(selection, x, String(r[x] ?? ""), e.shiftKey))}
        className="grid min-h-9 min-w-0 flex-1 grid-cols-[minmax(4.5rem,10rem)_minmax(0,1fr)_auto] items-center gap-x-3 rounded-lg px-2 py-1 text-left font-mono text-[11.5px] tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0061E2]/50"
      >
        <span className="truncate text-right text-zinc-700 dark:text-zinc-300" title={label}>
          {label}
        </span>
        {children}
        <span className="flex items-baseline gap-2 whitespace-nowrap text-zinc-900 dark:text-zinc-50">
          {value}
          {note && (
            <span className={cn("w-14 text-right text-[10.5px] font-bold", rose ? "text-emerald-700 dark:text-emerald-400" : "text-[#C81B28] dark:text-red-400")}>{note}</span>
          )}
        </span>
      </button>
      {canDrill && (
        <button
          type="button"
          aria-label={`Open ${label}`}
          onClick={() => onPick(r)}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-zinc-300 transition-colors hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0061E2]/50 dark:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      )}
    </li>
  );
}

/** a key under a ranking: what each ink is */
function Key({ items }: { items: { label: string; className: string }[] }) {
  return (
    <span className="flex flex-wrap gap-x-4 gap-y-1 px-2 font-mono text-[10.5px] text-zinc-500 dark:text-zinc-400">
      {items.map((k) => (
        <span key={k.label} className="flex items-center gap-1.5">
          <span className={cn("h-2 w-2 rounded-full", k.className)} />
          {k.label}
        </span>
      ))}
    </span>
  );
}

/** each row's figure now and before, on one line: a grey dot where it stood, an ink dot where it stands, and the
    line between them in the ink of its direction */
export function DumbbellView(props: PanelProps) {
  const { panel, rows, sym } = props;
  const [now, before] = panel.series;
  const shown = ranked(panel, rows, now.column);
  const top = Math.max(0, ...shown.flatMap((r) => [num(r[now.column]) ?? 0, num(r[before.column]) ?? 0]));
  const at = (v: number) => (top > 0 ? Math.max(0, Math.min(100, (v / top) * 100)) : 0);
  return (
    <div className="flex flex-col gap-3">
      <Key items={[{ label: now.label, className: "bg-zinc-900 dark:bg-zinc-100" }, { label: before.label, className: "bg-zinc-300 dark:bg-zinc-600" }]} />
      <ul className="flex flex-col">
        {shown.map((r, i) => {
          const n = num(r[now.column]) ?? 0;
          const b = num(r[before.column]);
          const [p, q] = [at(n), b === null ? null : at(b)];
          const up = b === null || n >= b;
          return (
            <RankRow key={i} props={props} r={r} value={fmt(n, now.format, sym)} note={changeText(n, b)} rose={up}>
              <span className="relative block h-5">
                <span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-zinc-100 dark:bg-zinc-800" />
                {q !== null && <span className="absolute top-1/2 h-0.5 -translate-y-1/2 rounded-full" style={{ left: `${Math.min(p, q)}%`, width: `${Math.abs(p - q)}%`, background: up ? UP : DOWN }} />}
                {q !== null && <span className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-zinc-300 ring-2 ring-white dark:bg-zinc-600 dark:ring-zinc-950" style={{ left: `${q}%` }} />}
                <span className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-zinc-900 ring-2 ring-white dark:bg-zinc-100 dark:ring-zinc-950" style={{ left: `${p}%` }} />
              </span>
            </RankRow>
          );
        })}
      </ul>
    </div>
  );
}

/** one signed figure per row, drawn from zero: gains to the right, losses to the left. Rows all of one sign draw
    from the edge, so the bars keep the whole width */
export function DivergingView(props: PanelProps) {
  const { panel, rows, sym } = props;
  const s = panel.series[0];
  const shown = ranked(panel, rows, s.column);
  const values = shown.map((r) => num(r[s.column]) ?? 0);
  const peak = Math.max(0, ...values.map(Math.abs));
  const [gains, losses] = [values.some((v) => v > 0), values.some((v) => v < 0)];
  const zero = gains && losses ? 50 : losses ? 100 : 0;
  const reach = gains && losses ? 50 : 100;
  return (
    <ul className="flex flex-col">
      {shown.map((r, i) => {
        const v = values[i];
        const w = peak > 0 ? (Math.abs(v) / peak) * reach : 0;
        return (
          <RankRow key={i} props={props} r={r} value={`${v > 0 ? "+" : ""}${fmt(v, s.format, sym)}`}>
            <span className="relative block h-4">
              <span className="absolute inset-y-0 w-px bg-zinc-300 dark:bg-zinc-700" style={{ left: `${zero}%` }} />
              <span className="absolute inset-y-0.5 rounded-[2px]" style={{ left: `${v >= 0 ? zero : zero - w}%`, width: `${w}%`, background: v >= 0 ? UP : DOWN }} />
            </span>
          </RankRow>
        );
      })}
    </ul>
  );
}
