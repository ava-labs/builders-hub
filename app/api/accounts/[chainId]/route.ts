import { NextRequest, NextResponse } from "next/server";
import { getAccountsActivity, type GasRangeDays } from "@/lib/explorer-clickhouse";

// Accounts leaderboards for one EVM chain: the most-called addresses and
// the busiest senders over ?range=1|7|30|90 days. ClickHouse-backed; the
// helper caches 5 minutes per (chain, range) and the response rides the
// CDN for the same window. The chart half of the Accounts page (active
// addresses, contracts deployed) comes from /api/chain-stats — this route
// only serves what that indexer can't: who the traffic actually is.

const RANGES: GasRangeDays[] = [1, 7, 30, 90];
// same ceiling as the gas market: a full 365d scan of raw_txs blows the
// query budget, so the year view clamps and the client labels it honestly
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

  const activity = await getAccountsActivity(evmChainId, range);
  if (activity === null) {
    return NextResponse.json({ error: "no account data indexed for this chain" }, { status: 404 });
  }

  return NextResponse.json(activity, {
    headers: {
      "Cache-Control": "public, max-age=120, s-maxage=300, stale-while-revalidate=1800",
    },
  });
}
