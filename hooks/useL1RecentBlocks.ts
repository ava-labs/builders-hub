'use client';

import { useEffect, useRef, useState } from 'react';
import { createPublicClient, http } from 'viem';

export interface BlockSummary {
  number: bigint;
  timestamp: bigint;
  txCount: number;
  gasUsed: bigint;
  gasLimit: bigint;
  baseFeePerGas: bigint | null;
}

export interface L1RecentBlocksState {
  blocks: BlockSummary[];
  isLoading: boolean;
  error: string | null;
  /** True for the very first fetch — used to render skeletons vs. live data. */
  hasLoadedOnce: boolean;
  refresh: () => void;
}

const DEFAULT_COUNT = 60;
const POLL_INTERVAL_MS = 30_000;

/**
 * Fetch the last `count` blocks from a given EVM RPC and re-poll every 30s.
 * Used by /console/my-l1/stats to render live charts (block time, tx count,
 * gas utilization, base fee). Each poll re-fetches the full window — fine
 * for ~60 blocks, but if we ever want longer history we should switch to
 * incremental polling (latest block + drop-oldest).
 *
 * Falls back gracefully when:
 * - rpcUrl is undefined → returns empty state
 * - block N can't be fetched → that block is omitted from the result
 * - the RPC times out → existing data stays visible, error is surfaced
 */
export function useL1RecentBlocks(
  rpcUrl: string | undefined,
  count: number = DEFAULT_COUNT,
): L1RecentBlocksState {
  const [blocks, setBlocks] = useState<BlockSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [tick, setTick] = useState(0);
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (!rpcUrl) {
      setBlocks([]);
      setError(null);
      setIsLoading(false);
      return;
    }

    const requestId = ++requestIdRef.current;
    const client = createPublicClient({ transport: http(rpcUrl) });
    let pollHandle: ReturnType<typeof setInterval> | null = null;

    const sample = async () => {
      setIsLoading(true);
      try {
        const latest = await client.getBlock();
        if (requestId !== requestIdRef.current) return;

        const latestNumber = latest.number;
        const start = latestNumber > BigInt(count - 1) ? latestNumber - BigInt(count - 1) : 0n;

        // Fetch the rest of the window in parallel — the latest block we
        // already have, so skip refetching it.
        const numbers: bigint[] = [];
        for (let n = start; n < latestNumber; n++) numbers.push(n);

        const results = await Promise.allSettled(
          numbers.map((n) => client.getBlock({ blockNumber: n })),
        );
        if (requestId !== requestIdRef.current) return;

        const summaries: BlockSummary[] = [];
        for (const r of results) {
          if (r.status !== 'fulfilled') continue;
          summaries.push(toSummary(r.value));
        }
        summaries.push(toSummary(latest));

        setBlocks(summaries);
        setError(null);
        setIsLoading(false);
        setHasLoadedOnce(true);
      } catch (err) {
        if (requestId !== requestIdRef.current) return;
        setError(err instanceof Error ? err.message : 'Failed to load recent blocks');
        setIsLoading(false);
      }
    };

    sample();
    pollHandle = setInterval(sample, POLL_INTERVAL_MS);
    return () => {
      if (pollHandle) clearInterval(pollHandle);
    };
  }, [rpcUrl, count, tick]);

  return {
    blocks,
    isLoading,
    error,
    hasLoadedOnce,
    refresh: () => setTick((n) => n + 1),
  };
}

function toSummary(block: {
  number: bigint;
  timestamp: bigint;
  transactions: readonly unknown[];
  gasUsed: bigint;
  gasLimit: bigint;
  baseFeePerGas: bigint | null;
}): BlockSummary {
  return {
    number: block.number,
    timestamp: block.timestamp,
    txCount: block.transactions.length,
    gasUsed: block.gasUsed,
    gasLimit: block.gasLimit,
    baseFeePerGas: block.baseFeePerGas,
  };
}
