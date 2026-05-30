import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/authSession";
import { evaluateAllConsoleBadges } from "@/server/services/consoleBadge/consoleBadgeService";

export async function POST(req: NextRequest) {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ awardedBadges: [] });
  }

  try {
    let timezone: string | undefined;
    try {
      const body = await req.json();
      timezone = body?.timezone;
    } catch {
      // No body or invalid JSON — timezone stays undefined
    }

    const awardedBadges = await evaluateAllConsoleBadges(session.user.id, { timezone });
    return NextResponse.json({ awardedBadges });
  } catch (error) {
    console.error("Console badge check error:", error);
    return NextResponse.json({ awardedBadges: [] });
  }
}
