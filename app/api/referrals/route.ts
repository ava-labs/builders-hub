import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/authSession";
import {
  canGenerateReferralLinkForTarget,
  canGenerateRestrictedReferralLinks,
} from "@/lib/auth/permissions";
import { prisma } from "@/prisma/prisma";
import {
  buildReferralUrl,
  createReferralLink,
  isReferralTargetType,
  listReferralLinksForUser,
} from "@/server/services/referrals";
import type { ReferralTargetType } from "@/lib/referrals/constants";

function getOrigin(request: NextRequest): string {
  return request.nextUrl.origin;
}

function getStringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getDateValue(value: unknown): Date | null {
  if (typeof value !== "string" || !value.trim()) return null;

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getRegistrationDeadline(content: unknown): Date | null {
  if (!content || typeof content !== "object") return null;
  return getDateValue((content as { registration_deadline?: unknown }).registration_deadline);
}

const ACTIVE_GRANT_REFERRAL_TARGETS: Record<string, string> = {
  "avalanche-research-proposals": "/grants/avalanche-research-proposals",
  "retro9000-returning": "/grants/retro9000returning",
};

async function resolveReferralTarget(targetType: ReferralTargetType, body: any) {
  if (targetType === "hackathon_registration") {
    const targetId = getStringValue(body?.targetId);
    if (!targetId) {
      return { error: "Missing hackathon target" };
    }

    const hackathon = await prisma.hackathon.findUnique({
      where: { id: targetId },
      select: {
        id: true,
        content: true,
        end_date: true,
        is_public: true,
      },
    });

    if (!hackathon || hackathon.is_public === false) {
      return { error: "Hackathon is not available for referrals" };
    }

    const closesAt = getRegistrationDeadline(hackathon.content) ?? hackathon.end_date;
    if (closesAt.getTime() < Date.now()) {
      return { error: "Hackathon registration is closed" };
    }

    return {
      targetId: hackathon.id,
      destinationUrl: `/events/registration-form?event=${hackathon.id}`,
    };
  }

  if (targetType === "bh_signup") {
    return {
      targetId: null,
      destinationUrl: "/",
    };
  }

  if (targetType === "grant_application") {
    const targetId = getStringValue(body?.targetId);
    if (!targetId || !ACTIVE_GRANT_REFERRAL_TARGETS[targetId]) {
      return { error: "Grant is not available for referrals" };
    }

    return {
      targetId,
      destinationUrl: ACTIVE_GRANT_REFERRAL_TARGETS[targetId],
    };
  }

  if (targetType === "build_games_application") {
    return { error: "Build Games referrals are closed" };
  }

  return {
    targetId: getStringValue(body?.targetId),
    destinationUrl: getStringValue(body?.destinationUrl),
  };
}

export async function GET(request: NextRequest) {
  const session = await getAuthSession();

  if (!session?.user?.id || !canGenerateRestrictedReferralLinks(session.user.custom_attributes)) {
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
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 401 });
  }

  const body = await request.json();
  const targetType = body?.targetType;

  if (!isReferralTargetType(targetType)) {
    return NextResponse.json({ error: "Invalid referral target type" }, { status: 400 });
  }

  if (!canGenerateReferralLinkForTarget(session.user.custom_attributes, targetType)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 401 });
  }

  const resolvedTarget = await resolveReferralTarget(targetType, body);
  if ("error" in resolvedTarget) {
    return NextResponse.json({ error: resolvedTarget.error }, { status: 400 });
  }

  const referralLink = await createReferralLink({
    ownerUserId: session.user.id,
    targetType,
    targetId: resolvedTarget.targetId,
    destinationUrl: resolvedTarget.destinationUrl,
  });

  return NextResponse.json({
    ...referralLink,
    shareUrl: buildReferralUrl(getOrigin(request), referralLink.destination_url, referralLink.code),
  });
}
