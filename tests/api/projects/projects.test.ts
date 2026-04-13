import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createMockRequest,
  callHandler,
  expectSuccess,
  expectPaginated,
  expectError,
} from '@/tests/api/helpers/api-test-utils';
import {
  createMockSession,
  createAdminSession,
  mockAuthSession,
  resetAuthMocks,
} from '@/tests/api/helpers/mock-session';
import { setupPrismaMock, resetPrismaMock } from '@/tests/api/helpers/mock-prisma';

// ---------------------------------------------------------------------------
// Module-level mocks (hoisted by vitest)
// ---------------------------------------------------------------------------
vi.mock('@/lib/auth/authSession');
vi.mock('@/prisma/prisma');

// Mock service modules
vi.mock('@/server/services/projects', () => ({
  getFilteredProjects: vi.fn(),
  createProject: vi.fn(),
  updateProject: vi.fn(),
  CheckInvitation: vi.fn(),
  GetProjectByHackathonAndUser: vi.fn(),
}));

vi.mock('@/server/services/memberProject', () => ({
  GetProjectByIdWithMembers: vi.fn(),
  GetMembersByProjectId: vi.fn(),
  UpdateRoleMember: vi.fn(),
  UpdateStatusMember: vi.fn(),
  GetProjectsByUserId: vi.fn(),
}));

vi.mock('@/server/services/fileValidation', () => ({
  isUserProjectMember: vi.fn(),
}));

vi.mock('@/server/services/submitProject', () => ({
  createProject: vi.fn(),
}));

vi.mock('@/server/services/inviteProjectMember', () => ({
  generateInvitation: vi.fn(),
}));

vi.mock('@/server/services/set-project-winner', () => ({
  SetWinner: vi.fn(),
}));

