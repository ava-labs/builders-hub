/**
 * Team One service — read and mutate the Team1 organisational tree.
 *
 * Membership shape:
 *   - `User.team_id` is the region tag (e.g. `team1-latam`, `team1-india`).
 *     The canonical list of valid Team 1 regions lives in `TEAM1_REGIONS`
 *     below — adding/removing a region there changes both the org tree
 *     view and the assign dropdown.
 *   - `User.custom_attributes` holds the within-team hierarchy tag. The
 *     three hierarchy tags (`team1-admin`, `team1-member`, `team1-technical`)
 *     are exported as `TEAM1_HIERARCHY_ROLES` from `lib/auth/roles.ts`.
 *     They are treated as mutually exclusive at the service layer.
 *
 * Permission model:
 *   - `devrel` sees and edits every region.
 *   - `team1-admin` sees and edits only their own region (matching `team_id`).
 *   - Anyone else: 403.
 *
 * Permission decisions are made in the API layer — service functions accept
 * an already-authorised `callerScope` and trust it. This keeps service code
 * simple to call from cron jobs / scripts.
 */

import { prisma } from "@/prisma/prisma";
import { TEAM1_HIERARCHY_ROLES, type Team1Role } from "@/lib/auth/roles";

const TEAM1_HIERARCHY_SET = new Set<string>(TEAM1_HIERARCHY_ROLES);

/**
 * Canonical Team 1 regions, in display order. This is the source of truth
 * for both the org tree and the assign dropdown — adding a region here
 * exposes it in the UI immediately. Labels are local to Team 1 (separate
 * from `REFERRAL_TEAM_LABELS`, which controls referral picker copy).
 */
export const TEAM1_REGIONS = [
  "team1-latam",
  "team1-japan",
  "team1-india",
  "team1-brazil",
  "team1-turkey",
] as const;
export type Team1Region = (typeof TEAM1_REGIONS)[number];

const TEAM1_REGION_LABELS: Record<Team1Region, string> = {
  "team1-latam": "Team 1 Latam",
  "team1-japan": "Team 1 Japan",
  "team1-india": "Team 1 India",
  "team1-brazil": "Team 1 Brazil",
  "team1-turkey": "Team 1 Turkey",
};

export function isTeam1Region(value: string | null | undefined): value is Team1Region {
  return !!value && (TEAM1_REGIONS as readonly string[]).includes(value);
}

// ─── Types ──────────────────────────────────────────────────────────────

export interface OrgMember {
  id: string;
  name: string;
  handle: string;
  email: string;
  country: string | null;
  /** "YYYY-MM" — month they joined (derived from User.created_at). */
  joined: string;
  /** Hierarchy tag — `team1-member` or `team1-technical`. */
  role: Exclude<Team1Role, "team1-admin">;
}

export interface OrgAdmin {
  id: string;
  name: string;
  handle: string;
  email: string;
  country: string | null;
  members: OrgMember[];
}

export interface OrgRegion {
  /** team_id, e.g. `team1-latam`. */
  teamId: string;
  /** Display label, e.g. "Team 1 Latam". */
  label: string;
  admins: OrgAdmin[];
  /** Members in this region with no `team1-admin` (orphan members). */
  unassignedMembers: OrgMember[];
  /** Counts split by hierarchy tag for the region header. */
  counts: {
    admins: number;
    technical: number;
    members: number;
  };
}

export interface PoolBuilder {
  id: string;
  name: string;
  handle: string;
  email: string;
  country: string | null;
  /** Existing team1 tag, if any (used to filter on the client). */
  team1Role: Team1Role | null;
}

/**
 * Authorised caller context. Built by the API layer after checking the
 * session's `custom_attributes`.
 */
export type CallerScope =
  | { kind: "devrel" } // can touch every region
  | { kind: "team1-admin"; teamId: string }; // scoped to their own region

// ─── Helpers ────────────────────────────────────────────────────────────

