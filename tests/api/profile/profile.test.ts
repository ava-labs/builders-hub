import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createMockRequest,
  callHandler,
  expectSuccess,
  expectError,
} from '@/tests/api/helpers/api-test-utils';
import { setupPrismaMock, resetPrismaMock } from '@/tests/api/helpers/mock-prisma';
import {
  createMockSession,
  mockAuthSession,
  resetAuthMocks,
} from '@/tests/api/helpers/mock-session';

vi.mock('@/prisma/prisma');
vi.mock('@/lib/auth/authSession');

vi.mock('@/server/services/profile', () => ({
  getProfile: vi.fn(),
  updateProfile: vi.fn(),
}));

vi.mock('@/server/services/profile/profile.service', () => ({
  getExtendedProfile: vi.fn(),
  updateExtendedProfile: vi.fn(),
  getPopularSkills: vi.fn(),
  ProfileValidationError: class extends Error {
    statusCode: number;
    constructor(message: string, statusCode: number) {
      super(message);
      this.statusCode = statusCode;
    }
  },
}));

const mockPrisma = setupPrismaMock();

afterEach(() => {
  resetPrismaMock(mockPrisma);
  resetAuthMocks();
});

// ---------------------------------------------------------------------------
// GET /api/profile/[id]
// ---------------------------------------------------------------------------
describe('GET /api/profile/[id]', () => {
  const session = createMockSession({ id: 'user-123' });

  beforeEach(() => {
    mockAuthSession(session);
    mockPrisma.apiRateLimitLog.count.mockResolvedValue(0);
    mockPrisma.apiRateLimitLog.create.mockResolvedValue({});
  });

  it('returns profile for own user', async () => {
    const mockProfile = { id: 'user-123', name: 'Test User', email: 'test@example.com' };
    const { getProfile } = await import('@/server/services/profile');
    (getProfile as ReturnType<typeof vi.fn>).mockResolvedValue(mockProfile);

    const { GET } = await import('@/app/api/profile/[id]/route');
    const req = createMockRequest('GET', {
      url: 'http://localhost:3000/api/profile/user-123',
    });

    const result = await callHandler(GET, req, { id: 'user-123' });
    const data = expectSuccess(result);
    expect(data).toEqual(mockProfile);
  });

  it('rejects access to another user profile', async () => {
    const { GET } = await import('@/app/api/profile/[id]/route');
    const req = createMockRequest('GET', {
      url: 'http://localhost:3000/api/profile/other-user',
    });

    const result = await callHandler(GET, req, { id: 'other-user' });
    expectError(result, 403, 'FORBIDDEN');
  });

  it('rejects unauthenticated requests', async () => {
    mockAuthSession(null);

    const { GET } = await import('@/app/api/profile/[id]/route');
    const req = createMockRequest('GET', {
      url: 'http://localhost:3000/api/profile/user-123',
    });

    const result = await callHandler(GET, req, { id: 'user-123' });
    expectError(result, 401, 'AUTH_REQUIRED');
  });
});

// ---------------------------------------------------------------------------
// PUT /api/profile/[id]
// ---------------------------------------------------------------------------
describe('PUT /api/profile/[id]', () => {
  const session = createMockSession({ id: 'user-123' });

  beforeEach(() => {
    mockAuthSession(session);
    mockPrisma.apiRateLimitLog.count.mockResolvedValue(0);
    mockPrisma.apiRateLimitLog.create.mockResolvedValue({});
  });

  it('updates own profile', async () => {
    const updatedProfile = { id: 'user-123', name: 'Updated Name' };
    const { updateProfile } = await import('@/server/services/profile');
    (updateProfile as ReturnType<typeof vi.fn>).mockResolvedValue(updatedProfile);

    const { PUT } = await import('@/app/api/profile/[id]/route');
    const req = createMockRequest('PUT', {
      body: { name: 'Updated Name' },
      url: 'http://localhost:3000/api/profile/user-123',
    });

    const result = await callHandler(PUT, req, { id: 'user-123' });
    const data = expectSuccess(result);
    expect(data).toEqual(updatedProfile);
  });

  it('rejects update to another user profile', async () => {
    const { PUT } = await import('@/app/api/profile/[id]/route');
    const req = createMockRequest('PUT', {
      body: { name: 'Hacked' },
      url: 'http://localhost:3000/api/profile/other-user',
    });

    const result = await callHandler(PUT, req, { id: 'other-user' });
    expectError(result, 403, 'FORBIDDEN');
  });

  it('rejects unauthenticated updates', async () => {
    mockAuthSession(null);

    const { PUT } = await import('@/app/api/profile/[id]/route');
    const req = createMockRequest('PUT', {
      body: { name: 'Should fail' },
      url: 'http://localhost:3000/api/profile/user-123',
    });

    const result = await callHandler(PUT, req, { id: 'user-123' });
    expectError(result, 401, 'AUTH_REQUIRED');
  });
});

