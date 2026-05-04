import { randomBytes } from "crypto";
import { prisma } from "@/prisma/prisma";
import {
  REFERRAL_COOKIE_NAME,
  REFERRAL_TARGET_TYPES,
  type ReferralSourceType,
  type ReferralTargetType,
} from "@/lib/referrals/constants";

export interface ReferralAttributionPayload {
  referralCode?: string | null;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_content?: string | null;
  utm_term?: string | null;
  landingPath?: string | null;
}

export interface RecordReferralAttributionInput {
  conversionType: ReferralTargetType;
  conversionResourceId?: string | null;
  convertedUserId?: string | null;
  convertedEmail?: string | null;
  attribution?: ReferralAttributionPayload | null;
}

export function isReferralTargetType(value: unknown): value is ReferralTargetType {
  return typeof value === "string" && REFERRAL_TARGET_TYPES.includes(value as ReferralTargetType);
}

export function getDefaultReferralDestination(targetType: ReferralTargetType): string {
  switch (targetType) {
    case "bh_signup":
      return "/profile";
    case "hackathon_registration":
      return "/events/registration-form";
    case "build_games_application":
      return "/build-games/apply";
    case "grant_application":
      return "/grants";
  }
}

export function buildReferralUrl(origin: string, destinationUrl: string, code: string): string {
  const url = new URL(destinationUrl, origin);
  url.searchParams.set("ref", code);
  return url.toString();
}

function hasUtm(attribution: ReferralAttributionPayload | null | undefined): boolean {
  return Boolean(
    attribution?.utm_source ||
      attribution?.utm_medium ||
      attribution?.utm_campaign ||
      attribution?.utm_content ||
      attribution?.utm_term
  );
}

function getSource(attribution: ReferralAttributionPayload | null | undefined): ReferralSourceType {
  if (attribution?.referralCode) return "referral";
  if (hasUtm(attribution)) return "utm";
  return "direct";
}

function decodeCookieValue(value: string): ReferralAttributionPayload | null {
  try {
    return JSON.parse(decodeURIComponent(value)) as ReferralAttributionPayload;
  } catch {
    return null;
  }
}

export function readReferralAttributionFromRequest(request: Request): ReferralAttributionPayload | null {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) return null;

  const cookie = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${REFERRAL_COOKIE_NAME}=`));

  if (!cookie) return null;

  return decodeCookieValue(cookie.slice(REFERRAL_COOKIE_NAME.length + 1));
}

export async function createReferralLink({
  ownerUserId,
  targetType,
  targetId,
  destinationUrl,
}: {
  ownerUserId: string;
  targetType: ReferralTargetType;
  targetId?: string | null;
  destinationUrl?: string | null;
}) {
  const destination = destinationUrl?.trim() || getDefaultReferralDestination(targetType);

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const code = randomBytes(8).toString("base64url");
    try {
      return await prisma.referralLink.create({
        data: {
          code,
          owner_user_id: ownerUserId,
          target_type: targetType,
          target_id: targetId || null,
          destination_url: destination,
        },
      });
    } catch (error) {
      if (attempt === 3) throw error;
    }
  }

  throw new Error("Unable to create referral link");
}

export async function listReferralLinksForUser(userId: string) {
  return prisma.referralLink.findMany({
    where: { owner_user_id: userId },
    orderBy: { created_at: "desc" },
    take: 25,
  });
}

export async function recordReferralAttribution(input: RecordReferralAttributionInput) {
  const attribution = input.attribution ?? null;
  const referralCode = attribution?.referralCode?.trim();
  const source = getSource(attribution);

  const referralLink = referralCode
    ? await prisma.referralLink.findFirst({
        where: {
          code: referralCode,
          disabled_at: null,
        },
      })
    : null;

  if (referralCode && !referralLink) {
    return null;
  }

  const convertedEmail = input.convertedEmail?.trim().toLowerCase() || null;
  const convertedUserId = input.convertedUserId || null;

  const existing = await prisma.referralAttribution.findFirst({
    where: {
      conversion_type: input.conversionType,
      conversion_resource_id: input.conversionResourceId || null,
      referral_link_id: referralLink?.id || null,
      ...(convertedUserId
        ? { converted_user_id: convertedUserId }
        : convertedEmail
          ? { converted_email: convertedEmail }
          : {}),
    },
  });

  if (existing) return existing;

  return prisma.referralAttribution.create({
    data: {
      referral_link_id: referralLink?.id || null,
      referrer_user_id: referralLink?.owner_user_id || null,
      converted_user_id: convertedUserId,
      converted_email: convertedEmail,
      conversion_type: input.conversionType,
      conversion_resource_id: input.conversionResourceId || null,
      source,
      utm_source: attribution?.utm_source || null,
      utm_medium: attribution?.utm_medium || null,
      utm_campaign: attribution?.utm_campaign || null,
      utm_content: attribution?.utm_content || null,
      utm_term: attribution?.utm_term || null,
      landing_path: attribution?.landingPath || null,
    },
  });
}

export async function recordReferralAttributionFromRequest(
  request: Request,
  input: Omit<RecordReferralAttributionInput, "attribution"> & {
    attribution?: ReferralAttributionPayload | null;
  }
) {
  return recordReferralAttribution({
    ...input,
    attribution: input.attribution ?? readReferralAttributionFromRequest(request),
  });
}
