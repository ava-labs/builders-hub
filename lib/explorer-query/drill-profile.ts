/* A drill that ranks its records (the 50 largest fees of a day) plots only
   those, and the bucket's other hours read as missing data. So the drill
   also reads its whole population over the bucket in bins: the drill's
   own SQL without its last ORDER BY and LIMIT, grouped by time, with each
   bin's record count and the ranked column's sum (a fee, an amount, gas)
   or, for a column that does not add up (a price), its highest. The page
   draws the bins behind the ranked records. */

/** the cut a drill's records are when its rows stop at the LIMIT of its last ORDER BY */
export interface DrillCut {
  /** in the plot's words: "the 50 largest fees", "the 50 latest" */
  words: string;
  /** the column the rows are ordered by */
  col: string;
  /** the rows are in time order, so they are a run of time, not the top of a figure across the bucket */
  byTime: boolean;
}

/** the drill's last ORDER BY and LIMIT, outside any parentheses */
const ORDER_LIMIT = /\bORDER\s+BY\s+(?:\w+\.)?`?(\w+)`?(?:\s+(ASC|DESC))?[^()]*?\bLIMIT\s+(\d+)\s*;?\s*$/i;
const TIME = /^(?:block_time|block_timestamp|t|time|ts)$/i;

/** the cut a drill's records are; null for records that are all there are */
export function drillCut(sql: string, rowCount: number): DrillCut | null {
  const m = ORDER_LIMIT.exec(sql);
  if (!m || Number(m[3]) !== rowCount) return null;
  const [, col, dir] = m;
  const desc = /^desc$/i.test(dir ?? "");
  if (TIME.test(col)) return { words: `the ${rowCount} ${desc ? "latest" : "earliest"}`, col, byTime: true };
  const most = desc ? "largest" : "smallest";
  const words = /^fees?(?:_\w+)?$/i.test(col)
    ? `the ${rowCount} ${most} fees`
    : /^amount(?:_\w+)?$/i.test(col)
      ? `the ${rowCount} ${most} amounts`
      : `the ${rowCount} ${most} by ${col.replace(/_/g, " ")}`;
  return { words, col, byTime: false };
}

/** the records are all there are: the drill's last LIMIT (the guard gives every query one) cut none of them, and
    no LIMIT inside cut the population before */
export function drillWhole(sql: string, rowCount: number): boolean {
  const last = /\bLIMIT\s+(\d+)\s*;?\s*$/i.exec(sql);
  if ([...sql.matchAll(/\bLIMIT\s+\d+/gi)].length > (last ? 1 : 0)) return false;
  return !last || rowCount < Number(last[1]);
}

/** a drill's whole population over its bucket, in bins */
export interface DrillProfile {
  /** the ranked column, and how a bin adds it up */
  col: string;
  agg: "sum" | "max";
  /** the bin width, in seconds */
  step: number;
  /** each bin: its start in unix seconds, its record count and its figure */
  bins: { t: number; n: number; v: number }[];
}

const STEPS = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600, 7200, 10_800, 21_600, 43_200, 86_400];

/** a round bin width that gives a bucket at most 96 bins, and a bin a few blocks at least: 15 minutes for a day, a
    minute for an hour, 10 s for 5 minutes */
export function binStep(seconds: number): number {
  return STEPS.find((s) => s >= Math.max(10, seconds / 96)) ?? 86_400;
}

/** a figure that adds up across records (a fee, an amount, gas used), not a rate, a price or an average */
const additive = (col: string) => /^(?:fees?|amount|value|volume|gas|usd|avax|total|count|transfers?|txs?)(?:_\w+)?$/i.test(col) && !/price|rate|ratio|pct|percent|share|avg|mean|per_/i.test(col);

/** the SQL of a drill's bins over a bucket in unix seconds; null when the drill does not rank its records by a figure */
export function profileSql(sql: string, span: readonly [number, number]): Omit<DrillProfile, "bins"> & { sql: string } | null {
  const m = ORDER_LIMIT.exec(sql);
  if (!m || TIME.test(m[1]) || !(span[1] > span[0])) return null;
  const col = m[1];
  const step = binStep(span[1] - span[0]);
  const agg = additive(col) ? "sum" : "max";
  const population = sql.slice(0, m.index).trim();
  return {
    col,
    agg,
    step,
    sql: `SELECT toUnixTimestamp(toStartOfInterval(t, INTERVAL ${step} SECOND)) AS bin, count() AS n, ${agg}(\`${col}\`) AS v FROM (\n${population}\n) GROUP BY bin ORDER BY bin`,
  };
}
