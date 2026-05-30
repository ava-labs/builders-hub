'use client';

import { useEffect, useState } from 'react';
import type { CrossChainStatsResponse } from '@/app/api/console/cross-chain-stats/[blockchainId]/route';

export type { CrossChainStatsResponse };

interface UseL1CrossChainStatsState {
  data: CrossChainStatsResponse | null;
  isLoading: boolean;
  error: string | null;
}

/**
 * Per-L1 cross-chain stats: ICTT bridge transfers + ICM messages aggregated
 * for the chain identified by `blockchainId` (CB58) and `evmChainId`.
 *
 * Read-only; auto-refetches when the user returns to the tab. Cached at the
 * server boundary so flipping between L1s on the dashboard is cheap.
 */
export function useL1CrossChainStats(
  blockchainId: string | null | undefined,
  evmChainId: number | null | undefined,
): UseL1CrossChainStatsState {
  const [data, setData] = useState<CrossChainStatsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!blockchainId) {
      setData(null);
      setError(null);
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    const ac = new AbortController();
    setIsLoading(true);
    setError(null);

    const url = `/api/console/cross-chain-stats/${encodeURIComponent(blockchainId)}${
      evmChainId !== null && evmChainId !== undefined ? `?evmChainId=${evmChainId}` : ''
    }`;

    (async () => {
      try {
        const res = await fetch(url, { signal: ac.signal });
        if (!res.ok) throw new Error(`Failed to load cross-chain stats (${res.status})`);
        const json = (await res.json()) as CrossChainStatsResponse;
        if (!cancelled) setData(json);
      } catch (err) {
        if (cancelled || ac.signal.aborted) return;
        setError(err instanceof Error ? err.message : 'Failed to load cross-chain stats');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [blockchainId, evmChainId]);

  return { data, isLoading, error };
}
