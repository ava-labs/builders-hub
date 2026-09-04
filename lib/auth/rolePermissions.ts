/**
 * Central definition of roles and their associated permissions.
 *
 * This is the single source of truth for authorization in the application.
 * Every role maps to a list of { resource, action } pairs.
 *
 * Resources use a "namespace:subnamespace" convention so future granularity
 * (e.g. "badge:nft") is supported without changing the permission model.
 *
 * Actions follow REST semantics:
 *   read    → safe reads (GET)
 *   write   → mutations (POST, PUT, PATCH)
 *   delete  → removal (DELETE)
 *   manage  → superset of every other action on that resource
 *   *       → every action on the matched resource
 *
 * Wildcard rules:
 *   resource "*" matches any resource.
 *   action   "*" matches any action.
 *   "manage" is a superset of all other actions (read, write, delete,
 *   export, admin, assign, and any future custom action).
 *
 * Scope:
 *   A grant may carry `scope: "own"`, meaning it covers only objects the user
 *   owns. This module cannot resolve ownership (that needs a DB read), so a
 *   scoped grant deliberately fails any unscoped check — see Scope below.
 *   Every `scope: "own"` grant has a matching `can…` policy helper in
 *   permissions.ts, named in a comment on the role.
 *
 * Capabilities NOT granted by roles:
 *   This map is keyed by role name, so anything granted by an *assignment row*
 *   rather than a role cannot appear here at all. Do not read the absence of a
 *   capability from this map as "nobody can do it". The assignment axes are:
 *
 *     HackathonJudge row → evaluate that hackathon's projects.
 *       canEvaluateHackathon() / canReviewMiniGrants() in permissions.ts.
 *       A user with NO roles can evaluate an event they are assigned to.
 *       Note the `judge` role below is a separate, weaker thing: it is neither
 *       granted by assignment nor required in order to evaluate.
 *
 *     ProjectMember row (status CONFIRMED) → edit that project's submission.
 *       Enforced in server/services/submitProject.ts.
 *
 *   These are a different axis from roles ("which objects is this user attached
 *   to" vs "what may this user do anywhere"). Resolving them needs a DB read, so
 *   they stay in policy helpers; folding them into this map would mean either
 *   losing the per-object scoping or carrying object ids in the session.
 *
 * To add a new role: add an entry here. Nothing else needs to change — unless
 * the grant is scoped, which also needs its policy helper in permissions.ts.
 * To protect a new route: add an entry to routeManifest.ts.
 */

export type Resource =
  | "event"
  | "showcase"
  | "badge"
  | "resource"
  | "speaker"
  | "notification"
  | "judge"
  | "user"
  | "platform"
  | "builder_insights"
  | "academy:team1"
  | "*"; // wildcard — matches any resource in checkPermission()

export type Action = "read" | "write" | "delete" | "manage" | "admin" | "export" | "assign" | "*";

/**
 * How far a grant reaches.
 *
 *   "all" (default) – every object of that resource, platform-wide.
 *   "own"           – only objects the user owns. What "owns" means is
 *                     resolved by a named policy helper in permissions.ts,
 *                     because it needs a DB read and this module must stay
 *                     synchronous and dependency-free (the middleware and
 *                     client components both import it).
 *
 * A "own" grant NEVER satisfies an unscoped requirement, so a bare
 * `hasPermission(attrs, { resource: "event", action: "manage" })` cannot
 * accidentally return true for a role that is only scoped to its own events.
 * Call sites that mean "…for this specific object" must pass scope: "own"
 * and then run the matching policy helper.
 */
export type Scope = "all" | "own";

export interface Permission {
  resource: Resource;
  action: Action;
  /** Omitted means "all". Every `scope: "own"` grant has a `can…` helper in permissions.ts. */
  scope?: Scope;
}

// ---------------------------------------------------------------------------
// Role → Permission map
// ---------------------------------------------------------------------------

export const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  // ── Platform admin (full wildcard) ───────────────────────────────────────
  devrel: [{ resource: "*", action: "manage" }],

  // ── Hackathon creator ─────────────────────────────────────────────────────
  hackathon_creator: [
    { resource: "event", action: "write" },
    { resource: "event", action: "read" },
    { resource: "resource", action: "read" },
    { resource: "speaker", action: "read" },
    { resource: "showcase", action: "read" },
    { resource: "showcase", action: "export" },
  ],

  // ── Team1 admin ──────────────────────────────────────────────────────────
  // event:manage is scope:"own" — only events they created or cohost.
  // Resolved by canEditEvent() / canManageHackathonJudges() in permissions.ts.
  // Because it is scoped, a bare hasPermission(attrs, {event, manage}) is
  // false here: platform-wide event powers belong to platform:admin only.
  team1_admin: [
    { resource: "event", action: "manage", scope: "own" },
    { resource: "resource", action: "manage" },
    { resource: "speaker", action: "manage" },
    { resource: "showcase", action: "read" },
    { resource: "showcase", action: "export" },
    { resource: "judge", action: "assign", scope: "own" },
    { resource: "academy:team1", action: "read" }
  ],

  // ── Team1 event admin ─────────────────────────────────────────────────────
  // Narrower than team1_admin: read-only event access, and only for events
  // they created or cohost. Resolved by canViewEventRegistrations().
  team1_event_admin: [
    { resource: "event", action: "read", scope: "own" },
    { resource: "academy:team1", action: "read" }],

  // ── Team1 lead ────────────────────────────────────────────────────────────
  // Team1 Chapter Lead and Co-Leads
  team1_lead: [
    { resource: "builder_insights", action: "read" },
    { resource: "academy:team1", action: "read" }
  ],

  // ── Team1 ─────────────────────────────────────────────────────────────────
  // member/collaborator of Team1.
  // allows to later add team1-member or team1-collaborator, if needed.
  team1: [{ resource: "academy:team1", action: "read" }],

  // ── Showcase ──────────────────────────────────────────────────────────────
  showcase: [
    { resource: "showcase", action: "read" },
    { resource: "showcase", action: "write" },
  ],

  // ── Badge admin ───────────────────────────────────────────────────────────
  badge_admin: [{ resource: "badge", action: "manage" }],

  // ── Notifications ─────────────────────────────────────────────────────────
  // notify_all  → can send to ALL users (notification:manage covers :write too)
  // notify_event → can send only to specific hackathons (notification:write)
  notify_all: [{ resource: "notification", action: "manage" }],
  notify_event: [{ resource: "notification", action: "write" }],

  // ── Builder insights ─────────────────────────────────────────────────────
  builder_insights: [{ resource: "builder_insights", action: "read" }, { resource: "builder_insights", action: "write" }],
} as const;

