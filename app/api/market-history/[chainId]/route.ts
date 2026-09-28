import { NextRequest, NextResponse } from "next/server";
import l1ChainsData from "@/constants/l1-chains.json";

// A chain's native token over time, for the sparklines beside the live
// price and market cap on the explorer home: CoinGecko's market_chart,
// oldest first. Daily points for a week and longer; hourly points for the
// day clock. One upstream call per chain and window per half hour (five
// minutes for the day); the free tier is rate-limited and the shape of
// thirty days does not change by the minute.

// the free tier stops at a year; "max" is a paid parameter
const WINDOWS = new Set(["1", "7", "30", "90", "365"]);

interface Upstream {
  prices: [number, number][];
  market_caps: [number, number][];
}

export interface MarketHistory {
  /** unix ms, one per day (one per hour on the day window), oldest first */
  timestamps: number[];
  prices: number[];
  marketCaps: number[];
}

const cache = new Map<string, { at: number; data: MarketHistory }>();
const TTL_MS = 30 * 60_000;
const DAY_TTL_MS = 5 * 60_000;

export async function GET(req: NextRequest, { params }: { params: Promise<{ chainId: string }> }) {
  const { chainId } = await params;
  const days = req.nextUrl.searchParams.get("days") ?? "30";
  if (!WINDOWS.has(days)) return NextResponse.json({ error: "days must be 1, 7, 30, 90 or 365" }, { status: 400 });
  const intraday = days === "1";
  const ttl = intraday ? DAY_TTL_MS : TTL_MS;
  const cacheHeader = intraday ? "public, max-age=120, s-maxage=300" : "public, max-age=900, s-maxage=1800";

  const chain = l1ChainsData.find((c) => c.chainId === chainId) as { coingeckoId?: string } | undefined;
  if (!chain?.coingeckoId) return NextResponse.json({ error: "no market data for this chain" }, { status: 404 });

  const key = `${chain.coingeckoId}:${days}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ttl) {
    return NextResponse.json(hit.data, { headers: { "Cache-Control": cacheHeader } });
  }

  try {
    const qs = new URLSearchParams({ vs_currency: "usd", days });
    // daily is a free-tier parameter only up to 90 days; longer windows come
    // back daily on their own, and the day window comes back in 5-minute steps
    if (!intraday && Number(days) <= 90) qs.set("interval", "daily");
    const res = await fetch(`https://api.coingecko.com/api/v3/coins/${chain.coingeckoId}/market_chart?${qs}`, {
      headers: { accept: "application/json", "user-agent": "builders-hub-explorer/1.0" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`CoinGecko HTTP ${res.status}`);
    const body = (await res.json()) as Upstream;
    // a live final point can ride at the end of a daily series; keep one
    // point per day, or per hour on the day window
    const byDay = new Map<string, { t: number; p: number; m: number }>();
    body.prices.forEach(([t, p], i) => {
      byDay.set(new Date(t).toISOString().slice(0, intraday ? 13 : 10), { t, p, m: body.market_caps[i]?.[1] ?? 0 });
    });
    const rows = [...byDay.values()].sort((a, b) => a.t - b.t);
    const data: MarketHistory = {
      timestamps: rows.map((r) => r.t),
      prices: rows.map((r) => r.p),
      marketCaps: rows.map((r) => r.m),
    };
    cache.set(key, { at: Date.now(), data });
    return NextResponse.json(data, { headers: { "Cache-Control": cacheHeader } });
  } catch (e) {
    // serve the stale shape rather than nothing when the upstream is rate-limited
    if (hit) return NextResponse.json(hit.data, { headers: { "Cache-Control": "no-store" } });
    return NextResponse.json({ error: e instanceof Error ? e.message : "market history failed" }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}
