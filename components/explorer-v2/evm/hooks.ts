"use client";

import { useCallback, useEffect, useState } from "react";
import { evmApiPath } from "@/lib/evm-explorer";
import { usePolledJson } from "@/components/explorer-v2/page-data";

// Default client poll interval for "live" views (home, tx/block lists).
export const LIVE_REFRESH_MS = 5_000;

const CHAIN_REFRESH_MS: Record<string, number> = {
  "43114": 1_000,
};

export function refreshMsForChain(chainId: number | string | undefined): number {
  return CHAIN_REFRESH_MS[String(chainId)] ?? LIVE_REFRESH_MS;
}

/** A read of the same-origin EVM explorer proxy: the shared poll hook
 *  (page-data.ts) on the chain's route. A chain not yet known reads nothing. */
export function useEvmData<T>(
  chainId: number | string | undefined,
  resource: string,
  query?: Record<string, string | number | undefined>,
  opts?: Parameters<typeof usePolledJson>[1],
): { data: T | null; loading: boolean; error: string | null; retry: () => void } {
  return usePolledJson<T>(chainId != null ? evmApiPath(chainId, resource, query) : "", opts);
}

/* Token market data: CoinGecko by way of the legacy explorer route's
 * priceOnly mode (server-side cached). Chain data stays on the EVM
 * explorer API; this is the one figure that isn't on-chain. */
export interface PriceData {
  price: number;
  priceInAvax?: number;
  change24h: number;
  marketCap: number;
}

export function usePrice(chainId: string | number | undefined): {
  price: PriceData | null;
  /** the fetch resolved: distinguishes "loading" from "token isn't listed",
   *  so USD-or-native cells can hold instead of flipping units */
  settled: boolean;
} {
  const [state, setState] = useState<{ price: PriceData | null; settled: boolean }>({
    price: null,
    settled: false,
  });
  useEffect(() => {
    if (chainId == null) return;
    let cancelled = false;
    setState({ price: null, settled: false });
    fetch(`/api/explorer/${chainId}?priceOnly=true`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { price?: PriceData } | null) => {
        if (!cancelled) setState({ price: data?.price ?? null, settled: true });
      })
      .catch(() => {
        if (!cancelled) setState({ price: null, settled: true });
      });
    return () => {
      cancelled = true;
    };
  }, [chainId]);
  return state;
}

/** wei × USD/token → "$1,234.56"; undefined without a price or for zero */
export function usdOfWei(wei: string | number | bigint | undefined, usdPrice: number | null): string | undefined {
  if (!usdPrice || wei === undefined) return undefined;
  const v = (Number(wei) / 1e18) * usdPrice;
  if (!Number.isFinite(v) || v === 0) return undefined;
  if (v < 0.01) return "<$0.01";
  return `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** An address list past its first page: the first page arrives through
 *  useEvmData, later pages are fetched on `more()` with the block cursor
 *  the API hands back (`nextBefore`), and appended. A new first page (a
 *  new address) starts the list over. */
export function useMorePages<T>(
  chainId: number | string,
  resource: string,
  listKey: string,
  first: { [k: string]: unknown; nextBefore?: number } | null,
  limit = 50,
): { items: T[]; more: () => void; hasMore: boolean; loadingMore: boolean } {
  const [extra, setExtra] = useState<T[]>([]);
  const [cursor, setCursor] = useState<number | undefined>(undefined);
  const [loadingMore, setLoadingMore] = useState(false);
  useEffect(() => {
    setExtra([]);
    setCursor(first?.nextBefore);
  }, [first]);
  const base = ((first?.[listKey] as T[] | undefined) ?? []);
  const more = useCallback(() => {
    if (cursor === undefined || loadingMore) return;
    setLoadingMore(true);
    fetch(evmApiPath(chainId, resource, { limit, before: cursor }))
      .then((res) => (res.ok ? res.json() : null))
      .then((page: ({ nextBefore?: number } & Record<string, unknown>) | null) => {
        const rows = (page?.[listKey] as T[] | undefined) ?? [];
        setExtra((x) => [...x, ...rows]);
        // a short or cursorless page is the end of the list
        setCursor(rows.length >= limit ? page?.nextBefore : undefined);
      })
      .catch(() => {})
      .finally(() => setLoadingMore(false));
  }, [chainId, resource, listKey, cursor, loadingMore, limit]);
  return { items: [...base, ...extra], more, hasMore: cursor !== undefined, loadingMore };
}
