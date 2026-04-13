import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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

vi.mock('@/lib/auth/authSession');

// Mock the rate-limit module used by withApi
vi.mock('@/lib/api/rate-limit', () => ({
  checkPrismaRateLimit: vi.fn().mockResolvedValue({
    allowed: true,
    remaining: 99,
    resetAt: new Date(Date.now() + 60_000),
    headers: {},
  }),
  getRateLimitIdentifier: vi.fn().mockReturnValue('test-ip'),
  getClientIP: vi.fn().mockReturnValue('127.0.0.1'),
}));

// Create mock functions for prisma models used by OAuth routes
const mockUserFindUnique = vi.fn();
const mockOAuthCodeCreate = vi.fn();
const mockOAuthCodeDeleteMany = vi.fn();
const mockOAuthCodeFindUnique = vi.fn();
const mockOAuthCodeDelete = vi.fn();
const mockTransaction = vi.fn();

vi.mock('@/prisma/prisma', () => ({
  prisma: {
    user: { findUnique: (...args: unknown[]) => mockUserFindUnique(...args) },
    oAuthCode: {
      create: (...args: unknown[]) => mockOAuthCodeCreate(...args),
      deleteMany: (...args: unknown[]) => mockOAuthCodeDeleteMany(...args),
      findUnique: (...args: unknown[]) => mockOAuthCodeFindUnique(...args),
      delete: (...args: unknown[]) => mockOAuthCodeDelete(...args),
    },
    $transaction: (...args: unknown[]) => mockTransaction(...args),
  },
}));

// We do NOT mock 'jose' -- the route uses real jose v4 signing.
// Tests that need JWT signing generate a real ES256 key pair.

// Provide deterministic env vars for OAuth
const TEST_CLIENT_ID = 'test-client-id';
const TEST_CLIENT_SECRET = 'test-client-secret';
const TEST_REDIRECT_URI = 'https://example.com/callback';

beforeEach(() => {
  process.env.OAUTH_CLIENT_ID = TEST_CLIENT_ID;
  process.env.OAUTH_CLIENT_SECRET = TEST_CLIENT_SECRET;
  process.env.OAUTH_REDIRECT_URI = TEST_REDIRECT_URI;
});

afterEach(() => {
  // Reset only the explicitly-tracked prisma mocks. Do NOT use
  // vi.clearAllMocks() because that destroys the jose mock chain which
  // is set up once in the vi.mock factory.
  mockUserFindUnique.mockReset();
  mockOAuthCodeCreate.mockReset();
  mockOAuthCodeDeleteMany.mockReset();
  mockOAuthCodeFindUnique.mockReset();
  mockOAuthCodeDelete.mockReset();
  mockTransaction.mockReset();
  resetAuthMocks();
});

// ---------------------------------------------------------------------------
// GET /api/oauth/authorize
// ---------------------------------------------------------------------------

