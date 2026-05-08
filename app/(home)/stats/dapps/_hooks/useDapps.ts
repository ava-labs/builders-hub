"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { DAppStats, DAppsMetrics } from "@/types/dapps";

interface UseDappsResult {
  dapps: DAppStats[];
  metrics: DAppsMetrics | null;
  loading: boolean;
  error: string | null;
  retry: () => void;
}

// Fetches the DefiLlama-derived dApps list with overview metrics. Cancels
// in-flight requests on unmount or retry so a stale response can't stomp
// fresher state.
export function useDapps(): UseDappsResult {
  const [dapps, setDapps] = useState<DAppStats[]>([]);
  const [metrics, setMetrics] = useState<DAppsMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchData = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      setLoading(true);
      setError(null);
      const response = await fetch("/api/dapps", { signal: controller.signal });
      if (!response.ok) throw new Error("Failed to fetch dApps data");
      const data = await response.json();
      setDapps(data.dapps);
      setMetrics(data.metrics);
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      console.error("Error fetching dApps:", err);
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    return () => abortRef.current?.abort();
  }, [fetchData]);

  return { dapps, metrics, loading, error, retry: fetchData };
}
