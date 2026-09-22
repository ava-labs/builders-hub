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
 *   Both "/api/speakers" and "/api/speakers/*" are declared explicitly
 *   so that the base path without a trailing segment is also protected.
 *   matchRoute() always tests an exact match before wildcard patterns.
 *
 * ---------------------------------------------------------------------------
 * Adding a protected page or route — where does the check go?
 * ---------------------------------------------------------------------------
 * DEFAULT: here, and only here. One line:
 *     "/my-admin-page": { resource: "platform", action: "admin" },
 *
 * This manifest is evaluated at the Edge with NO database access, so add a
 * SECOND check in the page/handler only when the decision needs something the
 * Edge cannot see:
 *
 *   1. The page reads the DB itself. A server component that queries Prisma is
 *      an API endpoint in disguise — nothing behind it carries a guard. (See
 *      app/(home)/evaluate/page.tsx, which loads submissions and applicant PII.)
 *      A page that is only a shell around guarded API routes does NOT need one.
 *   2. Per-object scoping — "may they edit THIS event". Declare scope: "own"
 *      here so the gate stays permissive, then call the matching policy helper
 *      (canEditEvent, canManageHackathonJudges, …) in the page/handler.
 *   3. The decision depends on the payload rather than the path — e.g.
 *      /api/generate-certificate gating on courseId.startsWith("team1-").
 *   4. Revocation must take effect immediately: getToken() here only decrypts
 *      the cookie, so a revoked role survives until the cookie refreshes.
 *      getAuthSession() in a page/handler re-reads UserRole every call.
 *
 * NEVER page-only. That skips the Edge gate, leaves the route invisible in this
 * manifest, and — the real hole — a sibling route added under the same prefix
 * later inherits no protection at all.
 *
 * When a page does carry its own check, it must REDIRECT on failure, not render
 * an "access denied" message: this manifest already redirects at the Edge, so a
 * rendered message would be unreachable and the two layers would disagree.
 *
 * To protect a new route: add one line here. Nothing else changes.
 */

import { Action, Resource, Scope, pathMatchesPattern } from "./rolePermissions";

export interface RouteConfig {
  resource?: Resource;
  action?: Action;
  /**
   * Declares this Edge gate as deliberately permissive for scoped grants.
   *
   * The middleware has no DB access, so it can never decide "is this the
   * caller's own event?". Setting scope: "own" makes the gate ask the scoped
   * question, which lets a scope:"own" role holder through to the handler —
   * where a policy helper (canEditEvent, canManageHackathonJudges, …) does the
   * ownership check for real. Without it, a scoped role would be 403'd at the
   * Edge even on its own objects.
   *
   * An entry carrying `scope` is therefore a marker that the handler MUST
   * perform the scoped check; the manifest alone does not protect it.
   */
  scope?: Scope;
  /** Any authenticated user passes; no resource:action check. */
  authOnly?: boolean;
  /**
   * Deliberately NOT gated at the Edge — the handler authorizes by a mechanism
   * the middleware cannot see (a cron secret, an API key, a signed URL token).
   *
   * Absence from this manifest already means "public", so this exists only to
   * carve a path OUT of a broader wildcard: exact entries beat wildcards in
   * matchRoute, so `{ public: true }` on a specific path overrides the gate its
   * prefix would otherwise apply. Never use it on a route that has no
   * authorization of its own.
   */
  public?: boolean;
}