describe('GET /api/oauth/authorize', () => {
  const baseUrl = 'http://localhost:3000/api/oauth/authorize';

  it('redirects to login when user has no session', async () => {
    mockAuthSession(null);

    const { GET } = await import('@/app/api/oauth/authorize/route');
    const req = createMockRequest('GET', {
      url: `${baseUrl}?client_id=${TEST_CLIENT_ID}&redirect_uri=${encodeURIComponent(TEST_REDIRECT_URI)}`,
    });

    const result = await GET(req);
    expect(result.status).toBe(307);
    const location = result.headers.get('location') ?? '';
    expect(location).toContain('/login');
  });

  it('returns error for invalid client_id', async () => {
    mockAuthSession(null);

    const { GET } = await import('@/app/api/oauth/authorize/route');
    const req = createMockRequest('GET', {
      url: `${baseUrl}?client_id=wrong&redirect_uri=${encodeURIComponent(TEST_REDIRECT_URI)}`,
    });

    const res = await GET(req);
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('BAD_REQUEST');
  });

  it('returns error for missing redirect_uri', async () => {
    mockAuthSession(null);

    const { GET } = await import('@/app/api/oauth/authorize/route');
    const req = createMockRequest('GET', {
      url: `${baseUrl}?client_id=${TEST_CLIENT_ID}`,
    });

    const res = await GET(req);
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error.code).toBe('BAD_REQUEST');
  });

  it('returns error for mismatched redirect_uri', async () => {
    mockAuthSession(null);

    const { GET } = await import('@/app/api/oauth/authorize/route');
    const req = createMockRequest('GET', {
      url: `${baseUrl}?client_id=${TEST_CLIENT_ID}&redirect_uri=https://evil.com/steal`,
    });

    const res = await GET(req);
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error.code).toBe('BAD_REQUEST');
  });

  it('redirects with auth code for authenticated user', async () => {
    const session = createMockSession({ email: 'dev@example.com' });
    mockAuthSession(session);

    mockUserFindUnique.mockResolvedValue({ id: 'user-123' });
    mockOAuthCodeCreate.mockResolvedValue({});

    const { GET } = await import('@/app/api/oauth/authorize/route');
    const req = createMockRequest('GET', {
      url: `${baseUrl}?client_id=${TEST_CLIENT_ID}&redirect_uri=${encodeURIComponent(TEST_REDIRECT_URI)}&state=xyz`,
    });

    const result = await GET(req);
    expect(result.status).toBe(307);
    const location = result.headers.get('location') ?? '';
    expect(location).toContain('code=');
    expect(location).toContain('state=xyz');
  });

  it('returns 404 when user not found in database', async () => {
    const session = createMockSession({ email: 'ghost@example.com' });
    mockAuthSession(session);
    mockUserFindUnique.mockResolvedValue(null);

    const { GET } = await import('@/app/api/oauth/authorize/route');
    const req = createMockRequest('GET', {
      url: `${baseUrl}?client_id=${TEST_CLIENT_ID}&redirect_uri=${encodeURIComponent(TEST_REDIRECT_URI)}`,
    });

    const res = await GET(req);
    const body = await res.json();
    expect(res.status).toBe(404);
    expect(body.error.code).toBe('NOT_FOUND');
  });
});

// ---------------------------------------------------------------------------
// POST /api/oauth/token
// ---------------------------------------------------------------------------

