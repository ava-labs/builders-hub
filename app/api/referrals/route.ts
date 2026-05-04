import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/authSession";
import { canGenerateReferralLinks } from "@/lib/auth/permissions";
import {
  buildReferralUrl,
  createReferralLink,
  isReferralTargetType,
  listReferralLinksForUser,
} from "@/server/services/referrals";

function getOrigin(request: NextRequest): string {
  return request.nextUrl.origin;
}

export async function GET(request: NextRequest) {
  const session = await getAuthSession();

  if (!session?.user?.id || !canGenerateReferralLinks(session.user.custom_attributes)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 401 });
  }

  const links = await listReferralLinksForUser(session.user.id);
  const origin = getOrigin(request);

  return NextResponse.json({
    links: links.map((link) => ({
      ...link,
      shareUrl: buildReferralUrl(origin, link.destination_url, link.code),
    })),
  });
}

export async function POST(request: NextRequest) {
  const session = await getAuthSession();

  if (!session?.user?.id || !canGenerateReferralLinks(session.user.custom_attributes)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 401 });
  }

  const body = await request.json();
  const targetType = body?.targetType;

  if (!isReferralTargetType(targetType)) {
    return NextResponse.json({ error: "Invalid referral target type" }, { status: 400 });
  }

  const referralLink = await createReferralLink({
    ownerUserId: session.user.id,
    targetType,
    targetId: typeof body?.targetId === "string" ? body.targetId : null,
    destinationUrl: typeof body?.destinationUrl === "string" ? body.destinationUrl : null,
  });

  return NextResponse.json({
    ...referralLink,
    shareUrl: buildReferralUrl(getOrigin(request), referralLink.destination_url, referralLink.code),
  });
}
