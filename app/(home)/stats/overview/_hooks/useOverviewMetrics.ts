"use client";
import { useEffect, useRef, useState } from "react";
import type { OverviewMetrics, TimeRangeKey } from "../_components/types";

interface UseOverviewMetricsResult {
  data: OverviewMetrics | null;
  initialLoading: boolean;
  refetching: boolean;
  error: string | null;
}

// Fetches aggregated overview stats (chains, totals) for the given timeRange.
// Distinguishes the *initial* load (where the entire page shows a skeleton)
// from a *refetch* triggered by a time-range change (where only the table
// shows a loading state, leaving the rest of the page interactive).
export function useOverviewMetrics(
  timeRange: TimeRangeKey
): UseOverviewMetricsResult {
  const [data, setData] = useState<OverviewMetrics | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refetching, setRefetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasLoadedOnce = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    if (hasLoadedOnce.current) {
      setRefetching(true);
    }
    setError(null);

    const fetchMetrics = async () => {
      try {
        const response = await fetch(
          `/api/overview-stats?timeRange=${timeRange}`,
          { signal: controller.signal }
        );
        if (!response.ok) {
          throw new Error(`Failed to fetch metrics: ${response.status}`);
        }
        const metrics = await response.json();
        setData(metrics);
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        console.error("Error fetching metrics data:", err);
        setError(
          err instanceof Error ? err.message : "Failed to load metrics data"
        );
      } finally {
        if (!controller.signal.aborted) {
          hasLoadedOnce.current = true;
          setInitialLoading(false);
          setRefetching(false);
        }
      }
    };

    fetchMetrics();
    return () => controller.abort();
  }, [timeRange]);

  return { data, initialLoading, refetching, error };
}
