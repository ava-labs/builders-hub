import { NextRequest, NextResponse } from "next/server";
import { getVerifiedContract } from "@/lib/sourcify";

// Same-origin proxy for Sourcify contract verification. The client asks
// this route (never sourcify.dev directly) so responses ride the CDN:
// verified contracts are effectively immutable and cache long; a miss
// caches short, because verification can land at any moment.

const HIT_CACHE = "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800";
const MISS_CACHE = "public, max-age=300, s-maxage=600";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ chainId: string; address: string }> },
) {
  const { chainId, address } = await params;
  const id = Number(chainId);
  const contract = await getVerifiedContract(id, address);
  if (!contract) {
    return NextResponse.json(
      { verified: false },
      { status: 404, headers: { "Cache-Control": MISS_CACHE } },
    );
  }
  return NextResponse.json(
    { verified: true, ...contract },
    { headers: { "Cache-Control": HIT_CACHE } },
  );
}
