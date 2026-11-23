/* What each chart kind needs of the rows it draws, checked before a layout is kept: a dumbbell needs a figure and
   the same figure before, a histogram a number column with enough values to spread, a heatmap one value for each
   pair, a treemap parts that add up. The designer is told what to fix; a kept layout that no longer fits its rows
   is laid out again. */

import type { ColumnMeta } from "./clickhouse";
import { EXTREME_NAME, MEAN_NAME, NUMERIC, RATE, distinctColumns } from "./column-kinds";
import { HISTOGRAM_ROWS, TREEMAP_PARTS, type Panel } from "./visual-spec";

type Row = Record<string, unknown>;

const val = (r: Row, c: string): number | null => {
  const v = r[c];
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
};

/** why a panel's kind does not fit these rows, for the designer; or null. cut: the rows stop at a LIMIT, with more
    past them */
export function kindError(panels: readonly Panel[], columns: readonly ColumnMeta[], rows: readonly Row[], sql?: string, cut = false): string | null {
  const numeric = (c: string | undefined) => !!c && NUMERIC.test(columns.find((k) => k.name === c)?.type ?? "");
  const once = (c: string) => new Set(rows.map((r) => String(r[c]))).size === rows.length;
  const perRow = distinctColumns(columns, sql);
  for (const p of panels) {
    if (p.kind === "table") continue;
    if (!p.x || p.series.length === 0) return "every chart panel needs x and at least one series";
    const cols = p.series.map((s) => s.column);
    if (p.kind === "dumbbell") {
      if (cols.length !== 2 || !cols.every(numeric)) return "a dumbbell panel needs two number series: the figure now, then the same figure before";
      if (!once(p.x)) return `a dumbbell draws one row for each name, and ${p.x} repeats in these rows: use a column that names each row once`;
    }
    if (p.kind === "diverging") {
      if (cols.length !== 1 || !numeric(cols[0])) return "a diverging panel needs one number series, a signed figure such as a change or a net flow";
      if (!once(p.x)) return `a diverging panel draws one bar for each name, and ${p.x} repeats in these rows: use a column that names each row once`;
      const vs = rows.map((r) => val(r, cols[0])).filter((v): v is number => v !== null);
      if (!vs.some((v) => v < 0) || !vs.some((v) => v > 0)) return `diverging bars set gains and losses either side of zero, and ${cols[0]} is all on one side in these rows: use hbar`;
    }
    if (p.kind === "histogram") {
      if (!numeric(p.x)) return `a histogram's x is the number column whose spread it draws: ${p.x} is not a number column`;
      if (cols.length !== 1 || cols[0] !== p.x) return "a histogram panel has one series, the same column as its x, for its label and format";
      const vs = new Set(rows.map((r) => val(r, p.x!)).filter((v): v is number => v !== null));
      if (rows.length < HISTOGRAM_ROWS || vs.size < 4) return `a histogram spreads ${HISTOGRAM_ROWS} values or more, and these rows hold ${rows.length} (${vs.size} distinct): use hbar or a table`;
    }
    if (p.kind === "heatmap") {
      if (!p.y || p.y === p.x || !columns.some((k) => k.name === p.y)) return "a heatmap panel needs x (the column across), y (another column of the rows, down the side) and one series (the value)";
      if (cols.length !== 1 || !numeric(cols[0])) return "a heatmap panel needs one number series, the value of each cell";
      const [xs, ys, pairs] = [new Set(rows.map((r) => String(r[p.x!]))), new Set(rows.map((r) => String(r[p.y!]))), new Set(rows.map((r) => `${String(r[p.y!])}\u0000${String(r[p.x!])}`))];
      if (xs.size < 2 || ys.size < 2) return "a heatmap needs two or more values on each side: with one, use bar or hbar";
      if (pairs.size < rows.length) return `a heatmap draws one cell for each pair of ${p.x} and ${p.y}, and a pair repeats in these rows`;
    }
    if (p.kind === "treemap") {
      if (cols.length !== 1 || !numeric(cols[0])) return "a treemap panel needs one number series, the size of each part";
      if (!once(p.x)) return `a treemap draws one part for each name, and ${p.x} repeats in these rows: use a column that names each row once`;
      // a part's share is of the whole: the rows a LIMIT kept are not the whole
      if (cut) return "a treemap divides the whole result, and these rows are only its first rows: use hbar";
      if (rows.length < TREEMAP_PARTS) return `a treemap divides a whole among ${TREEMAP_PARTS} parts or more, and these rows hold ${rows.length}: use hbar`;
      // parts of a whole add up: a rate, an average, an extreme or a count of distinct ones in each row does not
      if (RATE.test(cols[0]) || MEAN_NAME.test(cols[0]) || EXTREME_NAME.test(cols[0]) || perRow.has(cols[0])) return `a treemap's parts add up to a whole, and ${cols[0]} does not add up over the rows: use hbar`;
      if (rows.some((r) => (val(r, cols[0]) ?? 0) < 0)) return `a treemap's parts are sizes, and ${cols[0]} holds a value below zero: use diverging or hbar`;
    }
  }
  return null;
}
