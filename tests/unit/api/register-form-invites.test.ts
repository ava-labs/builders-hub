import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

/* A registration with teammates sends one invitation mail per teammate. It takes as many teammates as one
   invitation request does, and it counts in the same budget of invitation requests per account. */

const { createRegisterForm } = vi.hoisted(() => ({ createRegisterForm: vi.fn() }));
vi.mock('@/server/services/registerForms', () => ({ createRegisterForm, getRegisterForm: vi.fn() }));
vi.mock('@/server/services/hubspotUserData', () => ({ syncUserDataToHubSpot: vi.fn() }));
vi.mock('@/prisma/prisma', () => ({
  prisma: {
    hackathon: { findUnique: vi.fn(async () => ({ organizers: null, cohosts: [] })) },
    user: { findUnique: vi.fn(async () => ({ consent_sharing: true })), update: vi.fn() },
  },
}));
const session = vi.hoisted(() => ({ email: 'a@example.com' }));
vi.mock('@/lib/auth/authSession', () => ({ getAuthSession: async () => ({ user: { id: session.email, email: session.email } }) }));

import { POST } from '@/app/api/register-form/route';

const post = (body: Record<string, unknown>) =>
  POST(
    new NextRequest('https://build.avax.network/api/register-form', {
      method: 'POST',
      body: JSON.stringify({ hackathon_id: 'event-1', name: 'A', ...body }),
      headers: { 'content-type': 'application/json' },
    }),
    {},
  );

beforeEach(() => {
  createRegisterForm.mockReset().mockResolvedValue({ id: 'r1' });
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('POST /api/register-form', () => {
  it('takes at most 20 teammates, and a name of at most 200 characters', async () => {
    session.email = 'caps@example.com';
    const many = Array.from({ length: 21 }, (_, i) => `t${i}@example.com`);
    expect((await post({ teammates: many })).status).toBe(400);
    expect((await post({ name: 'x'.repeat(201) })).status).toBe(400);
    expect(createRegisterForm).not.toHaveBeenCalled();
    expect((await post({ teammates: many.slice(0, 20) })).status).toBe(201);
  });

  it('counts a registration with teammates in the invitation budget of the account', async () => {
    session.email = 'budget@example.com';
    for (let i = 0; i < 10; i++) expect((await post({ teammates: ['t@example.com'] })).status).toBe(201);
    expect((await post({ teammates: ['t@example.com'] })).status).toBe(429);
    expect(createRegisterForm).toHaveBeenCalledTimes(10);
    // a registration with no teammate sends no invitation
    expect((await post({ teammates: [' '] })).status).toBe(201);
    expect((await post({})).status).toBe(201);
  });
});
