import { beforeEach, describe, expect, it, vi } from 'vitest';

/* A user who joins a project of an event leaves the other projects of that event. The rows that change are the
   user's own rows, and a project goes only when this call took its last member. */

const { prisma } = vi.hoisted(() => ({
  prisma: {
    user: { findFirst: vi.fn() },
    member: { findFirst: vi.fn(), findMany: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    project: { findUnique: vi.fn(), findMany: vi.fn(), delete: vi.fn() },
  },
}));
vi.mock('@/prisma/prisma', () => ({ prisma }));

import { UpdateStatusMember } from '@/server/services/memberProject';

const USER = { id: 'user-1', email: 'reader@example.com', name: 'R', image: null };

beforeEach(() => {
  for (const model of Object.values(prisma)) for (const fn of Object.values(model)) fn.mockReset();
  prisma.user.findFirst.mockResolvedValue(USER);
  prisma.member.update.mockResolvedValue({ id: 'm1', status: 'Confirmed' });
  prisma.member.updateMany.mockResolvedValue({ count: 0 });
  prisma.project.findUnique.mockResolvedValue({ hackaton_id: 'event-1' });
});

describe('UpdateStatusMember, when the user was in another project', () => {
  it('finds the rows to remove by the account, when the stored row has no email and no user ID', async () => {
    // a row made from a user ID alone has no email; an invitation sent before sign-up has no user ID
    for (const row of [
      { id: 'm1', user_id: USER.id, email: null },
      { id: 'm1', user_id: null, email: USER.email },
    ]) {
      prisma.member.findMany.mockReset().mockResolvedValueOnce([{ id: 'm2', project_id: 'p2' }]).mockResolvedValue([{ id: 'x' }]);
      prisma.member.updateMany.mockClear();
      prisma.member.findFirst.mockResolvedValue(row);

      await UpdateStatusMember(USER.id, 'p1', 'Confirmed', USER.email, true);

      expect(prisma.member.findMany.mock.calls[0][0].where).toEqual({
        OR: [{ user_id: USER.id }, { email: USER.email }],
        status: { not: 'Removed' },
        project: { hackaton_id: 'event-1', id: { not: 'p1' } },
      });
      expect(prisma.member.updateMany).toHaveBeenCalledWith({ where: { id: { in: ['m2'] } }, data: { status: 'Removed' } });
    }
  });

  it('deletes only a project that this call left with no member', async () => {
    prisma.member.findFirst.mockResolvedValue({ id: 'm1', user_id: USER.id, email: null });
    prisma.member.findMany
      .mockResolvedValueOnce([
        { id: 'm2', project_id: 'p2' },
        { id: 'm3', project_id: 'p3' },
      ])
      .mockResolvedValueOnce([]) // p2 has no member left
      .mockResolvedValueOnce([{ id: 'teammate' }]); // p3 has one

    await UpdateStatusMember(USER.id, 'p1', 'Confirmed', USER.email, true);

    expect(prisma.project.findMany).not.toHaveBeenCalled();
    expect(prisma.project.delete).toHaveBeenCalledTimes(1);
    expect(prisma.project.delete).toHaveBeenCalledWith({ where: { id: 'p2' } });
  });

  it('changes nothing in other projects when the project has no event, or when the user has no other row', async () => {
    prisma.member.findFirst.mockResolvedValue({ id: 'm1', user_id: USER.id, email: null });
    prisma.project.findUnique.mockResolvedValue({ hackaton_id: null });
    await UpdateStatusMember(USER.id, 'p1', 'Confirmed', USER.email, true);
    expect(prisma.member.findMany).not.toHaveBeenCalled();

    prisma.project.findUnique.mockResolvedValue({ hackaton_id: 'event-1' });
    prisma.member.findMany.mockResolvedValue([]);
    await UpdateStatusMember(USER.id, 'p1', 'Confirmed', USER.email, true);

    expect(prisma.member.updateMany).not.toHaveBeenCalled();
    expect(prisma.project.delete).not.toHaveBeenCalled();
  });

  it('leaves the other projects alone when the flag is not set', async () => {
    prisma.member.findFirst.mockResolvedValue({ id: 'm1', user_id: USER.id, email: USER.email });
    await UpdateStatusMember(USER.id, 'p1', 'Confirmed', USER.email, false);
    expect(prisma.project.findUnique).not.toHaveBeenCalled();
    expect(prisma.member.updateMany).not.toHaveBeenCalled();
  });
});
