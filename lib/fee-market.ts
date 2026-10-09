/* The C-Chain fee market from its newest blocks: the base fee charged now,
   the priority fees that txs paid, how full the blocks are, and how long a
   tx waits for a block. Pure functions over blocks read from
   the RPC (headers, txs and receipts), so the gas page and its tests use
   one set of rules. Amounts are wei, as bigint; gas is a number. */

import { calculatePrice, executedBaseFee, type FeeBid } from "@/lib/evm-fee";

export interface MarketTx {
  bid: FeeBid;
  /** the receipt's effectiveGasPrice */
  paid: bigint;
}

export interface MarketBlock {
  number: number;
  /** ACP-226 header timestampMilliseconds, else timestamp x 1000 */
  timestampMs: number;
  /** the header's baseFeePerGas: since Helicon the worst-case bound */
  bound: bigint;
  /** the validators' minimum base fee (ACP-283); null on headers without minPriceExponent */
  floor: bigint | null;
  /** the gas target per second (ACP-176); null on headers without targetExponent */
  target: number | null;
  /** the validators' minimum block delay in ms (ACP-226); null on headers without minDelayExcess */
  minDelayMs: number | null;
  /** the header's gasUsed: since Helicon the sum of its txs' gas limits plus its atomic ops' gas */
  reserved: number;
  gasLimit: number;
  txs: MarketTx[];
}

/* decoders for the header exponents, by the node's integer series */

/** the minimum block delay in ms from a header's minDelayExcess: e^(q / 2^20) */
export function minBlockDelayMs(minDelayExcess: bigint): number {
  return Number(calculatePrice(1n, minDelayExcess, 1n << 20n));
}

/** what a block's base fee reads from: its header and its txs with their receipts */
export type FeeBlock = Pick<MarketBlock, "number" | "bound" | "floor" | "txs">;

/** the base fee a block charged: read back from its receipts, or its bound
 *  when the bound sits at the floor (the charge is never under the floor
 *  nor over the bound); null when neither fixes it */
export function chargedBaseFee(b: FeeBlock): bigint | null {
  const read = executedBaseFee(b.txs);
  if (read !== null) return read;
  return b.floor === null || b.floor >= b.bound ? b.bound : null;
}

/** a head stream's executed blocks: each head with a base fee in its header
 *  and txs in the stream. A head with no txs there is left out, as its
 *  receipts can still be missing. A block that the stream's cap cuts short
 *  still reads right: one base fee applies to all its txs. */
export function streamFeeBlocks(
  heads: { number: number; bound: bigint | null; floor: bigint | null }[],
  txs: { blockNumber: number; bid: FeeBid; paid: bigint }[],
): FeeBlock[] {
  const byBlock = new Map<number, MarketTx[]>();
  for (const { blockNumber, bid, paid } of txs) {
    const own = byBlock.get(blockNumber) ?? [];
    own.push({ bid, paid });
    byBlock.set(blockNumber, own);
  }
  return heads.flatMap(({ number, bound, floor }) => {
    const own = byBlock.get(number);
    return own && bound !== null ? [{ number, bound, floor, txs: own }] : [];
  });
}

/** the base fee now: the newest block whose charge is known */
export function baseFeeNow<B extends FeeBlock>(blocks: B[]): { fee: bigint; block: B } | null {
  const newestFirst = [...blocks].sort((a, b) => b.number - a.number);
  for (const block of newestFirst) {
    const fee = chargedBaseFee(block);
    if (fee !== null) return { fee, block };
  }
  return null;
}

export interface TipStats {
  /** txs with a known split */
  txs: number;
  /** shares of txs (by count, 0..1): no more than `low`, up to 1 nAVAX, more than 1 nAVAX */
  low: number;
  mid: number;
  high: number;
}

const ONE_NANO = 1_000_000_000n;

/** the priority fees txs paid over the blocks, each the paid price less its
 *  block's charged base fee; `low` is the wallet suggestion that bounds the
 *  first band. Null when no tx has a known split. */
export function tipStats(blocks: MarketBlock[], low: bigint): TipStats | null {
  const tips: bigint[] = [];
  for (const b of blocks) {
    const base = chargedBaseFee(b);
    if (base === null) continue;
    for (const tx of b.txs) if (tx.paid >= base) tips.push(tx.paid - base);
  }
  if (!tips.length) return null;
  const n = tips.length;
  const lowN = tips.filter((t) => t <= low).length;
  const highN = tips.filter((t) => t > ONE_NANO).length;
  return { txs: n, low: lowN / n, mid: (n - lowN - highN) / n, high: highN / n };
}

/** the fullest block's reserved gas over its gas limit, 0..1: what decides
 *  whether a tx fits in the next block, and so whether a priority fee matters */
export function fillOf(blocks: MarketBlock[]): number | null {
  if (!blocks.length) return null;
  return Math.max(...blocks.map((b) => (b.gasLimit > 0 ? b.reserved / b.gasLimit : 0)));
}

export interface Cadence {
  /** the median gap between blocks, ms */
  medianMs: number;
  /** the mean wait for the next block of a tx sent at a random moment, ms */
  waitMs: number;
  /** the newest header's minimum block delay, ms */
  minDelayMs: number | null;
  /** blocks per second over the span */
  perSecond: number;
}

/* A gap longer than the minimum delay is idle: no tx was pending, and a tx
   that arrives then starts the next block at once, after a throttle of at
   most 100 ms. A gap of SLOT_MISS_MS or more is a missed proposer slot (the
   next proposer's turn starts 5 s after the parent), and a tx in it waits
   for the gap's end. */
const SLOT_MISS_MS = 4_000;
const IDLE_WAIT_MS = 50;

/** the blocks' rhythm from their millisecond timestamps */
export function cadenceOf(blocks: MarketBlock[]): Cadence | null {
  const sorted = [...blocks].sort((a, b) => a.number - b.number);
  const gaps: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].number !== sorted[i - 1].number + 1) continue;
    const d = sorted[i].timestampMs - sorted[i - 1].timestampMs;
    if (d > 0) gaps.push(d);
  }
  if (!gaps.length) return null;
  const byLength = [...gaps].sort((a, b) => a - b);
  const sum = gaps.reduce((s, d) => s + d, 0);
  const minDelay = sorted[sorted.length - 1].minDelayMs;
  // each moment of a gap waits until the gap ends, except an idle stretch
  const waited = gaps.reduce((s, d) => {
    if (minDelay === null || d >= SLOT_MISS_MS) return s + (d * d) / 2;
    const busy = Math.min(d, minDelay);
    return s + (busy * busy) / 2 + (d - busy) * IDLE_WAIT_MS;
  }, 0);
  return {
    medianMs: byLength[Math.floor(byLength.length / 2)],
    waitMs: waited / sum,
    minDelayMs: minDelay,
    perSecond: (gaps.length * 1000) / sum,
  };
}

/** the fee of `gas` units at a price per gas */
export function costOf(gas: number | bigint, priceWei: bigint): bigint {
  return BigInt(gas) * priceWei;
}

/** the typical gas of everyday actions, for "what does a tx cost now" */
export const ACTIONS: { label: string; gas: number }[] = [
  { label: "Send AVAX", gas: 21_000 },
  { label: "ERC-20 Transfer", gas: 55_000 },
  { label: "DEX Swap", gas: 165_000 },
  { label: "NFT Mint", gas: 120_000 },
];
