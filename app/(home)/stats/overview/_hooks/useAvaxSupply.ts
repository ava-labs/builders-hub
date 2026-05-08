"use client";
import { useEffect, useState } from "react";
import type { AvaxSupplyData } from "../_components/types";

interface UseAvaxSupplyResult {
  data: AvaxSupplyData | null;
  loading: boolean;
  error: string | null;
}

// Fetches AVAX supply data (burned amounts + L1 validator fees) for the
// secondary stats row. Failure is non-fatal — the hero shows "—" placeholders.
export function useAvaxSupply(): UseAvaxSupplyResult {
  const [data, setData] = useState<AvaxSupplyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    const fetchAvaxSupply = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch("/api/avax-supply", {
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error(`Failed to fetch AVAX supply (HTTP ${response.status})`);
        }
        const json = await response.json();
        setData(json);
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        console.error("Error fetching AVAX supply data:", err);
        setError(err instanceof Error ? err.message : "Failed to load AVAX supply");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    fetchAvaxSupply();
    return () => controller.abort();
  }, []);

  return { data, loading, error };
}
