"use client";

import { useEffect, useState } from "react";
import { priceFloor } from "@/lib/evm-fee";
import { minBlockDelayMs, type MarketBlock, type MarketTx } from "@/lib/fee-market";
import { targetOfExponent } from "@/lib/gas-target-math";
import { rpcBatch } from "@/components/explorer-v2/evm/useHeadStream";

/* The fee market off the chain's own RPC: the newest blocks with their txs
   and receipts, the node's bound on the next block's base fee, and the
   priority fee that wallets get suggested. One read every POLL_MS while the
   tab shows, none while it is hidden; each read fetches only the blocks it
   has not seen. 'latest' is the newest executed block, so its receipts are
   there. */

const POLL_MS = 2_000;
/** a read that takes longer is dropped, and the next one starts */
const READ_TIMEOUT_MS = 8_000;
/** how long the reads keep to the head after the older blocks failed to load */
const FILL_BACKOFF_MS = 10_000;
/** the blocks the figures read: about a minute at 0.8 s blocks */
export const MARKET_BLOCKS = 60;

interface RpcTx {
  hash: string;
  gasPrice?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
}

interface RpcBlock {
  number: string;
  timestamp: string;
  timestampMilliseconds?: string;
  baseFeePerGas?: string;
  minPriceExponent?: string;
  targetExponent?: string;
  minDelayExcess?: string;
  gasUsed: string;
  gasLimit: string;
  transactions: RpcTx[];
}

interface RpcReceipt {
  transactionHash: string;
  effectiveGasPrice: string;
}

export interface FeeMarketFeed {
  /** newest first, at most MARKET_BLOCKS */
  blocks: MarketBlock[];
  /** eth_maxPriorityFeePerGas: the priority fee wallets get suggested */
  suggestedTip: bigint | null;
}

const big = (v: string | undefined): bigint | null => (v ? BigInt(v) : null);

function toBlock(b: RpcBlock, txs: MarketTx[]): MarketBlock {
  const ms = big(b.timestampMilliseconds);
  const minPrice = big(b.minPriceExponent);
  const delay = big(b.minDelayExcess);
  return {
    number: Number(BigInt(b.number)),
    timestampMs: ms !== null ? Number(ms) : Number(BigInt(b.timestamp)) * 1000,
    bound: big(b.baseFeePerGas) ?? 0n,
    floor: minPrice !== null ? priceFloor(minPrice) : null,
    target: b.targetExponent ? targetOfExponent(parseInt(b.targetExponent, 16)) : null,
    minDelayMs: delay !== null ? minBlockDelayMs(delay) : null,
    reserved: Number(BigInt(b.gasUsed)),
    gasLimit: Number(BigInt(b.gasLimit)),
    txs,
  };
}

/** the blocks with their receipts; a block missing a receipt is left out, so no figure reads half a block */
async function withReceipts(rpcUrl: string, blocks: RpcBlock[], signal: AbortSignal): Promise<MarketBlock[]> {
  const hashes = blocks.flatMap((b) => b.transactions.map((t) => t.hash));
  const receipts = hashes.length
    ? await rpcBatch<RpcReceipt>(rpcUrl, hashes.map((h) => ({ method: "eth_getTransactionReceipt", params: [h] })), signal)
    : [];
  const byHash = new Map(receipts.flatMap((r) => (r ? [[r.transactionHash, r] as const] : [])));
  return blocks.flatMap((b) => {
    const txs: MarketTx[] = [];
    for (const t of b.transactions) {
      const r = byHash.get(t.hash);
      if (!r) return [];
      txs.push({
        bid:
          t.maxFeePerGas !== undefined && t.maxPriorityFeePerGas !== undefined
            ? { maxFeePerGas: BigInt(t.maxFeePerGas), maxPriorityFeePerGas: BigInt(t.maxPriorityFeePerGas) }
            : { gasPrice: BigInt(t.gasPrice ?? r.effectiveGasPrice) },
        paid: BigInt(r.effectiveGasPrice),
      });
    }
    return [toBlock(b, txs)];
  });
}

export function useFeeMarket(rpcUrl: string | undefined): FeeMarketFeed {
  const [feed, setFeed] = useState<FeeMarketFeed>({ blocks: [], suggestedTip: null });

  useEffect(() => {
    setFeed({ blocks: [], suggestedTip: null });
    if (!rpcUrl) return;
    const controller = new AbortController();
    const kept = new Map<number, MarketBlock>();
    let busy = false;

    // after a failed fill of the older blocks, the next reads keep to the head for a while
    let fillAfter = 0;

    const read = async () => {
      if (busy || document.visibilityState === "hidden") return;
      busy = true;
      // one stalled request must not stop the feed
      const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(READ_TIMEOUT_MS)]);
      try {
        const [head, tip] = await rpcBatch<RpcBlock | string>(
          rpcUrl,
          [
            { method: "eth_getBlockByNumber", params: ["latest", true] },
            { method: "eth_maxPriorityFeePerGas", params: [] },
          ],
          signal,
        );
        const latest = head && typeof head === "object" ? head : null;
        if (!latest || controller.signal.aborted) return;
        const top = Number(BigInt(latest.number));
        if (!kept.has(top)) for (const b of await withReceipts(rpcUrl, [latest], signal)) kept.set(b.number, b);
        const missing: number[] = [];
        for (let n = top - 1; n > top - MARKET_BLOCKS && n >= 0; n--) if (!kept.has(n)) missing.push(n);
        if (missing.length && Date.now() >= fillAfter) {
          try {
            const older = await rpcBatch<RpcBlock>(
              rpcUrl,
              missing.map((n) => ({ method: "eth_getBlockByNumber", params: [`0x${n.toString(16)}`, true] })),
              signal,
            );
            for (const b of await withReceipts(rpcUrl, older.flatMap((b) => (b ? [b] : [])), signal)) kept.set(b.number, b);
          } catch {
            fillAfter = Date.now() + FILL_BACKOFF_MS;
          }
        }
        for (const n of kept.keys()) if (n <= top - MARKET_BLOCKS) kept.delete(n);
        if (controller.signal.aborted) return;
        // a call that did not answer keeps its last value
        setFeed((last) => ({
          blocks: [...kept.values()].sort((x, y) => y.number - x.number),
          suggestedTip: typeof tip === "string" ? BigInt(tip) : last.suggestedTip,
        }));
      } catch {
        /* the last reading stands */
      } finally {
        busy = false;
      }
    };

    void read();
    const timer = setInterval(() => void read(), POLL_MS);
    const onShow = () => {
      if (document.visibilityState === "visible") void read();
    };
    document.addEventListener("visibilitychange", onShow);
    return () => {
      controller.abort();
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onShow);
    };
  }, [rpcUrl]);

  return feed;
}