export const ROUTE_MANIFEST: Record<string, RouteConfig> = {
  // ── UI – auth-only (any logged-in user) ─────────────────────────────────
  "/profile":                              { authOnly: true },
  "/profile/*":                            { authOnly: true },
  "/student-launchpad":                    { authOnly: true },
  "/student-launchpad/*":                  { authOnly: true },
  // Grant APPLICATION flows only. "/grants" and "/grants/*" would gate the
  // public landing page and the programme info pages; and "/grants/*" is
  // single-segment, so it never matched "/grants/team1-mini-grants/apply" —
  // the one path that was explicitly protected before. Listed explicitly.
  // "/grants/avalanche-research-proposals" is deliberately absent: applications
  // are closed and the page is read-only (see PROTECTED_PATHS).
  "/grants/retro9000":                     { authOnly: true },
  "/grants/team1-mini-grants/apply":       { authOnly: true },
  "/events/registration-form":             { authOnly: true },
  "/events/project-submission":            { authOnly: true },
  "/build-games/apply":                    { authOnly: true },
  "/audits/new":                           { authOnly: true },

  // ── UI + API – audit program admin ───────────────────────────────────────
  // audit:manage (audit_admin, platform admins). requireAuditAdmin() in
  // app/api/audits/utils.ts and the /audits/admin layout are the second layer.
  "/audits/admin":                         { resource: "audit" },
  "/audits/admin/**":                      { resource: "audit" },
  "/api/audits/admin/**":                  { resource: "audit" },

  // ── UI – role-protected ───────────────────────────────────────────────────
  "/showcase":                             { resource: "showcase" },
  "/showcase/*":                           { resource: "showcase" },
  // action:"write", not the inferred read — notify_event holds only
  // notification:write and must reach this page.
  "/send-notifications":                   { resource: "notification", action: "write" },
  // event:write scope:"own" is the common "may manage events" gate: it admits
  // hackathon_creator (unscoped event:write) and team1_admin (event:manage
  // scope:"own"), while excluding read-only team1_event_admin. A bare
  // { resource: "event" } infers UNSCOPED event:read, which team1_admin — whose
  // only event grant is scoped — does not satisfy, locking it out of its own
  // editor. canEditEvent() remains the authoritative per-event check.
  // No "/hackathons/*" twins: next.config redirects them to /events/* before
  // middleware runs, so such entries can never match.
  "/events/edit":                          { resource: "event", action: "write", scope: "own" },
  "/events/edit/*":                        { resource: "event", action: "write", scope: "own" },
  "/events/new":                           { resource: "event", action: "write", scope: "own" },
  "/events/*/admin-panel":                 { resource: "event", action: "write", scope: "own" },
  "/events/*/admin-panel/judges":          { resource: "judge", action: "assign", scope: "own" },
  "/events/*/registrations":               { resource: "event", action: "read", scope: "own" },

  // Evaluation is granted by a HackathonJudge assignment row, not a role, so
  // the Edge can only establish authentication — same reasoning as
  // "/api/evaluate". evaluableHackathonIds() / canEvaluateHackathon() decide.
  "/evaluate":                             { authOnly: true },
  "/events/*/evaluate":                    { authOnly: true },

  // ── UI + API – Team1 Academy (gated area) ────────────────────────────────
  // Ordinary academy:team1 permission. The certificate entries are listed
  // explicitly because matchRoute sorts wildcards by LENGTH, so without them
  // "/academy/**/get-certificate" would out-rank "/academy/team1/**" and
  // downgrade Team1 certificate pages to authOnly.
  // The /api/raw/* twins gate the markdown API; proxy.ts additionally refuses
  // to REWRITE /academy/team1/* onto them, which no manifest entry can do.
  "/academy/team1":                         { resource: "academy:team1" },
  "/academy/team1/**":                      { resource: "academy:team1" },
  "/academy/team1/**/get-certificate":      { resource: "academy:team1" },
  "/academy/team1/**/certificate":          { resource: "academy:team1" },
  "/api/raw/academy/team1":                 { resource: "academy:team1" },
  "/api/raw/academy/team1/**":              { resource: "academy:team1" },

  // ── UI – academy certificates (auth-only) ────────────────────────────────
  // "**" (multi-segment): courses live at /academy/{category}/{course}/...
  "/academy/**/get-certificate":           { authOnly: true },
  "/academy/**/certificate":              { authOnly: true },

  // ── API – events ──────────────────────────────────────────────────────────
  // Note: GET /api/events and GET /api/events/[id] are intentionally NOT listed
  // here because they serve public data to unauthenticated users. Mutating
  // operations (POST, PUT, PATCH, DELETE) are protected directly in the route
  // handlers via withAuthPermission / canEditEvent. The entries below cover
  // sub-resources that are always fully protected regardless of method.
  // Judge assignment is reserved for devrel / team1_admin (judge:assign).
  // scope:"own" — team1_admin's grant is scoped, so the Edge gate must ask the
  // scoped question to let them reach their own events; both handlers then
  // enforce canManageHackathonJudges, which is the real check.
  "/api/events/*/judges":                  { resource: "judge", action: "assign", scope: "own" },
  "/api/events/*/judges/*":                { resource: "judge", action: "assign", scope: "own" },

  // ── API – evaluate ─────────────────────────────────────────────────────────
  // authOnly: per-hackathon judges are DB-assigned (HackathonJudge rows) and
  // may hold no global role, so the proxy can't permission-check them. The
  // route handlers enforce canEvaluateHackathon / canReviewMiniGrants.
  "/api/evaluate":                         { authOnly: true },
  "/api/evaluate/*":                       { authOnly: true },

  // ── API – speakers ────────────────────────────────────────────────────────
  "/api/speakers":                         { resource: "speaker" },
  "/api/speakers/*":                       { resource: "speaker" },

  // ── API – resources ───────────────────────────────────────────────────────
  "/api/resources":                        { resource: "resource" },
  "/api/resources/*":                      { resource: "resource" },

  // ── API – notifications ───────────────────────────────────────────────────
  "/api/notifications/create":             { resource: "notification" },

  // ── API – badges ──────────────────────────────────────────────────────────
  // authOnly, NOT { resource: "badge" }: earning and displaying an academy
  // badge is a self-service action for every learner (see badgeStrategy —
  // academy/requirement badges require no role). The handlers do the real
  // authorization: /assign is self-only unless the badge needs badge:manage,
  // /validate is self-only. Gating these on badge:read/badge:write here 403s
  // every quiz completion at the Edge before the handler runs.
  "/api/badge":                            { authOnly: true },
  "/api/badge/*":                          { authOnly: true },
  // The one genuinely admin badge path (exact match wins over the wildcard).
  "/api/badge/console-migrate":            { resource: "badge", action: "write" },

  // ── API – projects ────────────────────────────────────────────────────────
  "/api/projects/export":                  { resource: "showcase", action: "export" },

  // ── UI + API – admin (user management) ───────────────────────────────────
  // user:manage is devrel-only (wildcard). The wildcard entries mean a sibling
  // admin page or route added later inherits the gate instead of shipping open.
  "/admin":                                { resource: "user", action: "manage" },
  "/admin/**":                             { resource: "user", action: "manage" },
  "/api/admin":                            { resource: "user" },
  "/api/admin/*":                          { resource: "user" },

  // ── API – auth-only ───────────────────────────────────────────────────────
  "/api/profile":                          { authOnly: true },
  "/api/profile/*":                        { authOnly: true },
  "/api/projects/member":                  { authOnly: true },
  "/api/projects/member/*":                { authOnly: true },
  "/api/users/search":                     { authOnly: true },
  "/api/glacier-jwt":                      { authOnly: true },
  "/api/validator-alerts":                 { authOnly: true },
  // Carved out of the wildcard below: these authorize themselves and are called
  // WITHOUT a NextAuth session, so an authOnly gate 401s them at the Edge.
  //   /check       – Vercel cron (Bearer CRON_SECRET) or x-api-key
  //   /unsubscribe – signed token in the URL, followed from an email
  "/api/validator-alerts/check":           { public: true },
  "/api/validator-alerts/unsubscribe":     { public: true },
  "/api/validator-alerts/*":               { authOnly: true },
  "/api/faucet-rate-limit":                { authOnly: true },
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
 * A double-star wildcard matches one or more segments (crosses "/"), so the
 * academy certificate entries match
 * "/academy/avalanche-l1/avalanche-fundamentals/get-certificate".
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
    if (pathMatchesPattern(pattern, pathname)) return config;
  }

  return null;
}
