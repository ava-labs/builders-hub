/* An answer set beside the period before it, with no new read: the rows of the period before (use-prior.ts) join
   the answer's rows, and the first chart that can show both does. A ranking becomes a dumbbell, each row's figure
   now beside the same figure before; a series gains the period before as a dashed line, bucket for bucket. */

import { isTime } from "@/lib/explorer-query/values";
import type { Panel, VisualSpec } from "@/lib/explorer-query/visual-spec";
import type { Prior } from "./stat-figures";

type Row = Record<string, unknown>;

export interface Compared {
  visual: VisualSpec;
  rows: Row[];
  /** each drawn row's own row of the answer: a mark opens the answer's row, not the joined one */
  origin: Map<Row, Row>;
}

/** the column the figure before stands in, beside its own */
const beforeOf = (column: string) => `${column}__before`;
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** the answer beside the period before, or null when no chart can show both: no rows before, a panel of another
    kind, a series whose periods before do not line up with its own. label names the period before ("Prior 7 days") */
export function comparedTo(visual: VisualSpec | null, rows: readonly Row[], prior: Prior | null, label: string): Compared | null {
  if (!visual || !prior?.rows.length || rows.length < 2) return null;
  const at = visual.panels.findIndex((p) => !!p.x && p.series.length > 0 && (p.kind === "hbar" || p.kind === "bar" || p.kind === "line" || p.kind === "area") && p.series[0].transform === "none" && !p.series.some((s) => s.below));
  const panel = visual.panels[at];
  if (!panel) return null;
  const x = panel.x!;
  const s = panel.series[0];
  const col = beforeOf(s.column);
  const series = rows.every((r) => isTime(r[x]));
  let joined: Row[];
  let drawn: Panel;
  if (series) {
    // the same number of periods, one bucket apart at most: the last period of a window that runs to now is still filling
    if (panel.kind === "hbar" || Math.abs(prior.rows.length - rows.length) > 1) return null;
    const [now, was] = [[...rows], [...prior.rows]].map((list) => list.sort((p, q) => String(p[x]).localeCompare(String(q[x]))));
    joined = now.map((r, i) => ({ ...r, [col]: num(was[i]?.[s.column]) }));
    drawn = { ...panel, series: [...panel.series, { ...s, column: col, label, axis: s.axis, mark: "line", transform: "none", dashed: true }] };
  } else {
    if (panel.kind !== "hbar" && panel.kind !== "bar") return null;
    if (new Set(rows.map((r) => String(r[x]))).size !== rows.length) return null;
    const was = new Map(prior.rows.map((r) => [String(r[x]), num(r[s.column])]));
    joined = rows.map((r) => ({ ...r, [col]: was.get(String(r[x])) ?? null }));
    // a row with no figure before still draws: its dot stands alone, and its change reads new
    if (!joined.some((r) => r[col] !== null)) return null;
    drawn = { ...panel, kind: "dumbbell", stacked: false, series: [s, { ...s, column: col, label }] };
  }
  return { visual: { ...visual, panels: visual.panels.map((p, i) => (i === at ? drawn : p)) }, rows: joined, origin: new Map(joined.map((r, i) => [r, (series ? [...rows].sort((p, q) => String(p[x]).localeCompare(String(q[x]))) : rows)[i]])) };
}
