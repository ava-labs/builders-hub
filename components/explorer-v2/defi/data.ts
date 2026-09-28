"use client";

import { useCallback, useEffect, useState } from "react";
import type { DefiOverview, YieldPool } from "@/lib/defi/llama";
import type { ExplorerRange } from "@/components/explorer-v2/time-range";
import type { Span } from "@/lib/defi/llama";

/* The DeFi page's feeds. Each is one cached snapshot, so the hooks are
   one-shot loads with a retry; each section degrades alone. */

function useFeed<T>(url: string, pick: (raw: unknown) => T | null) {
  const [data, setData] = useState<T | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    fetch(url)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((raw) => {
        if (cancelled) return;
        const picked = pick(raw);
        if (picked === null) setFailed(true);
        else setData(picked);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
    // pick is an inline lambda; re-fetching on its identity would loop
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, attempt]);
  const retry = useCallback(() => setAttempt((a) => a + 1), []);
  return { data, failed, retry };
}

export function useDefiOverview() {
  return useFeed<DefiOverview>("/api/defi/overview", (raw) => {
    const o = raw as DefiOverview;
    return o && Array.isArray(o.protocols) && o.protocols.length ? o : null;
  });
}

export function useDefiYields() {
  return useFeed<YieldPool[]>("/api/defi/yields", (raw) => {
    const pools = (raw as { pools?: YieldPool[] })?.pools;
    return Array.isArray(pools) ? pools : null;
  });
}

/* the page clock as the window a protocol's change reads over: DefiLlama
   keeps each protocol's TVL a day, a week and a month back, so anything
   longer than a month reads the month */
export function spanOf(range: ExplorerRange): Span {
  return range === "day" ? "1d" : range === "week" ? "7d" : "30d";
}

export const SPAN_LABEL: Record<Span, string> = { "1d": "24 hours", "7d": "7 days", "30d": "30 days" };
