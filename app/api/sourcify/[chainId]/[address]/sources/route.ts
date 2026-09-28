import { NextRequest, NextResponse } from "next/server";
import { getContractSources } from "@/lib/sourcify";

/*
 * Source files for a verified contract, from whichever verifier has them
 * — ours or Sourcify's. The Contract tab asks this route and never has to
 * know which one answered.
 *
 * Split out from the sibling metadata route because source trees are big
 * and only one tab wants them, while the metadata route is called for
 * every address on a page.
 */

const HIT_CACHE = "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800";
// Not browser-cached, for the same reason as the sibling route: sources
// appear the moment a contract is verified.
const MISS_CACHE = "public, max-age=0, s-maxage=60";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ chainId: string; address: string }> },
) {
  const { chainId, address } = await params;
  const sources = await getContractSources(Number(chainId), address);

  if (!sources) {
    return NextResponse.json(
      { available: false },
      { status: 404, headers: { "Cache-Control": MISS_CACHE } },
    );
  }

  return NextResponse.json(
    { available: true, ...sources },
    { headers: { "Cache-Control": HIT_CACHE } },
  );
}
