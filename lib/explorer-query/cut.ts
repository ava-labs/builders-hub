import "server-only";
import { anchored, runQuery, type ColumnMeta, type QueryResult } from "./clickhouse";
import { MAX_ROWS } from "./guard";
import type { Totals } from "./types";

/* What a query's LIMIT left out. A query stops at its own LIMIT (a
   ranking's top 20) or at the row cap, and a reader must see "100 of
   142", with each figure across the top counted over all 142. So when
   the rows come back exactly at the limit, one more read takes the totals
   result's size, sums, extremes and distinct counts. A time series that
   the cap cut from its latest end is written again to keep its newest
   rows: a question about a window is about its latest part too. */

/** a query that ends in its LIMIT, and the form newestSql writes */
const TRAILING = /\sLIMIT\s+(\d+)\s*$/i;
const NEWEST = /^SELECT \* FROM \(SELECT \* FROM \(\n([\s\S]+)\n\) ORDER BY (`[^`]+`) DESC LIMIT (\d+)\) ORDER BY \2$/;
const NUMERIC = /^(Nullable\()?(U?Int\d+|Float\d+|Decimal)/;
const TIME = /^(Nullable\()?Date/;

const quote = (name: string) => "`" + name.replace(/`/g, "") + "`";

/** where a query's rows stop, when they reached its limit: the query without the limit, and the limit */
export function cutOf(sql: string, rowCount: number): { inner: string; limit: number; newest: boolean } | null {
  const n = NEWEST.exec(sql);
  if (n) return rowCount >= Number(n[3]) ? { inner: n[1], limit: Number(n[3]), newest: true } : null;
  const m = TRAILING.exec(sql);
  if (!m) return null;
  const limit = Number(m[1]);
  return rowCount >= limit ? { inner: sql.slice(0, m.index).trimEnd(), limit, newest: false } : null;
}

/** a column rows run along: a time, or a block's number */
export function runsAlong(c: ColumnMeta | undefined): boolean {
  return !!c && (TIME.test(c.type) || /^(block_number|block_height|height)$/i.test(c.name));
}

/** a time series in rising order that the row cap cut, written again to keep its newest rows, still in order */
export function newestSql(sql: string, result: Pick<QueryResult, "columns" | "rows" | "rowCount">, x: string | undefined): string | null {
  if (!x) return null;
  const cut = cutOf(sql, result.rowCount);
  if (!cut || cut.newest || cut.limit < MAX_ROWS) return null;
  if (!runsAlong(result.columns.find((c) => c.name === x))) return null;
  const first = result.rows[0]?.[x];
  const last = result.rows[result.rows.length - 1]?.[x];
  if (first == null || last == null) return null;
  const rising = typeof first === "number" && typeof last === "number" ? first < last : String(first) < String(last);
  if (!rising) return null;
  return `SELECT * FROM (SELECT * FROM (\n${cut.inner}\n) ORDER BY ${quote(x)} DESC LIMIT ${cut.limit}) ORDER BY ${quote(x)}`;
}

/** the whole result, read once past its limit: its size, each column's figures, and the row that holds each
    extreme. sql is the query as written, before anchored(): the totals read goes through anchored() itself,
    so it reads the same tables the rows did (FINAL, the reference tables). Null when the rows did not reach a
    limit or the read failed; a result that only reached its limit comes back with as many rows as it shows */
export async function totalsOf(sql: string, result: QueryResult, chainId: number): Promise<Totals | null> {
  const cut = cutOf(sql, result.rowCount);
  if (!cut) return null;
  const cols = result.columns.map((c, i) => ({ name: c.name, i, num: NUMERIC.test(c.type) }));
  // the column a row is known by: a time, else the first that is not a number
  const label = result.columns.find((c) => TIME.test(c.type)) ?? result.columns.find((c) => !NUMERIC.test(c.type));
  const parts = ["count() AS __rows"];
  for (const { name, i, num } of cols) {
    const q = quote(name);
    const at = label ? [`argMax(${quote(label.name)}, ${q}) AS ha${i}`, `argMin(${quote(label.name)}, ${q}) AS la${i}`] : [];
    parts.push(...(num ? [`sum(${q}) AS s${i}`, `count(${q}) AS n${i}`, `min(${q}) AS lo${i}`, `max(${q}) AS hi${i}`, ...at] : [`uniqExact(${q}) AS d${i}`]));
  }
  try {
    const r = await runQuery((await anchored(`SELECT ${parts.join(", ")} FROM (\n${cut.inner}\n)`, chainId)).sql);
    const row = r.rows[0];
    if (!row) return null;
    const w: Totals = { rows: Number(row.__rows), newest: cut.newest, sum: {}, count: {}, min: {}, max: {}, distinct: {}, ...(label ? { label: label.name, maxAt: {}, minAt: {} } : {}) };
    for (const { name, i, num } of cols) {
      if (!num) {
        w.distinct[name] = Number(row[`d${i}`]);
        continue;
      }
      w.sum[name] = Number(row[`s${i}`]);
      w.count[name] = Number(row[`n${i}`]);
      w.min[name] = Number(row[`lo${i}`]);
      w.max[name] = Number(row[`hi${i}`]);
      if (w.maxAt && w.minAt) {
        w.maxAt[name] = String(row[`ha${i}`]);
        w.minAt[name] = String(row[`la${i}`]);
      }
    }
    return w;
  } catch {
    // the rows stand without their totals; the page says only what it knows
    return null;
  }
}
