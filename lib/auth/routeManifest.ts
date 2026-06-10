/**
 * Route Manifest — single source of truth for protected routes.
 *
 * Every entry declares:
 *   resource   – which resource the route operates on (maps to ROLE_PERMISSIONS).
 *   authOnly   – if true, any authenticated session passes (no permission check).
 *
 * The HTTP method is used to infer the required action automatically:
 *   GET / HEAD  → read
 *   POST        → write
 *   PUT / PATCH → write
 *   DELETE      → delete
 *
 * Routes NOT listed here are public.
 *
 * Defense-in-depth for API routes:
 *   API entries here act as a first line of defense at the Edge (middleware),
 *   before the request reaches the route handler. The withAuth* guards inside
 *   the handlers are the second layer. Both layers must pass independently.
 *   Removing an API entry from this manifest does NOT remove its protection if
 *   the handler still has a withAuth* guard — but it weakens the system:
 *   a future handler added under the same path prefix without a guard would be
 *   left completely unprotected.
 *
 * Trailing-segment note:
 *   Both "/api/hackathons" and "/api/hackathons/*" are declared explicitly
 *   so that the base path without a trailing segment is also protected.
 *   matchRoute() always tests an exact match before wildcard patterns.
 *
 * To protect a new route: add one line here. Nothing else changes.
 */

import { Action, Resource } from "./rolePermissions";

export interface RouteConfig {
  resource?: Resource;
  action?: Action;
  /** Any authenticated user passes; no resource:action check. */
  authOnly?: boolean;
}

export const ROUTE_MANIFEST: Record<string, RouteConfig> = {
  // ── UI – auth-only (any logged-in user) ─────────────────────────────────
  "/profile":                              { authOnly: true },
  "/profile/*":                            { authOnly: true },
  "/student-launchpad":                    { authOnly: true },
  "/student-launchpad/*":                  { authOnly: true },
  "/grants":                               { authOnly: true },
  "/grants/*":                             { authOnly: true },

  // ── UI – role-protected ───────────────────────────────────────────────────
  "/showcase":                             { resource: "showcase" },
  "/showcase/*":                           { resource: "showcase" },
  "/send-notifications":                   { resource: "notification" },
  "/hackathons/edit":                      { resource: "event" },
  "/hackathons/edit/*":                    { resource: "event" },
  "/events/edit":                          { resource: "event" },
  "/events/edit/*":                        { resource: "event" },

  // ── UI – academy certificates (auth-only) ────────────────────────────────
  "/academy/*/get-certificate":            { authOnly: true },
  "/academy/*/certificate":               { authOnly: true },

  // ── API – hackathons / events ──────────────────────────────────────────────
  // Note: GET /api/events and GET /api/hackathons are intentionally NOT listed
  // here because they serve public data to unauthenticated users. Mutating
  // operations (POST, PUT, PATCH, DELETE) are protected directly in the route
  // handlers via withAuthPermission. The entries below cover sub-resources that
  // are always fully protected regardless of method.
  "/api/hackathons/*":                     { resource: "event" },
  "/api/events/*/judges":                  { resource: "judge" },
  "/api/events/*/judges/*":                { resource: "judge" },

  // ── API – evaluate (judge scoring; all methods require judge:read or higher) ──
  "/api/evaluate":                         { resource: "judge" },
  "/api/evaluate/*":                       { resource: "judge" },

  // ── API – speakers ────────────────────────────────────────────────────────
  "/api/speakers":                         { resource: "speaker" },
  "/api/speakers/*":                       { resource: "speaker" },

  // ── API – resources ───────────────────────────────────────────────────────
  "/api/resources":                        { resource: "resource" },
  "/api/resources/*":                      { resource: "resource" },

  // ── API – notifications ───────────────────────────────────────────────────
  "/api/notifications/create":             { resource: "notification" },

  // ── API – badges ──────────────────────────────────────────────────────────
  "/api/badge":                            { resource: "badge" },
  "/api/badge/*":                          { resource: "badge" },

  // ── API – showcase / projects ─────────────────────────────────────────────
  "/api/showcase":                         { resource: "showcase" },
  "/api/showcase/*":                       { resource: "showcase" },
  "/api/projects/export":                  { resource: "showcase", action: "export" },

  // ── API – judge ───────────────────────────────────────────────────────────
  "/api/judge":                            { resource: "judge" },
  "/api/judge/*":                          { resource: "judge" },

  // ── API – admin (user management) ────────────────────────────────────────
  "/api/admin":                            { resource: "user" },
  "/api/admin/*":                          { resource: "user" },

  // ── API – auth-only ───────────────────────────────────────────────────────
  "/api/profile":                          { authOnly: true },
  "/api/profile/*":                        { authOnly: true },
  "/api/projects/member":                  { authOnly: true },
  "/api/projects/member/*":               { authOnly: true },
  "/api/users/search":                     { authOnly: true },
  "/api/glacier-jwt":                      { authOnly: true },
  "/api/validator-alerts":                 { authOnly: true },
  "/api/validator-alerts/*":              { authOnly: true },
  "/api/faucet-rate-limit":               { authOnly: true },
  "/console/utilities/data-api-keys":      { authOnly: true },
} as const;

// ---------------------------------------------------------------------------
// matchRoute
// ---------------------------------------------------------------------------

/**
 * Finds the most specific matching RouteConfig for a given pathname.
 *
 * Resolution order (most specific wins):
 *  1. Exact match
 *  2. Wildcard patterns — longest pattern first (more specific wins)
 *
 * Wildcard "*" matches exactly one path segment (any character except "/").
 * It is non-greedy and does NOT cross segment boundaries, so:
 *   "/api/hackathons/*" matches "/api/hackathons/123"
 *                   but NOT "/api/hackathons/123/sub"
 *
 * For multi-segment wildcards, add a dedicated entry (e.g. "/**").
 * Returns null for public routes.
 */
export function matchRoute(pathname: string): RouteConfig | null {
  // 1. Exact match
  if (ROUTE_MANIFEST[pathname]) return ROUTE_MANIFEST[pathname];

  // 2. Wildcard patterns — sort by length descending so the most specific wins
  const wildcardEntries = Object.entries(ROUTE_MANIFEST)
    .filter(([pattern]) => pattern.includes("*"))
    .sort(([a], [b]) => b.length - a.length);

  for (const [pattern, config] of wildcardEntries) {
    // Convert each "*" to match one or more non-slash characters
    const regex = new RegExp(
      "^" + pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[^/]+") + "$",
    );
    if (regex.test(pathname)) return config;
  }

  return null;
}
