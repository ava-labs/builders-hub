import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createMockRequest,
  callHandler,
  expectSuccess,
  expectError,
} from '@/tests/api/helpers/api-test-utils';
import {
  createMockSession,
  createAdminSession,
  mockAuthSession,
  resetAuthMocks,
} from '@/tests/api/helpers/mock-session';
import { setupPrismaMock, resetPrismaMock } from '@/tests/api/helpers/mock-prisma';
import { prisma } from '@/prisma/prisma';

// ---------------------------------------------------------------------------
// Module-level mocks (hoisted by vitest)
// ---------------------------------------------------------------------------

vi.mock('@/lib/auth/authSession');
vi.mock('@/prisma/prisma');
vi.mock('@/server/services/badge');
vi.mock('@/server/services/badgeAssignmentService');
vi.mock('@/server/services/project-badge');
vi.mock('@/server/services/rewardBoard');
vi.mock('@/server/services/consoleBadge/consoleBadgeService');

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const mockPrisma = setupPrismaMock();

const MOCK_BADGE = {
  id: 'badge-1',
  name: 'Test Badge',
  description: 'A test badge',
  image_path: '/images/test-badge.png',
  category: 'academy',
  requirements: [{ id: 'req-1', course_id: 'course-abc', type: 'academy' }],
};

const MOCK_BADGES = [MOCK_BADGE];

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  resetAuthMocks();
  resetPrismaMock(mockPrisma);
});

// ===========================================================================
// GET /api/badge — badge by course_id
// ===========================================================================

describe('GET /api/badge', () => {
  it('returns badges for a valid course_id', async () => {
    const session = createMockSession();
    mockAuthSession(session);

    const { getBadgeByCourseId } = await import('@/server/services/badge');
    vi.mocked(getBadgeByCourseId).mockResolvedValue(MOCK_BADGES as any);

    const { GET } = await import('@/app/api/badge/route');
    const req = createMockRequest('GET', {
      url: 'http://localhost:3000/api/badge',
      searchParams: { course_id: 'course-abc' },
    });

    const result = await callHandler(GET, req);
    const data = expectSuccess(result);
    expect(data).toHaveLength(1);
    expect(data[0].id).toBe('badge-1');
  });

  it('returns 400 when course_id is missing', async () => {
    const session = createMockSession();
    mockAuthSession(session);

    const { GET } = await import('@/app/api/badge/route');
    const req = createMockRequest('GET', {
      url: 'http://localhost:3000/api/badge',
    });

    const result = await callHandler(GET, req);
    expectError(result, 400, 'VALIDATION_ERROR');
  });

  it('returns 401 when unauthenticated', async () => {
    mockAuthSession(null);

    const { GET } = await import('@/app/api/badge/route');
    const req = createMockRequest('GET', {
      url: 'http://localhost:3000/api/badge',
      searchParams: { course_id: 'course-abc' },
    });

    const result = await callHandler(GET, req);
    expectError(result, 401, 'AUTH_REQUIRED');
  });
});

// ===========================================================================
// GET /api/badge/validate — validate badge for user + course
// ===========================================================================

describe('GET /api/badge/validate', () => {
  it('returns badges when both course_id and user_id are provided', async () => {
    const session = createMockSession();
    mockAuthSession(session);

    const { getBadgeByCourseId } = await import('@/server/services/badge');
    vi.mocked(getBadgeByCourseId).mockResolvedValue(MOCK_BADGES as any);

    const { GET } = await import('@/app/api/badge/validate/route');
    const req = createMockRequest('GET', {
      url: 'http://localhost:3000/api/badge/validate',
      searchParams: { course_id: 'course-abc', user_id: 'user-1' },
    });

    const result = await callHandler(GET, req);
    const data = expectSuccess(result);
    expect(data).toHaveLength(1);
  });

  it('returns 400 when user_id is missing', async () => {
    const session = createMockSession();
    mockAuthSession(session);

    const { GET } = await import('@/app/api/badge/validate/route');
    const req = createMockRequest('GET', {
      url: 'http://localhost:3000/api/badge/validate',
      searchParams: { course_id: 'course-abc' },
    });

    const result = await callHandler(GET, req);
    expectError(result, 400, 'VALIDATION_ERROR');
  });

  it('returns 400 when course_id is missing', async () => {
    const session = createMockSession();
    mockAuthSession(session);

    const { GET } = await import('@/app/api/badge/validate/route');
    const req = createMockRequest('GET', {
      url: 'http://localhost:3000/api/badge/validate',
      searchParams: { user_id: 'user-1' },
    });

    const result = await callHandler(GET, req);
    expectError(result, 400, 'VALIDATION_ERROR');
  });
});

