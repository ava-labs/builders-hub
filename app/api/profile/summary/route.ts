import { NextResponse } from "next/server";
import { headers } from "next/headers";
import type { Session } from "next-auth";

import { withAuth } from "@/lib/protectedRoute";
import { buildReferralUrl } from "@/server/services/referrals";
import {
  getUserProjects,
  getUserBadgesForProfile,
  getProfileEngagement,
  getUserReferralCount,
  getOrCreateBhSignupReferralCode,
} from "@/server/services/profile-summary";

async function getRequestOrigin(): Promise<string> {
  const headersList = await headers();
  const host = headersList.get("host");
  if (!host) return "https://build.avax.network";
  const protocol = headersList.get("x-forwarded-proto") ?? "https";
  return `${protocol}://${host}`;
}

export const GET = withAuth(async (_request, _context: unknown, session: Session) => {
  const userId = session.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [origin, projects, badges, engagement, referralCount] = await Promise.all([
      getRequestOrigin(),
      getUserProjects(userId),
      getUserBadgesForProfile(userId),
      getProfileEngagement(userId),
      getUserReferralCount(userId),
    ]);

    let bhSignupCode: string | null = null;
    let bhSignupShareUrl: string | null = null;
    try {
      bhSignupCode = await getOrCreateBhSignupReferralCode(userId);
      bhSignupShareUrl = buildReferralUrl(origin, "/", bhSignupCode);
    } catch (err) {
      // Non-fatal — the profile still renders without the invite link.
      console.error("[profile/summary] failed to mint bh_signup code:", err);
    }

    return NextResponse.json({
      projects,
      badges,
      engagement,
      referralCount,
      bhSignupCode,
      bhSignupShareUrl,
    });
  } catch (err) {
    console.error("[profile/summary] error:", err);
    return NextResponse.json(
      { error: "Failed to load profile summary" },
      { status: 500 },
    );
  }
});
