/**
 * Paths on which the login modal opens automatically for anonymous visitors
 * (AutoLoginModalTrigger / LoginModalWrapper, client side).
 *
 * This list does NOT enforce anything. Enforcement is ROUTE_MANIFEST in
 * routeManifest.ts (middleware) plus the page/handler check. Every path here
 * must also be gated by the manifest — otherwise the modal opens over a page
 * that is served in full — and every authOnly UI entry in the manifest should
 * be here, or the visitor is let through with no explanation. Unit-tested in
 * tests/unit/auth/permissionScope.test.ts.
 *
 * No "/hackathons/*" entries: next.config redirects them to /events/* before
 * the page renders.
 */
export const PROTECTED_PATHS = [
  "/events/registration-form",
  "/events/project-submission",
  "/events/edit",
  "/showcase",
  "/send-notifications",
  "/profile",
  "/student-launchpad",
  "/grants/retro9000",
  // "/grants/avalanche-research-proposals": applications are closed, the page is read-only
  "/grants/team1-mini-grants/apply",
  "/console/utilities/data-api-keys",
  "/build-games/apply",
  "/academy/team1",
  "/audits/new",
  "/audits/admin",
] as const;

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
}
