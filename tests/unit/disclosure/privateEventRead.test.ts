import { describe, expect, it, vi, beforeEach } from 'vitest';

const { getHackathonMock, getAuthSessionMock } = vi.hoisted(() => ({
  getHackathonMock: vi.fn(),
  getAuthSessionMock: vi.fn(),
}));

vi.mock('@/server/services/hackathons', () => ({
  getHackathon: getHackathonMock,
  updateHackathon: vi.fn(),
}));
vi.mock('@/lib/auth/authSession', () => ({ getAuthSession: getAuthSessionMock }));
vi.mock('@/lib/protectedRoute', () => ({
  withAuth: () => () => new Response(null, { status: 403 }),
  withAuthRole: () => () => new Response(null, { status: 403 }),
}));

import { GET } from '@/app/api/events/[id]/route';

const ctx = { params: Promise.resolve({ id: 'h1' }) };
const req = {} as any;

const PRIVATE_EVENT = {
  id: 'h1',
  is_public: false,
  created_by: 'owner-1',
  cohosts: ['cohost@example.com'],
  prize_pool: 'secret',
};

const user = (over: Record<string, unknown> = {}) => ({
  user: { id: 'rando', email: 'rando@example.com', custom_attributes: [], ...over },
});

beforeEach(() => {
  getHackathonMock.mockReset();
  getAuthSessionMock.mockReset();
  getHackathonMock.mockResolvedValue(PRIVATE_EVENT);
});

describe('GET /api/events/[id] — private event visibility', () => {
  it('404s an anonymous caller', async () => {
    getAuthSessionMock.mockResolvedValue(null);
    expect((await GET(req, ctx)).status).toBe(404);
  });

  // Finding: any authenticated account could read unpublished events.
  // Signup is open, so that was barely a restriction.
  it('404s an ordinary logged-in user', async () => {
    getAuthSessionMock.mockResolvedValue(user());
    const res = await GET(req, ctx);
    expect(res.status).toBe(404);
    expect(JSON.stringify(await res.json())).not.toMatch(/secret/);
  });

  it('allows devrel', async () => {
    getAuthSessionMock.mockResolvedValue(user({ custom_attributes: ['devrel'] }));
    expect((await GET(req, ctx)).status).toBe(200);
  });

  it('allows team1-admin', async () => {
    getAuthSessionMock.mockResolvedValue(user({ custom_attributes: ['team1-admin'] }));
    expect((await GET(req, ctx)).status).toBe(200);
  });

  it('allows the creator', async () => {
    getAuthSessionMock.mockResolvedValue(user({ id: 'owner-1' }));
    expect((await GET(req, ctx)).status).toBe(200);
  });

  it('allows a cohost by email, case-insensitively', async () => {
    getAuthSessionMock.mockResolvedValue(user({ email: 'CoHost@Example.com' }));
    expect((await GET(req, ctx)).status).toBe(200);
  });

  it('still serves a public event to anonymous callers', async () => {
    getHackathonMock.mockResolvedValue({ ...PRIVATE_EVENT, is_public: true });
    getAuthSessionMock.mockResolvedValue(null);
    expect((await GET(req, ctx)).status).toBe(200);
  });
});
