/**
 * Single source of truth for paths that require authentication.
 *
 * Two pieces of the app gate access against this list:
 *  - `proxy.ts` (middleware): when an unauthenticated request hits one of
 *    these paths, the middleware sets `x-auth-required: true` and lets the
 *    request continue so the page can render a placeholder.
 *  - `AutoLoginModalTrigger` (client): on these paths, when the session is
 *    `unauthenticated`, the login modal is opened automatically.
 *
 * Both pieces must agree on the list — otherwise the modal opens without a
 * placeholder (or vice versa). Adding a new protected route is a one-line
 * change here.
 */
export const PROTECTED_PATHS = [
  "/hackathons/registration-form",
  "/hackathons/project-submission",
  "/events/registration-form",
  "/events/project-submission",
  "/events/edit",
  "/showcase",
  "/send-notifications",
  "/profile",
  "/student-launchpad",
  "/grants/",
  "/console/utilities/data-api-keys",
  "/build-games/apply",
  "/academy/team1",
] as const;

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PATHS.some((p) => pathname.startsWith(p));
}
