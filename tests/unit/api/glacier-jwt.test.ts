import { describe, expect, it, vi } from 'vitest';

/* The console token names an account. A session before the terms are accepted has none. */

describe('GET /api/glacier-jwt', () => {
  it('gives no token to a session with no account', async () => {
    const createGlacierJWT = vi.fn(async () => 'token');
    const session = { user: { id: 'pending_a@example.com', email: 'a@example.com' } };
    vi.doMock('@/lib/auth/authSession', () => ({ getAuthSession: async () => session }));
    vi.doMock('@/lib/glacier-jwt', () => ({ createGlacierJWT }));
    const { GET } = await import('@/app/api/glacier-jwt/route');
    expect((await GET()).status).toBe(403);
    expect(createGlacierJWT).not.toHaveBeenCalled();
    session.user.id = 'user-1';
    expect((await GET()).status).toBe(200);
    expect(createGlacierJWT).toHaveBeenCalledWith({ sub: 'user-1', iss: 'https://build.avax.network/', email: 'a@example.com' });
  });
});
