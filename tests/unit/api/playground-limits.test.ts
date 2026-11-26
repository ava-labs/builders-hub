import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

/* A stats dashboard: its creator is shown by the rule of the creator's profile, and what an account stores has a
   size. The Console log of an account has a size and a rate too. */

const { db, session, consumeQuota } = vi.hoisted(() => ({
  db: { playgroundFindFirst: vi.fn(), playgroundCreate: vi.fn(), logCreate: vi.fn() },
  session: { user: null as null | { id: string } },
  consumeQuota: vi.fn(),
}));
vi.mock('@/prisma/prisma', () => ({
  prisma: {
    statsPlayground: { findFirst: db.playgroundFindFirst, create: db.playgroundCreate },
    consoleLog: { create: db.logCreate },
  },
}));
vi.mock('@/lib/auth/authSession', () => ({ getAuthSession: async () => (session.user ? { user: session.user } : null) }));
vi.mock('@/lib/verification/limits', () => ({ consumeQuota }));

import { GET, POST } from '@/app/api/playground/route';
import { POST as addLog } from '@/app/api/console-log/route';

const json = (url: string, body: unknown) =>
  new NextRequest(`https://build.avax.network${url}`, { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } });
const row = (privacy: string) => ({
  id: 'pg1',
  user_id: 'owner',
  name: 'P',
  is_public: true,
  charts: [],
  view_count: 1,
  favorites: [],
  _count: { favorites: 0 },
  user: { id: 'owner', name: 'Owner Name', user_name: 'owner', image: 'i', profile_privacy: privacy },
});

beforeEach(() => {
  for (const fn of Object.values(db)) fn.mockReset();
  consumeQuota.mockReset().mockResolvedValue({ allowed: true, retryAfterSeconds: 1 });
  session.user = null;
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('GET /api/playground?id=', () => {
  const read = async () => (await GET(new NextRequest('https://build.avax.network/api/playground?id=pg1'))).json();

  it('names no creator of a private profile to a visitor', async () => {
    db.playgroundFindFirst.mockResolvedValue(row('private'));
    const body = await read();
    expect(body.creator).toBeUndefined();
    expect(body.user).toBeUndefined();
    expect(body.user_id).toBeUndefined();
    expect(JSON.stringify(body)).not.toContain('Owner Name');
    expect(body.name).toBe('P');
  });

  it('names the creator of a public profile, and the owner to the owner', async () => {
    db.playgroundFindFirst.mockResolvedValue(row('public'));
    expect((await read()).creator.user_name).toBe('owner');
    db.playgroundFindFirst.mockResolvedValue(row('private'));
    session.user = { id: 'owner' };
    const own = await read();
    expect(own.is_owner).toBe(true);
    expect(own.user_id).toBe('owner');
  });
});

describe('POST /api/playground', () => {
  it('refuses a dashboard above the count or the size of a dashboard', async () => {
    session.user = { id: 'me' };
    for (const body of [
      { name: 'x'.repeat(121), charts: [] },
      { name: 'P', charts: Array.from({ length: 51 }, () => ({})) },
      { name: 'P', charts: [{ title: 'x'.repeat(200_001) }] },
    ]) {
      expect((await POST(json('/api/playground', body))).status).toBe(400);
    }
    expect(db.playgroundCreate).not.toHaveBeenCalled();
    db.playgroundCreate.mockResolvedValue({ id: 'pg2' });
    expect((await POST(json('/api/playground', { name: 'P', charts: [{ title: 'T' }] }))).status).toBe(200);
  });
});

describe('POST /api/console-log', () => {
  it('refuses an entry above its size, and counts the entries of an account', async () => {
    session.user = { id: 'me' };
    for (const body of [
      { status: 'x'.repeat(65), actionPath: '/a' },
      { status: 'ok', actionPath: 'x'.repeat(301) },
      { status: 'ok', actionPath: '/a', data: { blob: 'x'.repeat(100_001) } },
    ]) {
      expect((await addLog(json('/api/console-log', body))).status).toBe(400);
    }
    expect(db.logCreate).not.toHaveBeenCalled();

    db.logCreate.mockResolvedValue({ id: 'l1' });
    expect((await addLog(json('/api/console-log', { status: 'ok', actionPath: '/a', data: { tx: '0x1' } }))).status).toBe(200);
    expect(consumeQuota).toHaveBeenCalledWith('console-log:me', { limit: 600, windowMs: 3_600_000 });
    consumeQuota.mockResolvedValue({ allowed: false, retryAfterSeconds: 30 });
    expect((await addLog(json('/api/console-log', { status: 'ok', actionPath: '/a' }))).status).toBe(429);
    expect(db.logCreate).toHaveBeenCalledTimes(1);
  });
});
