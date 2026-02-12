import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/authSession";
import { evaluateAllConsoleBadges } from "@/server/services/consoleBadge/consoleBadgeService";

export async function POST() {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ awardedBadges: [] });
  }

  try {
    const awardedBadges = await evaluateAllConsoleBadges(session.user.id);
    return NextResponse.json({ awardedBadges });
  } catch (error) {
    console.error("Console badge check error:", error);
    return NextResponse.json({ awardedBadges: [] });
  }
}
