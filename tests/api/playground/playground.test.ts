import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// vi.hoisted runs in the hoisted context alongside vi.mock
const { mockPrisma } = vi.hoisted(() => {
  // Inline minimal mock factory (cannot import from non-hoisted modules)
  const METHODS = [
    'findFirst', 'findMany', 'findUnique', 'create', 'createMany',
    'update', 'updateMany', 'delete', 'deleteMany', 'upsert', 'count',
    'aggregate', 'groupBy',
  ] as const;

  type MockModel = { [K in (typeof METHODS)[number]]: ReturnType<typeof vi.fn> };

  function createModel(): MockModel {
    const m = {} as MockModel;
    for (const method of METHODS) m[method] = vi.fn();
    return m;
  }

  const cache = new Map<string, MockModel>();
  const proxy = new Proxy({} as Record<string, any>, {
    get(_t, prop: string) {
      if (prop === '$transaction') return vi.fn(async (arg: unknown) => typeof arg === 'function' ? arg(proxy) : Array.isArray(arg) ? Promise.all(arg) : arg);
      if (prop === 'then' || prop === 'toJSON' || typeof prop === 'symbol') return undefined;
      if (!cache.has(prop)) cache.set(prop, createModel());
      return cache.get(prop)!;
    },
  });

  return { mockPrisma: proxy };
});

// Module-level mocks (hoisted by vitest)
vi.mock('@/prisma/prisma', () => ({ prisma: mockPrisma }));
vi.mock('@/lib/auth/authSession');

import {
  createMockRequest,
  callHandler,
  expectSuccess,
  expectError,
} from '@/tests/api/helpers/api-test-utils';
import {
  createMockSession,
  mockAuthSession,
  resetAuthMocks,
} from '@/tests/api/helpers/mock-session';

// Dynamic import so mocks are in place before the route module loads
const routeModule = () => import('@/app/api/playground/route');
const favoriteModule = () => import('@/app/api/playground/favorite/route');

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const session = createMockSession({ email: 'dev@example.com' });

const PG_ID = '00000000-0000-4000-8000-000000000001';

const PLAYGROUND = {
  id: PG_ID,
  user_id: 'test-user-id',
  name: 'My Dashboard',
  is_public: false,
  charts: { globalStartTime: null, globalEndTime: null, charts: [] },
  view_count: 5,
  created_at: new Date(),
  updated_at: new Date(),
  favorites: [],
  _count: { favorites: 2 },
  user: {
    id: 'test-user-id',
    name: 'Test User',
    user_name: 'testuser',
    image: null,
    profile_privacy: 'public',
  },
};

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

beforeEach(() => vi.clearAllMocks());
afterEach(() => resetAuthMocks());

// ---------------------------------------------------------------------------
// GET /api/playground
// ---------------------------------------------------------------------------

describe('GET /api/playground', () => {
  beforeEach(() => mockAuthSession(session));

  it('returns a single playground by id', async () => {
    const { GET } = await routeModule();
    mockPrisma.statsPlayground.findFirst.mockResolvedValue(PLAYGROUND);

    const req = createMockRequest('GET', {
      url: 'http://localhost:3000/api/playground',
      searchParams: { id: PG_ID },
    });

    const result = await callHandler(GET, req);
    const data = expectSuccess(result);
    expect(data.name).toBe('My Dashboard');
    expect(data.is_owner).toBe(true);
    expect(data.favorite_count).toBe(2);
    expect(data.view_count).toBe(5);
  });

  it('returns 404 when playground not found', async () => {
    const { GET } = await routeModule();
    mockPrisma.statsPlayground.findFirst.mockResolvedValue(null);

    const req = createMockRequest('GET', {
      url: 'http://localhost:3000/api/playground',
      searchParams: { id: '00000000-0000-4000-8000-000000000099' },
    });

    const result = await callHandler(GET, req);
    expectError(result, 404, 'NOT_FOUND');
  });

  it('returns user playgrounds list when authenticated', async () => {
    const { GET } = await routeModule();
    mockPrisma.statsPlayground.findMany.mockResolvedValue([
      { ...PLAYGROUND, _count: { favorites: 0 } },
    ]);

    const req = createMockRequest('GET', {
      url: 'http://localhost:3000/api/playground',
    });

    const result = await callHandler(GET, req);
    const data = expectSuccess(result);
    expect(Array.isArray(data)).toBe(true);
    expect(data[0].name).toBe('My Dashboard');
  });

  it('returns 401 when listing without auth', async () => {
    const { GET } = await routeModule();
    mockAuthSession(null);

    const req = createMockRequest('GET', {
      url: 'http://localhost:3000/api/playground',
    });

    const result = await callHandler(GET, req);
    // Route throws AuthError (401) when no session and no playground id
    expectError(result, 401, 'AUTH_REQUIRED');
  });
});

