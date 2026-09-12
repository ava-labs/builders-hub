import { NextResponse } from "next/server";
import { listReleases } from "@/lib/verification/solc";

/*
 * Released Solidity versions, newest first, for the compiler picker on the
 * verify form. Proxied rather than fetched in the browser so the list is
 * cached once at the edge instead of per visitor, and so the form and the
 * verifier can never disagree about which versions exist.
 */
export const runtime = "nodejs";

export async function GET() {
  try {
    const releases = await listReleases();
    return NextResponse.json(
      { releases },
      { headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800" } },
    );
  } catch {
    return NextResponse.json({ releases: [] }, { status: 503 });
  }
}
