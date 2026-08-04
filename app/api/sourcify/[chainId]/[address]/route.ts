import { NextRequest, NextResponse } from "next/server";
import { getVerifiedContractResolvingProxies } from "@/lib/sourcify";

// Same-origin proxy for Sourcify contract verification, proxy-aware: an
// EIP-1967/1167 proxy comes back with its implementation's ABI merged in,
// so method decoding works on delegated calls. The client asks this route
// (never sourcify.dev directly) so responses ride the CDN: plain verified
// contracts are effectively immutable and cache long; proxy-resolved ones
// cache shorter (the implementation can be upgraded); a miss caches short,
// because verification can land at any moment.

const HIT_CACHE = "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800";
const PROXY_CACHE = "public, max-age=1800, s-maxage=3600, stale-while-revalidate=86400";
const MISS_CACHE = "public, max-age=300, s-maxage=600";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ chainId: string; address: string }> },
) {
  const { chainId, address } = await params;
  const id = Number(chainId);
  const contract = await getVerifiedContractResolvingProxies(id, address);
  if (!contract) {
    return NextResponse.json(
      { verified: false },
      { status: 404, headers: { "Cache-Control": MISS_CACHE } },
    );
  }
  return NextResponse.json(
    { verified: true, ...contract },
    { headers: { "Cache-Control": contract.proxy ? PROXY_CACHE : HIT_CACHE } },
  );
}