// ---------------------------------------------------------------------------
// POST /api/playground
// ---------------------------------------------------------------------------

describe('POST /api/playground', () => {
  beforeEach(() => mockAuthSession(session));

  it('creates a new playground', async () => {
    const { POST } = await routeModule();
    const created = { id: '00000000-0000-4000-8000-000000000002', user_id: 'test-user-id', name: 'New Dashboard' };
    mockPrisma.statsPlayground.create.mockResolvedValue(created);

    const req = createMockRequest('POST', {
      url: 'http://localhost:3000/api/playground',
      body: { name: 'New Dashboard', isPublic: true, charts: [] },
    });

    const result = await callHandler(POST, req);
    const data = expectSuccess(result, 201);
    expect(data.name).toBe('New Dashboard');
  });

  it('rejects when name is missing', async () => {
    const { POST } = await routeModule();

    const req = createMockRequest('POST', {
      url: 'http://localhost:3000/api/playground',
      body: { isPublic: false },
    });

    const result = await callHandler(POST, req);
    expectError(result, 400, 'VALIDATION_ERROR');
  });

  it('rejects unauthenticated requests', async () => {
    const { POST } = await routeModule();
    mockAuthSession(null);

    const req = createMockRequest('POST', {
      url: 'http://localhost:3000/api/playground',
      body: { name: 'test' },
    });

    const result = await callHandler(POST, req);
    expectError(result, 401, 'AUTH_REQUIRED');
  });
});

// ---------------------------------------------------------------------------
// PUT /api/playground  -- ownership check via assertOwnership
// ---------------------------------------------------------------------------

