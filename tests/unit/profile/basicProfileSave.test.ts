import { describe, expect, it, vi } from 'vitest';

import { resolveProfileUserId, saveBasicProfile } from '@/lib/profile/basicProfileSave';

const COMPLETE_PROFILE = {
  name: 'Test User',
  country: 'Turkey',
  user_type: { is_developer: true },
};

const completePayload = { name: 'Test User', country: 'Turkey', user_type: { is_developer: true } };

describe('resolveProfileUserId', () => {
  it('returns a materialized id untouched without refreshing the session', async () => {
    const refreshSession = vi.fn();
    expect(await resolveProfileUserId('user-1', refreshSession)).toBe('user-1');
    expect(refreshSession).not.toHaveBeenCalled();
  });

  it('swaps a pending id for the refreshed session id', async () => {
    const refreshSession = vi.fn().mockResolvedValue({ user: { id: 'user-real' } });
    expect(await resolveProfileUserId('pending_abc', refreshSession)).toBe('user-real');
  });

  it('returns null when the session stays pending', async () => {
    const refreshSession = vi.fn().mockResolvedValue({ user: { id: 'pending_abc' } });
    expect(await resolveProfileUserId('pending_abc', refreshSession)).toBeNull();
  });

  it('returns null when the session refresh throws', async () => {
    const refreshSession = vi.fn().mockRejectedValue(new Error('network'));
    expect(await resolveProfileUserId('pending_abc', refreshSession)).toBeNull();
  });
});

describe('saveBasicProfile', () => {
  it('saves against the resolved id and confirms completeness (the #4388 repro, fixed)', async () => {
    // Repro from the issue: modal opened with a pending_* id. The old code
    // PUT against it, got a 403, and swallowed it — the user saw nothing and
    // the profile never persisted. The fix resolves the real id first.
    const putProfile = vi.fn().mockResolvedValue(COMPLETE_PROFILE);
    const outcome = await saveBasicProfile(
      {
        userId: 'pending_abc',
        refreshSession: vi.fn().mockResolvedValue({ user: { id: 'user-real' } }),
        putProfile,
      },
      completePayload,
    );
    expect(outcome).toEqual({ ok: true });
    expect(putProfile).toHaveBeenCalledWith('user-real', completePayload);
  });

  it('reports session-not-ready instead of PUTting a doomed pending id', async () => {
    const putProfile = vi.fn();
    const outcome = await saveBasicProfile(
      {
        userId: 'pending_abc',
        refreshSession: vi.fn().mockResolvedValue({ user: { id: 'pending_abc' } }),
        putProfile,
      },
      completePayload,
    );
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.reason).toBe('session-not-ready');
    expect(putProfile).not.toHaveBeenCalled();
  });

  it('surfaces the server error body when the PUT fails', async () => {
    const axios403 = Object.assign(new Error('Request failed with status code 403'), {
      response: { data: { error: 'Forbidden: You can only update your own profile.' } },
    });
    const outcome = await saveBasicProfile(
      {
        userId: 'user-real',
        refreshSession: vi.fn(),
        putProfile: vi.fn().mockRejectedValue(axios403),
      },
      completePayload,
    );
    expect(outcome).toEqual({
      ok: false,
      reason: 'request-failed',
      message: 'Forbidden: You can only update your own profile.',
    });
  });

  it('falls back to a generic message when the failure has no server body', async () => {
    const outcome = await saveBasicProfile(
      {
        userId: 'user-real',
        refreshSession: vi.fn(),
        putProfile: vi.fn().mockRejectedValue(new Error('Network Error')),
      },
      completePayload,
    );
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.reason).toBe('request-failed');
      expect(outcome.message).toBe("Couldn't save your profile. Please try again.");
    }
  });

  it('refuses to report success when the stored profile would reopen the modal', async () => {
    const outcome = await saveBasicProfile(
      {
        userId: 'user-real',
        refreshSession: vi.fn(),
        // Server answered 200 but the stored row lacks a role flag — the
        // reopen check would bring the modal back on the next mount.
        putProfile: vi.fn().mockResolvedValue({ name: 'Test User', country: 'Turkey', user_type: {} }),
      },
      completePayload,
    );
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.reason).toBe('incomplete-after-save');
  });
});
