import { NextRequest, NextResponse } from "next/server";
import { getPchainL1Ops, type PchainL1OpsDays } from "@/lib/explorer-clickhouse";

// The P-Chain's L1 ops ledger for the L1s tab: daily counts of every
// ACP-77 transaction type it processed (register / set-weight / disable /
// top-up / convert) over ?days=30|90|365, plus the all-time cumulative
// conversion curve. Reads the same ClickHouse box as /api/pchain-activity.

const WINDOWS: PchainL1OpsDays[] = [30, 90, 365];

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ network: string }> },
) {
  const { network } = await params;
  const raw = Number(req.nextUrl.searchParams.get("days") ?? 30);
  const days = (WINDOWS.includes(raw as PchainL1OpsDays) ? raw : 30) as PchainL1OpsDays;
  const data = await getPchainL1Ops(network, days);
  if (data === null) {
    return NextResponse.json({ error: "no l1 ops data" }, { status: 404 });
  }
  return NextResponse.json(data, {
    headers: {
      "Cache-Control": "public, max-age=300, s-maxage=900, stale-while-revalidate=1800",
    },
  });
}
