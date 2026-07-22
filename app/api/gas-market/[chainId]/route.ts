import { NextRequest, NextResponse } from "next/server";
import { getGasMarket, type GasRangeDays } from "@/lib/explorer-clickhouse";

// Gas market history for one EVM chain: hourly/daily base-fee series,
// fee seasonality, and the demand sections (protocol-attributed consumers,
// method selectors, fullness histogram, reverted gas) over
// ?range=1|7|30|90 days. ClickHouse-backed; the helper caches 5 minutes per (chain, range)
// and the response rides the CDN for the same window. The live half of
// the Gas page (current base fee, per-block utilization) comes straight
// from the chain's RPC client-side — this route only serves what an RPC
// can't: history.

const RANGES: GasRangeDays[] = [1, 7, 30, 90];
// 90d is the longest window we compute reliably: a full 365d scan of the
// C-Chain's raw_txs (~1B rows) blows past the 30s query budget and 404s the
// whole page. The year view clamps here; the client labels the clamp honestly.
const MAX_SERVABLE_DAYS: GasRangeDays = 90;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ chainId: string }> },
) {
  const { chainId } = await params;
  const evmChainId = Number(chainId);
  if (!Number.isFinite(evmChainId) || evmChainId <= 0) {
    return NextResponse.json({ error: `invalid chain id '${chainId}'` }, { status: 400 });
  }

  const rangeParam = Number(req.nextUrl.searchParams.get("range") ?? 1);
  const range: GasRangeDays = RANGES.includes(rangeParam as GasRangeDays)
    ? (rangeParam as GasRangeDays)
    : rangeParam > MAX_SERVABLE_DAYS
      ? MAX_SERVABLE_DAYS
      : 1;

  const market = await getGasMarket(evmChainId, range);
  if (market === null) {
    return NextResponse.json({ error: "no gas data indexed for this chain" }, { status: 404 });
  }

  return NextResponse.json(market, {
    headers: {
      "Cache-Control": "public, max-age=120, s-maxage=300, stale-while-revalidate=1800",
    },
  });
}
