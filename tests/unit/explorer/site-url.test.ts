import { afterEach, describe, expect, it, vi } from 'vitest';

import { siteBaseUrl } from '@/lib/chat/site-url';

/** the three variables siteBaseUrl reads; any not given is unset */
const env = (vars: { NEXT_PUBLIC_SITE_URL?: string; VERCEL_ENV?: string; VERCEL_URL?: string }) => {
  for (const k of ['NEXT_PUBLIC_SITE_URL', 'VERCEL_ENV', 'VERCEL_URL'] as const) vi.stubEnv(k, vars[k] ?? '');
};

describe('siteBaseUrl', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('takes NEXT_PUBLIC_SITE_URL first, without its trailing slash', () => {
    env({ NEXT_PUBLIC_SITE_URL: 'https://example.com/', VERCEL_ENV: 'production', VERCEL_URL: 'builder-abc123-team.vercel.app' });
    expect(siteBaseUrl()).toBe('https://example.com');
  });

  it("calls production on its public domain, not its deployment host behind Vercel's login", () => {
    env({ VERCEL_ENV: 'production', VERCEL_URL: 'builder-abc123-team.vercel.app' });
    expect(siteBaseUrl()).toBe('https://build.avax.network');
  });

  it('calls a preview on its deployment host, and local dev on :3000', () => {
    env({ VERCEL_ENV: 'preview', VERCEL_URL: 'builder-def456-team.vercel.app' });
    expect(siteBaseUrl()).toBe('https://builder-def456-team.vercel.app');
    env({});
    expect(siteBaseUrl()).toBe('http://localhost:3000');
  });
});
