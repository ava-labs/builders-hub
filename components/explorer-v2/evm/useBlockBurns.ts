"use client";

import { useEffect, useState } from "react";
import { BURN_CHAINS } from "@/lib/evm-burn";

/* The true burn of each block in view, from /api/explorer/[chainId]/burn:
   one request per change of the block set, for the blocks not known yet.
   A block the node has not executed yet comes back empty and is asked
   again on the next change. Kept for the tab's life, since an accepted
   block never changes. */

export type BurnState = bigint | "loading" | "failed";

const known = new Map<string, bigint>();
const failed = new Set<string>();
const inFlight = new Set<string>();

export function useBlockBurns(chainId: string | number | undefined, blocks: number[]): (n: number) => BurnState | undefined {
  const chain = chainId === undefined ? "" : String(chainId);
  const enabled = BURN_CHAINS.has(chain);
  const [, setTick] = useState(0);
  const key = enabled ? blocks.join(",") : "";

  useEffect(() => {
    if (!key) return;
    const want = key
      .split(",")
      .map(Number)
      .filter((n) => {
        const k = `${chain}:${n}`;
        return !known.has(k) && !failed.has(k) && !inFlight.has(k);
      })
      .slice(0, 50);
    if (want.length === 0) return;
    want.forEach((n) => inFlight.add(`${chain}:${n}`));
    fetch(`/api/explorer/${chain}/burn?blocks=${want.join(",")}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((data: { burns: Record<string, string | null> }) => {
        for (const n of want) {
          const wei = data.burns?.[n];
          if (wei != null) known.set(`${chain}:${n}`, BigInt(wei));
        }
      })
      .catch(() => {
        want.forEach((n) => failed.add(`${chain}:${n}`));
      })
      .finally(() => {
        want.forEach((n) => inFlight.delete(`${chain}:${n}`));
        // a later block set must not swallow this answer, so no abort here
        setTick((t) => t + 1);
      });
  }, [chain, key]);

  return (n: number) => {
    if (!enabled) return undefined;
    const k = `${chain}:${n}`;
    const wei = known.get(k);
    if (wei !== undefined) return wei;
    return failed.has(k) ? "failed" : "loading";
  };
}
