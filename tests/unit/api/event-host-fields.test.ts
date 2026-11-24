import { beforeEach, describe, expect, it, vi } from 'vitest';

/* An event read leaves out the host fields (host emails and user IDs), except in the list of events that the
   caller manages. Pages pass the event object to the browser, so the default read must not hold them. */

const db = vi.hoisted(() => ({
  hackathonFindUnique: vi.fn(),
  hackathonFindMany: vi.fn(),
  hackathonCount: vi.fn(),
  userFindUnique: vi.fn(),
}));

vi.mock('@/prisma/prisma', () => ({ prisma: { user: { findUnique: db.userFindUnique } } }));
vi.mock('@prisma/client', () => ({
  Prisma: {},
  PrismaClient: class {
    hackathon = { findUnique: db.hackathonFindUnique, findMany: db.hackathonFindMany, count: db.hackathonCount };
  },
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import { getFilteredHackathons, getHackathon } from '@/server/services/hackathons';

const EVENT = {
  id: 'event-1',
  title: 'Event',
  content: {},
  start_date: new Date('2026-01-01T00:00:00Z'),
  end_date: new Date('2026-01-02T00:00:00Z'),
  cohosts: ['host@example.com'],
  created_by: 'user-9',
  updated_by: 'user-9',
};
const HOST_FIELDS = ['cohosts', 'created_by', 'updated_by', 'created_by_name', 'updated_by_name'];

beforeEach(() => {
  for (const fn of Object.values(db)) fn.mockReset();
});

describe('event reads', () => {
  it('leave the host fields out of a single event', async () => {
    db.hackathonFindUnique.mockResolvedValue(EVENT);
    const event = await getHackathon('event-1');
    for (const field of HOST_FIELDS) expect(event).not.toHaveProperty(field);
    expect(event.title).toBe('Event');
  });

  it('leave the host fields out of a list', async () => {
    db.hackathonCount.mockResolvedValue(1);
    db.hackathonFindMany.mockResolvedValue([EVENT]);
    const { hackathons } = await getFilteredHackathons({});
    for (const field of HOST_FIELDS) expect(hackathons[0]).not.toHaveProperty(field);
    expect(db.userFindUnique).not.toHaveBeenCalled();
  });

  it('keep the host fields in the list of events that the caller manages', async () => {
    db.hackathonCount.mockResolvedValue(1);
    db.hackathonFindMany.mockResolvedValue([EVENT]);
    db.userFindUnique.mockResolvedValue({ id: 'user-9', name: 'Host', email: 'creator@example.com' });
    const { hackathons } = await getFilteredHackathons({ with_hosts: true });
    expect(hackathons[0].cohosts).toEqual(['host@example.com']);
    expect(hackathons[0].created_by_name).toBe('Host');
  });
});
