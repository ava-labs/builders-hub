import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { createUnlinkAdminMock, createUnlinkAuthRoutesMock } = vi.hoisted(() => ({
  createUnlinkAdminMock: vi.fn(),
  createUnlinkAuthRoutesMock: vi.fn(),
}));

const SESSION_SECRET = 'admin-test-session-secret-with-32-characters';

vi.mock('@unlink-xyz/sdk/admin', () => ({
  createUnlinkAdmin: createUnlinkAdminMock,
  createUnlinkAuthRoutes: createUnlinkAuthRoutesMock,
}));

beforeEach(() => {
  vi.resetModules();
  createUnlinkAdminMock.mockReset();
  createUnlinkAuthRoutesMock.mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('getUnlinkServer', () => {
  it('fails closed when either server secret is missing or the session secret is weak', async () => {
    const { getUnlinkServer } = await import('@/lib/unlink/admin');

    vi.stubEnv('UNLINK_API_KEY', '');
    vi.stubEnv('UNLINK_DEMO_SESSION_SECRET', SESSION_SECRET);
    expect(getUnlinkServer()).toBeNull();

    vi.stubEnv('UNLINK_API_KEY', 'api-key');
    vi.stubEnv('UNLINK_DEMO_SESSION_SECRET', '');
    expect(getUnlinkServer()).toBeNull();

    vi.stubEnv('UNLINK_DEMO_SESSION_SECRET', 'too-short');
    expect(getUnlinkServer()).toBeNull();
    expect(createUnlinkAdminMock).not.toHaveBeenCalled();
  });

  it('lazily caches the exact Fuji admin client and refreshes it after key rotation', async () => {
    const firstAdmin = { name: 'first' };
    const secondAdmin = { name: 'second' };
    createUnlinkAdminMock.mockReturnValueOnce(firstAdmin).mockReturnValueOnce(secondAdmin);
    vi.stubEnv('UNLINK_API_KEY', ' api-key-one ');
    vi.stubEnv('UNLINK_DEMO_SESSION_SECRET', ` ${SESSION_SECRET} `);

    const { getUnlinkServer } = await import('@/lib/unlink/admin');
    expect(getUnlinkServer()).toEqual({ admin: firstAdmin, sessionSecret: SESSION_SECRET });
    expect(getUnlinkServer()).toEqual({ admin: firstAdmin, sessionSecret: SESSION_SECRET });
    expect(createUnlinkAdminMock).toHaveBeenCalledTimes(1);
    expect(createUnlinkAdminMock).toHaveBeenCalledWith({
      environment: 'avalanche-fuji',
      apiKey: 'api-key-one',
    });

    vi.stubEnv('UNLINK_API_KEY', 'api-key-two');
    expect(getUnlinkServer()).toEqual({ admin: secondAdmin, sessionSecret: SESSION_SECRET });
    expect(createUnlinkAdminMock).toHaveBeenLastCalledWith({
      environment: 'avalanche-fuji',
      apiKey: 'api-key-two',
    });
  });

  it('re-exports the SDK auth-route factory instead of maintaining a local protocol copy', async () => {
    const { createUnlinkAuthRoutes } = await import('@/lib/unlink/admin');
    expect(createUnlinkAuthRoutes).toBe(createUnlinkAuthRoutesMock);
  });
});