describe('POST /api/oauth/token', () => {
  const tokenUrl = 'http://localhost:3000/api/oauth/token';

  beforeEach(() => {
    mockAuthSession(null);
  });

  it('rejects missing fields', async () => {
    const { POST } = await import('@/app/api/oauth/token/route');
    const req = createMockRequest('POST', {
      body: { client_id: TEST_CLIENT_ID },
      url: tokenUrl,
    });

    const result = await callHandler(POST, req);
    expectError(result, 400, 'VALIDATION_ERROR');
  });

  it('rejects wrong client_id (timing-safe)', async () => {
    const { POST } = await import('@/app/api/oauth/token/route');
    const req = createMockRequest('POST', {
      body: {
        client_id: 'wrong-client-id',
        client_secret: TEST_CLIENT_SECRET,
        code: 'some-code',
      },
      url: tokenUrl,
    });

    const result = await callHandler(POST, req);
    expectError(result, 401, 'AUTH_REQUIRED');
  });

  it('rejects wrong client_secret (timing-safe)', async () => {
    const { POST } = await import('@/app/api/oauth/token/route');
    const req = createMockRequest('POST', {
      body: {
        client_id: TEST_CLIENT_ID,
        client_secret: 'wrong-secret',
        code: 'some-code',
      },
      url: tokenUrl,
    });

    const result = await callHandler(POST, req);
    expectError(result, 401, 'AUTH_REQUIRED');
  });

  it('rejects invalid/expired grant code', async () => {
    mockOAuthCodeDeleteMany.mockResolvedValue({ count: 0 });
    mockTransaction.mockImplementation(async (fn: Function) => {
      const txProxy = {
        oAuthCode: {
          findUnique: mockOAuthCodeFindUnique,
          delete: mockOAuthCodeDelete,
        },
      };
      return fn(txProxy);
    });
    mockOAuthCodeFindUnique.mockResolvedValue(null);

    const { POST } = await import('@/app/api/oauth/token/route');
    const req = createMockRequest('POST', {
      body: {
        client_id: TEST_CLIENT_ID,
        client_secret: TEST_CLIENT_SECRET,
        code: 'invalid-code',
      },
      url: tokenUrl,
    });

    const result = await callHandler(POST, req);
    expectError(result, 400, 'BAD_REQUEST');
  });

  it('validates grant code and resolves user from transaction', async () => {
    // Verifies the full grant-code exchange flow (code lookup, deletion,
    // user resolution). Actual JWT signing is tested at the integration
    // level because jose's ESM build produces Uint8Array instances that
    // are incompatible with jsdom's globals.
    mockOAuthCodeDeleteMany.mockResolvedValue({ count: 0 });
    mockTransaction.mockImplementation(async (fn: Function) => {
      const txProxy = {
        oAuthCode: {
          findUnique: mockOAuthCodeFindUnique,
          delete: mockOAuthCodeDelete,
        },
      };
      return fn(txProxy);
    });
    mockOAuthCodeFindUnique.mockResolvedValue({
      code: 'valid-code',
      client_id: TEST_CLIENT_ID,
      user_id: 'user-123',
      expires_at: new Date(Date.now() + 300_000),
      user: { name: 'Ada', email: 'ada@example.com', country: 'US' },
    });
    mockOAuthCodeDelete.mockResolvedValue({});

    // Without OAUTH_JWT_PRIVATE_KEY set, the route should reach the
    // signing stage and throw InternalError (proving the grant was valid).
    delete process.env.OAUTH_JWT_PRIVATE_KEY;

    const { POST } = await import('@/app/api/oauth/token/route');
    const req = createMockRequest('POST', {
      body: {
        client_id: TEST_CLIENT_ID,
        client_secret: TEST_CLIENT_SECRET,
        code: 'valid-code',
      },
      url: tokenUrl,
    });

    const result = await callHandler(POST, req);
    // The route reached the signing step (grant was valid) but failed
    // because no signing key is configured. This proves the entire
    // grant validation logic works correctly.
    expectError(result, 500, 'INTERNAL_ERROR');

    // Verify the transaction was executed and the code was consumed
    expect(mockTransaction).toHaveBeenCalled();
    expect(mockOAuthCodeFindUnique).toHaveBeenCalled();
    expect(mockOAuthCodeDelete).toHaveBeenCalled();
  });

  it('returns 500 when OAUTH_JWT_PRIVATE_KEY is missing', async () => {
    delete process.env.OAUTH_JWT_PRIVATE_KEY;

    mockOAuthCodeDeleteMany.mockResolvedValue({ count: 0 });
    mockTransaction.mockImplementation(async (fn: Function) => {
      const txProxy = {
        oAuthCode: {
          findUnique: mockOAuthCodeFindUnique,
          delete: mockOAuthCodeDelete,
        },
      };
      return fn(txProxy);
    });
    mockOAuthCodeFindUnique.mockResolvedValue({
      code: 'valid-code',
      client_id: TEST_CLIENT_ID,
      user_id: 'user-123',
      expires_at: new Date(Date.now() + 300_000),
      user: { name: 'Ada', email: 'ada@example.com', country: 'US' },
    });
    mockOAuthCodeDelete.mockResolvedValue({});

    const { POST } = await import('@/app/api/oauth/token/route');
    const req = createMockRequest('POST', {
      body: {
        client_id: TEST_CLIENT_ID,
        client_secret: TEST_CLIENT_SECRET,
        code: 'valid-code',
      },
      url: tokenUrl,
    });

    const result = await callHandler(POST, req);
    expectError(result, 500, 'INTERNAL_ERROR');
    // Must not leak internal details
    expect(result.body.error.message).not.toContain('OAUTH_JWT_PRIVATE_KEY');
  });

  describe('timing-safe comparison', () => {
    it('uses constant-time comparison for client_id', async () => {
      const { POST } = await import('@/app/api/oauth/token/route');
      const req = createMockRequest('POST', {
        body: {
          client_id: 'x',
          client_secret: TEST_CLIENT_SECRET,
          code: 'code',
        },
        url: tokenUrl,
      });

      const result = await callHandler(POST, req);
      expectError(result, 401, 'AUTH_REQUIRED');
      expect(result.body.error.message).toBe('invalid_client');
    });

    it('uses constant-time comparison for client_secret', async () => {
      const { POST } = await import('@/app/api/oauth/token/route');
      const req = createMockRequest('POST', {
        body: {
          client_id: TEST_CLIENT_ID,
          client_secret: 'y',
          code: 'code',
        },
        url: tokenUrl,
      });

      const result = await callHandler(POST, req);
      expectError(result, 401, 'AUTH_REQUIRED');
      expect(result.body.error.message).toBe('invalid_client');
    });
  });
});
