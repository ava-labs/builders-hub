import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/prisma/prisma";

// Resolves a referral code to its referrer's team + user identity so the
// client can pre-fill (and lock) the picker on form load. Public route —
// codes are already shareable. 404 mirrors the silent no-op behavior of
// recordReferralAttribution for unknown / disabled codes; the client
// silently falls back to the manual picker when this 404s.
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("ref")?.trim();
  if (!code) {
    return NextResponse.json({ error: "Missing ref" }, { status: 400 });
  }

  const link = await prisma.referralLink.findFirst({
    where: { code, disabled_at: null },
    select: { team_id: true, owner_user_id: true },
  });

  if (!link) {
    return NextResponse.json({ error: "Unknown code" }, { status: 404 });
  }

  const owner = await prisma.user.findUnique({
    where: { id: link.owner_user_id },
    select: { id: true, name: true },
  });

  return NextResponse.json({
    teamId: link.team_id ?? null,
    userId: owner?.id ?? link.owner_user_id,
    userName: owner?.name ?? null,
  });
}
