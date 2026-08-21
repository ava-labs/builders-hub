"use client";

import { useCallback, useEffect, useState } from "react";
import { evmApiPath } from "@/lib/evm-explorer";

// Default client poll interval for "live" views (home, tx/block lists). Sits
// just above the proxy's ~10s edge cache so most polls coalesce on it while
// still surfacing new blocks/txs within ~10–20s. Detail pages (a specific
// tx/block) are immutable and opt out by omitting refreshMs.
export const LIVE_REFRESH_MS = 12_000;

/**
 * Generic client fetch for the same-origin EVM explorer proxy. Mirrors
 * pchain/hooks.ts usePchainData — plain fetch + AbortController, silent
 * background refresh (stale data stands on failure), polling paused while the
 * tab is hidden, and a 404 retry window for entities the indexer trails on.
 */
export function useEvmData<T>(
  chainId: number | string | undefined,
  resource: string,
  query?: Record<string, string | number | undefined>,
  opts?: {
    refreshMs?: number;
    /** keep re-checking a 404 for this long — fresh txs/blocks exist
     *  on-chain seconds before the indexer has ingested them */
    retry404Ms?: number;
  },
): { data: T | null; loading: boolean; error: string | null; retry: () => void } {
  const key = chainId != null ? evmApiPath(chainId, resource, query) : "";
  const refreshMs = opts?.refreshMs ?? 0;
  const retry404Ms = opts?.retry404Ms ?? 0;
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // bumping the nonce re-runs the whole fetch effect — the "Retry" button
  // for feeds that died on an upstream outage rather than a 404
  const [nonce, setNonce] = useState(0);
  const retry = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!key) {
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    setLoading(true);
    setError(null);

    // Every request carries a deadline: a fetch that never settles (laptop
    // sleep mid-request, a proxy socket that never closes) would otherwise
    // end the poll chain silently — the list freezes and visibly ages while
    // the rest of the page keeps re-rendering.
    const pollSignal = () => AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]);

    // silent background refresh: stale data stands on any failure, and the
    // tab pauses polling while hidden so a parked explorer doesn't hammer
    // the (shared, small) upstream API.
    let inFlight = false;
    const refresh = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const res = await fetch(key, { signal: pollSignal() });
        if (res.ok) {
          setData((await res.json()) as T);
          setError(null);
        }
      } catch {
        /* keep showing the last good payload */
      }
      inFlight = false;
      if (!controller.signal.aborted && refreshMs > 0) schedule();
    };
    let live = false;
    const schedule = () => {
      live = true;
      timer = setTimeout(() => {
        if (document.visibilityState === "hidden") schedule();
        else void refresh();
      }, refreshMs);
    };
    // hidden-tab timers are heavily throttled — on return, poll NOW rather
    // than leaving minutes-old rows on screen until the next tick lands
    const onVisible = () => {
      if (document.visibilityState === "visible" && live && !controller.signal.aborted) {
        if (timer) clearTimeout(timer);
        void refresh();
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    // a 404 with retry404Ms is usually the indexer trailing the chain by
    // seconds on a fresh tx — keep re-asking until the window closes.
    const retry404Until = (deadline: number) => {
      timer = setTimeout(async () => {
        if (controller.signal.aborted) return;
        try {
          const res = await fetch(key, { signal: pollSignal() });
          if (res.ok) {
            setData((await res.json()) as T);
            setError(null);
            if (refreshMs > 0) schedule();
            return;
          }
        } catch {
          /* fall through to the next attempt */
        }
        if (!controller.signal.aborted && Date.now() < deadline) retry404Until(deadline);
      }, 4000);
    };

    (async () => {
      // the upstream explorer API times out intermittently under load
      // (504 through the proxy); one spaced retry absorbs almost all of it.
      let notFound = false;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const res = await fetch(key, { signal: pollSignal() });
          if (res.status === 404) throw new Error("not found");
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          setData((await res.json()) as T);
          setError(null);
          break;
        } catch (e) {
          if (e instanceof DOMException && e.name === "AbortError") return;
          const message = e instanceof Error ? e.message : "failed to load";
          const retryable = message !== "not found" && attempt < 2;
          if (retryable) {
            await new Promise((r) => setTimeout(r, 1200 * (attempt + 1)));
            if (controller.signal.aborted) return;
            continue;
          }
          notFound = message === "not found";
          setError(message);
          setData(null);
        }
      }
      if (controller.signal.aborted) return;
      setLoading(false);
      if (notFound && retry404Ms > 0) retry404Until(Date.now() + retry404Ms);
      else if (refreshMs > 0) schedule();
    })();

    return () => {
      controller.abort();
      document.removeEventListener("visibilitychange", onVisible);
      if (timer) clearTimeout(timer);
    };
  }, [key, refreshMs, retry404Ms, nonce]);

  return { data, loading, error, retry };
}
