import { afterEach, describe, expect, it, vi } from 'vitest';
import { knownKey, mayResetCache, trimCache } from '@/lib/api/cache-bounds';

/* A route that keeps answers between requests: the store has a size, a caller cannot empty it in production, and
   a caller's value is a key only when the route knows it. */

afterEach(() => vi.unstubAllEnvs());

describe('trimCache', () => {
  it('drops the oldest entries above the size', () => {
    const cache = new Map([1, 2, 3, 4, 5].map((n) => [`k${n}`, n]));
    trimCache(cache, 3);
    expect([...cache.keys()]).toEqual(['k3', 'k4', 'k5']);
    trimCache(cache, 10);
    expect(cache.size).toBe(3);
  });
});

describe('mayResetCache', () => {
  const asked = new URLSearchParams('clearCache=true');
  it('never lets a request empty a cache in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect(mayResetCache(asked)).toBe(false);
  });
  it('lets a developer or a test empty it, when the request asks', () => {
    vi.stubEnv('NODE_ENV', 'development');
    expect(mayResetCache(asked)).toBe(true);
    expect(mayResetCache(new URLSearchParams('clearCache=1'))).toBe(false);
    expect(mayResetCache(new URLSearchParams())).toBe(false);
  });
});

describe('knownKey', () => {
  it('reads a value the route does not know as the default', () => {
    const known = ['30d', '90d', 'all'] as const;
    expect(knownKey('90d', known, '30d')).toBe('90d');
    for (const value of ['7 d', 'x'.repeat(500), '__proto__', 'constructor', '', null]) {
      expect(knownKey(value, known, '30d')).toBe('30d');
    }
  });
});

describe('GET /api/icm-flow', () => {
  it('reads only the windows the pages ask for', async () => {
    const flows = vi.fn(async () => []);
    vi.doMock('@/lib/icm-clickhouse', () => ({ getICMFlowData: flows, getICMFlowDataBothSides: vi.fn() }));
    const { GET } = await import('@/app/api/icm-flow/route');
    for (const days of ['100000', '31', '0', '-1', '1.5', 'x', '1e2']) {
      expect((await GET(new Request(`https://build.avax.network/api/icm-flow?days=${days}`))).status, days).toBe(400);
    }
    expect(flows).not.toHaveBeenCalled();
    expect((await GET(new Request('https://build.avax.network/api/icm-flow?days=7'))).status).toBe(200);
    expect((await GET(new Request('https://build.avax.network/api/icm-flow'))).status).toBe(200);
    expect(flows.mock.calls.map((call) => (call as unknown[])[0])).toEqual([7, 30]);
  });
});
