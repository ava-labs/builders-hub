"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ICTTStats } from "../_components/types";

interface UseIcttStatsResult {
  data: ICTTStats | null;
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  retry: () => void;
  loadMore: () => void;
}

// Fetches paginated ICTT transfers. The first page is requested on mount;
// `loadMore()` appends subsequent pages. Errors during pagination are logged
// but don't replace the displayed data — only the initial fetch surfaces
// `error` to the UI.
export function useIcttStats(): UseIcttStatsResult {
  const [data, setData] = useState<ICTTStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchPage = useCallback(
    async (offset: number, append: boolean, signal: AbortSignal) => {
      try {
        if (append) {
          setLoadingMore(true);
        } else {
          setLoading(true);
          setError(null);
        }

        const limit = offset === 0 ? 20 : 25;
        const response = await fetch(
          `/api/ictt-stats?limit=${limit}&offset=${offset}`,
          { signal }
        );

        if (!response.ok) {
          throw new Error(`Failed to fetch ICTT stats (HTTP ${response.status})`);
        }

        const json = await response.json();

        if (append) {
          setData((prev) =>
            prev
              ? { ...json, transfers: [...prev.transfers, ...json.transfers] }
              : json
          );
        } else {
          setData(json);
        }
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        console.error("Error fetching ICTT stats:", err);
        if (!append) {
          setError(
            err instanceof Error ? err.message : "Failed to load ICTT data"
          );
        }
      } finally {
        if (!signal.aborted) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    []
  );

  const fetchInitial = useCallback(() => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    fetchPage(0, false, controller.signal);
  }, [fetchPage]);

  useEffect(() => {
    fetchInitial();
    return () => abortRef.current?.abort();
  }, [fetchInitial]);

  const loadMore = useCallback(() => {
    setData((current) => {
      if (current?.transfers) {
        const controller = new AbortController();
        // Pagination requests are not aborted on unmount; the fetchPage
        // handler short-circuits state writes if signal becomes aborted.
        fetchPage(current.transfers.length, true, controller.signal);
      }
      return current;
    });
  }, [fetchPage]);

  return {
    data,
    loading,
    loadingMore,
    error,
    retry: fetchInitial,
    loadMore,
  };
}
