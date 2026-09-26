import { NextResponse } from "next/server";
import { protocolMainContract } from "@/lib/contracts";
import {
  toHistory,
  toLayers,
  toMeta,
  toProtocols,
  toVolume,
  type DefiOverview,
  type DimensionOverview,
  type FullProtocol,
  type LiteCharts,
  type LiteProtocol,
  type ProtocolMeta,
} from "@/lib/defi/llama";

/* The C-Chain DeFi page's one DefiLlama read: every Avalanche protocol
   with its Avalanche TVL now and a day, a week and a month back, the
   chain's layered TVL history, and the DEX volume and fee overviews.
   The protocol list is about 7 MB, over Next's 2 MB fetch-cache limit,
   so this route holds the reduced answer in memory and serves it stale
   while one refresh runs. */

const LLAMA = "https://api.llama.fi";
const FRESH_MS = 15 * 60 * 1000;
const STALE_MS = 24 * 60 * 60 * 1000;
const TIMEOUT_MS = 20_000;
const CACHE_CONTROL = "public, max-age=300, s-maxage=900, stale-while-revalidate=3600";

let cached: { data: DefiOverview; at: number } | null = null;
let inflight: Promise<DefiOverview> | null = null;

/* descriptions, X handles and C-Chain addresses come from the full list
   (about 9 MB). They rarely change, so they refresh every 6 hours. */
const META_MS = 6 * 60 * 60 * 1000;
let meta: { data: Map<string, ProtocolMeta>; at: number } | null = null;

async function getMeta(): Promise<Map<string, ProtocolMeta>> {
  if (meta && Date.now() - meta.at < META_MS) return meta.data;
  const full = await optional<FullProtocol[]>("/protocols");
  if (Array.isArray(full) && full.length) meta = { data: toMeta(full), at: Date.now() };
  return meta?.data ?? new Map();
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${LLAMA}${path}`, { cache: "no-store", signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`DefiLlama ${path} returned ${res.status}`);
  return (await res.json()) as T;
}

/** a feed the page can do without comes back null instead of failing the whole read */
async function optional<T>(path: string): Promise<T | null> {
  try {
    return await getJson<T>(path);
  } catch (error) {
    console.error("[GET /api/defi/overview] optional feed failed:", error);
    return null;
  }
}

async function build(): Promise<DefiOverview> {
  const [lite, charts, dex, fees, info] = await Promise.all([
    getJson<{ protocols?: LiteProtocol[] }>("/lite/protocols2?b=2"),
    optional<LiteCharts>("/lite/charts/Avalanche"),
    optional<DimensionOverview>("/overview/dexs/Avalanche?excludeTotalDataChartBreakdown=true"),
    optional<DimensionOverview>("/overview/fees/Avalanche?excludeTotalDataChartBreakdown=true"),
    getMeta(),
  ]);
  if (!Array.isArray(lite.protocols) || lite.protocols.length === 0) throw new Error("DefiLlama returned no protocols");
  const protocols = toProtocols(lite.protocols, dex, fees, (slug) => protocolMainContract(slug) ?? null, info);
  if (protocols.length === 0) throw new Error("DefiLlama returned no Avalanche protocols");
  return {
    asOf: Math.floor(Date.now() / 1000),
    layers: toLayers(protocols),
    history: toHistory(charts),
    dex: toVolume(dex),
    fees: toVolume(fees),
    protocols,
  };
}

function refresh(): Promise<DefiOverview> {
  if (!inflight) {
    inflight = build()
      .then((data) => {
        cached = { data, at: Date.now() };
        return data;
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
    return NextResponse.json(cached.data, { headers: { "Cache-Control": CACHE_CONTROL, "X-Data-Source": "cache" } });
  }
  if (cached && age < STALE_MS) {
    refresh().catch((error) => console.error("[GET /api/defi/overview] background refresh failed:", error));
    return NextResponse.json(cached.data, { headers: { "Cache-Control": CACHE_CONTROL, "X-Data-Source": "stale" } });
  }
  try {
    const data = await refresh();
    return NextResponse.json(data, { headers: { "Cache-Control": CACHE_CONTROL, "X-Data-Source": "fresh" } });
  } catch (error) {
    console.error("[GET /api/defi/overview] Error:", error);
    return NextResponse.json({ error: "Failed to load DefiLlama data" }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}
