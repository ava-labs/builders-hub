import { NextResponse } from "next/server";
import { toPools, type RawPool, type YieldPool } from "@/lib/defi/llama";

/* Avalanche's yield pools from DefiLlama. The full list covers every
   chain (about 12 MB), so the route keeps only Avalanche's few hundred
   pools in memory and serves them stale while one refresh runs. */

const POOLS_URL = "https://yields.llama.fi/pools";
const FRESH_MS = 30 * 60 * 1000;
const STALE_MS = 24 * 60 * 60 * 1000;
const TIMEOUT_MS = 20_000;
const CACHE_CONTROL = "public, max-age=600, s-maxage=1800, stale-while-revalidate=3600";

let cached: { pools: YieldPool[]; at: number } | null = null;
let inflight: Promise<YieldPool[]> | null = null;

function refresh(): Promise<YieldPool[]> {
  if (!inflight) {
    inflight = fetch(POOLS_URL, { cache: "no-store", signal: AbortSignal.timeout(TIMEOUT_MS) })
      .then(async (res) => {
        if (!res.ok) throw new Error(`DefiLlama yields returned ${res.status}`);
        const body = (await res.json()) as { data?: RawPool[] };
        const pools = toPools(Array.isArray(body.data) ? body.data : []);
        if (pools.length === 0) throw new Error("DefiLlama returned no Avalanche pools");
        cached = { pools, at: Date.now() };
        return pools;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

export async function GET() {
  const age = cached ? Date.now() - cached.at : Infinity;
  if (cached && age < FRESH_MS) {
    return NextResponse.json({ pools: cached.pools }, { headers: { "Cache-Control": CACHE_CONTROL, "X-Data-Source": "cache" } });
  }
  if (cached && age < STALE_MS) {
    refresh().catch((error) => console.error("[GET /api/defi/yields] background refresh failed:", error));
    return NextResponse.json({ pools: cached.pools }, { headers: { "Cache-Control": CACHE_CONTROL, "X-Data-Source": "stale" } });
  }
  try {
    const pools = await refresh();
    return NextResponse.json({ pools }, { headers: { "Cache-Control": CACHE_CONTROL, "X-Data-Source": "fresh" } });
  } catch (error) {
    console.error("[GET /api/defi/yields] Error:", error);
    return NextResponse.json({ error: "Failed to load DefiLlama yields" }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}
