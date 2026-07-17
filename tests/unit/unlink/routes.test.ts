import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createUnlinkSessionCookie, readUnlinkSession } from '@/lib/unlink/session';

const { createUnlinkAuthRoutesMock, getUnlinkServerMock } = vi.hoisted(() => ({
  createUnlinkAuthRoutesMock: vi.fn(),
  getUnlinkServerMock: vi.fn(),
}));

vi.mock('@/lib/unlink/admin', () => ({
  createUnlinkAuthRoutes: createUnlinkAuthRoutesMock,
  getUnlinkServer: getUnlinkServerMock,
}));

import { POST as register } from '@/app/api/unlink/register/route';
import { POST as authorize } from '@/app/api/unlink/authorization-token/route';

const ENGINE_ADDRESS = `unlink1${'a'.repeat(38)}`;
const OTHER_ADDRESS = `unlink1${'b'.repeat(38)}`;
const SESSION_SECRET = 'route-test-session-secret-with-32-characters';
const ADMIN = { kind: 'admin' };

type AuthRouteOptions = {
  admin: unknown;
  authenticate: (request: Request) => Promise<unknown>;
  authorizeUnlinkAddress: (params: { request: Request; session: unknown; unlinkAddress: string }) => Promise<boolean>;
  expiresInSeconds?: number;
  onRegister?: (params: {
    request: Request;
    session: unknown;
    registration: {
      address: string;
      payload: unknown;
      wire: unknown;
    };
  }) => Promise<void>;
};

