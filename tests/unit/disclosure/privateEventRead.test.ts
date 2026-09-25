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

  // Finding: any authenticated account could read unpublished events, and
  // signup is open, so that was barely a restriction. A 404 here also broke
  // registration and submission for real participants, so the record is
  // narrowed instead of withheld: the unpublished detail still never lands.
  it('withholds unpublished detail from an ordinary logged-in user', async () => {
    getAuthSessionMock.mockResolvedValue(user());
    const res = await GET(req, ctx);
    expect(res.status).toBe(200);
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

describe('GET /api/events/[id] · a signed-in participant', () => {
  // Regression: gating the whole record on the organizer rule 404'd ordinary
  // registrants, and both the registration form and the project-submission
  // hook read this endpoint, so neither flow worked on a private event.
  it('reads a private event rather than getting a 404', async () => {
    getAuthSessionMock.mockResolvedValue(user());

    const res = await GET(req, ctx);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe('h1');
  });

  it('receives only the allowlisted fields', async () => {
    getAuthSessionMock.mockResolvedValue(user());

    const body = await (await GET(req, ctx)).json();

    expect(body.cohosts).toBeUndefined();
    expect(body.created_by).toBeUndefined();
    expect(body.prize_pool).toBeUndefined();
    expect(JSON.stringify(body)).not.toContain('cohost@example.com');
  });

  it('passes through the two content keys the flows read', async () => {
    getHackathonMock.mockResolvedValue({
      ...PRIVATE_EVENT,
      content: { team_size_min: 2, team_size_max: 5, submission_deadline: 'x', judges: 'secret' },
    });
    getAuthSessionMock.mockResolvedValue(user());

    const body = await (await GET(req, ctx)).json();

    expect(body.content).toEqual({ team_size_min: 2, team_size_max: 5, submission_deadline: 'x' });
  });

  it('still returns the whole record to an organizer', async () => {
    getAuthSessionMock.mockResolvedValue(user({ custom_attributes: ['devrel'] }));

    const body = await (await GET(req, ctx)).json();

    expect(body.cohosts).toEqual(['cohost@example.com']);
    expect(body.created_by).toBe('owner-1');
  });

  it('still 404s an anonymous caller', async () => {
    getAuthSessionMock.mockResolvedValue(null);

    expect((await GET(req, ctx)).status).toBe(404);
  });
});
