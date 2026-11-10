import { getAuthCallbackUrl } from '@/lib/auth/callback-url';
import { isProtectedPath } from '@/lib/auth/protected-paths';

const GATED_PATHS = [
  '/events/registration-form',
  '/events/project-submission',
  '/hackathons/registration-form',
  '/hackathons/project-submission',
];

// Event and hackathon ids are UUIDs or slugs. Anything else, such as
// '..//evil.example', would change the path that is built from it.
const EVENT_ID = /^[A-Za-z0-9_-]+$/;

// Resolve an event-context target from a URL: a gated registration/submission
// page maps to its public event page (with ref); an event/hackathon page is
// kept as-is. Returns null when there's no event context.
export function eventDismissTarget(rawUrl: string | null | undefined, origin: string): string | null {
  if (!rawUrl) return null;
  try {
    const url = new URL(rawUrl, origin);
    const path = url.pathname;
    const ref = url.searchParams.get('ref');
    if (GATED_PATHS.some((p) => path.startsWith(p))) {
      const eventId = url.searchParams.get('event') ?? url.searchParams.get('hackathon');
      if (!eventId || !EVENT_ID.test(eventId)) return null;
      const target = new URL(`/events/${eventId}`, origin);
      if (ref) target.searchParams.set('ref', ref);
      return `${target.pathname}${target.search}`;
    }
    if (/^\/(events|hackathons)(\/|$)/.test(path)) {
      return `${path}${url.search}`;
    }
  } catch {
    // ignore malformed URLs
  }
  return null;
}

function pathOf(rawUrl: string | null, origin: string): string {
  if (!rawUrl) return '/';
  try {
    return new URL(rawUrl, origin).pathname;
  } catch {
    return '/';
  }
}

// On dismiss without signing in, keep the user in the event context (their
// current page, or the event behind a gated form). A page that needs sign-in
// has nothing to show without it, so it sends the user home. On any other
// page the modal opened over something the user can keep using, so the
// result is null: close the modal and stay.
// A target goes to router.push, so it must stay on this origin:
// getAuthCallbackUrl turns anything else into '/'.
export function resolveDismissTarget(callbackUrl: string, currentUrl: string | null, origin: string): string | null {
  const event = eventDismissTarget(callbackUrl, origin) ?? eventDismissTarget(currentUrl, origin);
  if (event) return getAuthCallbackUrl(event, undefined, origin);
  return isProtectedPath(pathOf(currentUrl, origin)) ? '/' : null;
}
