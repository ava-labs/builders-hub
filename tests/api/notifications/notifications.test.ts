import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import {
  createMockRequest,
  callHandler,
  expectSuccess,
  expectError,
} from '@/tests/api/helpers/api-test-utils';
import { setupPrismaMock, resetPrismaMock } from '@/tests/api/helpers/mock-prisma';
import {
  createMockSession,
  createAdminSession,
  mockAuthSession,
  resetAuthMocks,
} from '@/tests/api/helpers/mock-session';

vi.mock('@/prisma/prisma');
vi.mock('@/lib/auth/authSession');

// Mock global fetch for upstream calls
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const mockPrisma = setupPrismaMock();

// Set env vars needed by notification routes
const originalEnv = { ...process.env };

beforeEach(() => {
  process.env.NEXT_PUBLIC_AVALANCHE_WORKERS_URL = 'https://workers.test.local';
  process.env.AVALANCHE_WORKERS_API_KEY = 'test-api-key';
});

afterEach(() => {
  resetPrismaMock(mockPrisma);
  resetAuthMocks();
  mockFetch.mockReset();
  process.env = { ...originalEnv };
});

// ---------------------------------------------------------------------------
// POST /api/notifications/create
// ---------------------------------------------------------------------------
describe('POST /api/notifications/create', () => {
  const adminSession = createAdminSession();

  beforeEach(() => {
    mockAuthSession(adminSession);
    // Rate limit: allow by default
    mockPrisma.apiRateLimitLog.count.mockResolvedValue(0);
    mockPrisma.apiRateLimitLog.create.mockResolvedValue({});
  });

  it('creates notifications when authenticated with correct role', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ created: 2 }),
    });

    const { POST } = await import('@/app/api/notifications/create/route');
    const req = createMockRequest('POST', {
      body: { notifications: [{ content: 'Hello' }, { content: 'World' }] },
      url: 'http://localhost:3000/api/notifications/create',
    });

    const result = await callHandler(POST, req);
    const data = expectSuccess(result);
    expect(data).toEqual({ created: 2 });
  });

  it('rejects unauthenticated requests', async () => {
    mockAuthSession(null);

    const { POST } = await import('@/app/api/notifications/create/route');
    const req = createMockRequest('POST', {
      body: { notifications: [{ content: 'test' }] },
      url: 'http://localhost:3000/api/notifications/create',
    });

    const result = await callHandler(POST, req);
    expectError(result, 401, 'AUTH_REQUIRED');
  });

  it('rejects users without devrel or notify_event role', async () => {
    const regularSession = createMockSession({ custom_attributes: [] });
    mockAuthSession(regularSession);

    const { POST } = await import('@/app/api/notifications/create/route');
    const req = createMockRequest('POST', {
      body: { notifications: [{ content: 'test' }] },
      url: 'http://localhost:3000/api/notifications/create',
    });

    const result = await callHandler(POST, req);
    expectError(result, 403, 'FORBIDDEN');
  });

  it('rejects empty notifications array', async () => {
    const { POST } = await import('@/app/api/notifications/create/route');
    const req = createMockRequest('POST', {
      body: { notifications: [] },
      url: 'http://localhost:3000/api/notifications/create',
    });

    const result = await callHandler(POST, req);
    expectError(result, 400, 'VALIDATION_ERROR');
  });

  it('rejects missing notifications field', async () => {
    const { POST } = await import('@/app/api/notifications/create/route');
    const req = createMockRequest('POST', {
      body: {},
      url: 'http://localhost:3000/api/notifications/create',
    });

    const result = await callHandler(POST, req);
    expectError(result, 400, 'VALIDATION_ERROR');
  });
});

// ---------------------------------------------------------------------------
// POST /api/notifications/get
// ---------------------------------------------------------------------------
describe('POST /api/notifications/get', () => {
  const session = createMockSession();

  beforeEach(() => {
    mockAuthSession(session);
    mockPrisma.apiRateLimitLog.count.mockResolvedValue(0);
    mockPrisma.apiRateLimitLog.create.mockResolvedValue({});
  });

  it('fetches notifications for authenticated user', async () => {
    const mockNotifications = [
      { id: '1', content: 'Notification 1', read: false },
      { id: '2', content: 'Notification 2', read: true },
    ];

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockNotifications,
    });

    const { POST } = await import('@/app/api/notifications/get/route');
    const req = createMockRequest('POST', {
      url: 'http://localhost:3000/api/notifications/get',
    });

    const result = await callHandler(POST, req);
    const data = expectSuccess(result);
    expect(data).toEqual(mockNotifications);
  });

  it('rejects unauthenticated requests', async () => {
    mockAuthSession(null);

    const { POST } = await import('@/app/api/notifications/get/route');
    const req = createMockRequest('POST', {
      url: 'http://localhost:3000/api/notifications/get',
    });

    const result = await callHandler(POST, req);
    expectError(result, 401, 'AUTH_REQUIRED');
  });

  it('returns empty data when upstream is unavailable (500)', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => 'Service unavailable',
    });

    const { POST } = await import('@/app/api/notifications/get/route');
    const req = createMockRequest('POST', {
      url: 'http://localhost:3000/api/notifications/get',
    });

    const result = await callHandler(POST, req);
    const data = expectSuccess(result);
    expect(data).toEqual({});
  });

  it('returns empty data on network error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network failure'));

    const { POST } = await import('@/app/api/notifications/get/route');
    const req = createMockRequest('POST', {
      url: 'http://localhost:3000/api/notifications/get',
    });

    const result = await callHandler(POST, req);
    const data = expectSuccess(result);
    expect(data).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// POST /api/notifications/read
// ---------------------------------------------------------------------------
describe('POST /api/notifications/read', () => {
  const session = createMockSession();

  beforeEach(() => {
    mockAuthSession(session);
    mockPrisma.apiRateLimitLog.count.mockResolvedValue(0);
    mockPrisma.apiRateLimitLog.create.mockResolvedValue({});
  });

  it('marks notifications as read', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ updated: 2 }),
    });

    const { POST } = await import('@/app/api/notifications/read/route');
    const req = createMockRequest('POST', {
      body: ['notif-1', 'notif-2'],
      url: 'http://localhost:3000/api/notifications/read',
    });

    const result = await callHandler(POST, req);
    const data = expectSuccess(result);
    expect(data).toEqual({ updated: 2 });
  });

  it('rejects unauthenticated requests', async () => {
    mockAuthSession(null);

    const { POST } = await import('@/app/api/notifications/read/route');
    const req = createMockRequest('POST', {
      body: ['notif-1'],
      url: 'http://localhost:3000/api/notifications/read',
    });

    const result = await callHandler(POST, req);
    expectError(result, 401, 'AUTH_REQUIRED');
  });
});
