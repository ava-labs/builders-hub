import { NextResponse } from "next/server";
import { getCchainDailyActivity } from "@/lib/explorer-clickhouse";

// Daily C-Chain activity by on-chain behavior (DeFi / NFT / tokens /
// other) for the overview's stacked area chart. Classification runs over
// the raw log archive in ClickHouse — heavy, so the helper caches for 15
// minutes and this response rides the CDN for the same window.

export async function GET() {
  const days = await getCchainDailyActivity();
  if (days === null) {
    return NextResponse.json({ error: "no activity data" }, { status: 404 });
  }
  return NextResponse.json(
    { days },
    {
      headers: {
        "Cache-Control": "public, max-age=300, s-maxage=900, stale-while-revalidate=3600",
      },
    },
  );
}
