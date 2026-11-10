import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const getScan = vi.hoisted(() => vi.fn());
const scanChain = vi.hoisted(() => vi.fn());
const after = vi.hoisted(() => vi.fn());
const set = vi.hoisted(() => vi.fn());

vi.mock('@/lib/explorer-query/scan', () => ({ SCAN_FRESH_MS: 15 * 60_000, getScan, scanChain }));
vi.mock('@/lib/redis', () => ({ redis: vi.fn(async () => ({ set })) }));
vi.mock('next/server', async (importOriginal) => ({ ...(await importOriginal<typeof import('next/server')>()), after }));

import { GET } from '@/app/api/explorer/query/scan/route';

/* The landing page's cards: a read of what a scan kept, and the scan itself only for the schedule's secret. */

const card = { figure: '1', label: 'Transactions', spark: [], shape: 'none', finding: null };
const get = (query = '', headers: Record<string, string> = {}) => GET(new Request(`http://localhost/api/explorer/query/scan${query}`, { headers }));
/** what the route left to run once its response was out */
const later = async () => {
  for (const [job] of after.mock.calls) await (job as () => Promise<void>)();
};

beforeEach(() => {
  getScan.mockReset().mockResolvedValue({ at: Date.now(), cards: { q: card } });
  scanChain.mockReset().mockResolvedValue({ at: Date.now(), cards: { q: card } });
  after.mockReset();
  set.mockReset().mockResolvedValue('OK');
  vi.stubEnv('CRON_SECRET', 'the-secret');
});
afterEach(() => vi.unstubAllEnvs());

describe('GET /api/explorer/query/scan', () => {
  it('scans the scheduled chains only for the schedule', async () => {
    expect((await get()).status).toBe(401);
    expect((await get('', { authorization: 'Bearer wrong' })).status).toBe(401);
    expect(scanChain).not.toHaveBeenCalled();
    const res = await get('', { authorization: 'Bearer the-secret' });
    expect(res.status).toBe(200);
    expect(scanChain.mock.calls.map((c) => c[0])).toEqual([43114, 1, 0]);
  });

  it('runs no scan when the secret is not set', async () => {
    vi.stubEnv('CRON_SECRET', '');
    expect((await get('', { authorization: 'Bearer ' })).status).toBe(401);
    expect(scanChain).not.toHaveBeenCalled();
  });

  it('answers a chain with the cards a scan kept, and reads nothing', async () => {
    const out = await (await get('?chainId=43114')).json();
    expect(out.cards).toEqual({ q: card });
    await later();
    expect(scanChain).not.toHaveBeenCalled();
    // the network by its slug
    expect((await (await get('?chainId=all')).json()).cards).toEqual({ q: card });
  });

  it('scans an L1 once its kept scan is old, after the response, one instance at a time', async () => {
    getScan.mockResolvedValue({ at: Date.now() - 16 * 60_000, cards: { q: card } });
    const res = await get('?chainId=43419');
    // the reader gets what is kept now
    expect((await res.json()).cards).toEqual({ q: card });
    expect(scanChain).not.toHaveBeenCalled();
    await later();
    expect(scanChain).toHaveBeenCalledOnce();
    expect(scanChain.mock.calls[0][0]).toBe(43419);
    // another instance holds the claim: this one scans nothing
    scanChain.mockClear();
    after.mockClear();
    set.mockResolvedValue(null);
    await get('?chainId=43419');
    await later();
    expect(scanChain).not.toHaveBeenCalled();
  });

  it('never scans a scheduled chain or a fresh L1 on a read', async () => {
    getScan.mockResolvedValue(null);
    await get('?chainId=43114');
    getScan.mockResolvedValue({ at: Date.now() - 60_000, cards: {} });
    await get('?chainId=43419');
    await later();
    expect(scanChain).not.toHaveBeenCalled();
  });

  it('has no cards for Fuji or an unknown chain', async () => {
    for (const id of ['43113', '5', 'nope', '999999999']) {
      const out = await (await get(`?chainId=${id}`)).json();
      expect(out).toEqual({ at: null, cards: {} });
    }
    expect(getScan).not.toHaveBeenCalled();
  });
});
