import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/authSession";
import { isReferralTargetType, recordReferralAttribution } from "@/server/services/referrals";

export async function POST(request: NextRequest) {
  const session = await getAuthSession();
  const body = await request.json();
  const conversionType = body?.conversionType;

  if (!isReferralTargetType(conversionType)) {
    return NextResponse.json({ error: "Invalid conversion type" }, { status: 400 });
  }

  const attribution = await recordReferralAttribution({
    conversionType,
    conversionResourceId:
      typeof body?.conversionResourceId === "string" ? body.conversionResourceId : null,
    convertedUserId:
      typeof body?.convertedUserId === "string"
        ? body.convertedUserId
        : session?.user?.id && !session.user.id.startsWith("pending_")
          ? session.user.id
          : null,
    convertedEmail:
      typeof body?.convertedEmail === "string"
        ? body.convertedEmail
        : session?.user?.email ?? null,
    attribution: body?.attribution ?? null,
  });

  return NextResponse.json({ success: true, attribution });
}
