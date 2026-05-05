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
  landingPath?: string | null;
}

export interface RecordReferralAttributionInput {
  conversionType: ReferralTargetType;
  conversionResourceId?: string | null;
  conversionTargetId?: string | null;
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

function getSource(attribution: ReferralAttributionPayload | null | undefined): ReferralSourceType {
  if (attribution?.referralCode) return "referral";
  return "unknown";
}

function normalizeNullable(value: string | null | undefined): string | null {
  return value?.trim() || null;
}

function buildDedupeKey({
  conversionType,
  conversionResourceId,
  referralLinkId,
  convertedUserId,
  convertedEmail,
  source,
}: {
  conversionType: ReferralTargetType;
  conversionResourceId: string | null;
  referralLinkId: string | null;
  convertedUserId: string | null;
  convertedEmail: string | null;
  source: ReferralSourceType;
}): string {
  return [
    conversionType,
    conversionResourceId ?? "",
    referralLinkId ?? "",
    convertedUserId ?? "",
    convertedEmail ?? "",
    source,
  ].join("|");
}

async function findExistingReferralLink({
  ownerUserId,
  targetType,
  targetId,
  destinationUrl,
}: {
  ownerUserId: string;
  targetType: ReferralTargetType;
  targetId: string | null;
  destinationUrl: string;
}) {
  return prisma.referralLink.findFirst({
    where: {
      owner_user_id: ownerUserId,
      target_type: targetType,
      target_id: targetId,
      destination_url: destinationUrl,
      disabled_at: null,
    },
    orderBy: { created_at: "asc" },
  });
}

function toReferralCodePart(value: string | null | undefined, maxLength = 28): string | null {
  const slug = value
    ?.toLowerCase()
    .trim()
    .replace(/@.*$/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength)
    .replace(/-+$/g, "");

  return slug || null;
}

async function getOwnerReferralCodePart(ownerUserId: string): Promise<string> {
  const owner = await prisma.user.findUnique({
    where: { id: ownerUserId },
    select: { user_name: true, name: true, email: true },
  });

  return (
    toReferralCodePart(owner?.user_name) ??
    toReferralCodePart(owner?.name) ??
    toReferralCodePart(owner?.email) ??
    toReferralCodePart(ownerUserId, 12) ??
    "builder"
  );
}

function buildReferralCode(ownerCodePart: string, targetType: ReferralTargetType): string {
  const targetCodePart = toReferralCodePart(targetType.replaceAll("_", "-"), 22) ?? "referral";
  return `${ownerCodePart}-${targetCodePart}-${randomBytes(4).toString("hex")}`;
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
  const normalizedTargetId = normalizeNullable(targetId);
  const existingLink = await findExistingReferralLink({
    ownerUserId,
    targetType,
    targetId: normalizedTargetId,
    destinationUrl: destination,
  });

  if (existingLink) {
    return existingLink;
  }

  const ownerCodePart = await getOwnerReferralCodePart(ownerUserId);

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const code = buildReferralCode(ownerCodePart, targetType);
    try {
      return await prisma.referralLink.create({
        data: {
          code,
          owner_user_id: ownerUserId,
          target_type: targetType,
          target_id: normalizedTargetId,
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
  const referralCode = normalizeNullable(attribution?.referralCode);
  if (!referralCode) {
    return null;
  }

  const source = getSource(attribution);
  const conversionResourceId = normalizeNullable(input.conversionResourceId);
  const conversionTargetId = normalizeNullable(input.conversionTargetId) ?? conversionResourceId;

  const referralLink = await prisma.referralLink.findFirst({
    where: {
      code: referralCode,
      disabled_at: null,
    },
  });

  if (!referralLink) {
    return null;
  }

  if (
    referralLink &&
    (referralLink.target_type !== input.conversionType ||
      (referralLink.target_id && referralLink.target_id !== conversionTargetId))
  ) {
    return null;
  }

  const convertedEmail = normalizeNullable(input.convertedEmail)?.toLowerCase() ?? null;
  const convertedUserId = normalizeNullable(input.convertedUserId);
  const referralLinkId = referralLink?.id ?? null;
  const dedupeKey = buildDedupeKey({
    conversionType: input.conversionType,
    conversionResourceId,
    referralLinkId,
    convertedUserId,
    convertedEmail,
    source,
  });

  return prisma.referralAttribution.upsert({
    where: { dedupe_key: dedupeKey },
    update: {},
    create: {
      dedupe_key: dedupeKey,
      referral_link_id: referralLinkId,
      referrer_user_id: referralLink?.owner_user_id || null,
      converted_user_id: convertedUserId,
      converted_email: convertedEmail,
      conversion_type: input.conversionType,
      conversion_resource_id: conversionResourceId,
      source,
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
