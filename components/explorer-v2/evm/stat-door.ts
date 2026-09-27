/* A figure that is one row's extreme (the largest single fee) opens that
   row's transaction when the row names one: the figure's own stem column
   (max_fee_avax -> max_fee_tx), else tx_hash, on the explorer's tx page.
   A figure the totals gave comes from a row a LIMIT cut, a row the page
   does not hold, so it opens nothing. */

import { truncate } from "@/components/explorer-v2/format";
import type { Stat } from "@/lib/explorer-query/visual";

type Row = Record<string, unknown>;

const isHash = (v: unknown): v is string => typeof v === "string" && /^0x[0-9a-fA-F]{64}$/.test(v);

/** the transaction a max or min figure opens, and its hash as the card writes it; null when its row names none */
export function statDoor(s: Pick<Stat, "agg" | "column">, rows: Row[], value: unknown, base: string | undefined): { href: string; hash: string; short: string } | null {
  if (!base || (s.agg !== "max" && s.agg !== "min") || typeof value !== "number") return null;
  let at: Row | null = null;
  for (const r of rows) {
    const v = r[s.column];
    if (typeof v !== "number") continue;
    const best = at?.[s.column] as number | undefined;
    if (best === undefined || (s.agg === "max" ? v > best : v < best)) at = r;
  }
  // the figure is the totals' when no row here holds it
  if (!at || at[s.column] !== value) return null;
  const row = at;
  const hash = [`${s.column.replace(/_[^_]+$/, "")}_tx`, `${s.column}_tx`, "tx_hash"].map((k) => row[k]).find(isHash);
  return hash ? { href: `${base}/tx/${hash}`, hash, short: truncate(hash, 6) } : null;
}