describe('PUT /api/playground', () => {
  beforeEach(() => mockAuthSession(session));

  it('updates an owned playground', async () => {
    const { PUT } = await routeModule();
    mockPrisma.statsPlayground.findFirst.mockResolvedValue(PLAYGROUND);
    mockPrisma.statsPlayground.update.mockResolvedValue({
      ...PLAYGROUND,
      name: 'Renamed',
    });

    const req = createMockRequest('PUT', {
      url: 'http://localhost:3000/api/playground',
      body: { id: PG_ID, name: 'Renamed' },
    });

    const result = await callHandler(PUT, req);
    const data = expectSuccess(result);
    expect(data.name).toBe('Renamed');
  });

  it('returns 404 when not owner (assertOwnership)', async () => {
    const { PUT } = await routeModule();
    mockPrisma.statsPlayground.findFirst.mockResolvedValue(null);

    const req = createMockRequest('PUT', {
      url: 'http://localhost:3000/api/playground',
      body: { id: PG_ID, name: 'Stolen' },
    });

    const result = await callHandler(PUT, req);
    expectError(result, 404, 'NOT_FOUND');
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/playground  -- ownership check via assertOwnership
// ---------------------------------------------------------------------------

describe('DELETE /api/playground', () => {
  beforeEach(() => mockAuthSession(session));

  it('deletes an owned playground', async () => {
    const { DELETE } = await routeModule();
    mockPrisma.statsPlayground.findFirst.mockResolvedValue(PLAYGROUND);
    mockPrisma.statsPlayground.delete.mockResolvedValue(PLAYGROUND);

    const req = createMockRequest('DELETE', {
      url: 'http://localhost:3000/api/playground',
      searchParams: { id: PG_ID },
    });

    const result = await callHandler(DELETE, req);
    // Route returns 204 No Content (noContentResponse)
    expect(result.status).toBe(204);
  });

  it('returns 400 when id is missing', async () => {
    const { DELETE } = await routeModule();

    const req = createMockRequest('DELETE', {
      url: 'http://localhost:3000/api/playground',
    });

    const result = await callHandler(DELETE, req);
    expectError(result, 400, 'BAD_REQUEST');
  });

  it('returns 404 when not owner (assertOwnership)', async () => {
    const { DELETE } = await routeModule();
    mockPrisma.statsPlayground.findFirst.mockResolvedValue(null);

    const req = createMockRequest('DELETE', {
      url: 'http://localhost:3000/api/playground',
      searchParams: { id: PG_ID },
    });

    const result = await callHandler(DELETE, req);
    expectError(result, 404, 'NOT_FOUND');
  });
});

// ---------------------------------------------------------------------------
// POST /api/playground/favorite
// ---------------------------------------------------------------------------

describe('POST /api/playground/favorite', () => {
  beforeEach(() => mockAuthSession(session));

  it('favorites a playground', async () => {
    const { POST } = await favoriteModule();
    mockPrisma.statsPlayground.findFirst.mockResolvedValue(PLAYGROUND);
    mockPrisma.statsPlaygroundFavorite.findUnique.mockResolvedValue(null);
    mockPrisma.statsPlaygroundFavorite.create.mockResolvedValue({});
    mockPrisma.statsPlaygroundFavorite.count.mockResolvedValue(3);

    const req = createMockRequest('POST', {
      url: 'http://localhost:3000/api/playground/favorite',
      body: { playgroundId: PG_ID },
    });

    const result = await callHandler(POST, req);
    // Route returns 201 for newly created favorites
    const data = expectSuccess(result, 201);
    expect(data.favorite_count).toBe(3);
  });

  it('returns 409 when already favorited', async () => {
    const { POST } = await favoriteModule();
    mockPrisma.statsPlayground.findFirst.mockResolvedValue(PLAYGROUND);
    mockPrisma.statsPlaygroundFavorite.findUnique.mockResolvedValue({ id: 'fav-1' });

    const req = createMockRequest('POST', {
      url: 'http://localhost:3000/api/playground/favorite',
      body: { playgroundId: PG_ID },
    });

    const result = await callHandler(POST, req);
    expectError(result, 409, 'CONFLICT');
  });

  it('returns 404 when playground not found', async () => {
    const { POST } = await favoriteModule();
    mockPrisma.statsPlayground.findFirst.mockResolvedValue(null);

    const req = createMockRequest('POST', {
      url: 'http://localhost:3000/api/playground/favorite',
      body: { playgroundId: '00000000-0000-4000-8000-000000000099' },
    });

    const result = await callHandler(POST, req);
    expectError(result, 404, 'NOT_FOUND');
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/playground/favorite
// ---------------------------------------------------------------------------

describe('DELETE /api/playground/favorite', () => {
  beforeEach(() => mockAuthSession(session));

  it('unfavorites a playground', async () => {
    const { DELETE } = await favoriteModule();
    mockPrisma.statsPlaygroundFavorite.deleteMany.mockResolvedValue({ count: 1 });
    mockPrisma.statsPlaygroundFavorite.count.mockResolvedValue(1);

    const req = createMockRequest('DELETE', {
      url: 'http://localhost:3000/api/playground/favorite',
      searchParams: { playgroundId: PG_ID },
    });

    const result = await callHandler(DELETE, req);
    const data = expectSuccess(result);
    expect(data.favorite_count).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Security: ownership enforcement (user A cannot modify user B's playground)
// ---------------------------------------------------------------------------

describe('Security: ownership enforcement', () => {
  beforeEach(() => mockAuthSession(session));

  it('user A cannot update user B playground via PUT (assertOwnership)', async () => {
    const { PUT } = await routeModule();
    // findFirst returns null because user_id does not match
    mockPrisma.statsPlayground.findFirst.mockResolvedValue(null);

    const req = createMockRequest('PUT', {
      url: 'http://localhost:3000/api/playground',
      body: { id: '00000000-0000-4000-8000-000000000099', name: 'Stolen Name' },
    });

    const result = await callHandler(PUT, req);
    expectError(result, 404, 'NOT_FOUND');
    // update should never have been called
    expect(mockPrisma.statsPlayground.update).not.toHaveBeenCalled();
  });

  it('user A cannot delete user B playground via DELETE (assertOwnership)', async () => {
    const { DELETE } = await routeModule();
    // findFirst returns null because user_id does not match
    mockPrisma.statsPlayground.findFirst.mockResolvedValue(null);

    const req = createMockRequest('DELETE', {
      url: 'http://localhost:3000/api/playground',
      searchParams: { id: '00000000-0000-4000-8000-000000000099' },
    });

    const result = await callHandler(DELETE, req);
    expectError(result, 404, 'NOT_FOUND');
    // delete should never have been called
    expect(mockPrisma.statsPlayground.delete).not.toHaveBeenCalled();
  });
});
