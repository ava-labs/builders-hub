"use client";

import { useEffect, useState } from "react";
import { pchainApiPath } from "@/lib/pchain-explorer";

/**
 * Generic client fetch for the same-origin P-chain proxy. Plain
 * fetch + AbortController (matches the builders-hub stats convention;
 * react-query is scoped to the toolbox only).
 */
export function usePchainData<T>(
  network: string,
  resource: string,
  query?: Record<string, string | number | undefined>,
): { data: T | null; loading: boolean; error: string | null } {
  const key = pchainApiPath(network, resource, query);
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    (async () => {
      // the upstream explorer API times out intermittently under load
      // (504 through the proxy); one spaced retry absorbs almost all of it.
      // 404s are real answers and never retried.
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const res = await fetch(key, { signal: controller.signal });
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
          setError(message);
          setData(null);
        }
      }
      if (!controller.signal.aborted) setLoading(false);
    })();
    return () => controller.abort();
  }, [key]);

  return { data, loading, error };
}
