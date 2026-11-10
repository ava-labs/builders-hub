import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { DAppsApiResponse, DefiLlamaProtocol } from '@/types/dapps';

const { fetchMock } = vi.hoisted(() => ({ fetchMock: vi.fn() }));

/* Made-up protocols: one on Avalanche, one elsewhere. */
const protocol = (slug: string, chains: string[], avalancheTvl: number): DefiLlamaProtocol => ({
  id: slug,
  name: slug,
  slug,
  tvl: avalancheTvl,
  chainTvls: { Avalanche: avalancheTvl },
  change_1h: null,
  change_1d: null,
  change_7d: null,
  category: 'Dexs',
  chains,
  logo: '',
  url: 'https://example.com',
  description: '',
});
const FIRST = [protocol('example-dex', ['Avalanche'], 1_000), protocol('elsewhere', ['Ethereum'], 0)];
const SECOND = [protocol('example-dex-2', ['Avalanche'], 2_000)];

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

// the route's other feeds answer with nothing
function upstream(url: string): Response {
  if (url.endsWith('/v2/chains')) return json([]);
  if (url.includes('/simple/price')) return json({ 'avalanche-2': { usd: 1, usd_24h_change: 0 } });
  if (url.includes('/overview/dexs/')) return json({ protocols: [] });
  return json({ error: 'unexpected' }, 404);
}

const isProtocols = (url: unknown) => String(url).endsWith('/protocols');
const protocolCalls = () => fetchMock.mock.calls.filter(([url]) => isProtocols(url)).length;

async function slugs(GET: () => Promise<Response>): Promise<string[]> {
  const res = await GET();
  expect(res.status).toBe(200);
  const body = (await res.json()) as DAppsApiResponse;
  return body.dapps.filter((d) => !d.id.startsWith('local-')).map((d) => d.slug);
}

beforeEach(() => {
  // the route keeps its protocols in module state: each test starts cold
  vi.resetModules();
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-01T00:00:00Z'));
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockImplementation(async (url: string) => (isProtocols(url) ? json(FIRST) : upstream(url)));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('GET /api/dapps', () => {
  it('reads the protocol list once in 5 minutes', async () => {
    const { GET } = await import('@/app/api/dapps/route');
    expect(await slugs(GET)).toEqual(['example-dex']);
    vi.setSystemTime(Date.now() + 299_000);
    expect(await slugs(GET)).toEqual(['example-dex']);
    expect(protocolCalls()).toBe(1);
    // after 5 minutes the next request reads it again
    vi.setSystemTime(Date.now() + 2_000);
    await GET();
    expect(protocolCalls()).toBe(2);
  });

  it('shares one read between requests that come at the same time', async () => {
    let answer: (res: Response) => void = () => {};
    fetchMock.mockImplementation((url: string) =>
      isProtocols(url) ? new Promise<Response>((resolve) => (answer = resolve)) : Promise.resolve(upstream(url)),
    );
    const { GET } = await import('@/app/api/dapps/route');
    const both = Promise.all([slugs(GET), slugs(GET)]);
    await vi.waitFor(() => expect(protocolCalls()).toBe(1));
    answer(json(FIRST));
    expect(await both).toEqual([['example-dex'], ['example-dex']]);
    expect(protocolCalls()).toBe(1);
  });

  it('keeps the last good list when a refresh fails', async () => {
    const { GET } = await import('@/app/api/dapps/route');
    expect(await slugs(GET)).toEqual(['example-dex']);
    fetchMock.mockImplementation(async (url: string) => (isProtocols(url) ? json({ error: 'down' }, 503) : upstream(url)));
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.setSystemTime(Date.now() + 301_000);
    expect(await slugs(GET)).toEqual(['example-dex']);
    expect(protocolCalls()).toBe(2);
    await vi.waitFor(() => expect(logged).toHaveBeenCalled());
    // the failed refresh left the old list in place, and the next request tries again
    expect(await slugs(GET)).toEqual(['example-dex']);
    expect(protocolCalls()).toBe(3);
    // a good refresh replaces it
    fetchMock.mockImplementation(async (url: string) => (isProtocols(url) ? json(SECOND) : upstream(url)));
    await GET();
    await vi.waitFor(async () => expect(await slugs(GET)).toEqual(['example-dex-2']));
  });

  it('lists no DefiLlama protocols when the first read fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    fetchMock.mockImplementation(async (url: string) => (isProtocols(url) ? json({ error: 'down' }, 503) : upstream(url)));
    const { GET } = await import('@/app/api/dapps/route');
    expect(await slugs(GET)).toEqual([]);
  });
});
