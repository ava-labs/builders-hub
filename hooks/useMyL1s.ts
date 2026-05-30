'use client';

import { useEffect, useState, useCallback } from 'react';
import type { MyL1 } from '@/lib/console/my-l1s';

export type { MyL1 };

interface UseMyL1sState {
  l1s: MyL1[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Fetches the L1s tied to the authenticated user's Builder Hub account from
 * `/api/console/my-l1s`. The endpoint aggregates `NodeRegistration` rows by
 * subnet so this hook returns one entry per L1, not per node. Independent of
 * the wallet's selected chain — the page survives Reset Console State and
 * wallet network switches.
 */
export function useMyL1s(): UseMyL1sState {
  const [l1s, setL1s] = useState<MyL1[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  const refetch = useCallback(() => {
    setReloadTick((n) => n + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const ac = new AbortController();

    const run = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/console/my-l1s', {
          credentials: 'include',
          signal: ac.signal,
        });
        if (res.status === 401) {
          if (!cancelled) {
            setL1s([]);
            setError('Sign in to Builder Hub to view your L1s.');
          }
          return;
        }
        if (!res.ok) {
          throw new Error(`Failed to load L1s (${res.status})`);
        }
        const json = (await res.json()) as { l1s: MyL1[] };
        if (!cancelled) {
          setL1s(json.l1s ?? []);
        }
      } catch (err) {
        if (cancelled || ac.signal.aborted) return;
        setError(err instanceof Error ? err.message : 'Failed to load L1s');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [reloadTick]);

  // Auto-refresh when the user returns to this tab — covers the common
  // "I just provisioned an L1 in another tab and want to see it here"
  // flow without forcing a manual Refresh click. Fires on both
  // visibilitychange (tab activation) and focus (window-level focus return
  // from another desktop app, where visibilitychange may not fire).
  //
  // Tab return commonly triggers BOTH listeners back-to-back; we debounce
  // by 1s so we issue exactly one refetch per wake event instead of two.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const WAKE_DEBOUNCE_MS = 1000;
    let lastWakeAt = 0;
    const wake = () => {
      const now = Date.now();
      if (now - lastWakeAt < WAKE_DEBOUNCE_MS) return;
      lastWakeAt = now;
      setReloadTick((n) => n + 1);
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') wake();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', wake);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', wake);
    };
  }, []);

  return { l1s, isLoading, error, refetch };
}