function pickHierarchy(attrs: string[] | null | undefined): Team1Role | null {
  if (!attrs) return null;
  for (const a of attrs) {
    if (TEAM1_HIERARCHY_SET.has(a)) return a as Team1Role;
  }
  return null;
}

function joinedMonth(d: Date | null | undefined): string {
  const date = d ?? new Date();
  return date.toISOString().slice(0, 7);
}

function displayHandle(u: { user_name: string | null; email: string }): string {
  if (u.user_name && u.user_name.trim()) return u.user_name.trim();
  return u.email.split("@")[0];
}

// ─── Reads ──────────────────────────────────────────────────────────────

/**
 * Returns every Team One region the caller is allowed to see, with admins
 * and members nested underneath. DevRel gets everything; team1-admins get
 * only their own region.
 */
export async function getOrgTree(scope: CallerScope): Promise<OrgRegion[]> {
  const teamIdFilter =
    scope.kind === "devrel"
      ? { in: [...TEAM1_REGIONS] }
      : { equals: scope.teamId };

  const rows = await prisma.user.findMany({
    where: {
      team_id: teamIdFilter,
      // Only users whose custom_attributes contain a team1-* hierarchy tag.
      custom_attributes: { hasSome: [...TEAM1_HIERARCHY_ROLES] },
    },
    select: {
      id: true,
      name: true,
      email: true,
      user_name: true,
      country: true,
      team_id: true,
      custom_attributes: true,
      created_at: true,
    },
    orderBy: [{ team_id: "asc" }, { name: "asc" }],
  });

  // Bucket rows by region.
  const byRegion = new Map<
    string,
    { admins: OrgAdmin[]; members: OrgMember[] }
  >();

  for (const u of rows) {
    if (!u.team_id) continue;
    const role = pickHierarchy(u.custom_attributes);
    if (!role) continue;

    const bucket = byRegion.get(u.team_id) ?? { admins: [], members: [] };
    byRegion.set(u.team_id, bucket);

    const base = {
      id: u.id,
      name: u.name ?? u.email,
      handle: displayHandle(u),
      email: u.email,
      country: u.country ?? null,
    };

    if (role === "team1-admin") {
      bucket.admins.push({ ...base, members: [] });
    } else {
      bucket.members.push({
        ...base,
        joined: joinedMonth(u.created_at),
        role,
      });
    }
  }

  // Emit every canonical region in declared order, even if empty, so the
  // UI can render assignment slots for regions with no one in them yet.
  // Members hang off the first admin in the region (single-admin is the
  // common shape in our DB; proper per-admin attribution would need an
  // `assigned_by_user_id` column — out of scope for v1).
  const visibleRegions =
    scope.kind === "devrel"
      ? TEAM1_REGIONS
      : TEAM1_REGIONS.filter((r) => r === scope.teamId);

  return visibleRegions.map<OrgRegion>((teamId) => {
    const bucket = byRegion.get(teamId) ?? { admins: [], members: [] };

    if (bucket.admins.length > 0) {
      bucket.admins[0].members = bucket.members;
    }

    return {
      teamId,
      label: TEAM1_REGION_LABELS[teamId],
      admins: bucket.admins,
      unassignedMembers: bucket.admins.length === 0 ? bucket.members : [],
      counts: {
        admins: bucket.admins.length,
        technical: bucket.members.filter((m) => m.role === "team1-technical").length,
        members: bucket.members.filter((m) => m.role === "team1-member").length,
      },
    };
  });
}

/**
 * Search Builder Hub accounts that are NOT currently in Team One.
 *
 * For DevRel, returns global matches. For a team1-admin, the `teamId`
 * argument is honoured as a hint but the search is still global — the API
 * layer is responsible for ultimately routing the assignment into the
 * admin's own region.
 */
