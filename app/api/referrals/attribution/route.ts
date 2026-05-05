import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/authSession";
import { prisma } from "@/prisma/prisma";
import { recordReferralAttributionFromRequest } from "@/server/services/referrals";

const SIGNUP_ATTRIBUTION_WINDOW_MS = 24 * 60 * 60 * 1000;

export async function POST(request: NextRequest) {
  const session = await getAuthSession();

  if (!session?.user?.id || session.user.id.startsWith("pending_")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true, created_at: true },
  });

  if (!user?.email) {
    return NextResponse.json({ error: "Forbidden" }, { status: 401 });
  }

  if (Date.now() - user.created_at.getTime() > SIGNUP_ATTRIBUTION_WINDOW_MS) {
    return NextResponse.json({ error: "Signup attribution window expired" }, { status: 403 });
  }

  const attribution = await recordReferralAttributionFromRequest(request, {
    conversionType: "bh_signup",
    convertedUserId: user.id,
    convertedEmail: user.email,
  });

  return NextResponse.json({ success: true, attribution });
}
