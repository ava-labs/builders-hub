import { timingSafeEqual } from "node:crypto";
import { prisma } from "../../prisma/prisma";
import { MINI_GRANT_HACKATHON_ID } from "@/lib/grants/programs";
import { isTeam1Event } from "@/lib/events/team1";

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
 * True when the user may assign/remove judges for the given hackathon:
 * devrel for any event; team1-admin for events they created or cohost.
 */
export async function canManageHackathonJudges(
  session:
    | { user?: { id?: string; email?: string; custom_attributes?: string[] } }
    | null
    | undefined,
  hackathonId: string,
): Promise<boolean> {
  if (!session?.user) return false;
  if (hasAnyAttribute(session.user.custom_attributes, ["devrel"])) return true;
  return isTeam1AdminForOwnEvent(session.user, hackathonId);
}

export function canManageEvaluationPhase(
  session: { user?: { custom_attributes?: string[] } } | null | undefined,
): boolean {
  if (!session?.user) return false;
  return hasAnyAttribute(session.user.custom_attributes, ["devrel"]);
}

/**
 * True when the user may view an event's registrations (registrant PII):
 * - devrel: all events (global event admins).
 * - team1-admin: all Team1 events (full access to everything Team1).
 * - team1-event-admin: only events they created or where they are a
 *   listed cohost (creators are NOT auto-added to cohosts).
 * Cohosts without one of these roles are intentionally excluded —
 * registrants only consent to sharing their contact data with Avalanche
 * Team1, not with arbitrary external co-organizers.
 */
export async function canViewEventRegistrations(
  session:
    | { user?: { id?: string; email?: string; custom_attributes?: string[] } }
    | null
    | undefined,
  hackathonId: string,
): Promise<boolean> {
  if (!session?.user) return false;
  const attributes = session.user.custom_attributes;
  if (hasAnyAttribute(attributes, ["devrel"])) return true;
  const isTeam1Admin = hasAnyAttribute(attributes, ["team1-admin"]);
  const isTeam1EventAdmin = hasAnyAttribute(attributes, ["team1-event-admin"]);
  if (!isTeam1Admin && !isTeam1EventAdmin) return false;
  const hackathon = await prisma.hackathon.findUnique({
    where: { id: hackathonId },
    select: { organizers: true, cohosts: true, created_by: true },
  });
  if (!hackathon) return false;
  if (isTeam1Admin && isTeam1Event(hackathon)) return true;
  if (!isTeam1EventAdmin) return false;
  if (session.user.id && hackathon.created_by === session.user.id) return true;
  return !!session.user.email && hackathon.cohosts.includes(session.user.email);
}

/**
 * Shared mechanic (not a policy): true when the user holds the team1-admin
 * role AND is the creator or a listed cohost of the given event — the same
 * set surfaced in their managed events list (GET /api/events?managed=true).
 * Policy functions (canEditEvent, canManageHackathonJudges) decide what
 * this grants; change the policy there, not here.
 */
async function isTeam1AdminForOwnEvent(
  user: { id?: string; email?: string; custom_attributes?: string[] },
  hackathonId: string,
): Promise<boolean> {
  if (!hasAnyAttribute(user.custom_attributes, ["team1-admin"])) return false;
  const hackathon = await prisma.hackathon.findUnique({
    where: { id: hackathonId },
    select: { cohosts: true, created_by: true },
  });
  if (!hackathon) return false;
  if (user.id && hackathon.created_by === user.id) return true;
  return !!user.email && hackathon.cohosts.includes(user.email);
}

/**
 * True when the user may edit an event (PUT/PATCH /api/events/[id]):
 * - devrel: any event.
 * - team1-admin: only events they created or where they are a listed
 *   cohost, so everything in their managed list they can also edit.
 */
export async function canEditEvent(
  session:
    | { user?: { id?: string; email?: string; custom_attributes?: string[] } }
    | null
    | undefined,
  hackathonId: string,
): Promise<boolean> {
  if (!session?.user) return false;
  if (hasAnyAttribute(session.user.custom_attributes, ["devrel"])) return true;
  return isTeam1AdminForOwnEvent(session.user, hackathonId);
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
