"use client";

import { useEffect, useState } from "react";
import { SOFT_READ, isOk, statusOf } from "@/lib/explorer-soft-status";
import type { TraceResponse } from "@/lib/trace";

/* One transaction's trace, for the tx page, from the ingestion pipeline
   (app/api/trace). The route answers its misses soft, so the console logs
   no error for them.

   A tx newer than the pipeline (about 2 s behind the chain) is not indexed
   yet ("pending"), and a busy stats-api turns the read away: the page
   keeps its receipt view and asks again after a wait that grows, up to
   RETRY_MS.length times. A chain or tx the pipeline does not index, or a
   trace too large to send, has none ("none"). */

export type TraceState = "loading" | "ready" | "none" | "pending" | "error";

/** the waits before each next ask while the trace is not indexed */
const RETRY_MS = [2_000, 3_000, 5_000, 8_000, 13_000, 20_000, 30_000, 30_000, 30_000, 30_000];

/** block: the tx's block, or null on a chain the pipeline does not trace */
export function useTrace(chainId: string, hash: string, block: number | null): { trace: TraceResponse | null; state: TraceState; retrying: boolean } {
  const [trace, setTrace] = useState<TraceResponse | null>(null);
  const [state, setState] = useState<TraceState>(block === null ? "none" : "loading");
  // the asks so far, for this tx only
  const [asked, setAsked] = useState<{ key: string; n: number }>({ key: "", n: 0 });
  const key = `${chainId}:${hash}:${block}`;
  const n = asked.key === key ? asked.n : 0;
  useEffect(() => {
    if (n === 0) setTrace(null);
    if (block === null) {
      setState("none");
      return;
    }
    if (n === 0) setState("loading");
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const later = () => {
      setState("pending");
      if (n < RETRY_MS.length) timer = setTimeout(() => setAsked({ key, n: n + 1 }), RETRY_MS[n]);
    };
    fetch(`/api/trace/${chainId}/${hash}?block=${block}`, { headers: SOFT_READ.headers, signal: controller.signal })
      .then(async (r) => {
        const status = statusOf(r);
        if (status === 503) return later();
        if (status === 404) {
          const { error } = (await r.json().catch(() => ({}))) as { error?: string };
          return error === "not_indexed" ? later() : setState("none");
        }
        if (!isOk(r)) return setState("error");
        setTrace((await r.json()) as TraceResponse);
        setState("ready");
      })
      .catch(() => !controller.signal.aborted && setState("error"));
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [chainId, hash, block, key, n]);
  return { trace, state, retrying: state === "pending" && n < RETRY_MS.length };
}
