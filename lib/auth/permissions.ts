import { timingSafeEqual } from "node:crypto";
import { prisma } from "../../prisma/prisma";
import { MINI_GRANT_HACKATHON_ID } from "@/lib/grants/programs";

export function hasAnyAttribute(
  attributes: string[] | undefined | null,
  allowedAttributes: string[]
): boolean {
  return allowedAttributes.some((attribute) => attributes?.includes(attribute));
}

export function canAccessEvaluationTools(
  attributes: string[] | undefined | null
): boolean {
  return hasAnyAttribute(attributes, ["devrel", "judge"]);
}

/**
 * True when the user has a per-hackathon judge assignment row for the given
 * hackathon. Unlike the global "judge" custom_attribute, this is scoped to a
 * single Hackathon.id.
 */
export async function isHackathonJudge(
  userId: string | undefined | null,
  hackathonId: string,
): Promise<boolean> {
  if (!userId) return false;
  const row = await prisma.hackathonJudge.findUnique({
    where: { hackathon_id_user_id: { hackathon_id: hackathonId, user_id: userId } },
    select: { id: true },
  });
  return row !== null;
}

/**
 * True when the user may evaluate projects for the given hackathon:
 * devrel (host) OR an assigned HackathonJudge row exists.
 */
export async function canEvaluateHackathon(
  session: { user?: { id?: string; custom_attributes?: string[] } } | null | undefined,
  hackathonId: string,
): Promise<boolean> {
  if (!session?.user) return false;
  if (hasAnyAttribute(session.user.custom_attributes, ["devrel"])) return true;
  return isHackathonJudge(session.user.id, hackathonId);
}

/**
 * True when the user may review Team1 Mini Grant (grant_minigrant) applications:
 * devrel OR a judge assigned to the mini-grant backing hackathon. The global
 * "judge" custom_attribute is intentionally NOT sufficient — mini-grant review
 * is scoped to devrel and explicitly assigned mini-grant judges.
 */
export function canReviewMiniGrants(
  session: { user?: { id?: string; custom_attributes?: string[] } } | null | undefined,
): Promise<boolean> {
  return canEvaluateHackathon(session, MINI_GRANT_HACKATHON_ID);
}

/**
 * True when the user may assign/remove judges for any hackathon. Today
 * this is devrel-only; we may scope it per-hackathon later.
 */
export function canManageHackathonJudges(
  session: { user?: { custom_attributes?: string[] } } | null | undefined,
): boolean {
  if (!session?.user) return false;
  return hasAnyAttribute(session.user.custom_attributes, ["devrel"]);
}

export function canManageEvaluationPhase(
  session: { user?: { custom_attributes?: string[] } } | null | undefined,
): boolean {
  if (!session?.user) return false;
  return hasAnyAttribute(session.user.custom_attributes, ["devrel"]);
}

/**
 * Constant-time bearer-token check for the public projects endpoint.
 * Expects `Authorization: Bearer <token>`. Compares to the
 * HACKATHON_PROJECTS_API_KEY env var. Returns false if the env var is
 * unset (no anonymous fallback).
 */
export function verifyHackathonProjectsApiKey(
  authHeader: string | null | undefined,
): boolean {
  const expected = process.env.HACKATHON_PROJECTS_API_KEY;
  if (!expected || expected.length === 0) return false;
  if (!authHeader) return false;
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) return false;
  const provided = match[1].trim();
  const expectedBuf = Buffer.from(expected);
  const providedBuf = Buffer.from(provided);
  if (expectedBuf.length !== providedBuf.length) return false;
  return timingSafeEqual(expectedBuf, providedBuf);
}

export function canAccessBuilderInsights(
  attributes: string[] | undefined | null
): boolean {
  return hasAnyAttribute(attributes, ["builder_insights"]);
}

export function canSendNotifications(
  attributes: string[] | undefined | null
): boolean {
  return hasAnyAttribute(attributes, ["devrel"]);
}

export function canGenerateRestrictedReferralLinks(
  attributes: string[] | undefined | null
): boolean {
  return canAccessBuilderInsights(attributes);
}

export function canGenerateReferralLinkForTarget(
  _attributes: string[] | undefined | null,
  targetType: string
): boolean {
  if (targetType === "build_games_application") return false;
  return true;
}
