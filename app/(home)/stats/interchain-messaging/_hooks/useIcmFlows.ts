"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ICMFlowResponse } from "../_components/types";

interface UseIcmFlowsResult {
  data: ICMFlowResponse | null;
  loading: boolean;
  error: string | null;
  retry: () => void;
}

// Fetches the 30-day ICM flow data used by the flow chart in the Top Chains
// section. Failure surfaces an inline error+retry — the rest of the page
// stays usable.
export function useIcmFlows(): UseIcmFlowsResult {
  const [data, setData] = useState<ICMFlowResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchFlows = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      setLoading(true);
      setError(null);
      const response = await fetch("/api/icm-flow?days=30", {
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch ICM flow (HTTP ${response.status})`);
      }
      const json = await response.json();
      setData(json);
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      console.error("Error fetching ICM flow data:", err);
      setError(err instanceof Error ? err.message : "Failed to load ICM flow");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFlows();
    return () => abortRef.current?.abort();
  }, [fetchFlows]);

  return { data, loading, error, retry: fetchFlows };
}
