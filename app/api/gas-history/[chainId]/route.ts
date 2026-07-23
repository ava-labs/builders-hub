import { NextRequest, NextResponse } from "next/server";
import { getGasHistory, type GasHistoryDays } from "@/lib/explorer-clickhouse";

// Deep daily gas history for one EVM chain: fee percentiles, utilization,
// gas used and block counts per day over ?days=7|30|90|365. Blocks-only
// (raw_blocks), so unlike /api/gas-market's tx-scanning demand sections a
// full year stays inside the query budget. Serves the per-metric detail
// sheets under /explorer/[network]/[chain]/gas/[metric].

const WINDOWS: GasHistoryDays[] = [7, 30, 90, 365];

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ chainId: string }> },
) {
  const { chainId } = await params;
  const evmChainId = Number(chainId);
  if (!Number.isFinite(evmChainId) || evmChainId <= 0) {
    return NextResponse.json({ error: `invalid chain id '${chainId}'` }, { status: 400 });
  }

  const daysParam = Number(req.nextUrl.searchParams.get("days") ?? 90);
  const days: GasHistoryDays = WINDOWS.includes(daysParam as GasHistoryDays)
    ? (daysParam as GasHistoryDays)
    : 90;

  const history = await getGasHistory(evmChainId, days);
  if (history.length === 0) {
    return NextResponse.json({ error: "no gas data indexed for this chain" }, { status: 404 });
  }

  return NextResponse.json(
    { days, daily: history },
    {
      headers: {
        // daily buckets: browsers revalidate, the CDN holds an hour
        "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=7200",
      },
    },
  );
}
