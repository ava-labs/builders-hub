"use client";
import { useEffect, useState } from "react";
import type { ICMFlowRoute } from "@/components/stats/NetworkDiagram";

interface IcmFlowApiPoint {
  sourceChainId: string;
  targetChainId: string;
  messageCount: number;
}

interface UseIcmFlowsResult {
  flows: ICMFlowRoute[];
  failedChainIds: string[];
  loading: boolean;
  error: string | null;
}

// Fetches the 30-day ICM flow data used to draw arcs on the NetworkDiagram.
// Failure is non-fatal: the diagram still renders chain nodes, just without flows.
export function useIcmFlows(): UseIcmFlowsResult {
  const [flows, setFlows] = useState<ICMFlowRoute[]>([]);
  const [failedChainIds, setFailedChainIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    const fetchIcmFlows = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch("/api/icm-flow?days=30", {
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error(`Failed to fetch ICM flows (HTTP ${response.status})`);
        }
        const data = await response.json();
        if (data.flows && Array.isArray(data.flows)) {
          setFlows(
            (data.flows as IcmFlowApiPoint[]).map((f) => ({
              sourceChainId: f.sourceChainId,
              targetChainId: f.targetChainId,
              messageCount: f.messageCount,
            }))
          );
        }
        if (data.failedChainIds && Array.isArray(data.failedChainIds)) {
          setFailedChainIds(data.failedChainIds);
        }
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        console.error("Error fetching ICM flows:", err);
        setError(err instanceof Error ? err.message : "Failed to load ICM flows");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    fetchIcmFlows();
    return () => controller.abort();
  }, []);

  return { flows, failedChainIds, loading, error };
}
