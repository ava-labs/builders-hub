import { NextRequest, NextResponse } from "next/server";

// USD prices for token contracts on one chain, by way of DefiLlama's
// batched price API (no key, one request for many addresses). Held a
// minute in memory per address set; prices move slower than that on a
// block explorer's timescale and the upstream asks not to be hammered.

const LLAMA_CHAIN: Record<string, string> = {
  "43114": "avax",
};

interface LlamaResponse {
  coins: Record<string, { price: number; decimals?: number; symbol?: string; confidence?: number; timestamp: number }>;
}

const cache = new Map<string, { at: number; prices: Record<string, number> }>();
const TTL_MS = 60_000;
const MAX_ADDRESSES = 60;

export async function GET(req: NextRequest, { params }: { params: Promise<{ chainId: string }> }) {
  const { chainId } = await params;
  const chain = LLAMA_CHAIN[chainId];
  const raw = req.nextUrl.searchParams.get("addresses") ?? "";
  const addresses = [...new Set(raw.split(",").map((a) => a.trim().toLowerCase()).filter((a) => /^0x[0-9a-f]{40}$/.test(a)))]
    .sort()
    .slice(0, MAX_ADDRESSES);
  if (!chain || addresses.length === 0) {
    return NextResponse.json({ prices: {} }, { headers: { "Cache-Control": "public, max-age=60" } });
  }
  const key = `${chainId}:${addresses.join(",")}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) {
    return NextResponse.json({ prices: hit.prices }, { headers: { "Cache-Control": "public, max-age=60" } });
  }
  try {
    const coins = addresses.map((a) => `${chain}:${a}`).join(",");
    const res = await fetch(`https://coins.llama.fi/prices/current/${coins}`, {
      headers: { "user-agent": "builders-hub-explorer/1.0" },
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = (await res.json()) as LlamaResponse;
    const prices: Record<string, number> = {};
    for (const [k, v] of Object.entries(body.coins ?? {})) {
      const addr = k.split(":")[1]?.toLowerCase();
      // low-confidence quotes come from thin pools and mislead more than
      // they inform; the explorer shows no dollar rather than a wrong one
      if (addr && typeof v.price === "number" && (v.confidence ?? 1) >= 0.8) prices[addr] = v.price;
    }
    cache.set(key, { at: Date.now(), prices });
    return NextResponse.json({ prices }, { headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" } });
  } catch (e) {
    if (hit) return NextResponse.json({ prices: hit.prices, stale: true });
    return NextResponse.json({ error: e instanceof Error ? e.message : "price feed unavailable" }, { status: 502 });
  }
}
