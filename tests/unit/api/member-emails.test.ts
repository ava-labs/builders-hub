import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

/* Who may read a project member's email address: the member, and a team that typed the address into an invitation.
   A member row can be made from a user ID alone, so the list does not return another user's account email. */

const db = vi.hoisted(() => ({
  projectFindUnique: vi.fn(),
  memberFindMany: vi.fn(),
  memberUpdateMany: vi.fn(),
  createProjectWithMembers: vi.fn(),
  getFilteredProjects: vi.fn(),
}));

vi.mock('@/prisma/prisma', () => ({
  prisma: {
    project: { findUnique: db.projectFindUnique },
    member: { findMany: db.memberFindMany, updateMany: db.memberUpdateMany },
  },
}));
const roles = vi.hoisted(() => ({ list: [] as string[] }));
vi.mock('@/lib/auth/authSession', () => ({
  getAuthSession: async () => ({ user: { id: 'me', email: 'me@example.com', custom_attributes: roles.list } }),
}));
vi.mock('@/server/services/projects', () => ({
  createProjectWithMembers: db.createProjectWithMembers,
  getFilteredProjects: db.getFilteredProjects,
}));

import { memberEmailFor } from '@/server/services/projectMembership';
import { GetMembersByProjectId, GetProjectByIdWithMembers } from '@/server/services/memberProject';
import { GET as listProjects, POST as createProject } from '@/app/api/projects/route';

beforeEach(() => {
  for (const fn of Object.values(db)) fn.mockReset();
  roles.list = [];
});

describe('memberEmailFor', () => {
  it('gives a viewer their own account email', () => {
    expect(memberEmailFor('me', { email: null, user: { id: 'me', email: 'me@example.com' } })).toBe('me@example.com');
  });

  it('gives the email that the team typed into an invitation', () => {
    expect(memberEmailFor('me', { email: 'invited@example.com', user: null })).toBe('invited@example.com');
  });

  it("keeps another user's account email private", () => {
    expect(memberEmailFor('me', { email: null, user: { id: 'other', email: 'other@example.com' } })).toBeNull();
  });
});

describe('GetMembersByProjectId', () => {
  it('does not return the account email of a member that was added by user ID', async () => {
    db.projectFindUnique.mockResolvedValue({ hackathon: null });
    db.memberFindMany.mockResolvedValue([
      { id: 'm1', user_id: 'me', email: null, role: 'Member', status: 'Confirmed', user: { id: 'me', name: 'Me', email: 'me@example.com', image: null } },
      { id: 'm2', user_id: 'other', email: null, role: 'Member', status: 'Pending Confirmation', user: { id: 'other', name: 'Other', email: 'other@example.com', image: null } },
      { id: 'm3', user_id: null, email: 'invited@example.com', role: 'Member', status: 'Pending Confirmation', user: null },
    ]);
    const members = await GetMembersByProjectId('project-1', 'me');
    expect(members.map((m) => m.email)).toEqual(['me@example.com', null, 'invited@example.com']);
    expect(members[1].name).toBe('Other');
  });
});

describe('POST /api/projects', () => {
  const post = (body: unknown) =>
    createProject(new NextRequest('http://localhost/api/projects', { method: 'POST', body: JSON.stringify(body) }), {});

  it('makes the caller the one confirmed member and every other user an invitee', async () => {
    db.createProjectWithMembers.mockResolvedValue({ id: 'project-1' });
    const res = await post({
      project_name: 'P',
      members: [
        { user_id: 'other', role: 'lead', status: 'Confirmed' },
        { user_id: 'me', role: 'lead', status: 'Removed' },
        { user_id: 'other', role: 'Member', status: 'Confirmed' },
      ],
    });
    expect(res.status).toBe(201);
    expect(db.createProjectWithMembers.mock.calls[0][0].members).toEqual([
      { user_id: 'me', role: 'Member', status: 'Confirmed' },
      { user_id: 'other', role: 'Member', status: 'Pending Confirmation' },
    ]);
  });

  it('refuses a body with a field of the wrong type, before any write', async () => {
    for (const body of [{ members: [{ user_id: { not: '' } }] }, { project_name: { set: 'x' } }, { hackaton_id: ['a'] }, 'text', null]) {
      expect((await post(body)).status).toBe(400);
    }
    expect(db.createProjectWithMembers).not.toHaveBeenCalled();
  });
});

describe('GetProjectByIdWithMembers', () => {
  it('reads no account email and no Telegram name of a member', async () => {
    db.projectFindUnique.mockResolvedValue({ id: 'project-1', members: [] });
    await GetProjectByIdWithMembers('project-1');
    const select = db.projectFindUnique.mock.calls[0][0].include.members.include.user.select;
    expect(Object.keys(select).sort()).toEqual(['additional_social_accounts', 'bio', 'id', 'image', 'name', 'user_name']);
  });
});

describe('GET /api/projects', () => {
  const list = (query = '') => listProjects(new NextRequest(`http://localhost/api/projects${query}`), {});

  it('lists all projects only for the showcase role, as the showcase page does', async () => {
    expect((await list()).status).toBe(403);
    expect(db.getFilteredProjects).not.toHaveBeenCalled();
    roles.list = ['showcase'];
    db.getFilteredProjects.mockResolvedValue({ projects: [], total: 0 });
    expect((await list('?page=2&pageSize=50')).status).toBe(200);
    expect(db.getFilteredProjects).toHaveBeenCalledWith({ page: 2, pageSize: 50, search: undefined, event: undefined });
  });

  it('refuses a page size above the cap, and a page that is no number', async () => {
    roles.list = ['devrel'];
    for (const query of ['?pageSize=100000', '?pageSize=0', '?pageSize=-5', '?page=0', '?page=x', '?pageSize=x']) {
      expect((await list(query)).status, query).toBe(400);
    }
    expect(db.getFilteredProjects).not.toHaveBeenCalled();
  });
});
