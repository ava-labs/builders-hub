import { createHash } from "crypto";
import { prisma } from "@/prisma/prisma";
import {
  REFERRAL_COOKIE_NAME,
  REFERRAL_TARGET_TYPES,
  type ReferralTargetType,
} from "@/lib/referrals/constants";
import {
  OTHER_TEAM_SENTINEL,
  isOtherTeam,
  isReferralTeamId,
} from "@/lib/referrals/team-labels";

export interface ManualReferrerInput {
  teamId: string;
  teamIdOther?: string | null;
  userId?: string | null;
}

export interface ReferralAttributionPayload {
  referralCode?: string | null;
  landingPath?: string | null;
  manualReferrer?: ManualReferrerInput | null;
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

export async function getActiveReferralTargets() {
  const { ACTIVE_GRANT_TARGETS, BUILDER_HUB_SIGNUP_TARGET } = await import(
    "@/lib/referrals/targets"
  );

  const activeEvents = await prisma.hackathon.findMany({
    where: {
      end_date: { gte: new Date() },
      OR: [{ is_public: true }, { is_public: null }],
    },
    select: { id: true, title: true, start_date: true, end_date: true },
    orderBy: [{ start_date: "asc" }],
    take: 25,
  });

  const eventTargets = activeEvents.map((event) => ({
    key: `event-${event.id}`,
    group: "event" as const,
    label: event.title,
    detail: "Active or upcoming event",
    targetType: "hackathon_registration" as const,
    targetId: event.id,
    destinationUrl: `/events/registration-form?event=${event.id}`,
  }));

  return {
    signup: [BUILDER_HUB_SIGNUP_TARGET],
    event: eventTargets,
    grant: ACTIVE_GRANT_TARGETS,
  };
}

const MANUAL_OTHER_LABEL_MAX_LENGTH = 100;

async function resolveSubmitterId(
  rawUserId: string | null | undefined,
  rawUserEmail: string | null | undefined,
): Promise<{ userId: string | null; userEmail: string | null }> {
  const userEmail = normalizeNullable(rawUserEmail)?.toLowerCase() ?? null;
  const explicitId = normalizeNullable(rawUserId);
  if (explicitId) return { userId: explicitId, userEmail };
  if (!userEmail) return { userId: null, userEmail };
  const user = await prisma.user.findUnique({
    where: { email: userEmail },
    select: { id: true },
  });
  return { userId: user?.id ?? null, userEmail };
}

async function recordCodeBasedAttribution({
  attribution,
  input,
  referralCode,
  targetId,
}: {
  attribution: ReferralAttributionPayload;
  input: RecordReferralAttributionInput;
  referralCode: string;
  targetId: string | null;
}) {
  const referralLink = await prisma.referralLink.findFirst({
    where: { code: referralCode, disabled_at: null },
  });
  if (!referralLink) return null;
  if (
    referralLink.target_type !== input.targetType ||
    (referralLink.target_id && referralLink.target_id !== targetId)
  ) {
    return null;
  }

  const { userId, userEmail } = await resolveSubmitterId(input.userId, input.userEmail);
  const attributionKey = buildAttributionKey({
    targetType: input.targetType,
    targetId,
    referralLinkId: referralLink.id,
    userId,
    userEmail,
  });

  return prisma.referralAttribution.upsert({
    where: { attribution_key: attributionKey },
    update: {},
    create: {
      attribution_key: attributionKey,
      referral_link_id: referralLink.id,
      user_id_referrer: referralLink.owner_user_id,
      team_id_referrer: referralLink.team_id || null,
      team_id_referrer_other: null,
      user_id: userId,
      target_type: input.targetType,
      target_id: targetId,
      path: attribution.landingPath || null,
    },
  });
}

async function recordManualAttribution({
  attribution,
  input,
  manual,
  targetId,
}: {
  attribution: ReferralAttributionPayload;
  input: RecordReferralAttributionInput;
  manual: ManualReferrerInput;
  targetId: string | null;
}) {
  const rawTeamId = typeof manual.teamId === "string" ? manual.teamId : "";
  let teamIdReferrer: string | null = null;
  let teamIdReferrerOther: string | null = null;
  let userIdReferrer: string | null = null;

  if (isOtherTeam(rawTeamId)) {
    const trimmed = (manual.teamIdOther ?? "").trim();
    if (!trimmed || trimmed.length > MANUAL_OTHER_LABEL_MAX_LENGTH) {
      return null;
    }
    if (manual.userId) {
      console.warn(
        "[Referral] Ignoring manualReferrer.userId because team is 'Other'",
        { targetType: input.targetType, targetId },
      );
    }
    teamIdReferrer = OTHER_TEAM_SENTINEL;
    teamIdReferrerOther = trimmed;
  } else if (isReferralTeamId(rawTeamId)) {
    teamIdReferrer = rawTeamId;
    if (manual.userId) {
      const candidate = await prisma.user.findUnique({
        where: { id: manual.userId },
        select: { team_id: true },
      });
      if (candidate?.team_id === rawTeamId) {
        userIdReferrer = manual.userId;
      } else {
        console.warn(
          "[Referral] Dropping manualReferrer.userId — user.team_id does not match selected team",
          { targetType: input.targetType, targetId, teamId: rawTeamId },
        );
      }
    }
  } else {
    return null;
  }

  const { userId, userEmail } = await resolveSubmitterId(input.userId, input.userEmail);
  const attributionKey = buildAttributionKey({
    targetType: input.targetType,
    targetId,
    referralLinkId: null,
    userId,
    userEmail,
  });

  return prisma.referralAttribution.upsert({
    where: { attribution_key: attributionKey },
    update: {},
    create: {
      attribution_key: attributionKey,
      referral_link_id: null,
      user_id_referrer: userIdReferrer,
      team_id_referrer: teamIdReferrer,
      team_id_referrer_other: teamIdReferrerOther,
      user_id: userId,
      target_type: input.targetType,
      target_id: targetId,
      path: attribution.landingPath || null,
    },
  });
}

export async function recordReferralAttribution(input: RecordReferralAttributionInput) {
  const attribution = input.attribution ?? null;
  if (!attribution) return null;

  const referralCode = normalizeNullable(attribution.referralCode);
  const targetId = normalizeNullable(input.targetId);
  const manual = attribution.manualReferrer ?? null;

  if (referralCode) {
    if (manual) {
      console.info("[Referral] URL code overrode manual referrer", {
        targetType: input.targetType,
        targetId,
      });
    }
    return recordCodeBasedAttribution({ attribution, input, referralCode, targetId });
  }

  if (manual) {
    return recordManualAttribution({ attribution, input, manual, targetId });
  }

  return null;
}

export async function recordReferralAttributionFromRequest(
  request: Request,
  input: Omit<RecordReferralAttributionInput, "attribution"> & {
    attribution?: ReferralAttributionPayload | null;
  }
) {
  const explicit = input.attribution ?? null;
  const fromRequest = readReferralAttributionFromRequest(request);
  // Merge: explicit wins for code/manual; request fills landingPath when absent.
  const merged: ReferralAttributionPayload | null =
    explicit || fromRequest
      ? {
          referralCode: explicit?.referralCode ?? fromRequest?.referralCode ?? null,
          landingPath: explicit?.landingPath ?? fromRequest?.landingPath ?? null,
          manualReferrer: explicit?.manualReferrer ?? null,
        }
      : null;
  return recordReferralAttribution({ ...input, attribution: merged });
}

/**
 * One-line helper for API routes. Reads `referral_attribution` from the
 * parsed request body, merges with cookie/Referer-derived attribution, and
 * writes a row. Never throws — failures are logged and reported via the
 * boolean return.
 *
 * Usage:
 *   const referralAttributed = await extractAndRecordReferral(
 *     request,
 *     body,
 *     { targetType: "grant_application", targetId: "avalanche-research-proposals" },
 *     { userId: sessionUserId, userEmail: sessionEmail },
 *   );
 */
export async function extractAndRecordReferral(
  request: Request,
  body: unknown,
  target: { targetType: ReferralTargetType; targetId?: string | null },
  identity: { userId?: string | null; userEmail?: string | null },
): Promise<boolean> {
  const explicit =
    body && typeof body === "object" && "referral_attribution" in body
      ? ((body as { referral_attribution?: ReferralAttributionPayload | null })
          .referral_attribution ?? null)
      : null;
  try {
    const row = await recordReferralAttributionFromRequest(request, {
      targetType: target.targetType,
      targetId: target.targetId ?? null,
      userId: identity.userId ?? null,
      userEmail: identity.userEmail ?? null,
      attribution: explicit,
    });
    return Boolean(row);
  } catch (error) {
    console.error("[Referral] Failed to record attribution", {
      targetType: target.targetType,
      targetId: target.targetId ?? null,
      error,
    });
    return false;
  }
}
