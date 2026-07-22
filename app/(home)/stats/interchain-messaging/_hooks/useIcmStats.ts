"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ICMStats } from "../_components/types";

interface UseIcmStatsResult {
  data: ICMStats | null;
  loading: boolean;
  error: string | null;
  retry: () => void;
}

// Fetches the ICM message volume series for the given window (the /api/icm-stats
// route accepts 1d/7d/30d/90d/1y). Defaults to "1y" so existing callers behave
// as before. Cancels in-flight requests when the component unmounts, retry is
// invoked, or timeRange changes, so a stale response can't overwrite fresh state.
export function useIcmStats(timeRange: string = "1y"): UseIcmStatsResult {
  const [data, setData] = useState<ICMStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchStats = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/icm-stats?timeRange=${timeRange}`, {
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const json = await response.json();
      setData(json);
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [timeRange]);

  useEffect(() => {
    fetchStats();
    return () => abortRef.current?.abort();
  }, [fetchStats]);

  return { data, loading, error, retry: fetchStats };
}
