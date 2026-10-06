/* The wire shape of a chain's live window: /api/live/[chainId] writes it
   once a tick from our own node, and the city's live panes read it. A head
   and a tx here have the head stream's shape (useHeadStream), so a pane can
   take rows from either feed. */

/** the heads a window holds: about 45 s of a one-second chain, so the home
 *  page's lanes open full and a lane that rests misses no block */
export const LIVE_HEADS = 48;

export interface LiveHead {
  number: number;
  hash: string;
  /** `timestampMilliseconds` (ACP-226) when the header carries it, else `timestamp * 1000` */
  timestampMs: number;
  txCount: number;
  gasUsed: number;
  gasLimit: number;
  /** ACP-194: the newest block whose execution this block settles; null on chains without Continuous Execution */
  settledHeight: number | null;
}

/** a transaction with its receipt: the block's tx merged with what execution said */
export interface LiveTx {
  hash: string;
  blockNumber: number;
  txIndex: number;
  /** unix seconds */
  timestamp: number;
  from: string;
  /** "" for contract creation */
  to: string;
  /** wei, decimal string */
  value: string;
  /** 4-byte selector, "" for plain transfers */
  methodId: string;
  /** calldata, cut after the third word: enough to decode a token transfer's amount */
  input: string;
  success: boolean;
  feeWei: number;
}

export interface LiveWindow {
  chainId: string;
  /** server time of the tick, ms since epoch */
  at: number;
  tip: number | null;
  /** every block at or below this height has its receipts in `txs` (execution is FIFO) */
  executedHeight: number | null;
  /** newest first */
  heads: LiveHead[];
  /** newest block first, then by index; only blocks at or below `executedHeight` */
  txs: LiveTx[];
  /** the last tick failed: this is the window as it stood */
  stale: boolean;
}
