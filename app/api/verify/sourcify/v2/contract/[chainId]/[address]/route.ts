import { NextRequest, NextResponse } from "next/server";
import { isAddress } from "@/lib/verification/chains";
import { contractResponse, parseFields } from "@/lib/verification/sourcify-api";
import { findVerified } from "@/lib/verification/store";

/*
 * GET /api/verify/sourcify/v2/contract/{chainId}/{address}
 *
 * Lookup for contracts verified here. hardhat-verify calls this before
 * submitting and reads `match` out of the 404 body to decide a contract
 * is unverified, so the miss has to carry that field rather than a bare
 * error. Also the source of truth for the explorer's Contract tab.
 *
 * Only our own verifications answer here. Sourcify's archive is consulted
 * through /api/sourcify/[chainId]/[address], which merges both.
 */
export const runtime = "nodejs";

const HIT_CACHE = "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400";
// Tooling calls this to decide whether a contract still needs verifying,
// so a remembered miss is worth very little and costs a wasted round of
// verification when it is wrong.
const MISS_CACHE = "public, max-age=0, s-maxage=30";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ chainId: string; address: string }> },
) {
  const { chainId: chainIdRaw, address } = await params;
  const chainId = Number(chainIdRaw);

  if (!Number.isInteger(chainId) || chainId <= 0 || !isAddress(address)) {
    return NextResponse.json({ match: null, error: "Invalid chain or address" }, { status: 400 });
  }

  const verified = await findVerified(chainId, address);
  if (!verified) {
    return NextResponse.json(
      { match: null, chainId: String(chainId), address: address.toLowerCase() },
      { status: 404, headers: { "Cache-Control": MISS_CACHE } },
    );
  }

  const fields = parseFields(request.nextUrl.searchParams.get("fields"));
  return NextResponse.json(await contractResponse(verified, fields), {
    headers: { "Cache-Control": HIT_CACHE },
  });
}