vi.mock('@/server/services/exportShowcase', () => ({
  exportShowcase: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Import mocked services
// ---------------------------------------------------------------------------
import {
  getFilteredProjects,
  createProject as createProjectService,
  updateProject,
  CheckInvitation,
} from '@/server/services/projects';
import {
  GetProjectByIdWithMembers,
  GetMembersByProjectId,
  UpdateRoleMember,
  UpdateStatusMember,
} from '@/server/services/memberProject';
import { isUserProjectMember } from '@/server/services/fileValidation';
import { createProject as submitProjectService } from '@/server/services/submitProject';
import { generateInvitation } from '@/server/services/inviteProjectMember';
import { SetWinner } from '@/server/services/set-project-winner';
import { exportShowcase } from '@/server/services/exportShowcase';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const mockPrisma = setupPrismaMock();
const userSession = createMockSession({ id: 'user-1', email: 'dev@example.com' });
const adminSession = createAdminSession();

const sampleProject = {
  id: 'proj-1',
  project_name: 'Test Project',
  short_description: 'A test',
  hackaton_id: 'hack-1',
  members: [{ user_id: 'user-1', role: 'Member', status: 'Confirmed' }],
};

// ---------------------------------------------------------------------------
// Test suites
// ---------------------------------------------------------------------------
describe('API /api/projects', () => {
  beforeEach(() => {
    mockAuthSession(userSession);
  });

  afterEach(() => {
    resetAuthMocks();
    resetPrismaMock(mockPrisma);
  });

  // -------------------------------------------------------------------------
  // GET /api/projects -- list with pagination
  // -------------------------------------------------------------------------
  describe('GET /api/projects', () => {
    it('returns paginated projects', async () => {
      const { GET } = await import('@/app/api/projects/route');
      vi.mocked(getFilteredProjects).mockResolvedValue({
        projects: [sampleProject as any],
        total: 1,
        page: 1,
        pageSize: 12,
      });

      const req = createMockRequest('GET', {
        url: 'http://localhost:3000/api/projects?page=1&pageSize=12',
      });
      const result = await callHandler(GET, req);

      const { data, pagination } = expectPaginated(result);
      expect(data).toHaveLength(1);
      expect(pagination.total).toBe(1);
      expect(pagination.pageSize).toBe(12);
    });

    it('caps pageSize at MAX_PAGE_SIZE (100)', async () => {
      const { GET } = await import('@/app/api/projects/route');
      vi.mocked(getFilteredProjects).mockResolvedValue({
        projects: [],
        total: 0,
        page: 1,
        pageSize: 100,
      });

      const req = createMockRequest('GET', {
        url: 'http://localhost:3000/api/projects?page=1&pageSize=9999',
      });
      const result = await callHandler(GET, req);

      // parsePagination clamps to 100
      expect(vi.mocked(getFilteredProjects)).toHaveBeenCalledWith(
        expect.objectContaining({ pageSize: 100 }),
      );
      expect(result.status).toBe(200);
    });

    it('returns 401 when unauthenticated', async () => {
      const { GET } = await import('@/app/api/projects/route');
      mockAuthSession(null);

      const req = createMockRequest('GET', {
        url: 'http://localhost:3000/api/projects',
      });
      const result = await callHandler(GET, req);
      expectError(result, 401, 'AUTH_REQUIRED');
    });
  });

  // -------------------------------------------------------------------------
  // POST /api/projects -- create
  // -------------------------------------------------------------------------
  describe('POST /api/projects', () => {
    it('creates a project and auto-adds user as member', async () => {
      const { POST } = await import('@/app/api/projects/route');
      vi.mocked(createProjectService).mockResolvedValue(sampleProject as any);

      const req = createMockRequest('POST', {
        url: 'http://localhost:3000/api/projects',
        body: { project_name: 'New Project', short_description: 'desc' },
      });
      const result = await callHandler(POST, req);

      const data = expectSuccess(result, 201);
      expect(data.project_name).toBe('Test Project');

      // Verify the user was auto-added as member
      const callArgs = vi.mocked(createProjectService).mock.calls[0][0];
      expect(callArgs.members).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ user_id: 'user-1', status: 'Confirmed' }),
        ]),
      );
    });

    it('returns 401 when unauthenticated', async () => {
      const { POST } = await import('@/app/api/projects/route');
      mockAuthSession(null);

      const req = createMockRequest('POST', {
        url: 'http://localhost:3000/api/projects',
        body: { project_name: 'X' },
      });
      const result = await callHandler(POST, req);
      expectError(result, 401, 'AUTH_REQUIRED');
    });
  });

  // -------------------------------------------------------------------------
  // GET /api/projects/[id] -- single project
  // -------------------------------------------------------------------------
  describe('GET /api/projects/[id]', () => {
    it('returns project when user is a member', async () => {
      const { GET } = await import('@/app/api/projects/[id]/route');
      vi.mocked(isUserProjectMember).mockResolvedValue(true);
      vi.mocked(GetProjectByIdWithMembers).mockResolvedValue(sampleProject as any);

      const req = createMockRequest('GET', {
        url: 'http://localhost:3000/api/projects/proj-1',
      });
      const result = await callHandler(GET, req, { id: 'proj-1' });
      const data = expectSuccess(result);
      expect(data.id).toBe('proj-1');
    });

    it('returns 403 when user is not a member', async () => {
      const { GET } = await import('@/app/api/projects/[id]/route');
      vi.mocked(isUserProjectMember).mockResolvedValue(false);

      const req = createMockRequest('GET', {
        url: 'http://localhost:3000/api/projects/proj-1',
      });
      const result = await callHandler(GET, req, { id: 'proj-1' });
      expectError(result, 403, 'FORBIDDEN');
    });

    it('returns 404 when project does not exist', async () => {
      const { GET } = await import('@/app/api/projects/[id]/route');
      vi.mocked(isUserProjectMember).mockResolvedValue(true);
      vi.mocked(GetProjectByIdWithMembers).mockResolvedValue(null);

      const req = createMockRequest('GET', {
        url: 'http://localhost:3000/api/projects/missing',
      });
      const result = await callHandler(GET, req, { id: 'missing' });
      expectError(result, 404, 'NOT_FOUND');
    });
  });

  // -------------------------------------------------------------------------
  // PUT /api/projects/[id] -- update with mass-assignment prevention
  // -------------------------------------------------------------------------
  describe('PUT /api/projects/[id]', () => {
    it('updates only allowed fields', async () => {
      const { PUT } = await import('@/app/api/projects/[id]/route');
      vi.mocked(isUserProjectMember).mockResolvedValue(true);
      vi.mocked(updateProject).mockResolvedValue(sampleProject as any);

      const req = createMockRequest('PUT', {
        url: 'http://localhost:3000/api/projects/proj-1',
        body: {
          project_name: 'Updated Name',
          short_description: 'Updated desc',
        },
      });
      const result = await callHandler(PUT, req, { id: 'proj-1' });
      expectSuccess(result);

      const updateArgs = vi.mocked(updateProject).mock.calls[0];
      expect(updateArgs[0]).toBe('proj-1');
      expect(updateArgs[1]).toEqual({
        project_name: 'Updated Name',
        short_description: 'Updated desc',
      });
    });

    it('strips disallowed fields (mass assignment prevention)', async () => {
      const { PUT } = await import('@/app/api/projects/[id]/route');
      vi.mocked(isUserProjectMember).mockResolvedValue(true);
      vi.mocked(updateProject).mockResolvedValue(sampleProject as any);

      const req = createMockRequest('PUT', {
        url: 'http://localhost:3000/api/projects/proj-1',
        body: {
          project_name: 'Safe Name',
          is_winner: true,
          hackaton_id: 'hacked',
          created_at: '2000-01-01',
          members: [{ user_id: 'attacker' }],
        },
      });
      const result = await callHandler(PUT, req, { id: 'proj-1' });
      expectSuccess(result);

      const updateArgs = vi.mocked(updateProject).mock.calls[0];
      expect(updateArgs[1]).toEqual({ project_name: 'Safe Name' });
      expect(updateArgs[1]).not.toHaveProperty('is_winner');
      expect(updateArgs[1]).not.toHaveProperty('hackaton_id');
      expect(updateArgs[1]).not.toHaveProperty('created_at');
      expect(updateArgs[1]).not.toHaveProperty('members');
    });

    it('returns 403 when user is not a member', async () => {
      const { PUT } = await import('@/app/api/projects/[id]/route');
      vi.mocked(isUserProjectMember).mockResolvedValue(false);

      const req = createMockRequest('PUT', {
        url: 'http://localhost:3000/api/projects/proj-1',
        body: { project_name: 'X' },
      });
      const result = await callHandler(PUT, req, { id: 'proj-1' });
      expectError(result, 403, 'FORBIDDEN');
    });
  });

  // -------------------------------------------------------------------------
  // GET /api/projects/[id]/members
  // -------------------------------------------------------------------------
  describe('GET /api/projects/[id]/members', () => {
    it('returns members when user is a project member', async () => {
      const { GET } = await import('@/app/api/projects/[id]/members/route');
      vi.mocked(isUserProjectMember).mockResolvedValue(true);
      vi.mocked(GetMembersByProjectId).mockResolvedValue([
        { id: 'm-1', user_id: 'user-1', name: 'Dev', email: 'dev@example.com', role: 'Member', status: 'Confirmed' },
      ] as any);

      const req = createMockRequest('GET', {
        url: 'http://localhost:3000/api/projects/proj-1/members',
      });
      const result = await callHandler(GET, req, { id: 'proj-1' });
      const data = expectSuccess(result);
      expect(data).toHaveLength(1);
    });

    it('returns 403 when user is not a member', async () => {
      const { GET } = await import('@/app/api/projects/[id]/members/route');
      vi.mocked(isUserProjectMember).mockResolvedValue(false);

      const req = createMockRequest('GET', {
        url: 'http://localhost:3000/api/projects/proj-1/members',
      });
      const result = await callHandler(GET, req, { id: 'proj-1' });
      expectError(result, 403, 'FORBIDDEN');
    });
  });

  // -------------------------------------------------------------------------
  // PATCH /api/projects/[id]/members -- role update
  // -------------------------------------------------------------------------
  describe('PATCH /api/projects/[id]/members', () => {
    it('updates member role', async () => {
      const { PATCH } = await import('@/app/api/projects/[id]/members/route');
      vi.mocked(isUserProjectMember).mockResolvedValue(true);
      vi.mocked(UpdateRoleMember).mockResolvedValue({ id: 'm-1', role: 'Lead' } as any);

      const req = createMockRequest('PATCH', {
        url: 'http://localhost:3000/api/projects/proj-1/members',
        body: { member_id: 'm-1', role: 'Lead' },
      });
      const result = await callHandler(PATCH, req, { id: 'proj-1' });
      const data = expectSuccess(result);
      expect(data.role).toBe('Lead');
    });

    it('returns 400 when member_id or role is missing', async () => {
      const { PATCH } = await import('@/app/api/projects/[id]/members/route');
      vi.mocked(isUserProjectMember).mockResolvedValue(true);

      const req = createMockRequest('PATCH', {
        url: 'http://localhost:3000/api/projects/proj-1/members',
        body: { member_id: 'm-1' },
      });
      const result = await callHandler(PATCH, req, { id: 'proj-1' });
      expectError(result, 400, 'BAD_REQUEST');
    });
  });

  // -------------------------------------------------------------------------
  // PATCH /api/projects/[id]/members/status
  // -------------------------------------------------------------------------
  describe('PATCH /api/projects/[id]/members/status', () => {
    it('updates member status for own user', async () => {
      const { PATCH } = await import('@/app/api/projects/[id]/members/status/route');
      vi.mocked(isUserProjectMember).mockResolvedValue(true);
      vi.mocked(UpdateStatusMember).mockResolvedValue({ id: 'm-1', status: 'Confirmed' } as any);

      const req = createMockRequest('PATCH', {
        url: 'http://localhost:3000/api/projects/proj-1/members/status',
        body: { user_id: 'user-1', status: 'Confirmed', wasInOtherProject: false },
      });
      const result = await callHandler(PATCH, req, { id: 'proj-1' });
      expectSuccess(result);
    });

    it('returns 403 when updating another user status', async () => {
      const { PATCH } = await import('@/app/api/projects/[id]/members/status/route');
      vi.mocked(isUserProjectMember).mockResolvedValue(true);

      const req = createMockRequest('PATCH', {
        url: 'http://localhost:3000/api/projects/proj-1/members/status',
        body: { user_id: 'other-user', status: 'Confirmed', wasInOtherProject: false },
      });
      const result = await callHandler(PATCH, req, { id: 'proj-1' });
      expectError(result, 403, 'FORBIDDEN');
    });
  });

  // -------------------------------------------------------------------------
  // GET /api/projects/check-invitation
  // -------------------------------------------------------------------------
  describe('GET /api/projects/check-invitation', () => {
    it('returns invitation data', async () => {
      const { GET } = await import('@/app/api/projects/check-invitation/route');
      vi.mocked(CheckInvitation).mockResolvedValue({
        invitation: { isValid: true, isConfirming: true, exists: true, hasConfirmedProject: false },
        project: { project_id: 'proj-1', project_name: 'Test', confirmed_project_name: '', hackathon_id: 'h-1' },
      } as any);

      const req = createMockRequest('GET', {
        url: 'http://localhost:3000/api/projects/check-invitation?invitation=inv-1',
      });
      const result = await callHandler(GET, req);
      const data = expectSuccess(result);
      expect(data.invitation.exists).toBe(true);
    });

    it('returns 400 when invitation param is missing', async () => {
      const { GET } = await import('@/app/api/projects/check-invitation/route');
      const req = createMockRequest('GET', {
        url: 'http://localhost:3000/api/projects/check-invitation',
      });
      const result = await callHandler(GET, req);
      expectError(result, 400, 'BAD_REQUEST');
    });

    it('returns 403 when user_id does not match session', async () => {
      const { GET } = await import('@/app/api/projects/check-invitation/route');
      const req = createMockRequest('GET', {
        url: 'http://localhost:3000/api/projects/check-invitation?invitation=inv-1&user_id=other',
      });
      const result = await callHandler(GET, req);
      expectError(result, 403, 'FORBIDDEN');
    });
  });

  // -------------------------------------------------------------------------
  // PUT /api/projects/set-winner -- role-based access
  // -------------------------------------------------------------------------
  describe('PUT /api/projects/set-winner', () => {
    it('sets winner when user has badge_admin role', async () => {
      const { PUT } = await import('@/app/api/projects/set-winner/route');
      mockAuthSession(adminSession);
      vi.mocked(SetWinner).mockResolvedValue({ success: true } as any);

      const req = createMockRequest('PUT', {
        url: 'http://localhost:3000/api/projects/set-winner',
        body: { project_id: 'proj-1', isWinner: true },
      });
      const result = await callHandler(PUT, req);
      expectSuccess(result);
    });

    it('returns 403 when user lacks badge_admin role', async () => {
      const { PUT } = await import('@/app/api/projects/set-winner/route');
      // userSession has no roles
      const req = createMockRequest('PUT', {
        url: 'http://localhost:3000/api/projects/set-winner',
        body: { project_id: 'proj-1', isWinner: true },
      });
      const result = await callHandler(PUT, req);
      expectError(result, 403, 'FORBIDDEN');
    });

    it('returns 400 when project_id is missing', async () => {
      const { PUT } = await import('@/app/api/projects/set-winner/route');
      mockAuthSession(adminSession);

      const req = createMockRequest('PUT', {
        url: 'http://localhost:3000/api/projects/set-winner',
        body: { isWinner: true },
      });
      const result = await callHandler(PUT, req);
      expectError(result, 400, 'BAD_REQUEST');
    });
  });

  // -------------------------------------------------------------------------
  // POST /api/projects/export -- role-based, no stack trace leaks
  // -------------------------------------------------------------------------
  describe('POST /api/projects/export', () => {
    it('returns 403 when user lacks devrel role', async () => {
      const { POST } = await import('@/app/api/projects/export/route');
      // userSession has no roles
      const req = createMockRequest('POST', {
        url: 'http://localhost:3000/api/projects/export',
        body: { hackathon_id: 'h-1' },
      });
      const result = await callHandler(POST, req);
      expectError(result, 403, 'FORBIDDEN');
    });

    it('exports when user has devrel role', async () => {
      const { POST } = await import('@/app/api/projects/export/route');
      mockAuthSession(adminSession);
      const fakeBuffer = Buffer.from('xlsx-data');
      vi.mocked(exportShowcase).mockResolvedValue(fakeBuffer);

      const req = createMockRequest('POST', {
        url: 'http://localhost:3000/api/projects/export',
        body: { hackathon_id: 'h-1' },
      });
      const result = await callHandler(POST, req);
      // The export route returns raw buffer, not JSON envelope
      expect(result.status).toBe(200);
    });

    it('never exposes stack traces in error responses', async () => {
      const { POST } = await import('@/app/api/projects/export/route');
      mockAuthSession(adminSession);
      vi.mocked(exportShowcase).mockRejectedValue(new Error('DB connection failed'));

      const req = createMockRequest('POST', {
        url: 'http://localhost:3000/api/projects/export',
        body: {},
      });
      const result = await callHandler(POST, req);
      expect(result.status).toBe(500);
      // Verify no stack trace in error body
      const body = JSON.stringify(result.body);
      expect(body).not.toContain('at ');
      expect(body).not.toContain('.ts:');
      expect(body).not.toContain('stack');
    });
  });

  // -------------------------------------------------------------------------
  // POST /api/projects/invite-member
  // -------------------------------------------------------------------------
  describe('POST /api/projects/invite-member', () => {
    it('sends invitations when user is a project member', async () => {
      const { POST } = await import('@/app/api/projects/invite-member/route');
      vi.mocked(isUserProjectMember).mockResolvedValue(true);
      vi.mocked(generateInvitation).mockResolvedValue({ Success: true } as any);

      const req = createMockRequest('POST', {
        url: 'http://localhost:3000/api/projects/invite-member',
        body: {
          hackathon_id: 'h-1',
          project_id: 'proj-1',
          emails: ['friend@example.com'],
        },
      });
      const result = await callHandler(POST, req);
      expectSuccess(result);
    });

    it('returns 403 when user is not a project member', async () => {
      const { POST } = await import('@/app/api/projects/invite-member/route');
      vi.mocked(isUserProjectMember).mockResolvedValue(false);

      const req = createMockRequest('POST', {
        url: 'http://localhost:3000/api/projects/invite-member',
        body: {
          hackathon_id: 'h-1',
          project_id: 'proj-1',
          emails: ['friend@example.com'],
        },
      });
      const result = await callHandler(POST, req);
      expectError(result, 403, 'FORBIDDEN');
    });
  });

  // -------------------------------------------------------------------------
  // POST /api/projects/submit
  // -------------------------------------------------------------------------
  describe('POST /api/projects/submit', () => {
    it('creates a project via submit service', async () => {
      const { POST } = await import('@/app/api/projects/submit/route');
      vi.mocked(submitProjectService).mockResolvedValue(sampleProject as any);

      const req = createMockRequest('POST', {
        url: 'http://localhost:3000/api/projects/submit',
        body: { project_name: 'New Submission', short_description: 'desc' },
      });
      const result = await callHandler(POST, req);
      expectSuccess(result, 201);
    });
  });

  // -------------------------------------------------------------------------
  // GET /api/projects/submit
  // -------------------------------------------------------------------------
  describe('GET /api/projects/submit', () => {
    it('returns project by hackathon and user', async () => {
      const { GET } = await import('@/app/api/projects/submit/route');
      const { GetProjectByHackathonAndUser } = await import('@/server/services/projects');
      vi.mocked(GetProjectByHackathonAndUser).mockResolvedValue(sampleProject as any);

      const req = createMockRequest('GET', {
        url: 'http://localhost:3000/api/projects/submit?hackathon_id=h-1&user_id=user-1',
      });
      const result = await callHandler(GET, req);
      const data = expectSuccess(result);
      expect(data.project).toBeTruthy();
    });

    it('returns 403 when user_id does not match session', async () => {
      const { GET } = await import('@/app/api/projects/submit/route');
      const req = createMockRequest('GET', {
        url: 'http://localhost:3000/api/projects/submit?hackathon_id=h-1&user_id=other-user',
      });
      const result = await callHandler(GET, req);
      expectError(result, 403, 'FORBIDDEN');
    });
  });
});
