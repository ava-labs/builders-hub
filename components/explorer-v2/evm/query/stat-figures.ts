/* A headline figure and how it stands against the period before: the figure over a set of rows, its change against
   the same figure over the rows of the window before, and the words that name that window. Pure, so each is tested
   without a page. */

import type { Totals } from "@/lib/explorer-query/types";
import type { Stat } from "@/lib/explorer-query/visual-spec";
import { wholeFigure } from "@/lib/explorer-query/stat-label";

type Row = Record<string, unknown>;

/** the answer's query read over the period before its window: its rows, and its totals when a LIMIT cut them */
export interface Prior {
  rows: Row[];
  totals: Totals | null;
}

export function statValue(rows: readonly Row[], s: Pick<Stat, "column" | "agg">): number | string | null {
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

/** a change as a reader says it: +50.6%, -8.8%, +203%; a figure with nothing before it is new */
export function changeText(now: number, before: number | null): string {
  if (before === null || before === 0) return now === 0 ? "0%" : "new";
  const p = ((now - before) / Math.abs(before)) * 100;
  const a = Math.abs(p);
  return `${p >= 0 ? "+" : "-"}${a >= 100 ? Math.round(a) : a.toFixed(1)}%`;
}

export interface Change {
  /** +12.4%, or +1.2 pp for a rate */
  text: string;
  rose: boolean;
  before: number;
}

/** a figure against the same figure over the period before; null when there is nothing to set it against (no rows
    before, a figure that is one row's first or last value, a name) or when it did not move */
export function statChange(s: Pick<Stat, "column" | "agg" | "format">, now: number | string | null, prior: Prior | null | undefined): Change | null {
  if (!prior || !prior.rows.length || typeof now !== "number" || s.agg === "first" || s.agg === "last") return null;
  const before = wholeFigure(prior.totals, s) ?? statValue(prior.rows, s);
  if (typeof before !== "number" || !Number.isFinite(before) || !Number.isFinite(now) || before === now) return null;
  const rose = now > before;
  // a rate moves in points: 4% to 5% is one point up, not a quarter more
  if (s.format === "percent") {
    const d = Math.abs(now - before);
    return { text: `${rose ? "+" : "-"}${d >= 10 ? d.toFixed(0) : d >= 1 ? d.toFixed(1) : d.toFixed(2)} pp`, rose, before };
  }
  return { text: changeText(now, before), rose, before };
}

/** the period before a window, as a change names it: last 6 hours gives prior 6 hours, today gives yesterday */
export function priorWords(span: string | null | undefined): string {
  const s = (span ?? "").trim().toLowerCase();
  if (s.startsWith("last ")) return `prior ${s.slice(5)}`;
  if (s === "today") return "yesterday, to this time";
  if (s === "this week") return "last week, to this point";
  if (s === "this month") return "last month, to this point";
  return "the period before";
}
