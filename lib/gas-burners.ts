/* The C-Chain's top AVAX burners: the accounts that paid the most fees over
   complete UTC days. A fee burns whole on the C-Chain, the tip included
   (lib/evm-burn.ts), so an account's burn is the sum of its transactions'
   fees, gas charged times the price paid. The payer is the transaction's
   sender, and a sender is always an account: a sender with code is refused
   (EIP-3607). The board reads the indexed transactions through the stats
   API's query service (/api/explorer/[chainId]/burners). */

import { DAY } from "@/lib/explorer-query/values";

export type BurnDays = 1 | 7 | 30 | 90;

/** the longest window the board computes: 90 days of transactions take about 14 s to scan */
export const MAX_BURN_DAYS: BurnDays = 90;

/** the rows the route keeps for each window */
export const BURNERS_KEPT = 25;

/** the chains the board serves. Fuji's transaction index stopped in 2021. */
export const BURNERS_CHAINS = new Set([43114]);

export interface Burner {
  /** the account that paid, 0x and lower case */
  wallet: string;
  /** AVAX burned in the window */
  burned: number;
  txs: number;
  /** percent of the AVAX that all transactions burned in the window */
  sharePct: number;
  /** the receiver of the transactions that burned the most of this account's AVAX; null for a contract creation */
  target: string | null;
  /** percent of this account's burn that its transactions to `target` paid */
  targetPct: number;
  /** the registry's protocol or a well-known name for `target` */
  targetName: string | null;
  /** what `target` is, from its code; null when the read failed or for a creation */
  targetKind: "contract" | "account" | null;
}

export interface GasBurners {
  chainId: number;
  days: BurnDays;
  /** the window's first and last UTC days, both included */
  from: string;
  to: string;
  /** AVAX burned by all transactions in the window */
  total: number;
  txs: number;
  /** the accounts that paid a fee in the window */
  wallets: number;
  burners: Burner[];
}

/** the board's window for a clock window of `days`: the smallest that covers it, at most 90 days */
export function burnDays(days: number): BurnDays {
  if (!Number.isFinite(days) || days <= 1) return 1;
  return days <= 7 ? 7 : days <= 30 ? 30 : MAX_BURN_DAYS;
}

const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** the `days` complete UTC days before the day that holds `now` */
export function burnWindow(days: BurnDays, now: Date): { from: string; to: string; start: string; end: string } {
  const end = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const start = end - days * DAY;
  return { from: isoDay(start), to: isoDay(end - DAY), start: `${isoDay(start)} 00:00:00`, end: `${isoDay(end)} 00:00:00` };
}

/**
 * The board's query on evm_txs, keyed by (chain_id, block_number). The block
 * range comes from raw_blocks, so the scan reads only the window's blocks.
 * The inner query sums each (sender, receiver) pair, and the outer query
 * keeps each sender's largest pair as its main receiver (in a tuple, so a
 * contract creation's NULL receiver can win: argMax skips a bare NULL). A fee is
 * gas_used x gas_price, widened to UInt256: a UInt64 product overflows at
 * 18.45 AVAX. Every wei sum goes out as text, because JSON numbers lose
 * digits past 2^53. `complete` says whether the index holds a transaction at
 * or after the window's end: only then does it hold the whole last day.
 */
export function burnersSql(chainId: number, start: string, end: string, limit = BURNERS_KEPT): string {
  const chain = Math.trunc(chainId);
  return `SELECT concat('0x', lower(hex(s))) AS wallet,
  sum(c) AS txs,
  toString(sum(b)) AS burned_wei,
  concat('0x', lower(hex(argMax(tuple(t), b).1))) AS target,
  toString(max(b)) AS target_wei,
  toString(sum(sum(b)) OVER ()) AS total_wei,
  sum(sum(c)) OVER () AS total_txs,
  count() OVER () AS wallets,
  (SELECT max(block_time) FROM evm_txs WHERE chain_id = ${chain} AND block_time >= toDateTime('${end}', 'UTC') - INTERVAL 1 HOUR) >= toDateTime('${end}', 'UTC') AS complete
FROM (
  SELECT \`from\` AS s, \`to\` AS t, count() AS c, sum(toUInt256(gas_used) * gas_price) AS b
  FROM evm_txs
  WHERE chain_id = ${chain}
    AND block_time >= toDateTime('${start}', 'UTC')
    AND block_time < toDateTime('${end}', 'UTC')
    AND block_number >= (SELECT min(block_number) FROM raw_blocks WHERE chain_id = ${chain} AND block_time >= toDateTime('${start}', 'UTC'))
  GROUP BY s, t
)
GROUP BY s
ORDER BY sum(b) DESC
LIMIT ${Math.trunc(limit)}`;
}

/** one row of burnersSql */
export interface BurnerRow {
  wallet: string;
  txs: number | string;
  burned_wei: string;
  target: string | null;
  target_wei: string;
  total_wei: string;
  total_txs: number | string;
  wallets: number | string;
  complete: boolean | number | string;
}

/** wei as AVAX, to the micro-AVAX: a Number cannot hold a large wei sum exactly */
export function weiToAvax(wei: string | bigint): number {
  return Number(BigInt(wei) / 1_000_000_000_000n) / 1e6;
}

/** the query's rows as the board's figures; names and kinds are filled in later. An empty window is not complete. */
export function parseBurners(rows: BurnerRow[]): Pick<GasBurners, "total" | "txs" | "wallets" | "burners"> & { complete: boolean } {
  const first = rows[0];
  const totalWei = first ? BigInt(first.total_wei) : 0n;
  const pctOf = (part: bigint, whole: bigint) => (whole > 0n ? Number((part * 1_000_000n) / whole) / 10_000 : 0);
  return {
    total: weiToAvax(totalWei),
    txs: first ? Number(first.total_txs) : 0,
    wallets: first ? Number(first.wallets) : 0,
    complete: first ? [true, 1, "1", "true"].includes(first.complete) : false,
    burners: rows.map((r) => {
      const burned = BigInt(r.burned_wei);
      return {
        wallet: r.wallet,
        burned: weiToAvax(burned),
        txs: Number(r.txs),
        sharePct: pctOf(burned, totalWei),
        target: r.target || null,
        targetPct: pctOf(BigInt(r.target_wei), burned),
        targetName: null,
        targetKind: null,
      };
    }),
  };
}

/** what eth_getCode says an address is: no code is an account */
export function codeKind(code: unknown): "contract" | "account" | null {
  if (typeof code !== "string" || !/^0x[0-9a-fA-F]*$/.test(code)) return null;
  return code === "0x" ? "account" : "contract";
}

/** the chain-stats route's daily burn rows as complete UTC days before `today`, oldest first: the last `n` of them */
export function dailyBurn(rows: { date: string; value: number | string }[] | undefined, today: string, n: number): { d: string; v: number }[] {
  // the source can repeat a day: one row per date
  const byDay = new Map<string, number>();
  for (const r of rows ?? []) {
    const v = Number(r.value);
    if (r.date < today && Number.isFinite(v)) byDay.set(r.date, v);
  }
  return [...byDay]
    .map(([d, v]) => ({ d, v }))
    .sort((a, b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : 0))
    .slice(-n);
}

/** the last complete UTC day's end for a series read at `readAt` (ms): a day counts only when it ended before the read and before now */
export function seriesCut(readAt: number | undefined, now: number): string {
  return new Date(Math.min(now, readAt ?? now)).toISOString().slice(0, 10);
}
