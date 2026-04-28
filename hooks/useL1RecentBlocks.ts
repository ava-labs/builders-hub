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
const POLL_INTERVAL_MS = 15_000;

/**
 * Fetch the last `count` blocks from a given EVM RPC and refresh every
 * 15s. Used by `/console/my-l1/stats` to render live charts.
 *
 * Strategy:
 *  - First load: parallel fetch of [latest - count + 1 .. latest].
 *  - Subsequent polls: incremental — fetch latest only, then any new
 *    blocks since the previously-seen tip in parallel. Prepend to the
 *    window, drop oldest to keep length === count. This means a 240-block
 *    window costs 240 RPC calls once, then ~1-3 RPC calls per poll
 *    afterwards instead of 240.
 *  - rpcUrl or count change: full reset + re-fetch.
 *
 * Falls back gracefully when rpcUrl is undefined (returns empty state),
 * a single block fails (omitted from result), or the RPC errors (existing
 * data stays visible, error is surfaced).
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
  // Latest tip known to this hook instance — drives the incremental fetch.
  // Reset on rpcUrl/count change via the cleanup → effect re-run cycle.
  const latestSeenRef = useRef<bigint | null>(null);
  const blocksRef = useRef<BlockSummary[]>([]);

  useEffect(() => {
    if (!rpcUrl) {
      setBlocks([]);
      blocksRef.current = [];
      latestSeenRef.current = null;
      setError(null);
      setIsLoading(false);
      return;
    }

    const requestId = ++requestIdRef.current;
    const client = createPublicClient({ transport: http(rpcUrl) });
    let pollHandle: ReturnType<typeof setInterval> | null = null;

    // Reset state for this rpcUrl/count combo. The hasLoadedOnce flag stays
    // sticky so we don't flash skeletons on every count change after the
    // first successful load.
    latestSeenRef.current = null;
    blocksRef.current = [];

    const initialLoad = async () => {
      setIsLoading(true);
      try {
        const latest = await client.getBlock();
        if (requestId !== requestIdRef.current) return;
        const latestNumber = latest.number;
        const start = latestNumber > BigInt(count - 1) ? latestNumber - BigInt(count - 1) : 0n;

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

        latestSeenRef.current = latestNumber;
        blocksRef.current = summaries;
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

    const incrementalPoll = async () => {
      // Skip if the initial load hasn't completed yet — wait for the next tick.
      if (latestSeenRef.current === null) return;
      try {
        const latest = await client.getBlock();
        if (requestId !== requestIdRef.current) return;
        const seen = latestSeenRef.current!;
        if (latest.number <= seen) {
          // No new blocks — nothing to do.
          return;
        }

        // Fetch every new block strictly between (seen, latest.number).
        const numbers: bigint[] = [];
        for (let n = seen + 1n; n < latest.number; n++) numbers.push(n);
        const results = await Promise.allSettled(
          numbers.map((n) => client.getBlock({ blockNumber: n })),
        );
        if (requestId !== requestIdRef.current) return;

        const newSummaries: BlockSummary[] = [];
        for (const r of results) {
          if (r.status !== 'fulfilled') continue;
          newSummaries.push(toSummary(r.value));
        }
        newSummaries.push(toSummary(latest));

        const merged = [...blocksRef.current, ...newSummaries];
        // Keep tail = newest `count` blocks.
        const trimmed = merged.length > count ? merged.slice(merged.length - count) : merged;

        latestSeenRef.current = latest.number;
        blocksRef.current = trimmed;
        setBlocks(trimmed);
        setError(null);
      } catch (err) {
        if (requestId !== requestIdRef.current) return;
        setError(err instanceof Error ? err.message : 'Failed to refresh blocks');
      }
    };

    initialLoad();
    pollHandle = setInterval(incrementalPoll, POLL_INTERVAL_MS);
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
