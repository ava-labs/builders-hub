"use client";
import { useEffect, useState } from "react";
import {
  CHAIN_STATS_RANGES,
  type ChainStats,
  type ChainStatsRange,
} from "../_components/types";

interface UseChainStatsResult {
  data: ChainStats | null;
  loading: boolean;
  error: string | null;
}

// Fetches on-chain protocol activity scoped to the requested range. Refetches
// when `range` changes. Resets stale data on each refetch so a failed request
// can't leave the previous range's numbers labeled with the new range.
export function useChainStats(range: ChainStatsRange): UseChainStatsResult {
  const [data, setData] = useState<ChainStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const fetchChainStats = async () => {
      try {
        setLoading(true);
        setError(null);
        setData(null);
        const days = CHAIN_STATS_RANGES[range].days;
        const response = await fetch(
          `/api/dapps/chain-stats?days=${days}`,
          { signal: controller.signal }
        );
        if (!response.ok) {
          throw new Error(
            `Failed to fetch chain stats (HTTP ${response.status})`
          );
        }
        const json = await response.json();
        setData(json);
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        console.error("Error fetching chain stats:", err);
        setError(
          err instanceof Error ? err.message : "Failed to load chain stats"
        );
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    fetchChainStats();
    return () => controller.abort();
  }, [range]);

  return { data, loading, error };
}
