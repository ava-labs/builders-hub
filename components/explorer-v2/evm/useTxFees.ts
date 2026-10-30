"use client";

import { useEffect, useState } from "react";
import { feeWeiOf, type FeeReceipt } from "@/lib/evm-burn";
import { rpcBatch } from "./useHeadStream";

/* The fee each listed transaction paid. The indexer's rows carry the gas
   used but not the price, so the fee comes from the receipts: one batched
   read for the rows not known yet, kept for the tab's life, since a receipt
   never changes. A receipt the node does not return reads as no fee. */

const known = new Map<string, bigint | null>();
const inFlight = new Set<string>();

/** one batch at most per change of the row set */
const PER_READ = 100;

export function useTxFees(rpcUrl: string | undefined, hashes: string[]): (hash: string) => bigint | null | undefined {
  const [, setTick] = useState(0);
  const key = rpcUrl ? hashes.join(",") : "";

  useEffect(() => {
    if (!key || !rpcUrl) return;
    const want = key
      .split(",")
      .filter((h) => !known.has(`${rpcUrl}:${h}`) && !inFlight.has(`${rpcUrl}:${h}`))
      .slice(0, PER_READ);
    if (want.length === 0) return;
    want.forEach((h) => inFlight.add(`${rpcUrl}:${h}`));
    // not aborted on unmount: the receipts fill the cache for the next view
    rpcBatch<FeeReceipt>(
      rpcUrl,
      want.map((h) => ({ method: "eth_getTransactionReceipt", params: [h] })),
      new AbortController().signal,
    )
      .then((receipts) => {
        want.forEach((h, i) => {
          const r = receipts[i];
          known.set(`${rpcUrl}:${h}`, r?.gasUsed && r.effectiveGasPrice ? feeWeiOf(r) : null);
        });
      })
      .catch(() => {
        /* the column stays empty; the next change of rows asks again */
      })
      .finally(() => {
        want.forEach((h) => inFlight.delete(`${rpcUrl}:${h}`));
        setTick((t) => t + 1);
      });
  }, [key, rpcUrl]);

  return (hash) => (rpcUrl ? known.get(`${rpcUrl}:${hash}`) : null);
}
