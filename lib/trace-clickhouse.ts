import "server-only";
import { QueryBusyError, runQuery } from "@/lib/explorer-query/clickhouse";
import { traceFromRows, type TraceResponse, type TraceRow } from "@/lib/trace";

/* One transaction's execution, as the ingestion pipeline recorded it: the
   call tree from raw_traces and the logs from raw_logs, in one query on
   the read-only ClickHouse (lib/explorer-query/clickhouse.ts). No request
   here causes a trace on a node.

   The query is bounded by the chain, the tx hash and its block: raw_blocks
   (sorted by chain and block number) gives the block's time, which picks
   the one monthly partition of raw_traces and raw_logs to read. raw_traces
   is sorted by chain, tx hash and trace address, so the frames are a
   point read. The tx page reads this through /api/trace, and the chat
   calls it in process. */

/** the chains the pipeline traces */
export const TRACE_CHAINS = new Set(["43114", "43113"]);

/** why there is no trace: the chain is not indexed, the tx is not indexed
 *  yet (or not in that block), the trace is too large to send, the query
 *  service is busy, or the query failed */
export type TraceMiss = "no_index" | "not_indexed" | "too_large" | "busy" | "error";
export type TraceResult = { trace: TraceResponse } | { miss: TraceMiss };

/** the tables of one block land within about 230 ms of each other, logs
 *  sometimes after the traces: a trace younger than this can still lack
 *  its logs, so it counts as not indexed yet */
export const SETTLE_MS = 3_000;
/** the most this module sends: Vercel refuses a function response over 4.5 MB */
export const MAX_TRACE_BYTES = 4 * 1024 * 1024;

/** the trace query for a tx in a block. The inputs are checked here, so
 *  the SQL holds only digits and hex */
export function traceSql(chainId: string, hash: string, block: number): string {
  if (!TRACE_CHAINS.has(chainId)) throw new Error(`chain ${chainId} is not traced`);
  if (!/^0x[0-9a-f]{64}$/.test(hash)) throw new Error("invalid transaction hash");
  if (!Number.isInteger(block) || block < 0 || block > 0xffffffff) throw new Error("invalid block number");
  const h = hash.slice(2);
  return `WITH (SELECT any(block_time) FROM raw_blocks WHERE chain_id = ${chainId} AND block_number = ${block}) AS bt
SELECT 0 AS kind, arrayStringConcat(trace_address, '.') AS pos, toString(call_type) AS type, lower(hex(\`from\`)) AS src,
  lower(hex(assumeNotNull(\`to\`))) AS dst, isNull(\`to\`) AS no_to, toString(value) AS value, gas, gas_used,
  lower(hex(input)) AS input, lower(hex(output)) AS output, tx_success AS ok,
  toInt64(dateDiff('millisecond', ingested_at, now64(3))) AS age
FROM raw_traces
WHERE chain_id = ${chainId} AND tx_hash = unhex('${h}') AND block_time = bt AND block_number = ${block}
UNION ALL
SELECT 1, toString(log_index), '', lower(hex(address)), '', 0, '', 0, 0, lower(hex(data)),
  arrayStringConcat(arrayMap(x -> lower(hex(x)), arrayFilter(x -> isNotNull(x), [topic0, topic1, topic2, topic3])), ','), true,
  toInt64(dateDiff('millisecond', ingested_at, now64(3)))
FROM raw_logs
WHERE chain_id = ${chainId} AND block_number = ${block} AND transaction_hash = unhex('${h}') AND block_time = bt AND NOT removed`;
}

/** the callers in this instance that wait for the same tx */
const flights = new Map<string, Promise<TraceResult>>();

export async function getTrace(chainId: string, txHash: string, block: number): Promise<TraceResult> {
  if (!TRACE_CHAINS.has(chainId)) return { miss: "no_index" };
  const hash = txHash.toLowerCase();
  const key = `${chainId}:${hash}:${block}`;
  const flight = flights.get(key);
  if (flight) return flight;
  const p = read(chainId, hash, block).finally(() => flights.delete(key));
  flights.set(key, p);
  return p;
}

async function read(chainId: string, hash: string, block: number): Promise<TraceResult> {
  let rows: (TraceRow & { age: number })[];
  try {
    const out = await runQuery(traceSql(chainId, hash, block));
    // the row cap cut the answer: a tree with frames missing is no tree
    if (out.truncated) return { miss: "too_large" };
    rows = out.rows as unknown as (TraceRow & { age: number })[];
  } catch (e) {
    return { miss: e instanceof QueryBusyError ? "busy" : "error" };
  }
  if (rows.some((r) => Number(r.age) < SETTLE_MS)) return { miss: "not_indexed" };
  const trace = traceFromRows(rows);
  if (!trace) return { miss: "not_indexed" };
  if (JSON.stringify(trace).length > MAX_TRACE_BYTES) return { miss: "too_large" };
  return { trace };
}