// ---------------------------------------------------------------------------
// Core permission helpers
// ---------------------------------------------------------------------------

/**
 * Infers the required action from an HTTP method.
 *
 * GET / HEAD   → read
 * POST         → write
 * PUT / PATCH  → write
 * DELETE       → delete
 */
export function actionFromMethod(method: string): Action {
  const map: Record<string, Action> = {
    GET: "read",
    HEAD: "read",
    POST: "write",
    PUT: "write",
    PATCH: "write",
    DELETE: "delete",
  };
  return map[method.toUpperCase()] ?? "read";
}

// ---------------------------------------------------------------------------
// Per-process memoization — avoids rebuilding the permission set on every
// hasPermission() call for the same role combination.
// ---------------------------------------------------------------------------
const _permCache = new Map<string, Permission[]>();

/**
 * Resolves all permissions for a list of role names.
 * Results are memoized by the sorted role key for the lifetime of the process.
 */
export function getPermissionsFromRoles(roles: string[]): Permission[] {
  const key = [...roles].sort().join("\x00");
  const cached = _permCache.get(key);
  if (cached) return cached;

  const seen = new Set<string>();
  const permissions: Permission[] = [];

  for (const role of roles) {
    // Object.hasOwn guards against prototype-chain keys ("constructor",
    // "__proto__", ...) resolving to non-array values and throwing.
    if (!Object.hasOwn(ROLE_PERMISSIONS, role)) continue;
    for (const perm of ROLE_PERMISSIONS[role]) {
      // Scope is part of the identity: a user holding both a scoped and an
      // unscoped grant of the same resource:action must keep the unscoped one.
      const permKey = `${perm.resource}:${perm.action}:${perm.scope ?? "all"}`;
      if (!seen.has(permKey)) {
        seen.add(permKey);
        permissions.push(perm);
      }
    }
  }

  _permCache.set(key, permissions);
  return permissions;
}

/**
 * Checks whether a set of permissions satisfies a required permission.
 *
 * Matching rules (evaluated left to right):
 *  1. Wildcard resource ("*") matches any required resource.
 *  2. Exact resource match.
 *  3. Parent namespace match: owning "badge" grants access to "badge:nft".
 *  4. Wildcard action ("*") matches any required action.
 *  5. "manage" matches every other action (full superset).
 *  6. Exact action match.
 *  7. Scope: an unscoped grant answers anything; a `scope: "own"` grant only
 *     answers a requirement that also asks for scope "own".
 */
export function checkPermission(
  userPermissions: Permission[],
  required: Permission,
): boolean {
  return userPermissions.some((p) => {
    const resourceMatch =
      p.resource === "*" ||
      p.resource === required.resource ||
      // parent namespace: "badge" covers "badge:nft"
      required.resource.startsWith(p.resource + ":");

    const actionMatch =
      p.action === "*" ||
      p.action === "manage" ||
      p.action === required.action;

    // An "all" grant answers anything. A scoped grant answers only a
    // requirement asking for that same scope — so asking the unscoped
    // (platform-wide) question can never be satisfied by a scoped grant.
    // Written scope-agnostically so a future scope needs no change here.
    const grantScope = p.scope ?? "all";
    const scopeMatch = grantScope === "all" || grantScope === (required.scope ?? "all");

    return resourceMatch && actionMatch && scopeMatch;
  });
}

/**
 * A session, as far as authorization is concerned.
 *
 * Deliberately a STRUCTURAL shape rather than next-auth's Session type: this
 * module is imported by proxy.ts (middleware) and by client components, so it
 * must stay free of runtime dependencies.
 */
export type SessionLike =
  | { user?: { custom_attributes?: readonly string[] | null } | null }
  | null
  | undefined;

/**
 * Roles → capability, for the two places that hold a raw role list rather than
 * a session: proxy.ts (which has a decrypted JWT token, whose roles sit at the
 * top level and so cannot be a SessionLike) and the unit tests.
 *
 * Anything holding a session should call hasPermission() instead.
 */
export function rolesHavePermission(
  roles: readonly string[] | null | undefined,
  required: Permission,
): boolean {
  if (!roles || roles.length === 0) return false;
  return checkPermission(getPermissionsFromRoles([...roles]), required);
}

export function hasPermission(session: SessionLike, required: Permission): boolean {
  // The single place that knows WHERE roles live on a session. Call sites pass
  // the session and stay ignorant of the field, so changing it is a one-line
  // edit here rather than a sweep of every caller.
  return rolesHavePermission(session?.user?.custom_attributes, required);
}
