import { beforeEach, describe, expect, it, vi } from 'vitest';

/* An invitation to a person who is a confirmed member of the project changes nothing: the member stays confirmed. */

const tx = vi.hoisted(() => ({
  member: { findMany: vi.fn(), update: vi.fn(), create: vi.fn() },
}));
vi.mock('@/prisma/prisma', () => ({
  prisma: { $transaction: (run: (client: typeof tx) => unknown) => run(tx) },
}));
vi.mock('@/server/services/SendInvitationProjectMember', () => ({ sendInvitation: vi.fn() }));
vi.mock('@/server/services/getUser', () => ({ getUserByEmail: vi.fn() }));

import { createOrUpdateMemberAtomically } from '@/server/services/inviteProjectMember';

beforeEach(() => {
  for (const fn of Object.values(tx.member)) fn.mockReset();
});

describe('createOrUpdateMemberAtomically', () => {
  it('leaves a confirmed member as it is', async () => {
    const owner = { id: 'm1', user_id: 'owner', email: 'owner@example.com', status: 'Confirmed' };
    tx.member.findMany.mockResolvedValue([{ id: 'm0', status: 'Removed' }, owner]);
    expect(await createOrUpdateMemberAtomically({ id: 'owner' }, 'owner@example.com', 'p1')).toBe(owner);
    expect(tx.member.update).not.toHaveBeenCalled();
    expect(tx.member.create).not.toHaveBeenCalled();
  });

  it('finds the rows of a person with an account by the user ID too', async () => {
    tx.member.findMany.mockResolvedValue([{ id: 'm1', user_id: 'owner', email: null, status: 'Confirmed' }]);
    await createOrUpdateMemberAtomically({ id: 'owner' }, 'owner@example.com', 'p1');
    expect(tx.member.findMany.mock.calls[0][0].where).toEqual({
      project_id: 'p1',
      OR: [{ email: 'owner@example.com' }, { user_id: 'owner' }],
    });
  });

  it('sets a row that is not confirmed to pending, and makes a row for a new address', async () => {
    tx.member.findMany.mockResolvedValue([{ id: 'm2', status: 'Removed' }]);
    await createOrUpdateMemberAtomically(null, 'new@example.com', 'p1');
    expect(tx.member.update.mock.calls[0][0]).toEqual({ where: { id: 'm2' }, data: { role: 'Member', status: 'Pending Confirmation' } });

    tx.member.findMany.mockResolvedValue([]);
    await createOrUpdateMemberAtomically(null, 'new@example.com', 'p1');
    expect(tx.member.create.mock.calls[0][0].data).toMatchObject({ project_id: 'p1', email: 'new@example.com', status: 'Pending Confirmation' });
    expect(tx.member.findMany.mock.calls[1][0].where.OR).toEqual([{ email: 'new@example.com' }]);
  });
});
