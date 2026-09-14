import { NextRequest, NextResponse } from "next/server";
import l1ChainsData from "@/constants/l1-chains.json";
import { DEFAULT_ICM_PAGE, MAX_ICM_PAGE } from "@/lib/icm-feed-map";
import { fetchIcmFeedFromStats } from "@/lib/icm-chain-feed.stats";

export const dynamic = "force-dynamic";

const CACHE_CONTROL = "public, max-age=10, s-maxage=10, stale-while-revalidate=60";

interface ChainConfig {
  chainId: string;
  blockchainId?: string;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ chainId: string }> },
) {
  const { chainId } = await params;
  const { searchParams } = new URL(request.url);

  const chain = (l1ChainsData as ChainConfig[]).find((c) => c.chainId === chainId);
  const blockchainId = chain?.blockchainId || searchParams.get("blockchainId") || undefined;

  const rawLimit = Number(searchParams.get("limit"));
  const limit =
    Number.isFinite(rawLimit) && rawLimit > 0
      ? Math.min(Math.floor(rawLimit), MAX_ICM_PAGE)
      : DEFAULT_ICM_PAGE;

  const rawBefore = searchParams.get("beforeBlock");
  const parsedBefore = rawBefore === null ? NaN : Number(rawBefore);
  const beforeBlock =
    Number.isFinite(parsedBefore) && parsedBefore >= 0 ? Math.floor(parsedBefore) : undefined;

  try {
    const page = await fetchIcmFeedFromStats({ chainId, blockchainId, limit, beforeBlock });
    if (page) {
      return NextResponse.json(page, { headers: { "Cache-Control": CACHE_CONTROL } });
    }
  } catch (err) {
    console.error(`[Explorer API] ICM feed failed for chain ${chainId}:`, err);
  }

  return NextResponse.json(
    { status: "unavailable", messages: [], nextBeforeBlock: null, exhausted: false },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}