// ---------------------------------------------------------------------------
// GET /api/profile/extended/[id]
// ---------------------------------------------------------------------------
describe('GET /api/profile/extended/[id]', () => {
  const session = createMockSession({ id: 'user-123' });

  beforeEach(() => {
    mockAuthSession(session);
    mockPrisma.apiRateLimitLog.count.mockResolvedValue(0);
    mockPrisma.apiRateLimitLog.create.mockResolvedValue({});
  });

  it('returns extended profile for own user', async () => {
    const mockExtended = { id: 'user-123', skills: ['Solidity', 'TypeScript'] };
    const { getExtendedProfile } = await import('@/server/services/profile/profile.service');
    (getExtendedProfile as ReturnType<typeof vi.fn>).mockResolvedValue(mockExtended);

    const { GET } = await import('@/app/api/profile/extended/[id]/route');
    const req = createMockRequest('GET', {
      url: 'http://localhost:3000/api/profile/extended/user-123',
    });

    const result = await callHandler(GET, req, { id: 'user-123' });
    const data = expectSuccess(result);
    expect(data).toEqual(mockExtended);
  });

  it('returns 404 when profile does not exist', async () => {
    const { getExtendedProfile } = await import('@/server/services/profile/profile.service');
    (getExtendedProfile as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const { GET } = await import('@/app/api/profile/extended/[id]/route');
    const req = createMockRequest('GET', {
      url: 'http://localhost:3000/api/profile/extended/user-123',
    });

    const result = await callHandler(GET, req, { id: 'user-123' });
    expectError(result, 404, 'NOT_FOUND');
  });

  it('rejects access to another user extended profile', async () => {
    const { GET } = await import('@/app/api/profile/extended/[id]/route');
    const req = createMockRequest('GET', {
      url: 'http://localhost:3000/api/profile/extended/other-user',
    });

    const result = await callHandler(GET, req, { id: 'other-user' });
    expectError(result, 403, 'FORBIDDEN');
  });
});

// ---------------------------------------------------------------------------
// PUT /api/profile/extended/[id]
// ---------------------------------------------------------------------------
describe('PUT /api/profile/extended/[id]', () => {
  const session = createMockSession({ id: 'user-123' });

  beforeEach(() => {
    mockAuthSession(session);
    mockPrisma.apiRateLimitLog.count.mockResolvedValue(0);
    mockPrisma.apiRateLimitLog.create.mockResolvedValue({});
  });

  it('updates own extended profile', async () => {
    const updated = { id: 'user-123', skills: ['Solidity', 'Foundry'] };
    const { updateExtendedProfile } = await import('@/server/services/profile/profile.service');
    (updateExtendedProfile as ReturnType<typeof vi.fn>).mockResolvedValue(updated);

    const { PUT } = await import('@/app/api/profile/extended/[id]/route');
    const req = createMockRequest('PUT', {
      body: { skills: ['Solidity', 'Foundry'] },
      url: 'http://localhost:3000/api/profile/extended/user-123',
    });

    const result = await callHandler(PUT, req, { id: 'user-123' });
    const data = expectSuccess(result);
    expect(data).toEqual(updated);
  });

  it('rejects update to another user extended profile', async () => {
    const { PUT } = await import('@/app/api/profile/extended/[id]/route');
    const req = createMockRequest('PUT', {
      body: { skills: ['Hacked'] },
      url: 'http://localhost:3000/api/profile/extended/other-user',
    });

    const result = await callHandler(PUT, req, { id: 'other-user' });
    expectError(result, 403, 'FORBIDDEN');
  });
});

// ---------------------------------------------------------------------------
// GET /api/profile/popular-skills
// ---------------------------------------------------------------------------
describe('GET /api/profile/popular-skills', () => {
  const session = createMockSession();

  beforeEach(() => {
    mockAuthSession(session);
    mockPrisma.apiRateLimitLog.count.mockResolvedValue(0);
    mockPrisma.apiRateLimitLog.create.mockResolvedValue({});
  });

  it('returns popular skills list', async () => {
    const skills = ['Solidity', 'TypeScript', 'Rust'];
    const { getPopularSkills } = await import('@/server/services/profile/profile.service');
    (getPopularSkills as ReturnType<typeof vi.fn>).mockResolvedValue(skills);

    const { GET } = await import('@/app/api/profile/popular-skills/route');
    const req = createMockRequest('GET', {
      url: 'http://localhost:3000/api/profile/popular-skills',
    });

    const result = await callHandler(GET, req);
    const data = expectSuccess(result);
    expect(data).toEqual(skills);
  });

  it('includes no-cache headers', async () => {
    const { getPopularSkills } = await import('@/server/services/profile/profile.service');
    (getPopularSkills as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const { GET } = await import('@/app/api/profile/popular-skills/route');
    const req = createMockRequest('GET', {
      url: 'http://localhost:3000/api/profile/popular-skills',
    });

    const result = await callHandler(GET, req);
    expect(result.headers.get('cache-control')).toContain('no-store');
    expect(result.headers.get('pragma')).toBe('no-cache');
  });

  it('rejects unauthenticated requests', async () => {
    mockAuthSession(null);

    const { GET } = await import('@/app/api/profile/popular-skills/route');
    const req = createMockRequest('GET', {
      url: 'http://localhost:3000/api/profile/popular-skills',
    });

    const result = await callHandler(GET, req);
    expectError(result, 401, 'AUTH_REQUIRED');
  });
});
