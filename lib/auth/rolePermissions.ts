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
 *   manage  → all of the above (superpower for that resource)
 *   *       → every action on the matched resource
 *
 * Wildcard rules:
 *   resource "*" matches any resource.
 *   action   "*" matches any action.
 *   "manage" implies read + write + delete.
 *
 * To add a new role: add an entry here. Nothing else needs to change.
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
  | "*"; // wildcard — matches any resource in checkPermission()

export type Action = "read" | "write" | "delete" | "manage" | "admin" | "export" | "assign" | "*";

export interface Permission {
  resource: Resource;
  action: Action;
}

// ---------------------------------------------------------------------------
// Role → Permission map
// ---------------------------------------------------------------------------

export const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  // ── Super users (full wildcard) ──────────────────────────────────────────
  superadmin: [{ resource: "*", action: "manage" }, { resource: "platform", action: "admin" }, { resource: "judge", action: "assign" }],
  devrel: [{ resource: "*", action: "manage" }, { resource: "platform", action: "admin" }, { resource: "judge", action: "assign" }],

  // ── Hackathon creator ─────────────────────────────────────────────────────
  hackathonCreator: [
    { resource: "event", action: "write" },
    { resource: "event", action: "read" },
    { resource: "resource", action: "read" },
    { resource: "speaker", action: "read" },
    { resource: "showcase", action: "read" },
    { resource: "showcase", action: "export" },
  ],

  // ── Showcase ──────────────────────────────────────────────────────────────
  showcase: [
    { resource: "showcase", action: "read" },
    { resource: "showcase", action: "write" },
  ],

  // ── Judge ─────────────────────────────────────────────────────────────────
  // Note: judge:assign is intentionally NOT granted here.
  // Assigning/removing judges is reserved for devrel and superadmin only.
  judge: [
    { resource: "judge", action: "read" },
    { resource: "badge", action: "write" },
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

  // ── Team 1 internal roles ─────────────────────────────────────────────────
  "Team1-Leader": [{ resource: "builder_insights", action: "read" }],
  "Team1-member": [{ resource: "builder_insights", action: "read" }],
  "T1-Technical": [{ resource: "builder_insights", action: "read" }],
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
    for (const perm of ROLE_PERMISSIONS[role] ?? []) {
      const permKey = `${perm.resource}:${perm.action}`;
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
 *  4. Wildcard action ("*") or "manage" matches any required action.
 *  5. Exact action match.
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

    return resourceMatch && actionMatch;
  });
}

/**
 * Returns true when the user's roles grant the required { resource, action }.
 *
 * Safe to import in both server and client components — this module has no
 * server-only dependencies (no prisma, no next/headers, etc.).
 *
 * For async checks (e.g. judge rows in DB) use `canEvaluateHackathon` from
 * `@/lib/auth/roles` in server components / route handlers only.
 */
export function hasPermission(
  customAttributes: readonly string[] | null | undefined,
  required: Permission,
): boolean {
  if (!customAttributes || customAttributes.length === 0) return false;
  return checkPermission(getPermissionsFromRoles([...customAttributes]), required);
}
