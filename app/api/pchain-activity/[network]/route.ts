import { NextRequest, NextResponse } from "next/server";
import { getPchainStakingSeries, type PchainStakingDays } from "@/lib/explorer-clickhouse";

// Staking money-flow for the P-Chain overview and the staking detail
// sheets: AVAX rewards paid per day (the past ?days, parsed from the
// reward-UTXO archive) and stake unlocking per day (the next ?days, from
// the validator/delegator snapshots). ?days=30|90|365, default 30. The
// indexer API doesn't expose aggregates yet, so this reads the same
// ClickHouse box directly — read-only user, cached 15 minutes per window.

const WINDOWS: PchainStakingDays[] = [30, 90, 365];

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ network: string }> },
) {
  const { network } = await params;
  const raw = Number(req.nextUrl.searchParams.get("days") ?? 30);
  const days = (WINDOWS.includes(raw as PchainStakingDays) ? raw : 30) as PchainStakingDays;
  const series = await getPchainStakingSeries(network, days);
  if (series === null) {
    return NextResponse.json({ error: "no staking data" }, { status: 404 });
  }
  return NextResponse.json(series, {
    headers: {
      "Cache-Control": "public, max-age=300, s-maxage=900, stale-while-revalidate=1800",
    },
  });
}