function postRequest(path: string, body: unknown, options: { cookie?: string; origin?: string | null } = {}): Request {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  if (options.cookie) headers.set('Cookie', options.cookie);
  if (options.origin !== null) headers.set('Origin', options.origin ?? 'https://build.avax.network');

  return new Request(`https://build.avax.network${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

function sessionCookie(address = ENGINE_ADDRESS, now?: number): string {
  return createUnlinkSessionCookie(address, SESSION_SECRET, {
    ...(now !== undefined && { now }),
    secure: true,
  }).split(';', 1)[0];
}

function expectNoStore(response: Response): void {
  expect(response.headers.get('cache-control')).toBe('no-store');
}

beforeEach(() => {
  createUnlinkAuthRoutesMock.mockReset();
  getUnlinkServerMock.mockReset();
  getUnlinkServerMock.mockReturnValue({ admin: ADMIN, sessionSecret: SESSION_SECRET });
});

describe('POST /api/unlink/register', () => {
  it('binds the session cookie to the address returned by Engine', async () => {
    createUnlinkAuthRoutesMock.mockImplementation((options: AuthRouteOptions) => ({
      register: async (request: Request) => {
        const session = await options.authenticate(request);
        await options.onRegister?.({
          request,
          session,
          registration: { address: ENGINE_ADDRESS, payload: {}, wire: {} },
        });
        return Response.json({ ok: true, address: ENGINE_ADDRESS });
      },
    }));

    const response = await register(postRequest('/api/unlink/register', { unlinkAddress: OTHER_ADDRESS }));

    expect(response.status).toBe(200);
    expectNoStore(response);
    expect(createUnlinkAuthRoutesMock).toHaveBeenCalledWith(expect.objectContaining({ admin: ADMIN }));

    const setCookie = response.headers.get('set-cookie');
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('SameSite=Strict');
    expect(setCookie).toContain('Path=/api/unlink');
    expect(
      readUnlinkSession(
        new Request('https://build.avax.network/api/unlink/authorization-token', {
          headers: { cookie: setCookie!.split(';', 1)[0] },
        }),
        SESSION_SECRET,
      )?.unlinkAddress,
    ).toBe(ENGINE_ADDRESS);
  });

  it('returns a generic 503 when server configuration is missing', async () => {
    getUnlinkServerMock.mockReturnValue(null);
    const response = await register(postRequest('/api/unlink/register', {}));

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: { code: 'SERVICE_UNAVAILABLE', message: 'service unavailable' },
    });
    expectNoStore(response);
    expect(createUnlinkAuthRoutesMock).not.toHaveBeenCalled();
  });

  it('preserves canonical SDK errors without setting a session cookie', async () => {
    createUnlinkAuthRoutesMock.mockReturnValue({
      register: async () =>
        Response.json({ error: { code: 'INVALID_PAYLOAD', message: 'invalid registration' } }, { status: 400 }),
    });

    const response = await register(postRequest('/api/unlink/register', {}));
    expect(response.status).toBe(400);
    expect(response.headers.get('set-cookie')).toBeNull();
    expectNoStore(response);
  });

  it('fails closed if the SDK succeeds without returning a registered address', async () => {
    createUnlinkAuthRoutesMock.mockReturnValue({
      register: async () => Response.json({ ok: true }),
    });

    const response = await register(postRequest('/api/unlink/register', {}));
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({
      error: { code: 'BACKEND_ERROR', message: 'backend request failed' },
    });
    expectNoStore(response);
  });

  it('returns a generic backend error when the SDK handler throws', async () => {
    createUnlinkAuthRoutesMock.mockImplementation(() => {
      throw new Error('sensitive upstream detail');
    });

    const response = await register(postRequest('/api/unlink/register', {}));
    expect(response.status).toBe(502);
    expect(await response.text()).not.toContain('sensitive upstream detail');
    expectNoStore(response);
  });

  it('does not expose upstream 5xx response details', async () => {
    createUnlinkAuthRoutesMock.mockReturnValue({
      register: async () => Response.json({ error: { message: 'sensitive Engine detail' } }, { status: 500 }),
    });

    const response = await register(postRequest('/api/unlink/register', {}));

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({
      error: { code: 'BACKEND_ERROR', message: 'backend request failed' },
    });
    expectNoStore(response);
  });

  it('rejects cross-origin browser requests before touching the admin client', async () => {
    const response = await register(postRequest('/api/unlink/register', {}, { origin: 'https://evil.example' }));

    expect(response.status).toBe(403);
    expectNoStore(response);
    expect(getUnlinkServerMock).not.toHaveBeenCalled();
  });
});

describe('POST /api/unlink/authorization-token', () => {
  function installAuthorizationHandler(): void {
    createUnlinkAuthRoutesMock.mockImplementation((options: AuthRouteOptions) => ({
      authorizationToken: async (request: Request) => {
        const session = await options.authenticate(request);
        const body = (await request.clone().json()) as { unlinkAddress: string };
        const allowed = await options.authorizeUnlinkAddress({
          request,
          session,
          unlinkAddress: body.unlinkAddress,
        });
        if (!allowed) {
          return Response.json({ error: { code: 'UNAUTHORIZED', message: 'authorization failed' } }, { status: 401 });
        }
        return Response.json({ token: 'capability-token', expiresAt: '2026-07-18T12:15:00Z' });
      },
    }));
  }

  it('issues a token only for the address bound to the signed cookie', async () => {
    installAuthorizationHandler();
    const response = await authorize(
      postRequest('/api/unlink/authorization-token', { unlinkAddress: ENGINE_ADDRESS }, { cookie: sessionCookie() }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      token: 'capability-token',
      expiresAt: '2026-07-18T12:15:00Z',
    });
    expect(createUnlinkAuthRoutesMock).toHaveBeenCalledWith(
      expect.objectContaining({ admin: ADMIN, expiresInSeconds: 900 }),
    );
    expectNoStore(response);
  });

  it('returns the same generic 401 for a missing, tampered, or expired cookie', async () => {
    const validCookie = sessionCookie();
    const tamperedCookie = `${validCookie.slice(0, -1)}${validCookie.endsWith('a') ? 'b' : 'a'}`;
    const expiredCookie = sessionCookie(ENGINE_ADDRESS, 0);
    const responses = await Promise.all([
      authorize(postRequest('/api/unlink/authorization-token', { unlinkAddress: ENGINE_ADDRESS })),
      authorize(
        postRequest('/api/unlink/authorization-token', { unlinkAddress: ENGINE_ADDRESS }, { cookie: tamperedCookie }),
      ),
      authorize(
        postRequest('/api/unlink/authorization-token', { unlinkAddress: ENGINE_ADDRESS }, { cookie: expiredCookie }),
      ),
    ]);

    for (const response of responses) {
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({
        error: { code: 'UNAUTHORIZED', message: 'authorization failed' },
      });
      expectNoStore(response);
    }
    expect(createUnlinkAuthRoutesMock).not.toHaveBeenCalled();
  });

  it('returns the same generic 401 when the requested address does not match', async () => {
    installAuthorizationHandler();
    const response = await authorize(
      postRequest('/api/unlink/authorization-token', { unlinkAddress: OTHER_ADDRESS }, { cookie: sessionCookie() }),
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      error: { code: 'UNAUTHORIZED', message: 'authorization failed' },
    });
    expectNoStore(response);
  });

  it('returns a generic 503 before inspecting cookies when configuration is missing', async () => {
    getUnlinkServerMock.mockReturnValue(null);
    const response = await authorize(postRequest('/api/unlink/authorization-token', { unlinkAddress: ENGINE_ADDRESS }));

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: { code: 'SERVICE_UNAVAILABLE', message: 'service unavailable' },
    });
    expectNoStore(response);
  });

  it('returns a generic backend error when the SDK handler throws', async () => {
    createUnlinkAuthRoutesMock.mockReturnValue({
      authorizationToken: async () => {
        throw new Error('sensitive upstream detail');
      },
    });
    const response = await authorize(
      postRequest('/api/unlink/authorization-token', { unlinkAddress: ENGINE_ADDRESS }, { cookie: sessionCookie() }),
    );

    expect(response.status).toBe(502);
    expect(await response.text()).not.toContain('sensitive upstream detail');
    expectNoStore(response);
  });

  it('does not expose upstream 5xx response details', async () => {
    createUnlinkAuthRoutesMock.mockReturnValue({
      authorizationToken: async () => Response.json({ error: { message: 'sensitive Engine detail' } }, { status: 503 }),
    });
    const response = await authorize(
      postRequest('/api/unlink/authorization-token', { unlinkAddress: ENGINE_ADDRESS }, { cookie: sessionCookie() }),
    );

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({
      error: { code: 'BACKEND_ERROR', message: 'backend request failed' },
    });
    expectNoStore(response);
  });

  it('rejects cross-origin browser requests before inspecting cookies', async () => {
    const response = await authorize(
      postRequest(
        '/api/unlink/authorization-token',
        { unlinkAddress: ENGINE_ADDRESS },
        {
          origin: 'https://evil.example',
        },
      ),
    );

    expect(response.status).toBe(403);
    expectNoStore(response);
    expect(getUnlinkServerMock).not.toHaveBeenCalled();
  });
});
