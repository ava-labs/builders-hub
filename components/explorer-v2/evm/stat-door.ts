/* A figure that is one row's extreme (the largest single fee, the peak
   5 minutes, the gas leader) is that row. It opens the row's transaction
   when the row names one: the figure's own stem column (max_fee_avax ->
   max_fee_tx), else tx_hash, on the explorer's tx page. Else the card
   names the row: the peak's bucket, the leader's name. A figure the
   totals gave comes from a row a LIMIT cut, a row the page does not
   hold, so it opens and names nothing. Nor does a figure that is no
   row's own: one every row holds (a count of all the groups beside each
   of them) or a running total's, which peaks where it ends. */

import { truncate } from "@/components/explorer-v2/format";
import type { Names } from "@/lib/explorer-query/types";
import type { Stat } from "@/lib/explorer-query/visual";
import { msOf } from "@/lib/explorer-query/edges";
import { DAY, MONTHS_SHORT, isHash, isTime } from "@/lib/explorer-query/values";

type Row = Record<string, unknown>;

/** a running total's column, whose max or min is where it ends or starts */
const RUNNING = /(?:^|_)(?:cum|cumulative|running)(?:_|$)/i;

/** the row a max or min figure is, when the page holds it; null for any other figure, for one the totals gave, and
    for one that is no row's own: r11's G02 named "Pools 1,910" after the leader and "Top 5 share" after the 5th pool */
export function extremeOf(s: Pick<Stat, "agg" | "column">, rows: Row[], value: unknown): Row | null {
  if ((s.agg !== "max" && s.agg !== "min") || typeof value !== "number" || RUNNING.test(s.column)) return null;
  let at: Row | null = null;
  let held = 0;
  let same = true;
  for (const r of rows) {
    const v = r[s.column];
    if (typeof v !== "number") continue;
    const best = at?.[s.column] as number | undefined;
    held++;
    if (best !== undefined && v !== best) same = false;
    if (best === undefined || (s.agg === "max" ? v > best : v < best)) at = r;
  }
  // the figure is the totals' when no row here holds it, and no row's own when every row holds it
  if (held > 1 && same) return null;
  return at && at[s.column] === value ? at : null;
}

/** the transaction a max or min figure opens, and its hash as the card writes it; null when its row names none */
export function statDoor(s: Pick<Stat, "agg" | "column">, rows: Row[], value: unknown, base: string | undefined): { href: string; hash: string; short: string } | null {
  if (!base) return null;
  const row = extremeOf(s, rows, value);
  if (!row) return null;
  const hash = [`${s.column.replace(/_[^_]+$/, "")}_tx`, `${s.column}_tx`, "tx_hash"].map((k) => row[k]).find(isHash);
  return hash ? { href: `${base}/tx/${hash}`, hash, short: truncate(hash, 6) } : null;
}

/** the row a figure is, as its card names it by its x: a bucket in the words of the series' step (at 15:35 UTC
    inside one day, Sep 28, 23:55 UTC across days, on Sep 21, week of Sep 21, Sep 2026), else the row's name, else its
    address; nothing for a number */
export function rowWords(v: unknown, x: string, all: Row[], names: Names): string | undefined {
  if (isTime(v)) {
    const times = [...new Set(all.map((r) => r[x]).filter(isTime))].map(msOf).sort((p, q) => p - q);
    let step = Infinity;
    for (let i = 1; i < times.length; i++) step = Math.min(step, times[i] - times[i - 1]);
    const d = new Date(msOf(v));
    const day = `${MONTHS_SHORT[d.getUTCMonth()]} ${d.getUTCDate()}`;
    const hm = d.toISOString().slice(11, 16);
    // a lone row keeps the grain it is written in: a time of day, or a day
    if (step === Infinity ? v.length > 10 && hm !== "00:00" : step < DAY) {
      const oneDay = Math.floor(times[0] / DAY) === Math.floor(times[times.length - 1] / DAY);
      return oneDay ? `at ${hm} UTC` : `${day}, ${hm} UTC`;
    }
    if (step >= 28 * DAY) return `${MONTHS_SHORT[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
    return step >= 7 * DAY ? `week of ${day}` : `on ${day}`;
  }
  if (typeof v !== "string" || !v) return undefined;
  const name = names[x]?.[v.toLowerCase()];
  // a name runs to the card's edge
  if (name) return name;
  // an address, a hash or a long id reads by its ends
  return v.length > 26 ? truncate(v, 6) : v;
}
