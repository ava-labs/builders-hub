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
  getUserReferralLinks,
  getReferralTargetCatalog,
  ensureActiveReferralLinks,
  getTotalBuilderCount,
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
    const origin = await getRequestOrigin();
    // Mint any missing active-target links first so they're present when
    // we read `referralLinks` immediately after. Idempotent + sequential
    // to avoid saturating the connection pool.
    await ensureActiveReferralLinks(userId).catch((err) => {
      console.error("[profile/summary] ensureActiveReferralLinks failed:", err);
    });
    const [
      projects,
      badges,
      engagement,
      referralCount,
      referralLinks,
      referralTargets,
      totalBuilders,
    ] = await Promise.all([
      getUserProjects(userId),
      getUserBadgesForProfile(userId),
      getProfileEngagement(userId),
      getUserReferralCount(userId),
      getUserReferralLinks(userId, origin),
      getReferralTargetCatalog(),
      getTotalBuilderCount(),
    ]);

    // The bh_signup link was created/refreshed by ensureActiveReferralLinks
    // and is now in `referralLinks` — pluck the code out to build the
    // "Invite a friend" share URL.
    const bhSignupLink = referralLinks.find((l) => l.targetType === "bh_signup");
    const bhSignupCode = bhSignupLink?.code ?? null;
    const bhSignupShareUrl = bhSignupCode
      ? buildReferralUrl(origin, "/", bhSignupCode)
      : null;

    return NextResponse.json({
      projects,
      badges,
      engagement,
      referralCount,
      bhSignupCode,
      bhSignupShareUrl,
      referralLinks,
      referralTargets,
      totalBuilders,
      origin,
    });
  } catch (err) {
    console.error("[profile/summary] error:", err);
    return NextResponse.json(
      { error: "Failed to load profile summary" },
      { status: 500 },
    );
  }
});