// ===========================================================================
// POST /api/badge/assign — badge assignment with role checks
// ===========================================================================

describe('POST /api/badge/assign', () => {
  it('allows user to self-assign an academy badge', async () => {
    const session = createMockSession({ id: 'user-1' });
    mockAuthSession(session);

    const { badgeAssignmentService } = await import(
      '@/server/services/badgeAssignmentService'
    );
    vi.mocked(badgeAssignmentService.getRequiredRoleForAssignment).mockReturnValue(null);
    vi.mocked(badgeAssignmentService.assignBadge).mockResolvedValue({
      success: true,
      message: 'Badge assigned',
      badge_id: 'badge-1',
      user_id: 'user-1',
      badges: [],
    });

    const { POST } = await import('@/app/api/badge/assign/route');
    const req = createMockRequest('POST', {
      url: 'http://localhost:3000/api/badge/assign',
      body: { userId: 'user-1', courseId: 'course-abc' },
    });

    const result = await callHandler(POST, req);
    const data = expectSuccess(result);
    expect(data.success).toBe(true);
    expect(data.badge_id).toBe('badge-1');
  });

  it('rejects self-assignment to a different user (no admin)', async () => {
    const session = createMockSession({ id: 'user-1' });
    mockAuthSession(session);

    const { badgeAssignmentService } = await import(
      '@/server/services/badgeAssignmentService'
    );
    vi.mocked(badgeAssignmentService.getRequiredRoleForAssignment).mockReturnValue(null);

    const { POST } = await import('@/app/api/badge/assign/route');
    const req = createMockRequest('POST', {
      url: 'http://localhost:3000/api/badge/assign',
      body: { userId: 'someone-else', courseId: 'course-abc' },
    });

    const result = await callHandler(POST, req);
    expectError(result, 403, 'FORBIDDEN');
  });

  it('allows badge_admin to assign project badges to any user', async () => {
    const session = createMockSession({
      id: 'admin-1',
      custom_attributes: ['badge_admin'],
    });
    mockAuthSession(session);

    const { badgeAssignmentService } = await import(
      '@/server/services/badgeAssignmentService'
    );
    vi.mocked(badgeAssignmentService.getRequiredRoleForAssignment).mockReturnValue(
      'badge_admin',
    );
    vi.mocked(badgeAssignmentService.assignBadge).mockResolvedValue({
      success: true,
      message: 'Badge assigned',
      badge_id: 'badge-2',
      user_id: 'user-other',
      badges: [],
    });

    const { POST } = await import('@/app/api/badge/assign/route');
    const req = createMockRequest('POST', {
      url: 'http://localhost:3000/api/badge/assign',
      body: { userId: 'user-other', projectId: 'proj-1' },
    });

    const result = await callHandler(POST, req);
    const data = expectSuccess(result);
    expect(data.success).toBe(true);
  });

  it('allows devrel (super-admin) to assign badge_admin badges', async () => {
    const session = createAdminSession();
    mockAuthSession(session);

    const { badgeAssignmentService } = await import(
      '@/server/services/badgeAssignmentService'
    );
    vi.mocked(badgeAssignmentService.getRequiredRoleForAssignment).mockReturnValue(
      'badge_admin',
    );
    vi.mocked(badgeAssignmentService.assignBadge).mockResolvedValue({
      success: true,
      message: 'Badge assigned',
      badge_id: 'badge-3',
      user_id: 'user-other',
      badges: [],
    });

    const { POST } = await import('@/app/api/badge/assign/route');
    const req = createMockRequest('POST', {
      url: 'http://localhost:3000/api/badge/assign',
      body: { userId: 'user-other', projectId: 'proj-1' },
    });

    const result = await callHandler(POST, req);
    const data = expectSuccess(result);
    expect(data.success).toBe(true);
  });

  it('rejects non-admin user from assigning admin-only badge', async () => {
    const session = createMockSession({ id: 'user-1', custom_attributes: [] });
    mockAuthSession(session);

    const { badgeAssignmentService } = await import(
      '@/server/services/badgeAssignmentService'
    );
    vi.mocked(badgeAssignmentService.getRequiredRoleForAssignment).mockReturnValue(
      'badge_admin',
    );

    const { POST } = await import('@/app/api/badge/assign/route');
    const req = createMockRequest('POST', {
      url: 'http://localhost:3000/api/badge/assign',
      body: { userId: 'user-other', projectId: 'proj-1' },
    });

    const result = await callHandler(POST, req);
    expectError(result, 403, 'FORBIDDEN');
  });

  it('returns 400 for invalid body (missing userId)', async () => {
    const session = createMockSession();
    mockAuthSession(session);

    const { POST } = await import('@/app/api/badge/assign/route');
    const req = createMockRequest('POST', {
      url: 'http://localhost:3000/api/badge/assign',
      body: { courseId: 'course-abc' },
    });

    const result = await callHandler(POST, req);
    expectError(result, 400, 'VALIDATION_ERROR');
  });

  it('returns 401 when unauthenticated', async () => {
    mockAuthSession(null);

    const { POST } = await import('@/app/api/badge/assign/route');
    const req = createMockRequest('POST', {
      url: 'http://localhost:3000/api/badge/assign',
      body: { userId: 'user-1', courseId: 'course-abc' },
    });

    const result = await callHandler(POST, req);
    expectError(result, 401, 'AUTH_REQUIRED');
  });
});

