/* The reader's selection over one answer. A brush on a time chart, a
   click on a bar or a slice, a legend pick: each adds a pick. Every
   surface on the page (stats, charts, callouts, the rows inspector)
   reads the rows through applySelection, so one gesture filters all of
   them. Nothing here asks the server; it narrows rows already on hand. */

export type Row = Record<string, unknown>;

export type Pick =
  /** a continuous span of one column, both ends included */
  | { kind: "range"; column: string; from: string | number; to: string | number }
  /** one or more discrete values of one column */
  | { kind: "value"; column: string; values: string[] };

/** picks on different columns combine with AND; one pick per column */
export type Selection = Pick[];

export const EMPTY: Selection = [];

const TIME = /^\d{4}-\d{2}-\d{2}([ T]\d{2}:\d{2}(:\d{2})?)?/;

/** a comparable key: epoch ms for times, the number for numbers, else the text */
export function order(v: unknown): number | string {
  if (typeof v === "number") return v;
  if (typeof v === "string" && TIME.test(v)) {
    const s = v.replace(" ", "T");
    return new Date(s.length <= 10 ? `${s}T00:00:00Z` : s.endsWith("Z") ? s : `${s}Z`).getTime();
  }
  return String(v ?? "");
}

export function matches(row: Row, p: Pick): boolean {
  const v = row[p.column];
  if (p.kind === "value") return p.values.includes(String(v ?? ""));
  const k = order(v);
  const lo = order(p.from);
  const hi = order(p.to);
  return k >= lo && k <= hi;
}

export function applySelection(rows: Row[], sel: Selection): Row[] {
  if (sel.length === 0) return rows;
  return rows.filter((r) => sel.every((p) => matches(r, p)));
}

/** set or replace the pick on its column; a value pick with no values clears it */
export function withPick(sel: Selection, p: Pick): Selection {
  const rest = sel.filter((q) => q.column !== p.column);
  if (p.kind === "value" && p.values.length === 0) return rest;
  return [...rest, p];
}

/** toggle one value on a column; additive keeps the others (shift-click) */
export function toggleValue(sel: Selection, column: string, value: string, additive: boolean): Selection {
  const cur = sel.find((q) => q.column === column);
  const had = cur?.kind === "value" ? cur.values : [];
  const on = had.includes(value);
  const values = additive ? (on ? had.filter((v) => v !== value) : [...had, value]) : on && had.length === 1 ? [] : [value];
  return withPick(sel, { kind: "value", column, values });
}

export function clearColumn(sel: Selection, column: string): Selection {
  return sel.filter((q) => q.column !== column);
}

/** the selection in words, for a follow-up question: "block_time from
    2026-09-03 to 2026-09-09, token USDC or USDT" */
export function describe(sel: Selection, label: (column: string, value: unknown) => string = (_c, v) => String(v)): string {
  return sel
    .map((p) =>
      p.kind === "range"
        ? `${p.column} from ${label(p.column, p.from)} to ${label(p.column, p.to)}`
        : `${p.column} ${p.values.map((v) => label(p.column, v)).join(" or ")}`,
    )
    .join(", ");
}
