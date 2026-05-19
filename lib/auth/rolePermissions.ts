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
  | "hackathon"
  | "showcase"
  | "badge"
  | "resource"
  | "speaker"
  | "notification"
  | "judge"
  | "user"
  | string; // open for subnamespaces like "badge:nft"

export type Action = "read" | "write" | "delete" | "manage" | "*";

export interface Permission {
  resource: Resource;
  action: Action;
}

// ---------------------------------------------------------------------------
// Role → Permission map
// ---------------------------------------------------------------------------

export const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  // ── Super users (full wildcard) ──────────────────────────────────────────
  superadmin: [{ resource: "*", action: "*" }],
  devrel: [{ resource: "*", action: "*" }],

  // ── Team admin ────────────────────────────────────────────────────────────
  "team1-admin": [
    { resource: "hackathon", action: "manage" },
    { resource: "resource", action: "manage" },
    { resource: "speaker", action: "manage" },
    { resource: "showcase", action: "read" },
  ],

  // ── Hackathon creator ─────────────────────────────────────────────────────
  hackathonCreator: [
    { resource: "hackathon", action: "write" },
    { resource: "hackathon", action: "read" },
    { resource: "resource", action: "read" },
    { resource: "speaker", action: "read" },
    { resource: "showcase", action: "read" },
  ],

  // ── Showcase ──────────────────────────────────────────────────────────────
  showcase: [
    { resource: "showcase", action: "read" },
    { resource: "showcase", action: "write" },
  ],

  // ── Judge ─────────────────────────────────────────────────────────────────
  judge: [
    { resource: "judge", action: "read" },
    { resource: "judge", action: "write" },
    { resource: "badge", action: "write" },
  ],

  // ── Badge admin ───────────────────────────────────────────────────────────
  badge_admin: [{ resource: "badge", action: "manage" }],

  // ── Notifications ─────────────────────────────────────────────────────────
  notify_event: [{ resource: "notification", action: "write" }],

  // ── Builder insights ─────────────────────────────────────────────────────
  builder_insights: [{ resource: "builder_insights", action: "read" }],
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

/**
 * Resolves all permissions for a list of role names.
 * Deduplicates automatically. Handles wildcards at collection time.
 */
export function getPermissionsFromRoles(roles: string[]): Permission[] {
  const seen = new Set<string>();
  const permissions: Permission[] = [];

  for (const role of roles) {
    for (const perm of ROLE_PERMISSIONS[role] ?? []) {
      const key = `${perm.resource}:${perm.action}`;
      if (!seen.has(key)) {
        seen.add(key);
        permissions.push(perm);
      }
    }
  }

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
