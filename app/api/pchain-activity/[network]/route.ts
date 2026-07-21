import { NextRequest, NextResponse } from "next/server";
import { getPchainDailyTxs } from "@/lib/explorer-clickhouse";

// Daily P-Chain transaction counts (last 14 days) for the overview chart.
// The indexer API doesn't expose aggregates yet, so this reads the same
// ClickHouse box directly — read-only user, one GROUP BY per 15 minutes.

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ network: string }> },
) {
  const { network } = await params;
  const days = await getPchainDailyTxs(network);
  if (days === null) {
    return NextResponse.json({ error: "no activity data" }, { status: 404 });
  }
  return NextResponse.json(
    { days },
    {
      headers: {
        "Cache-Control": "public, max-age=300, s-maxage=900, stale-while-revalidate=1800",
      },
    },
  );
}
