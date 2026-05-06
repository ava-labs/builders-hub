import { createHash } from "crypto";
import { prisma } from "@/prisma/prisma";
import {
  REFERRAL_COOKIE_NAME,
  REFERRAL_TARGET_TYPES,
  type ReferralTargetType,
} from "@/lib/referrals/constants";

export interface ReferralAttributionPayload {
  referralCode?: string | null;
  landingPath?: string | null;
}

export interface RecordReferralAttributionInput {
  targetType: ReferralTargetType;
  targetId?: string | null;
  userId?: string | null;
  userEmail?: string | null;
  attribution?: ReferralAttributionPayload | null;
}

export function isReferralTargetType(value: unknown): value is ReferralTargetType {
  return typeof value === "string" && REFERRAL_TARGET_TYPES.includes(value as ReferralTargetType);
}

export function getDefaultReferralDestination(targetType: ReferralTargetType): string {
  switch (targetType) {
    case "bh_signup":
      return "/";
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

function normalizeNullable(value: string | null | undefined): string | null {
  return value?.trim() || null;
}

function buildAttributionKey({
  targetType,
  targetId,
  referralLinkId,
  userId,
  userEmail,
}: {
  targetType: ReferralTargetType;
  targetId: string | null;
  referralLinkId: string | null;
  userId: string | null;
  userEmail: string | null;
}): string {
  return [
    targetType,
    targetId ?? "",
    referralLinkId ?? "",
    userId ?? "",
    userEmail ?? "",
  ].join("|");
}

async function getOwnerReferralProfile(ownerUserId: string): Promise<{
  teamId: string | null;
}> {
  const owner = await prisma.user.findUnique({
    where: { id: ownerUserId },
    select: { team_id: true },
  });

  return {
    teamId: owner?.team_id ?? null,
  };
}

const REFERRAL_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const REFERRAL_CODE_LENGTH = 5;

function buildReferralCode({
  ownerUserId,
  targetType,
  targetId,
  attempt,
}: {
  ownerUserId: string;
  targetType: ReferralTargetType;
  targetId: string | null;
  attempt: number;
}): string {
  const hash = createHash("sha256")
    .update(`${ownerUserId}:${targetType}:${targetId ?? "global"}:${attempt}`)
    .digest();

  return Array.from({ length: REFERRAL_CODE_LENGTH }, (_, index) => {
    return REFERRAL_CODE_ALPHABET[hash[index] % REFERRAL_CODE_ALPHABET.length];
  }).join("");
}

function decodeCookieValue(value: string): ReferralAttributionPayload | null {
  try {
    return JSON.parse(decodeURIComponent(value)) as ReferralAttributionPayload;
  } catch {
    return null;
  }
}

function readReferralAttributionFromUrl(value: string | null): ReferralAttributionPayload | null {
  if (!value) return null;

  try {
    const url = new URL(value);
    const referralCode = normalizeNullable(url.searchParams.get("ref"));
    if (!referralCode) return null;

    return {
      referralCode,
      landingPath: `${url.pathname}${url.search}`,
    };
  } catch {
    return null;
  }
}

export function readReferralAttributionFromRequest(request: Request): ReferralAttributionPayload | null {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) {
    return (
      readReferralAttributionFromUrl(request.headers.get("referer")) ??
      readReferralAttributionFromUrl(request.headers.get("referrer"))
    );
  }

  const cookie = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${REFERRAL_COOKIE_NAME}=`));

  if (!cookie) {
    return (
      readReferralAttributionFromUrl(request.headers.get("referer")) ??
      readReferralAttributionFromUrl(request.headers.get("referrer"))
    );
  }

  return (
    decodeCookieValue(cookie.slice(REFERRAL_COOKIE_NAME.length + 1)) ??
    readReferralAttributionFromUrl(request.headers.get("referer")) ??
    readReferralAttributionFromUrl(request.headers.get("referrer"))
  );
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
  const ownerProfile = await getOwnerReferralProfile(ownerUserId);

  for (let attempt = 0; attempt < 16; attempt += 1) {
    const code = buildReferralCode({
      ownerUserId,
      targetType,
      targetId: normalizedTargetId,
      attempt,
    });

    const existingByCode = await prisma.referralLink.findUnique({ where: { code } });
    if (existingByCode) {
      if (
        existingByCode.owner_user_id === ownerUserId &&
        existingByCode.target_type === targetType &&
        (existingByCode.target_id ?? null) === normalizedTargetId &&
        existingByCode.destination_url === destination &&
        !existingByCode.disabled_at
      ) {
        return existingByCode;
      }

      continue;
    }

    try {
      return await prisma.referralLink.create({
        data: {
          code,
          owner_user_id: ownerUserId,
          team_id: ownerProfile.teamId,
          target_type: targetType,
          target_id: normalizedTargetId,
          destination_url: destination,
        },
      });
    } catch (error) {
      if (attempt === 15) throw error;
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

  const targetId = normalizeNullable(input.targetId);

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
    (referralLink.target_type !== input.targetType ||
      (referralLink.target_id && referralLink.target_id !== targetId))
  ) {
    return null;
  }

  const userEmail = normalizeNullable(input.userEmail)?.toLowerCase() ?? null;
  const userId =
    normalizeNullable(input.userId) ??
    (userEmail
      ? (
          await prisma.user.findUnique({
            where: { email: userEmail },
            select: { id: true },
          })
        )?.id ?? null
      : null);
  const referralLinkId = referralLink.id;
  const attributionKey = buildAttributionKey({
    targetType: input.targetType,
    targetId,
    referralLinkId,
    userId,
    userEmail,
  });

  return prisma.referralAttribution.upsert({
    where: { attribution_key: attributionKey },
    update: {},
    create: {
      attribution_key: attributionKey,
      referral_link_id: referralLinkId,
      user_id_referrer: referralLink.owner_user_id,
      team_id_referrer: referralLink.team_id || null,
      user_id: userId,
      target_type: input.targetType,
      target_id: targetId,
      path: attribution?.landingPath || null,
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
