/* The records behind one mark of a time series stand in that mark's
   bucket. A drill into Sep 24 plots its records across the whole day, so
   the 50 largest fees of the day read as the burst they are, not as a
   gap in the day; and the plot says they are the 50 largest, not all.
   The 50 latest are a run of time, the bucket's last seconds, and plot
   across the seconds they cover. */

import { msOf } from "@/lib/explorer-query/edges";
import { rowsWindow } from "@/lib/explorer-query/scope";

type Row = Record<string, unknown>;

/** the bucket a mark of a time series stands for, from its time to the series' next step, in unix seconds; null for
    a mark that is no time, and for a series of one */
export function bucketOf(v: unknown, x: string | undefined, rows: Row[]): [number, number] | null {
  const step = x ? rowsWindow(rows, x, Infinity)?.grain : undefined;
  const t = msOf(v);
  return step && Number.isFinite(t) ? [t / 1000, (t + step) / 1000] : null;
}

const TIME = /^(?:block_time|block_timestamp|t|time|ts)$/i;

/** the cut a drill's records are when its rows stop at the LIMIT of its last ORDER BY */
export interface DrillCut {
  /** in the plot's words: "the 50 largest fees", "the 50 latest" */
  words: string;
  /** the column the rows are ordered by */
  col: string;
  /** the rows are in time order, so they are a run of time, not the top of a figure across the bucket */
  byTime: boolean;
}

/** the cut a drill's records are; null for records that are all there are */
export function drillCut(sql: string, rowCount: number): DrillCut | null {
  const m = /\bORDER\s+BY\s+(?:\w+\.)?`?(\w+)`?(?:\s+(ASC|DESC))?[^()]*?\bLIMIT\s+(\d+)\s*;?\s*$/i.exec(sql);
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