// ===========================================================================
// GET /api/badge/get-all — list all badges
// ===========================================================================

describe('GET /api/badge/get-all', () => {
  it('returns all badges', async () => {
    const session = createMockSession();
    mockAuthSession(session);

    const { getAllBadges } = await import('@/server/services/badge');
    vi.mocked(getAllBadges).mockResolvedValue(MOCK_BADGES as any);

    const { GET } = await import('@/app/api/badge/get-all/route');
    const req = createMockRequest('GET', {
      url: 'http://localhost:3000/api/badge/get-all',
    });

    const result = await callHandler(GET, req);
    const data = expectSuccess(result);
    expect(data).toHaveLength(1);
  });

  it('returns 401 when unauthenticated', async () => {
    mockAuthSession(null);

    const { GET } = await import('@/app/api/badge/get-all/route');
    const req = createMockRequest('GET', {
      url: 'http://localhost:3000/api/badge/get-all',
    });

    const result = await callHandler(GET, req);
    expectError(result, 401, 'AUTH_REQUIRED');
  });
});

// ===========================================================================
// POST /api/badge/console-check — evaluate console badges
// ===========================================================================

describe('POST /api/badge/console-check', () => {
  it('evaluates console badges for the authenticated user', async () => {
    const session = createMockSession({ id: 'user-1' });
    mockAuthSession(session);

    const { evaluateAllConsoleBadges } = await import(
      '@/server/services/consoleBadge/consoleBadgeService'
    );
    vi.mocked(evaluateAllConsoleBadges).mockResolvedValue([
      { name: 'First Blood', tier: 'bronze' },
    ] as any);

    const { POST } = await import('@/app/api/badge/console-check/route');
    const req = createMockRequest('POST', {
      url: 'http://localhost:3000/api/badge/console-check',
      body: { timezone: 'America/New_York' },
    });

    const result = await callHandler(POST, req);
    const data = expectSuccess(result);
    expect(data.awardedBadges).toHaveLength(1);
    expect(vi.mocked(evaluateAllConsoleBadges)).toHaveBeenCalledWith('user-1', {
      timezone: 'America/New_York',
    });
  });

  it('works with no request body', async () => {
    const session = createMockSession({ id: 'user-2' });
    mockAuthSession(session);

    const { evaluateAllConsoleBadges } = await import(
      '@/server/services/consoleBadge/consoleBadgeService'
    );
    vi.mocked(evaluateAllConsoleBadges).mockResolvedValue([]);

    const { POST } = await import('@/app/api/badge/console-check/route');
    const req = createMockRequest('POST', {
      url: 'http://localhost:3000/api/badge/console-check',
    });

    const result = await callHandler(POST, req);
    const data = expectSuccess(result);
    expect(data.awardedBadges).toHaveLength(0);
  });

  it('returns 401 when unauthenticated', async () => {
    mockAuthSession(null);

    const { POST } = await import('@/app/api/badge/console-check/route');
    const req = createMockRequest('POST', {
      url: 'http://localhost:3000/api/badge/console-check',
    });

    const result = await callHandler(POST, req);
    expectError(result, 401, 'AUTH_REQUIRED');
  });
});

// ===========================================================================
// POST /api/badge/console-migrate — devrel-only migration
// ===========================================================================

