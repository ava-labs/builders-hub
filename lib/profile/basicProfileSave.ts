import { hasCompleteBasicProfile, type BasicProfileShape } from './socialAccountValidation';

/**
 * Save flow for the "Help us know you better" basic profile modal.
 *
 * Extracted from the component so the failure paths are unit-testable: the
 * modal used to swallow every save error (console.error only), which meant a
 * failed PUT — most commonly a 403 from saving against a provisional
 * `pending_*` user id before the session materializes — looked identical to
 * success. Nothing reached the database, and the modal came back on every new
 * device or session (#4388).
 */

export interface SaveBasicProfileDeps {
  /** The user id the modal was opened with (may still be a `pending_*` id). */
  userId: string;
  /** Refreshes the auth session and resolves with the latest session object. */
  refreshSession: () => Promise<{ user?: { id?: string | null } } | null | undefined>;
  /** PUTs the profile payload and resolves with the server's updated profile. */
  putProfile: (userId: string, payload: unknown) => Promise<BasicProfileShape | null | undefined>;
}

export type SaveBasicProfileOutcome =
  | { ok: true }
  | {
      ok: false;
      reason: 'session-not-ready' | 'request-failed' | 'incomplete-after-save';
      message: string;
    };

const isPendingId = (id: string | null | undefined): boolean =>
  typeof id === 'string' && id.startsWith('pending_');

/**
 * Resolves the real user id to save against. A `pending_*` id is doomed to a
 * 403 (the extended-profile route only accepts the session's own id), so we
 * refresh the session first and only proceed with a materialized id.
 */
export async function resolveProfileUserId(
  userId: string,
  refreshSession: SaveBasicProfileDeps['refreshSession'],
): Promise<string | null> {
  if (!isPendingId(userId)) return userId;
  try {
    const session = await refreshSession();
    const refreshedId = session?.user?.id;
    if (refreshedId && !isPendingId(refreshedId)) return refreshedId;
  } catch {
    // fall through — treated as "session not ready"
  }
  return null;
}

export async function saveBasicProfile(
  deps: SaveBasicProfileDeps,
  payload: unknown,
): Promise<SaveBasicProfileOutcome> {
  const targetId = await resolveProfileUserId(deps.userId, deps.refreshSession);
  if (!targetId) {
    return {
      ok: false,
      reason: 'session-not-ready',
      message: "Your session isn't ready yet. Please try saving again in a moment.",
    };
  }

  let updated: BasicProfileShape | null | undefined;
  try {
    updated = await deps.putProfile(targetId, payload);
  } catch (error) {
    return {
      ok: false,
      reason: 'request-failed',
      message: extractServerErrorMessage(error) ?? "Couldn't save your profile. Please try again.",
    };
  }

  // Close only when the server-confirmed profile passes the same completeness
  // check that decides whether to reopen the modal — otherwise it would
  // silently come back on the next mount.
  if (!hasCompleteBasicProfile(updated)) {
    return {
      ok: false,
      reason: 'incomplete-after-save',
      message: 'Your profile was saved but looks incomplete. Please review the required fields and save again.',
    };
  }

  return { ok: true };
}

/** Pulls the API's `{ error: string }` body out of an axios-style error. */
function extractServerErrorMessage(error: unknown): string | null {
  if (typeof error !== 'object' || error === null) return null;
  const response = (error as { response?: { data?: { error?: unknown } } }).response;
  const message = response?.data?.error;
  return typeof message === 'string' && message.length > 0 ? message : null;
}
