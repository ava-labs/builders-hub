import "server-only";
import { EVM_API_BASE } from "@/lib/evm-explorer";
import { toStatsChainId } from "@/lib/dedicated-stats";
import type { TraceResponse } from "@/lib/trace";

/* One transaction's execution from stats-api
   (/evm-api/{chain}/tx/{hash}/trace): the call tree and the logs the
   ingestion pipeline recorded. No request here causes a trace on a node.
   stats-api answers a tx only once its block is fully indexed, so a trace
   it answers is final. The tx page reads this through /api/trace, and the
   chat calls it in process. */

/** why there is no trace: the chain or tx is not indexed and will not be,
 *  the tx is not indexed yet, the trace is too large to send, stats-api is
 *  busy, or the read failed */
export type TraceMiss = "no_index" | "not_indexed" | "too_large" | "busy" | "error";
export type TraceResult = { trace: TraceResponse } | { miss: TraceMiss };

/** the most this module sends: Vercel refuses a function response over 4.5 MB */
export const MAX_TRACE_BYTES = 4 * 1024 * 1024;
const TIMEOUT_MS = 10_000;

/** the callers in this instance that wait for the same tx */
const flights = new Map<string, Promise<TraceResult>>();

/** block: the tx's block, which tells a tx stats-api has not reached yet
 *  from one it never indexed */
export async function getTrace(chainId: string, txHash: string, block: number): Promise<TraceResult> {
  const hash = txHash.toLowerCase();
  const key = `${chainId}:${hash}:${block}`;
  const flight = flights.get(key);
  if (flight) return flight;
  const p = read(chainId, hash, block).finally(() => flights.delete(key));
  flights.set(key, p);
  return p;
}

async function read(chainId: string, hash: string, block: number): Promise<TraceResult> {
  let res: Response;
  try {
    res = await fetch(`${EVM_API_BASE}/evm-api/${toStatsChainId(chainId)}/tx/${hash}/trace`, {
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { accept: "application/json" },
    });
  } catch {
    return { miss: "error" };
  }
  if (res.status === 404) {
    const { error, indexedThrough } = (await res.json().catch(() => ({}))) as { error?: string; indexedThrough?: number };
    if (error === "not_indexed" && typeof indexedThrough === "number" && block > indexedThrough) return { miss: "not_indexed" };
    return { miss: "no_index" };
  }
  // stats-api does not serve the chain
  if (res.status === 400) return { miss: "no_index" };
  if (res.status === 413) return { miss: "too_large" };
  if (res.status === 429 || res.status === 503) return { miss: "busy" };
  if (!res.ok) return { miss: "error" };
  const text = await res.text();
  if (text.length > MAX_TRACE_BYTES) return { miss: "too_large" };
  try {
    const { call, logs } = JSON.parse(text) as TraceResponse;
    return call && Array.isArray(logs) ? { trace: { call, logs } } : { miss: "error" };
  } catch {
    return { miss: "error" };
  }
}
