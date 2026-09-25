import { NextRequest, NextResponse } from "next/server";
import { EXPLORER_API_BASE, type PchainStakingSeries } from "@/lib/pchain-explorer";

// Staking money-flow for the P-Chain overview and the staking detail
// sheets: AVAX rewards paid per day (the past ?days) and stake unlocking
// per day (the next ?days). ?days=30|90|365, default 30.
//
// Served by the stats API.

const WINDOWS = [30, 90, 365] as const;
const REQUEST_TIMEOUT_MS = 8000;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ network: string }> },
) {
  const { network } = await params;
  const raw = Number(req.nextUrl.searchParams.get("days") ?? 30);
  const days = (WINDOWS as readonly number[]).includes(raw) ? raw : 30;

  const url = `${EXPLORER_API_BASE}/api/${network}/staking-activity?days=${days}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      return NextResponse.json({ error: "no staking data" }, { status: 404 });
    }
    const series = (await res.json()) as PchainStakingSeries;
    if (!series?.rewards?.length) {
      return NextResponse.json({ error: "no staking data" }, { status: 404 });
    }
    return NextResponse.json(series, {
      headers: {
        "Cache-Control": "public, max-age=300, s-maxage=900, stale-while-revalidate=1800",
      },
    });
  } catch {
    return NextResponse.json({ error: "no staking data" }, { status: 404 });
  } finally {
    clearTimeout(timeout);
  }
}
