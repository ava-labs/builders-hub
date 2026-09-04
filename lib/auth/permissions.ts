import { timingSafeEqual } from "node:crypto";
import { hasPermission, type SessionLike } from "@/lib/auth/rolePermissions";
import { prisma } from "../../prisma/prisma";
import { MINI_GRANT_HACKATHON_ID } from "@/lib/grants/programs";
import { isTeam1Event } from "@/lib/events/team1";

/**
 * Module-private: raw role-NAME check. Only for the few places that must
 * distinguish specific roles from one another (canViewEventRegistrations
 * branches differently for team1_admin vs team1_event_admin) rather than ask
 * a capability question. Everything else uses hasPermission.
 */
function hasAnyAttribute(
  attributes: string[] | undefined | null,
  allowedAttributes: string[]
): boolean {
  return allowedAttributes.some((attribute) => attributes?.includes(attribute));
}

/**
 * Shared mechanic (not a policy): platform-wide admins — every role holding
 * platform:admin (currently devrel only). Use this instead of checking the
 * "devrel" string, so a future platform-admin role is never silently excluded.
 */
function isPlatformAdmin(source: SessionLike): boolean {
  return hasPermission(source, { resource: "platform", action: "admin" });
}

/**
 * Which hackathons this user may evaluate.
 *
 *   null  → no restriction (platform admins see every hackathon).
 *   []    → may not evaluate anything.
 *   [ids] → exactly the hackathons they hold a HackathonJudge row for.
 *
 * The global "judge" role is deliberately NOT a factor: evaluation is granted
 * by assignment, not by a role (see the header of rolePermissions.ts). A user
 * with no roles at all evaluates the events they are assigned to, and holding
 * "judge" without an assignment grants nothing.
 */
export async function evaluableHackathonIds(
  session: { user?: { id?: string; custom_attributes?: string[] } } | null | undefined,
): Promise<string[] | null> {
  if (!session?.user?.id) return [];
  if (isPlatformAdmin(session)) return null;
  const rows = await prisma.hackathonJudge.findMany({
    where: { user_id: session.user.id },
    select: { hackathon_id: true },
  });
  return rows.map((r) => r.hackathon_id);
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
  if (isPlatformAdmin(session)) return true;
  return isHackathonJudge(session.user.id, hackathonId);
}

/**
 * True when the user may review Team1 Mini Grant (grant_minigrant) applications:
 * devrel OR a judge assigned to the mini-grant backing hackathon. The global
 * "judge" custom_attribute is intentionally NOT sufficient — mini-grant review
 * is scoped to devrel and explicitly assigned mini-grant judges.
 */
export async function canReviewMiniGrants(
  session: { user?: { id?: string; custom_attributes?: string[] } } | null | undefined,
): Promise<boolean> {
  // Spelled out rather than calling canEvaluateHackathon: policies stay
  // explicit and share the isHackathonJudge mechanic instead of each other.
  if (!session?.user) return false;
  if (isPlatformAdmin(session)) return true;
  return isHackathonJudge(session.user.id, MINI_GRANT_HACKATHON_ID);
}

/**
 * True when the user may assign/remove judges for the given hackathon:
 * devrel for any event; team1_admin for events they created or cohost.
 */
export async function canManageHackathonJudges(
  session:
    | { user?: { id?: string; email?: string; custom_attributes?: string[] } }
    | null
    | undefined,
  hackathonId: string,
): Promise<boolean> {
  if (!session?.user) return false;
  if (isPlatformAdmin(session)) return true;
  return isTeam1AdminForOwnEvent(session.user, hackathonId);
}

/**
 * True when the user may view an event's registrations (registrant PII):
 * - devrel: all events (global event admins).
 * - team1_admin: all Team1 events (full access to everything Team1).
 * - team1_event_admin: only events they created or where they are a
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
  if (isPlatformAdmin(session)) return true;
  const attributes = session.user.custom_attributes;
  const isTeam1Admin = hasAnyAttribute(attributes, ["team1_admin"]);
  const isTeam1EventAdmin = hasAnyAttribute(attributes, ["team1_event_admin"]);
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
 * Shared mechanic (not a policy): the user created the event, or is a listed
 * cohost on it. Deliberately role-agnostic — this answers "is it theirs?", and
 * each policy decides which roles that ownership is worth something to.
 */
async function isCreatorOrCohost(
  user: { id?: string; email?: string },
  hackathonId: string,
): Promise<boolean> {
  const hackathon = await prisma.hackathon.findUnique({
    where: { id: hackathonId },
    select: { cohosts: true, created_by: true },
  });
  if (!hackathon) return false;
  if (user.id && hackathon.created_by === user.id) return true;
  return !!user.email && hackathon.cohosts.includes(user.email);
}

/**
 * Shared mechanic (not a policy): true when the user holds the team1_admin
 * role AND owns the given event — the same set surfaced in their managed
 * events list (GET /api/events?managed=true). Policy functions decide what
 * this grants; change the policy there, not here.
 */
async function isTeam1AdminForOwnEvent(
  user: { id?: string; email?: string; custom_attributes?: string[] },
  hackathonId: string,
): Promise<boolean> {
  if (!hasAnyAttribute(user.custom_attributes, ["team1_admin"])) return false;
  return isCreatorOrCohost(user, hackathonId);
}

/**
 * True when the user may edit an event (PUT/PATCH /api/events/[id]):
 * - devrel: any event.
 * - team1_admin (event:manage scope own) and hackathon_creator (event:write):
 *   only events they created or where they are a listed cohost.
 *
 * hackathon_creator is included deliberately: the role exists to let trusted
 * external organisers run their own events, and POST /api/events grants them
 * creation. Without this they could create an event and then get a 403 saving
 * it — the editor at app/events/edit opens on event:write.
 */
export async function canEditEvent(
  session:
    | { user?: { id?: string; email?: string; custom_attributes?: string[] } }
    | null
    | undefined,
  hackathonId: string,
): Promise<boolean> {
  if (!session?.user) return false;
  if (isPlatformAdmin(session)) return true;
  // The common "may manage events" gate: satisfied by team1_admin (event:manage
  // scope:"own") and hackathon_creator (unscoped event:write), not by read-only
  // team1_event_admin. Asked as a permission, not a role name, so a new
  // event-editing role is picked up automatically.
  if (!hasPermission(session, { resource: "event", action: "write", scope: "own" })) {
    return false;
  }
  return isCreatorOrCohost(session.user, hackathonId);
}

/**
 * True when the user may change a project's competition outcome (the winner
 * flag, which also mints prize badges):
 * - devrel: any project.
 * - team1_admin: only projects belonging to an event they created or cohost.
 *
 * Spelled out rather than delegating to canEditEvent — policies stay explicit
 * and share the isTeam1AdminForOwnEvent mechanic instead of calling each other.
 */
export async function canManageProjectOutcome(
  session:
    | { user?: { id?: string; email?: string; custom_attributes?: string[] } }
    | null
    | undefined,
  projectId: string,
): Promise<boolean> {
  if (!session?.user) return false;
  if (isPlatformAdmin(session)) return true;
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { hackaton_id: true },
  });
  if (!project?.hackaton_id) return false;
  return isTeam1AdminForOwnEvent(session.user, project.hackaton_id);
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

