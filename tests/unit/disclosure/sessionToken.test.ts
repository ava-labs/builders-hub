import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { AuthOptions } from '@/lib/auth/authOptions';

/**
 * Finding: the session callback re-encoded a bearer JWT into the object that
 * NextAuth serialises to the browser, so any XSS could lift a durable API
 * credential out of client-side JS. Nothing consumed the field.
 */
describe('NextAuth session callback', () => {
  it('does not put a bearer token in the client session', async () => {
    const session: any = { user: {} };
    const token: any = {
      id: 'u1',
      name: 'Ada',
      email: 'ada@example.com',
      custom_attributes: ['devrel'],
      avatar: 'https://example/a.png',
    };

    const result: any = await (AuthOptions.callbacks as any).session({ session, token });

    expect(result.jwt_token).toBeUndefined();
    expect(JSON.stringify(result)).not.toMatch(/jwt_token|eyJ/);
  });

  it('still populates the user fields the app reads', async () => {
    const session: any = { user: {} };
    const token: any = {
      id: 'u1',
      name: 'Ada',
      email: 'ada@example.com',
      custom_attributes: ['devrel'],
      avatar: 'https://example/a.png',
      team_id: 't1',
    };

    const result: any = await (AuthOptions.callbacks as any).session({ session, token });

    expect(result.user.id).toBe('u1');
    expect(result.user.email).toBe('ada@example.com');
    expect(result.user.custom_attributes).toEqual(['devrel']);
    expect(result.user.team_id).toBe('t1');
  });

  it('no longer re-encodes a JWT in the session callback', () => {
    // Guards against the line being reintroduced: the callback should not be
    // minting tokens at all.
    const src = readFileSync('lib/auth/authOptions.ts', 'utf8');
    const sessionCb = src.slice(src.indexOf('async session('));
    expect(sessionCb).not.toMatch(/jwt_token:/);
    expect(sessionCb.slice(0, sessionCb.indexOf('async redirect'))).not.toMatch(/\bencode\(/);
  });
});
