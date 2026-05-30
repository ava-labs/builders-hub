"use client";
import { useEffect, useRef, useState } from "react";
import { type SubnetStats } from "@/types/validator-stats";

interface UseValidatorStatsResult {
  stats: SubnetStats[];
  loading: boolean;
  error: string | null;
  availableVersions: string[];
}

// Lazily fetches mainnet validator stats — only triggers when `enabled` is
// true (i.e. the validators table view becomes active). Subsequent toggles
// don't refetch since stats are stable for the session.
export function useValidatorStats(enabled: boolean): UseValidatorStatsResult {
  const [stats, setStats] = useState<SubnetStats[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availableVersions, setAvailableVersions] = useState<string[]>([]);
  const hasFetched = useRef(false);

  useEffect(() => {
    if (!enabled || hasFetched.current) return;

    const controller = new AbortController();
    const fetchValidatorStats = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch("/api/validator-stats?network=mainnet", {
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error(`Failed to fetch validator stats: ${response.status}`);
        }
        const data: SubnetStats[] = await response.json();
        setStats(data);

        const versions = new Set<string>();
        data.forEach((subnet) => {
          Object.keys(subnet.byClientVersion).forEach((v) => versions.add(v));
        });
        const sortedVersions = Array.from(versions)
          .filter((v) => v !== "Unknown")
          .sort()
          .reverse();
        setAvailableVersions(sortedVersions);
        hasFetched.current = true;
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        console.error("Error fetching validator stats:", err);
        setError(
          err instanceof Error ? err.message : "Failed to load validator stats"
        );
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    fetchValidatorStats();
    return () => controller.abort();
  }, [enabled]);

  return { stats, loading, error, availableVersions };
}
