"use client";

import { useEffect, useState } from "react";
import { pchainApiPath } from "@/lib/pchain-explorer";

// Default client poll interval for "live" views (home, tx/block lists). Sits
// just above the proxy's ~10s edge cache so most polls coalesce on it while
// still surfacing new blocks/txs within ~10–20s. Detail pages (a specific
// tx/block) are immutable and opt out by omitting refreshMs.
export const LIVE_REFRESH_MS = 12_000;

/**
 * Generic client fetch for the same-origin P-chain proxy. Plain fetch +
 * AbortController (matches the builders-hub stats convention; react-query is
 * scoped to the toolbox only).
 *
 * Pass `opts.refreshMs` to poll: the initial fetch shows the loading state;
 * each subsequent poll refetches silently and only swaps in data on success —
 * a failed background poll keeps the last-good data on screen. Polling pauses
 * while the tab is hidden.
 */
export function usePchainData<T>(
  network: string,
  resource: string,
  query?: Record<string, string | number | undefined>,
  opts?: { refreshMs?: number },
): { data: T | null; loading: boolean; error: string | null } {
  const key = pchainApiPath(network, resource, query);
  const refreshMs = opts?.refreshMs ?? 0;
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const controllers = new Set<AbortController>();

    const load = async (initial: boolean) => {
      // Skip background polls while the tab is hidden; the effect re-runs on
      // remount/navigation so a fresh initial load still happens on return.
      if (!initial && typeof document !== "undefined" && document.hidden) return;
      const controller = new AbortController();
      controllers.add(controller);
      if (initial) {
        setLoading(true);
        setError(null);
      }
      try {
        const res = await fetch(key, { signal: controller.signal });
        if (!res.ok) throw new Error(res.status === 404 ? "not found" : `HTTP ${res.status}`);
        const json = (await res.json()) as T;
        if (!cancelled) {
          setData(json);
          setError(null);
        }
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
        // Only surface the error (and clear data) on the initial load; a failed
        // background poll leaves the last-good data on screen.
        if (!cancelled && initial) {
          setError(e instanceof Error ? e.message : "failed to load");
          setData(null);
        }
      } finally {
        controllers.delete(controller);
        if (!cancelled && initial) setLoading(false);
      }
    };

    void load(true);
    const timer = refreshMs > 0 ? setInterval(() => void load(false), refreshMs) : undefined;

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      controllers.forEach((c) => c.abort());
    };
  }, [key, refreshMs]);

  return { data, loading, error };
}
