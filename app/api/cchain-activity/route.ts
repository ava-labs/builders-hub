import { NextResponse } from "next/server";
import { getCchainDailyActivity, type CchainActivityDays } from "@/lib/explorer-clickhouse";

// Daily C-Chain activity by on-chain behavior (DeFi / NFT / tokens /
// other) for the overview's stacked area chart, windowed by the page
// clock (?days=7|30|90; the year view clamps to 90 client-side — the
// classification runs over the raw log archive and a full year buys
// nothing but spill). Heavy, so the helper caches per window for 15
// minutes and this response rides the CDN for the same.

const WINDOWS: CchainActivityDays[] = [7, 30, 90];

export async function GET(request: Request) {
  const raw = Number(new URL(request.url).searchParams.get("days") ?? 7);
  const days = (WINDOWS.includes(raw as CchainActivityDays) ? raw : 7) as CchainActivityDays;

  const points = await getCchainDailyActivity(days);
  if (points === null) {
    return NextResponse.json({ error: "no activity data" }, { status: 404 });
  }
  return NextResponse.json(
    { days: points },
    {
      headers: {
        "Cache-Control": "public, max-age=300, s-maxage=900, stale-while-revalidate=3600",
      },
    },
  );
}
