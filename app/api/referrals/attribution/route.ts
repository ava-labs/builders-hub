import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/authSession";
import { prisma } from "@/prisma/prisma";
import { cleanAttribution, recordReferralAttributionFromRequest } from "@/server/services/referrals";
import { readJsonBody } from "@/lib/api/json-body";
import { z } from "zod";

const bodySchema = z.object({ referral_attribution: z.unknown().optional() });

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

  // A request with no body is fine: the cookie or the Referer can hold the referral.
  const body = await readJsonBody(request, bodySchema);
  const requestAttribution = cleanAttribution(body?.referral_attribution);

  const attribution = await recordReferralAttributionFromRequest(request, {
    targetType: "bh_signup",
    userId: user.id,
    userEmail: user.email,
    attribution: requestAttribution,
  });

  return NextResponse.json({ success: true, attribution });
}
