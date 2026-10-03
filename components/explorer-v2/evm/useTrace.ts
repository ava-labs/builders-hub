"use client";

import { useEffect, useState } from "react";
import { SOFT_READ, isOk, statusOf } from "@/lib/explorer-soft-status";
import type { TraceResponse } from "@/lib/trace";

/* One transaction's trace, for the tx page. A chain with no trace node
   here, or a tx the node does not know, has none: the route answers that
   miss soft, so the console logs no error for it. */

export type TraceState = "loading" | "ready" | "none" | "error";

export function useTrace(chainId: string, hash: string, enabled: boolean): { trace: TraceResponse | null; state: TraceState } {
  const [trace, setTrace] = useState<TraceResponse | null>(null);
  const [state, setState] = useState<TraceState>(enabled ? "loading" : "none");
  useEffect(() => {
    setTrace(null);
    if (!enabled) {
      setState("none");
      return;
    }
    setState("loading");
    const controller = new AbortController();
    fetch(`/api/trace/${chainId}/${hash}`, { ...SOFT_READ, signal: controller.signal })
      .then(async (r) => {
        if (statusOf(r) === 404) return setState("none");
        if (!isOk(r)) return setState("error");
        setTrace((await r.json()) as TraceResponse);
        setState("ready");
      })
      .catch(() => !controller.signal.aborted && setState("error"));
    return () => controller.abort();
  }, [chainId, hash, enabled]);
  return { trace, state };
}
