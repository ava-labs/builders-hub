import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/protectedRoute";
import { prisma } from "@/prisma/prisma";
import { isReferralTeamId } from "@/lib/referrals/team-labels";

// Lists users with a matching User.team_id so the referral picker can
// resolve a chosen team into a user dropdown. Auth-gated and PII-minimal:
// the response contains only { id, name }. Rejects "none" / "other"
// because those have no member roster.
export const GET = withAuth(async (req: NextRequest) => {
  const teamId = req.nextUrl.searchParams.get("team_id")?.trim();
  if (!teamId || !isReferralTeamId(teamId)) {
    return NextResponse.json({ error: "Invalid team_id" }, { status: 400 });
  }

  const members = await prisma.user.findMany({
    where: { team_id: teamId },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
    take: 100,
  });

  return NextResponse.json({ members });
});
