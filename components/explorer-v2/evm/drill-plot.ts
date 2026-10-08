/* The records behind one mark of a time series stand in that mark's
   bucket. A drill into Sep 24 plots its records across the whole day, so
   the 50 largest fees of the day read as the burst they are, not as a
   gap in the day; and the plot says they are the 50 largest, not all.
   The 50 latest are a run of time, the bucket's last seconds, and plot
   across the seconds they cover. The cut and the day's bins behind the
   records are the engine's (lib/explorer-query/drill-profile.ts). */

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
