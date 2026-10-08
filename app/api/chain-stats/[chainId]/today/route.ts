import { NextResponse } from "next/server";
import { DEDICATED_STATS_BASE_URL, resolveDedicatedMetricsChain } from "@/lib/dedicated-stats";

// Today's fees so far on one chain, UTC. The stats API's daily series holds whole days only;
// its hourly series runs into the current hour (about an hour behind), so today is the sum of
// the hours since midnight. Serves the token page's partial "Today" bar.

const TIMEOUT_MS = 10_000;

export async function GET(_req: Request, { params }: { params: Promise<{ chainId: string }> }) {
  const { chainId } = await params;
  const statsChainId = resolveDedicatedMetricsChain(chainId);
  if (!statsChainId) {
    return NextResponse.json({ error: `no hourly fees for chain '${chainId}'` }, { status: 404 });
  }

  const now = Math.floor(Date.now() / 1000);
  const midnight = Math.floor(now / 86_400) * 86_400;
  const url = new URL(`${DEDICATED_STATS_BASE_URL}/v2/chains/${statsChainId}/metrics/feesPaid`);
  url.searchParams.set("timeInterval", "hour");
  url.searchParams.set("startTimestamp", String(midnight));
  url.searchParams.set("endTimestamp", String(now));
  url.searchParams.set("pageSize", "48");

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" });
    if (!res.ok) throw new Error(`metrics-api ${res.status}`);
    const body = (await res.json()) as { results?: { value: number; timestamp: number }[] };
    const hours = (body.results ?? []).filter((r) => r.timestamp >= midnight);
    const feesPaid = hours.reduce((sum, r) => sum + (Number(r.value) || 0), 0);
    const latestHour = hours.reduce((t, r) => Math.max(t, r.timestamp), 0);

    return NextResponse.json(
      {
        date: new Date(midnight * 1000).toISOString().slice(0, 10),
        feesPaid,
        /** the start of the newest hour in the sum, unix seconds; null before the first hour lands */
        latestHour: latestHour || null,
      },
      { headers: { "Cache-Control": "public, max-age=0, s-maxage=300, stale-while-revalidate=600" } },
    );
  } catch (error) {
    console.error(`[chain-stats/today] failed for ${chainId}:`, error);
    return NextResponse.json({ error: "Failed to fetch today's fees" }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}
