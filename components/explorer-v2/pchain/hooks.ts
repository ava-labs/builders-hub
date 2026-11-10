"use client";

import { useEffect, useState } from "react";
import { pchainApiPath } from "@/lib/pchain-explorer";
import { usePolledJson } from "@/components/explorer-v2/page-data";

// Default client poll interval for "live" views (home, tx/block lists). Sits
// just above the proxy's ~10s edge cache so most polls coalesce on it while
// still surfacing new blocks/txs within ~10–20s. Detail pages (a specific
// tx/block) are immutable and opt out by omitting refreshMs.
export const LIVE_REFRESH_MS = 12_000;

/**
 * AVAX spot price in USD, for the fiat line on balance surfaces.
 *
 * Reuses `/api/avax-supply` (CoinGecko behind a 60s revalidate) rather than
 * adding a second price path. Returns null until it lands and on any failure,
 * so a dead price feed hides the USD line instead of printing "$0.00".
 *
 * Pass enabled=false on testnets: Fuji AVAX has no market value, and pricing
 * it against mainnet AVAX would be actively misleading.
 */
export function useAvaxUsd(enabled: boolean): number | null {
  const [price, setPrice] = useState<number | null>(null);
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    fetch("/api/avax-supply", { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { price?: number } | null) => {
        if (typeof d?.price === "number" && d.price > 0) setPrice(d.price);
      })
      .catch(() => {
        /* no price, no USD line */
      });
    return () => controller.abort();
  }, [enabled]);
  return price;
}

/** A read of the same-origin P-chain proxy: the shared poll hook
 *  (page-data.ts) on the network's route. Detail pages (a specific tx or
 *  block) are immutable and opt out of polling by omitting refreshMs. */
export function usePchainData<T>(
  network: string,
  resource: string,
  query?: Record<string, string | number | undefined>,
  opts?: Parameters<typeof usePolledJson>[1],
): { data: T | null; loading: boolean; error: string | null } {
  const { data, loading, error } = usePolledJson<T>(pchainApiPath(network, resource, query), opts);
  return { data, loading, error };
}