export async function searchAssignablePool(args: {
  query: string;
  limit?: number;
}): Promise<PoolBuilder[]> {
  const q = args.query.trim();
  const limit = Math.min(Math.max(args.limit ?? 20, 1), 50);

  // Empty query → don't return the whole DB; return an empty list so the
  // UI starts in a "type to search" state.
  if (q.length < 2) return [];

  const rows = await prisma.user.findMany({
    where: {
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        { user_name: { contains: q, mode: "insensitive" } },
      ],
      // Exclude anyone who already has a team1-* hierarchy tag.
      NOT: { custom_attributes: { hasSome: [...TEAM1_HIERARCHY_ROLES] } },
    },
    select: {
      id: true,
      name: true,
      email: true,
      user_name: true,
      country: true,
      custom_attributes: true,
    },
    take: limit,
    orderBy: [{ name: "asc" }],
  });

  return rows.map((u) => ({
    id: u.id,
    name: u.name ?? u.email,
    handle: displayHandle(u),
    email: u.email,
    country: u.country ?? null,
    team1Role: pickHierarchy(u.custom_attributes),
  }));
}

// ─── Mutations ──────────────────────────────────────────────────────────

/**
 * Assigns a Team 1 hierarchy role to a builder in the given region.
 * Idempotent:
 *  - Replaces any existing team1-* hierarchy tag (mutual exclusion).
 *  - Sets `team_id` to the target region.
 *
 * Permission rules:
 *  - `team1-admin` callers can only assign within their own region, and
 *    cannot grant the `team1-admin` role (admin promotion is DevRel only).
 *  - `devrel` callers can assign any of the three hierarchy roles in any
 *    region.
 */
export async function assignMember(args: {
  callerScope: CallerScope;
  builderId: string;
  teamId: string;
  role: Team1Role;
}): Promise<{ id: string }> {
  if (!isTeam1Region(args.teamId)) {
    throw new Error(`Invalid Team 1 region: ${args.teamId}`);
  }
  if (!TEAM1_HIERARCHY_SET.has(args.role)) {
    throw new Error(`Invalid Team 1 role: ${args.role}`);
  }
  if (args.callerScope.kind === "team1-admin") {
    if (args.callerScope.teamId !== args.teamId) {
      throw new Error("Forbidden: admins can only assign within their own region");
    }
    if (args.role === "team1-admin") {
      throw new Error("Forbidden: only DevRel can grant the team1-admin role");
    }
  }

  const builder = await prisma.user.findUnique({
    where: { id: args.builderId },
    select: { id: true, custom_attributes: true },
  });
  if (!builder) throw new Error("Builder not found");

  const nextAttrs = [
    ...builder.custom_attributes.filter(
      (a) => a != null && !TEAM1_HIERARCHY_SET.has(a),
    ),
    args.role,
  ];

  await prisma.user.update({
    where: { id: builder.id },
    data: {
      custom_attributes: nextAttrs,
      team_id: args.teamId,
    },
  });

  return { id: builder.id };
}

/**
 * Removes `team1-member` from a user and clears their `team_id`. Only
 * works on actual members — refuses to demote a `team1-admin` (use a
 * dedicated admin endpoint for that, out of scope for v1).
 */
export async function removeMember(args: {
  callerScope: CallerScope;
  memberId: string;
}): Promise<{ id: string }> {
  const target = await prisma.user.findUnique({
    where: { id: args.memberId },
    select: {
      id: true,
      custom_attributes: true,
      team_id: true,
    },
  });
  if (!target) throw new Error("Member not found");

  const role = pickHierarchy(target.custom_attributes);
  if (role === "team1-admin") {
    throw new Error("Cannot remove an admin via the member endpoint");
  }
  if (role !== "team1-member" && role !== "team1-technical") {
    // Nothing to remove — return idempotently.
    return { id: target.id };
  }
  if (
    args.callerScope.kind === "team1-admin" &&
    args.callerScope.teamId !== target.team_id
  ) {
    throw new Error("Forbidden: admins can only remove within their own region");
  }

  const nextAttrs = target.custom_attributes.filter(
    (a) => a != null && !TEAM1_HIERARCHY_SET.has(a),
  );

  await prisma.user.update({
    where: { id: target.id },
    data: {
      custom_attributes: nextAttrs,
      team_id: null,
    },
  });

  return { id: target.id };
}
