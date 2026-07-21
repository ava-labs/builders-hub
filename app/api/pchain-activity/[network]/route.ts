import { NextRequest, NextResponse } from "next/server";
import { getPchainStakingSeries } from "@/lib/explorer-clickhouse";

// Staking money-flow for the P-Chain overview: AVAX rewards paid per day
// (last 14 days, parsed from the reward-UTXO archive) and stake unlocking
// per day (next 14 days, from the validator/delegator snapshots). The
// indexer API doesn't expose aggregates yet, so this reads the same
// ClickHouse box directly — read-only user, cached 15 minutes.

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ network: string }> },
) {
  const { network } = await params;
  const series = await getPchainStakingSeries(network);
  if (series === null) {
    return NextResponse.json({ error: "no staking data" }, { status: 404 });
  }
  return NextResponse.json(series, {
    headers: {
      "Cache-Control": "public, max-age=300, s-maxage=900, stale-while-revalidate=1800",
    },
  });
}
