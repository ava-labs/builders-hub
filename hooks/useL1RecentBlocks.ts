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
 * Compute the block numbers strictly between `seen` (last polled tip) and
 * `latest` (current chain tip), exclusive of `latest` itself. The hook
 * fetches `latest` separately so the caller can append it after.
 *
 * Exported for unit testing — the hook delegates here for the incremental
 * fetch range so the bigint arithmetic is independently verifiable.
 */
export function blocksBetween(seen: bigint, latest: bigint): bigint[] {
  if (latest <= seen) return [];
  const out: bigint[] = [];
  for (let n = seen + 1n; n < latest; n++) out.push(n);
  return out;
}

/**
 * Keep the newest `count` entries of a block window. The hook merges
 * incremental polls into the existing window and trims the head; this is
 * pure tail-slicing.
 */
export function trimToCount<T>(blocks: T[], count: number): T[] {
  return blocks.length > count ? blocks.slice(blocks.length - count) : blocks;
}

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
  paused: boolean = false,
): L1RecentBlocksState {
  const [blocks, setBlocks] = useState<BlockSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [tick, setTick] = useState(0);
  const requestIdRef = useRef(0);
  // Latest tip known to this hook instance — drives the incremental fetch.
  // Reset on rpcUrl change via the cleanup → effect re-run cycle, but
  // explicitly NOT on count change (see prevRpcUrlRef below).
  const latestSeenRef = useRef<bigint | null>(null);
  const blocksRef = useRef<BlockSummary[]>([]);
  // Tracks the rpcUrl from the previous effect run so we can tell whether
  // this run was triggered by an rpcUrl change (full reset) or a count
  // change (window adjust). Without this, a 30 → 240 toggle threw away
  // 30 already-loaded blocks and triggered a 240-block refetch.
  const prevRpcUrlRef = useRef<string | undefined>(undefined);
  // `paused` lives in a ref so toggling it doesn't tear down the polling
  // effect (which would refetch the entire window unnecessarily). The
  // interval keeps firing every 15s; while paused, guardedPoll just
  // bails out — when the user unpauses, the next tick (≤15s later)
  // catches up.
  const pausedRef = useRef(paused);
  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    if (!rpcUrl) {
      setBlocks([]);
      blocksRef.current = [];
      latestSeenRef.current = null;
      prevRpcUrlRef.current = undefined;
      setError(null);
      setIsLoading(false);
      return;
    }

    const requestId = ++requestIdRef.current;
    const client = createPublicClient({ transport: http(rpcUrl) });
    let pollHandle: ReturnType<typeof setInterval> | null = null;

    // Only nuke state on rpcUrl change — when only `count` changed we want
    // to keep the existing window and trim/grow it via `adjustWindow()`
    // below. The hasLoadedOnce flag stays sticky in either case so we
    // don't flash skeletons on every count change after the first load.
    const rpcUrlChanged = prevRpcUrlRef.current !== rpcUrl;
    prevRpcUrlRef.current = rpcUrl;
    if (rpcUrlChanged) {
      latestSeenRef.current = null;
      blocksRef.current = [];
    }

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

    // Adjust the window in-place when only `count` changed. Trims when the
    // new window is smaller (no fetch); fetches the missing older blocks
    // and prepends when the new window is larger.
    const adjustWindow = async () => {
      const existing = blocksRef.current;
      if (existing.length >= count) {
        const trimmed = trimToCount(existing, count);
        blocksRef.current = trimmed;
        setBlocks(trimmed);
        return;
      }
      const oldest = existing[0]?.number;
      if (oldest === undefined) {
        // Defensive — shouldn't happen because empty `existing` falls into
        // the initialLoad path below. Bail out instead of fanning a fetch.
        return;
      }
      const need = count - existing.length;
      const start = oldest >= BigInt(need) ? oldest - BigInt(need) : 0n;
      const numbers: bigint[] = [];
      for (let n = start; n < oldest; n++) numbers.push(n);
      if (numbers.length === 0) {
        // Already at genesis-block boundary — nothing more to fetch.
        return;
      }

      setIsLoading(true);
      try {
        const results = await Promise.allSettled(
          numbers.map((n) => client.getBlock({ blockNumber: n })),
        );
        if (requestId !== requestIdRef.current) return;

        const olderSummaries: BlockSummary[] = [];
        for (const r of results) {
          if (r.status !== 'fulfilled') continue;
          olderSummaries.push(toSummary(r.value));
        }
        // Promise.allSettled doesn't guarantee result order — sort the
        // newly-fetched older blocks by number before prepending.
        olderSummaries.sort((a, b) =>
          a.number < b.number ? -1 : a.number > b.number ? 1 : 0,
        );

        const merged = [...olderSummaries, ...existing];
        blocksRef.current = merged;
        setBlocks(merged);
        setError(null);
        setIsLoading(false);
      } catch (err) {
        if (requestId !== requestIdRef.current) return;
        setError(err instanceof Error ? err.message : 'Failed to load older blocks');
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
        const numbers = blocksBetween(seen, latest.number);
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
        const trimmed = trimToCount(merged, count);

        latestSeenRef.current = latest.number;
        blocksRef.current = trimmed;
        setBlocks(trimmed);
        setError(null);
      } catch (err) {
        if (requestId !== requestIdRef.current) return;
        setError(err instanceof Error ? err.message : 'Failed to refresh blocks');
      }
    };

    // Visibility-aware poll: skip when the tab is hidden so a backgrounded
    // dashboard doesn't fan out 60–240 RPC calls per cycle while the user
    // is in another tab. On visibility return, fire one immediate catch-up
    // poll so the chart isn't stale when the user comes back.
    const isHidden = () =>
      typeof document !== 'undefined' && document.visibilityState === 'hidden';

    const guardedPoll = () => {
      if (isHidden() || pausedRef.current) return;
      void incrementalPoll();
    };

    const onVisibilityChange = () => {
      if (!isHidden() && !pausedRef.current && latestSeenRef.current !== null) {
        // Tab just became visible — catch up immediately. The next interval
        // tick continues normally afterwards. Skip when paused so the user
        // doesn't lose the frozen frame they're inspecting.
        void incrementalPoll();
      }
    };

    // Pick the right startup path. After an rpcUrl change (or first mount)
    // blocksRef is empty and we run the full initial load. After a pure
    // count change the window already has data — just trim or grow it.
    if (blocksRef.current.length === 0) {
      initialLoad();
    } else {
      void adjustWindow();
    }
    pollHandle = setInterval(guardedPoll, POLL_INTERVAL_MS);
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisibilityChange);
    }
    return () => {
      if (pollHandle) clearInterval(pollHandle);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisibilityChange);
      }
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