describe('POST /api/badge/console-migrate', () => {
  it('returns 403 for non-devrel user', async () => {
    const session = createMockSession({ custom_attributes: [] });
    mockAuthSession(session);

    const { POST } = await import('@/app/api/badge/console-migrate/route');
    const req = createMockRequest('POST', {
      url: 'http://localhost:3000/api/badge/console-migrate',
    });

    const result = await callHandler(POST, req);
    expectError(result, 403, 'FORBIDDEN');
  });

  it('returns 401 when unauthenticated', async () => {
    mockAuthSession(null);

    const { POST } = await import('@/app/api/badge/console-migrate/route');
    const req = createMockRequest('POST', {
      url: 'http://localhost:3000/api/badge/console-migrate',
    });

    const result = await callHandler(POST, req);
    expectError(result, 401, 'AUTH_REQUIRED');
  });

  it('processes users and returns migration summary for devrel', async () => {
    const session = createAdminSession();
    mockAuthSession(session);

    // The console-migrate route uses the prisma import directly, so mock
    // the auto-mocked module export rather than the local proxy.
    const mockedPrisma = vi.mocked(prisma) as any;
    mockedPrisma.consoleLog = { findMany: vi.fn().mockResolvedValue([{ user_id: 'u1' }]) };
    mockedPrisma.faucetClaim = { findMany: vi.fn().mockResolvedValue([{ user_id: 'u2' }]) };
    mockedPrisma.nodeRegistration = { findMany: vi.fn().mockResolvedValue([]) };

    const { evaluateAllConsoleBadges } = await import(
      '@/server/services/consoleBadge/consoleBadgeService'
    );
    vi.mocked(evaluateAllConsoleBadges)
      .mockResolvedValueOnce([{ name: 'badge1' }] as any)
      .mockResolvedValueOnce([]);

    const { POST } = await import('@/app/api/badge/console-migrate/route');
    const req = createMockRequest('POST', {
      url: 'http://localhost:3000/api/badge/console-migrate',
    });

    const result = await callHandler(POST, req);
    const data = expectSuccess(result);
    expect(data.usersProcessed).toBe(2);
    expect(data.totalBadgesAwarded).toBe(1);
    expect(data.details).toHaveLength(1);
  });
});

// ===========================================================================
// GET /api/badge/project-badge — project badges
// ===========================================================================

describe('GET /api/badge/project-badge', () => {
  it('returns badges for a project', async () => {
    const session = createMockSession();
    mockAuthSession(session);

    const { getProjectBadges } = await import('@/server/services/project-badge');
    vi.mocked(getProjectBadges).mockResolvedValue([
      { id: 'pb-1', project_id: 'proj-1', badge_id: 'badge-1' },
    ] as any);

    const { GET } = await import('@/app/api/badge/project-badge/route');
    const req = createMockRequest('GET', {
      url: 'http://localhost:3000/api/badge/project-badge',
      searchParams: { project_id: 'proj-1' },
    });

    const result = await callHandler(GET, req);
    const data = expectSuccess(result);
    expect(data).toHaveLength(1);
  });

  it('returns 400 when project_id is missing', async () => {
    const session = createMockSession();
    mockAuthSession(session);

    const { GET } = await import('@/app/api/badge/project-badge/route');
    const req = createMockRequest('GET', {
      url: 'http://localhost:3000/api/badge/project-badge',
    });

    const result = await callHandler(GET, req);
    expectError(result, 400, 'VALIDATION_ERROR');
  });

  it('returns 401 when unauthenticated', async () => {
    mockAuthSession(null);

    const { GET } = await import('@/app/api/badge/project-badge/route');
    const req = createMockRequest('GET', {
      url: 'http://localhost:3000/api/badge/project-badge',
      searchParams: { project_id: 'proj-1' },
    });

    const result = await callHandler(GET, req);
    expectError(result, 401, 'AUTH_REQUIRED');
  });
});

// ===========================================================================
// GET /api/profile/reward-board — user reward board
// ===========================================================================

describe('GET /api/profile/reward-board', () => {
  it('returns reward board for a user', async () => {
    const session = createMockSession();
    mockAuthSession(session);

    const { getRewardBoard } = await import('@/server/services/rewardBoard');
    vi.mocked(getRewardBoard).mockResolvedValue([
      { id: 'ub-1', badge_id: 'badge-1', status: 'approved' },
    ] as any);

    const { GET } = await import('@/app/api/profile/reward-board/route');
    const req = createMockRequest('GET', {
      url: 'http://localhost:3000/api/profile/reward-board',
      searchParams: { user_id: 'user-1' },
    });

    const result = await callHandler(GET, req);
    const data = expectSuccess(result);
    expect(data).toHaveLength(1);
  });

  it('returns 400 when user_id is missing', async () => {
    const session = createMockSession();
    mockAuthSession(session);

    const { GET } = await import('@/app/api/profile/reward-board/route');
    const req = createMockRequest('GET', {
      url: 'http://localhost:3000/api/profile/reward-board',
    });

    const result = await callHandler(GET, req);
    expectError(result, 400, 'VALIDATION_ERROR');
  });

  it('returns 401 when unauthenticated', async () => {
    mockAuthSession(null);

    const { GET } = await import('@/app/api/profile/reward-board/route');
    const req = createMockRequest('GET', {
      url: 'http://localhost:3000/api/profile/reward-board',
      searchParams: { user_id: 'user-1' },
    });

    const result = await callHandler(GET, req);
    expectError(result, 401, 'AUTH_REQUIRED');
  });
});
