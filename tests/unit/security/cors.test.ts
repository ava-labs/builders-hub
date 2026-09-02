import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { getCorsHeaders, isAllowedOrigin } from '@/lib/security/cors';

const ORIGINAL_NODE_ENV = process.env.NODE_ENV;
const ORIGINAL_VERCEL_ENV = process.env.VERCEL_ENV;

function setEnv(nodeEnv: string | undefined, vercelEnv: string | undefined) {
  if (nodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = nodeEnv;
  if (vercelEnv === undefined) delete process.env.VERCEL_ENV;
  else process.env.VERCEL_ENV = vercelEnv;
}

beforeEach(() => setEnv('test', undefined));
afterEach(() => setEnv(ORIGINAL_NODE_ENV, ORIGINAL_VERCEL_ENV));

describe('isAllowedOrigin', () => {
  it('always allows the production origin', () => {
    setEnv('production', 'production');
    expect(isAllowedOrigin('https://build.avax.network')).toBe(true);
  });

  it('allows localhost only outside production', () => {
    setEnv('development', undefined);
    expect(isAllowedOrigin('http://localhost:3000')).toBe(true);
    expect(isAllowedOrigin('http://127.0.0.1:3000')).toBe(true);

    setEnv('production', 'production');
    expect(isAllowedOrigin('http://localhost:3000')).toBe(false);
  });

  it('allows *.vercel.app only on https preview deployments, never in production', () => {
    setEnv('production', 'preview');
    expect(isAllowedOrigin('https://builders-hub-git-feature.vercel.app')).toBe(true);
    // http previews are not trusted
    expect(isAllowedOrigin('http://builders-hub-git-feature.vercel.app')).toBe(false);

    // In production the site must not reflect arbitrary Vercel tenants.
    setEnv('production', 'production');
    expect(isAllowedOrigin('https://anything.vercel.app')).toBe(false);
  });

  it('rejects unknown and look-alike origins', () => {
    setEnv('production', 'preview');
    expect(isAllowedOrigin('https://evil.com')).toBe(false);
    // Suffix must be a real subdomain boundary, not a substring.
    expect(isAllowedOrigin('https://notvercel.app')).toBe(false);
    // Production host as a prefix of an attacker domain must not match.
    expect(isAllowedOrigin('https://build.avax.network.evil.com')).toBe(false);
    // Userinfo trick: authority host is the attacker domain.
    expect(isAllowedOrigin('https://build.avax.network@evil.com')).toBe(false);
  });

  it('rejects non-http(s) schemes and malformed origins', () => {
    expect(isAllowedOrigin('file:///etc/passwd')).toBe(false);
    expect(isAllowedOrigin('chrome-extension://abc')).toBe(false);
    expect(isAllowedOrigin('null')).toBe(false);
    expect(isAllowedOrigin('')).toBe(false);
    expect(isAllowedOrigin('not-a-url')).toBe(false);
  });
});

describe('getCorsHeaders', () => {
  it('reflects an allowlisted origin and grants methods', () => {
    setEnv('production', 'production');
    const headers = getCorsHeaders('https://build.avax.network');
    expect(headers['Access-Control-Allow-Origin']).toBe('https://build.avax.network');
    expect(headers['Access-Control-Allow-Methods']).toContain('POST');
    expect(headers['Vary']).toBe('Origin');
  });

  it('never emits a wildcard origin', () => {
    setEnv('production', 'preview');
    for (const origin of [
      'https://build.avax.network',
      'https://foo.vercel.app',
      'https://evil.com',
      null,
    ]) {
      expect(getCorsHeaders(origin)['Access-Control-Allow-Origin']).not.toBe('*');
    }
  });

  it('grants nothing to a disallowed origin (empty headers, no CORS)', () => {
    setEnv('production', 'production');
    expect(getCorsHeaders('https://evil.com')).toEqual({});
  });

  it('grants nothing for requests without an Origin (same-origin / non-browser)', () => {
    expect(getCorsHeaders(null)).toEqual({});
  });
});
