import { NextResponse } from "next/server";
import registry from "@/data/contract-registry.json";
import { runQuery } from "@/lib/explorer-query/clickhouse";
import {
  largestMoves,
  largestSql,
  pairsSql,
  registryIndex,
  summarize,
  type FlowsResponse,
  type MoveRow,
  type PairRow,
  type RegistryContract,
} from "@/lib/defi/flows";

/* On-chain flows for the C-Chain DeFi tab: the USD that moved between
   wallets and each protocol and category, and the largest single moves,
   over the last 24 hours or 7 days. Two queries on the shared C-Chain
   ClickHouse, which can run twenty times slower when the cluster is busy,
   so each window is held for 10 minutes and served stale while one
   refresh runs. */

const WINDOWS = new Set([24, 168]);
const FRESH_MS = 10 * 60 * 1000;
const STALE_MS = 6 * 60 * 60 * 1000;
const CACHE_CONTROL = "public, max-age=300, s-maxage=600, stale-while-revalidate=3600";

const index = registryIndex(registry.contracts as RegistryContract[]);
const cache = new Map<number, { data: FlowsResponse; at: number }>();
const inflight = new Map<number, Promise<FlowsResponse>>();

async function build(hours: number): Promise<FlowsResponse> {
  const [pairs, largest] = await Promise.all([runQuery(pairsSql(index.keys, hours)), runQuery(largestSql(index.keys, hours, 300))]);
  return {
    asOf: Math.floor(Date.now() / 1000),
    hours,
    summary: summarize(pairs.rows as unknown as PairRow[], index, hours),
    moves: largestMoves(largest.rows as unknown as MoveRow[], index, 30),
  };
}

function refresh(hours: number): Promise<FlowsResponse> {
  let p = inflight.get(hours);
  if (!p) {
    p = build(hours)
      .then((data) => {
        cache.set(hours, { data, at: Date.now() });
        return data;
      })
      .finally(() => inflight.delete(hours));
    inflight.set(hours, p);
  }
  return p;
}

export async function GET(request: Request) {
  const asked = Number(new URL(request.url).searchParams.get("hours") ?? "168");
  const hours = WINDOWS.has(asked) ? asked : 168;
  const hit = cache.get(hours);
  const age = hit ? Date.now() - hit.at : Infinity;
  if (hit && age < FRESH_MS) {
    return NextResponse.json(hit.data, { headers: { "Cache-Control": CACHE_CONTROL, "X-Data-Source": "cache" } });
  }
  if (hit && age < STALE_MS) {
    refresh(hours).catch((error) => console.error("[GET /api/defi/flows] background refresh failed:", error));
    return NextResponse.json(hit.data, { headers: { "Cache-Control": CACHE_CONTROL, "X-Data-Source": "stale" } });
  }
  try {
    const data = await refresh(hours);
    return NextResponse.json(data, { headers: { "Cache-Control": CACHE_CONTROL, "X-Data-Source": "fresh" } });
  } catch (error) {
    console.error("[GET /api/defi/flows] Error:", error);
    return NextResponse.json({ error: "Failed to load on-chain flows" }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}
