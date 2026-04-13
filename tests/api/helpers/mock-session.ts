/**
 * Mock NextAuth session helpers for API route tests.
 *
 * Usage pattern — in each test file:
 *
 * ```ts
 * import { vi, beforeEach, afterEach } from 'vitest';
 * import { getAuthSession } from '@/lib/auth/authSession';
 * import { createMockSession, mockAuthSession, resetAuthMocks } from '@/tests/api/helpers/mock-session';
 *
 * // Module-level mock declaration (hoisted by vitest)
 * vi.mock('@/lib/auth/authSession');
 *
 * describe('my route', () => {
 *   const session = createMockSession({ email: 'dev@example.com' });
 *
 *   beforeEach(() => {
 *     mockAuthSession(session);
 *   });
 *
 *   afterEach(() => {
 *     resetAuthMocks();
 *   });
 * });
 * ```
 *
 * IMPORTANT: The `vi.mock('@/lib/auth/authSession')` call MUST be at the
 * module level in the test file. Vitest hoists it above all imports, which
 * means `getAuthSession` is already replaced by a vi.fn() by the time your
 * handler runs. The helpers here configure the return value per-test.
 */

import { vi } from 'vitest';
import { getAuthSession } from '@/lib/auth/authSession';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Fields available on the mocked user object.
 * Aligns with the augmented next-auth Session['user'] declared in
 * `@/lib/auth/authOptions.ts`.
 */
export interface MockUser {
  id: string;
  email: string;
  name: string;
  image?: string;
  avatar?: string;
  custom_attributes: string[];
  role?: string;
  user_name?: string;
  is_new_user: boolean;
  authentication_mode?: string;
}

/** The full session shape returned by getAuthSession. */
export interface MockSession {
  user: MockUser;
  expires: string;
}

// ---------------------------------------------------------------------------
// Session factories
// ---------------------------------------------------------------------------

/**
 * Create a mock session with sensible defaults.
 * Override any user field via `overrides`.
 *
 * @example
 * ```ts
 * const session = createMockSession({ email: 'dev@example.com' });
 * ```
 */
export function createMockSession(overrides?: Partial<MockUser>): MockSession {
  return {
    user: {
      id: 'test-user-id',
      email: 'test@example.com',
      name: 'Test User',
      custom_attributes: [],
      is_new_user: false,
      ...overrides,
    },
    expires: new Date(Date.now() + 86_400_000).toISOString(),
  };
}

/**
 * Create an admin session (has 'devrel' role in custom_attributes).
 * Override any user field via `overrides`.
 *
 * @example
 * ```ts
 * const admin = createAdminSession();
 * ```
 */
export function createAdminSession(overrides?: Partial<MockUser>): MockSession {
  return createMockSession({
    id: 'admin-user-id',
    email: 'admin@avalabs.org',
    name: 'Admin User',
    custom_attributes: ['devrel'],
    ...overrides,
  });
}

// ---------------------------------------------------------------------------
// Mock configuration
// ---------------------------------------------------------------------------

/**
 * Configure the mocked `getAuthSession` to resolve with the given session.
 *
 * Call this in `beforeEach` (or at the top of an individual test) after
 * declaring `vi.mock('@/lib/auth/authSession')` at module level.
 *
 * Pass `null` to simulate an unauthenticated request.
 *
 * @returns The mock function, so you can add further assertions
 *          (e.g. `expect(mock).toHaveBeenCalledTimes(1)`).
 *
 * @example
 * ```ts
 * mockAuthSession(session);        // authenticated
 * mockAuthSession(null);           // unauthenticated
 * ```
 */
export function mockAuthSession(session: MockSession | null): ReturnType<typeof vi.fn> {
  const mocked = vi.mocked(getAuthSession);
  mocked.mockResolvedValue(session);
  return mocked;
}

/**
 * Reset all auth mocks. Call in `afterEach` to prevent state leakage.
 */
export function resetAuthMocks(): void {
  vi.restoreAllMocks();
}
