/* What a suggestion's card shows before a click: the headline figure of its answer, a small drawing of its rows,
   and the finding that stands out most. Made from the suggestion's fixed layout and one run of its fixed SQL
   (scan.ts). No model is asked. Pure, so it is tested without a database. */

import { findingsOf, type Finding } from "@/components/explorer-v2/evm/query/findings";
import { statValue } from "@/components/explorer-v2/evm/query/stat-figures";
import { fmt, nameFor } from "@/components/explorer-v2/evm/query-format";
import type { Recipe } from "./cache";
import type { ColumnMeta } from "./clickhouse";
import type { Names } from "./types";
import { isTime } from "./values";

type Row = Record<string, unknown>;

/** the most marks a card's drawing holds */
export const SPARK = 32;

export interface ScanCard {
  /** the answer's first headline figure as the page writes it, and what it is */
  figure: string;
  label: string;
  /** the answer's main series through time, or its ranking's first rows, as heights from 0 to 1 */
  spark: number[];
  shape: "series" | "ranking" | "none";
  /** what stands out most in the rows, when a rule finds something */
  finding: Pick<Finding, "tag" | "text" | "tone" | "score"> | null;
}

/** the rows' values in a column as SPARK marks at most, each the mean of its stretch, scaled to the highest */
function heights(values: number[]): number[] {
  const step = Math.max(1, Math.ceil(values.length / SPARK));
  const marks: number[] = [];
  for (let i = 0; i < values.length; i += step) {
    const part = values.slice(i, i + step);
    marks.push(part.reduce((p, q) => p + q, 0) / part.length);
  }
  const top = Math.max(...marks, 0);
  return top > 0 ? marks.map((v) => Math.round((Math.max(0, v) / top) * 1000) / 1000) : [];
}

/** a suggestion's card from one run of its SQL; null when the run found no rows or the layout names no figure */
export function cardOf(recipe: Pick<Recipe, "visual" | "chart" | "sql">, result: { columns: ColumnMeta[]; rows: Row[] }, names: Names, symbol: string, anchor?: string | null, now?: number): ScanCard | null {
  const { rows, columns } = result;
  const stat = recipe.visual?.stats[0];
  if (!rows.length || !stat) return null;
  const v = statValue(rows, stat);
  if (v === null) return null;
  const figure = typeof v === "number" ? fmt(v, stat.format, symbol) : (nameFor(names, stat.column, v) ?? String(v));
  const panel = recipe.visual?.panels.find((p) => p.kind !== "table" && p.kind !== "flow" && p.kind !== "histogram" && p.kind !== "heatmap" && !!p.x && p.series.length > 0);
  let spark: number[] = [];
  let shape: ScanCard["shape"] = "none";
  if (panel) {
    const [x, col] = [panel.x!, panel.series[0].column];
    const num = (r: Row) => (typeof r[col] === "number" && Number.isFinite(r[col]) ? (r[col] as number) : 0);
    if (rows.every((r) => isTime(r[x]))) {
      spark = heights([...rows].sort((p, q) => String(p[x]).localeCompare(String(q[x]))).map(num));
      shape = "series";
    } else {
      spark = heights(rows.map(num).sort((p, q) => q - p).slice(0, 8));
      shape = "ranking";
    }
    if (spark.length < 2) [spark, shape] = [[], "none"];
  }
  const top = findingsOf({ columns, rows, names, visual: recipe.visual, chart: recipe.chart, sql: recipe.sql, anchor, sym: symbol, now })[0];
  return { figure, label: stat.label, spark, shape, finding: top ? { tag: top.tag, text: top.text, tone: top.tone, score: top.score } : null };
}
