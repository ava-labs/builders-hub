import { NextRequest, NextResponse } from "next/server";
import type { GasHistoryDays } from "@/lib/explorer-clickhouse";
import { getGasTargets } from "@/lib/gas-target";

// The ACP-176 gas target (gas per second) per UTC day over ?days=7|30|90|365,
// read from the chain's headers. 404 for chains that price without ACP-176:
// the utilization sheet then falls back to the share of the block gas limit.

const WINDOWS: GasHistoryDays[] = [7, 30, 90, 365];

export async function GET(req: NextRequest, { params }: { params: Promise<{ chainId: string }> }) {
  const { chainId } = await params;
  const evmChainId = Number(chainId);
  if (!Number.isFinite(evmChainId) || evmChainId <= 0) {
    return NextResponse.json({ error: `invalid chain id '${chainId}'` }, { status: 400 });
  }
  const daysParam = Number(req.nextUrl.searchParams.get("days") ?? 90);
  const days: GasHistoryDays = WINDOWS.includes(daysParam as GasHistoryDays) ? (daysParam as GasHistoryDays) : 90;

  const daily = await getGasTargets(evmChainId, days);
  if (!daily?.length) {
    return NextResponse.json({ error: "no ACP-176 gas target for this chain" }, { status: 404 });
  }
  return NextResponse.json(
    { days, daily },
    { headers: { "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=7200" } },
  );
}
