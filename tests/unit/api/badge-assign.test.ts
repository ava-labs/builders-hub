import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

/* POST /api/badge/assign: a signed-in user asks for the badge of a course they finished, and a badge admin gives a
   badge to a project. A badge for a requirement is the server's to give, when the requirement is met. */

const assignBadge = vi.hoisted(() => vi.fn());
const session = { user: { id: 'me', email: 'me@example.com', name: 'Me', custom_attributes: [] as string[] } };

vi.mock('@/lib/auth/authSession', () => ({ getAuthSession: async () => session }));
vi.mock('@/server/services/badgeAssignmentService', () => ({
  badgeAssignmentService: {
    assignBadge,
    getRequiredRoleForAssignment: (body: { category?: number; projectId?: string }) => (body.category === 1 || body.projectId ? 'badge_admin' : null),
  },
}));

import { POST } from '@/app/api/badge/assign/route';
import { BadgeCategory } from '@/server/services/badge';

const post = (body: unknown) => POST(new NextRequest('http://localhost/api/badge/assign', { method: 'POST', body: JSON.stringify(body) }), {});

beforeEach(() => {
  assignBadge.mockReset().mockResolvedValue({ success: true, badges: [] });
});

describe('POST /api/badge/assign', () => {
  it('refuses a requirement badge, named by its category or by a body with no course and no project', async () => {
    expect((await post({ userId: 'me', requirementId: 'GitHub', category: BadgeCategory.requirement })).status).toBe(403);
    expect((await post({ userId: 'me', requirementId: 'GitHub' })).status).toBe(403);
    expect(assignBadge).not.toHaveBeenCalled();
  });

  it('gives a course badge to the caller, and to no other user', async () => {
    expect((await post({ userId: 'me', courseId: 'course-1', category: BadgeCategory.academy })).status).toBe(200);
    expect(assignBadge).toHaveBeenCalledTimes(1);
    expect((await post({ userId: 'someone-else', courseId: 'course-1', category: BadgeCategory.academy })).status).toBe(403);
    expect(assignBadge).toHaveBeenCalledTimes(1);
  });

  it('refuses a project badge from a user who is no badge admin', async () => {
    expect((await post({ projectId: 'p1', badgesId: ['b1'], category: BadgeCategory.project })).status).toBe(403);
    expect(assignBadge).not.toHaveBeenCalled();
  });
});
