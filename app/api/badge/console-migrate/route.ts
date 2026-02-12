import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/authSession";
import { prisma } from "@/prisma/prisma";
import { evaluateAllConsoleBadges } from "@/server/services/consoleBadge/consoleBadgeService";

export async function POST() {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const hasDevrel = session.user.custom_attributes?.includes("devrel") ?? false;
  if (!hasDevrel) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    // Get distinct user IDs from all console-related tables
    const [consoleLogUsers, faucetClaimUsers, nodeRegistrationUsers] = await Promise.all([
      prisma.consoleLog.findMany({ select: { user_id: true }, distinct: ["user_id"] }),
      prisma.faucetClaim.findMany({ select: { user_id: true }, distinct: ["user_id"] }),
      prisma.nodeRegistration.findMany({ select: { user_id: true }, distinct: ["user_id"] }),
    ]);

    const uniqueUserIds = new Set([
      ...consoleLogUsers.map((u) => u.user_id),
      ...faucetClaimUsers.map((u) => u.user_id),
      ...nodeRegistrationUsers.map((u) => u.user_id),
    ]);

    const results: { userId: string; badgesAwarded: number }[] = [];
    let totalBadgesAwarded = 0;

    for (const userId of uniqueUserIds) {
      const awarded = await evaluateAllConsoleBadges(userId);
      if (awarded > 0) {
        results.push({ userId, badgesAwarded: awarded });
        totalBadgesAwarded += awarded;
      }
    }

    return NextResponse.json({
      success: true,
      usersProcessed: uniqueUserIds.size,
      totalBadgesAwarded,
      details: results,
    });
  } catch (error) {
    console.error("Console badge migration error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Migration failed" },
      { status: 500 }
    );
  }
}
