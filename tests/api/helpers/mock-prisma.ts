/**
 * Mock Prisma client for API route tests.
 *
 * Uses a Proxy-based approach so that any model property access
 * (e.g. `mockPrisma.user.findMany`) automatically returns a vitest mock
 * function. This avoids hard-coding every model from the schema.
 *
 * Usage pattern — in each test file:
 *
 * ```ts
 * import { vi, afterEach } from 'vitest';
 * import { setupPrismaMock, resetPrismaMock } from '@/tests/api/helpers/mock-prisma';
 *
 * // Module-level mock declaration (hoisted by vitest)
 * vi.mock('@/prisma/prisma');
 *
 * const mockPrisma = setupPrismaMock();
 *
 * afterEach(() => {
 *   resetPrismaMock(mockPrisma);
 * });
 *
 * it('fetches users', async () => {
 *   mockPrisma.user.findMany.mockResolvedValue([{ id: '1', name: 'Ada' }]);
 *   // ... call your handler
 * });
 * ```
 *
 * Models available (auto-proxied from schema):
 *   hackathon, user, verificationToken, registerForm, project, prize,
 *   member, badge, userBadge, projectBadge, nodeRegistration, consoleLog,
 *   statsPlayground, statsPlaygroundFavorite, faucetClaim, chatConversation,
 *   chatMessage, formData, evaluation, buildGamesApplication, oAuthCode,
 *   retro9000ReturningApplication, validatorAlert, validatorAlertLog
 */

import { vi } from 'vitest';
import { prisma } from '@/prisma/prisma';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Common Prisma client query methods that each model exposes. */
const PRISMA_METHODS = [
  'findFirst',
  'findMany',
  'findUnique',
  'create',
  'createMany',
  'update',
  'updateMany',
  'delete',
  'deleteMany',
  'upsert',
  'count',
  'aggregate',
  'groupBy',
] as const;

/** A single model's mocked interface — every method is a vi.fn(). */
export type MockModel = {
  [K in (typeof PRISMA_METHODS)[number]]: ReturnType<typeof vi.fn>;
};

/** The deeply-mocked Prisma client. Access any model as a property. */
export type MockPrismaClient = {
  [model: string]: MockModel;
} & {
  $transaction: ReturnType<typeof vi.fn>;
};

// ---------------------------------------------------------------------------
// Internal cache: one MockModel per model name (persisted across calls).
// ---------------------------------------------------------------------------

function createModelMock(): MockModel {
  const model = {} as MockModel;
  for (const method of PRISMA_METHODS) {
    model[method] = vi.fn();
  }
  return model;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Create a deeply-mocked Prisma client.
 *
 * Property access on the returned object is intercepted by a Proxy:
 * - Known Prisma methods on any model name return persistent `vi.fn()` stubs.
 * - `$transaction` accepts a callback and calls it with the mock client.
 *
 * @example
 * ```ts
 * const mock = createMockPrisma();
 * mock.user.findMany.mockResolvedValue([]);
 * mock.chatConversation.create.mockResolvedValue({ id: '1' });
 * ```
 */
export function createMockPrisma(): MockPrismaClient {
  const modelCache = new Map<string, MockModel>();

  const transactionFn = vi.fn(async (arg: unknown) => {
    if (typeof arg === 'function') {
      return arg(proxy);
    }
    // Array-of-promises mode: resolve all
    if (Array.isArray(arg)) {
      return Promise.all(arg);
    }
    return arg;
  });

  const proxy = new Proxy({} as MockPrismaClient, {
    get(_target, prop: string) {
      if (prop === '$transaction') {
        return transactionFn;
      }

      // Vitest / Node internals that should not trigger model creation
      if (
        prop === 'then' ||
        prop === 'toJSON' ||
        prop === 'asymmetricMatch' ||
        typeof prop === 'symbol'
      ) {
        return undefined;
      }

      if (!modelCache.has(prop)) {
        modelCache.set(prop, createModelMock());
      }
      return modelCache.get(prop)!;
    },
  });

  return proxy;
}

/**
 * Set up the Prisma mock and return the mock client.
 *
 * This configures `vi.mocked(prisma)` so that the default export of
 * `@/prisma/prisma` returns the mock client. The caller must have
 * `vi.mock('@/prisma/prisma')` at module level.
 *
 * @returns The mock Prisma client for configuring per-test return values.
 *
 * @example
 * ```ts
 * vi.mock('@/prisma/prisma');
 * const mockPrisma = setupPrismaMock();
 * ```
 */
export function setupPrismaMock(): MockPrismaClient {
  const mockClient = createMockPrisma();

  // vi.mocked(prisma) returns the module's `prisma` export as a mock.
  // We redirect every property access on it to our proxy.
  const mockedPrisma = vi.mocked(prisma);

  // Replace the mocked export with a proxy that delegates to mockClient.
  // Because vi.mock hoists and replaces the module, we can mutate the
  // mock's properties directly.
  return new Proxy(mockedPrisma as unknown as MockPrismaClient, {
    get(_target, prop: string) {
      return (mockClient as any)[prop];
    },
  });
}

/**
 * Reset all mocked Prisma method return values.
 * Call in `afterEach` to prevent state leakage between tests.
 *
 * @param mockPrisma - The mock client returned by `setupPrismaMock()`.
 */
export function resetPrismaMock(mockPrisma: MockPrismaClient): void {
  // Reset $transaction
  if (mockPrisma.$transaction && typeof mockPrisma.$transaction.mockReset === 'function') {
    mockPrisma.$transaction.mockReset();
  }

  // Iterate known method names on each accessed model.
  // The Proxy will create models on access, so we iterate the underlying
  // cache by accessing common model names. Instead, we rely on the fact
  // that vi.restoreAllMocks (called via resetAuthMocks or directly) will
  // clear the module-level mock, and we additionally reset every vi.fn()
  // we can reach.
  //
  // Since the proxy is transparent, calling resetPrismaMock just resets
  // whatever the consumer directly touched. We use vi.clearAllMocks()
  // as a safety net, then re-clear the $transaction mock.
  vi.clearAllMocks();
}
