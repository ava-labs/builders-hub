import { beforeEach, describe, expect, it, vi } from 'vitest';

import l1ChainsData from '@/constants/l1-chains.json';
import { toStatsChainId } from '@/lib/dedicated-stats';

const { fetchMock, postMock, indexedMock } = vi.hoisted(() => ({ fetchMock: vi.fn(), postMock: vi.fn(), indexedMock: vi.fn() }));
vi.mock('@/lib/pchain-rpc', () => ({ pchainPost: postMock }));
vi.mock('@/lib/icm-clickhouse', () => ({ getChainICMCount: vi.fn(async () => null) }));
vi.mock('@/lib/stats-coverage', async (importOriginal) => ({ ...(await importOriginal<object>()), fetchIndexedChainIds: indexedMock }));

type Catalog = { chainId: string; isTestnet?: boolean; isActive?: boolean }[];
const CATALOG = l1ChainsData as Catalog;
const TESTNET = new Set(CATALOG.filter((c) => c.isTestnet === true).map((c) => c.chainId));
// the hand-written filter the route had before it read activeChains: 69 mainnet chains on 2026-10-06
const handFiltered = (fuji: boolean) => CATALOG.filter((c) => (c.isTestnet === true) === fuji && c.isActive !== false);

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

// stats-api tracks no chain, the subnet list is empty, and the market has no price
function upstream(url: string): Response {
  if (url.includes('/v1/networks/mainnet/subnets?')) return json({ subnets: [] });
  if (url.includes('coingecko')) return json({});
  return json({ error: 'Not Found' }, 404);
}
const metricReads = () => fetchMock.mock.calls.map(([url]) => String(url)).filter((url) => url.includes('/metrics/'));

async function get(query: string) {
  const { GET } = await import('@/app/api/overview-stats/route');
  return GET(new Request(`http://localhost/api/overview-stats?${query}`));
}
const chainsOf = async (query: string) => ((await (await get(query)).json()) as { chains: { chainId: string }[] }).chains;

beforeEach(() => {
  // the route keeps its caches in module state: each test starts cold
  vi.resetModules();
  vi.clearAllMocks();
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockImplementation(async (url: string) => upstream(String(url)));
  postMock.mockImplementation(async () => json({ jsonrpc: '2.0', id: 1, result: { validatorSets: {} } }));
  indexedMock.mockResolvedValue(new Set([toStatsChainId('43113')]));
});

describe('GET /api/overview-stats chain list', () => {
  it('lists only the active testnet chains on Fuji', async () => {
    const chains = await chainsOf('timeRange=day&network=fuji');
    expect(chains.length).toBe(handFiltered(true).length);
    expect(chains.every((c) => TESTNET.has(c.chainId))).toBe(true);
    expect(chains.some((c) => c.chainId === '43113')).toBe(true);
  });

  it('lists the same mainnet chains as before', async () => {
    const chains = await chainsOf('timeRange=day');
    expect(chains.map((c) => c.chainId).sort()).toEqual(handFiltered(false).map((c) => c.chainId).sort());
    expect(chains.some((c) => TESTNET.has(c.chainId))).toBe(false);
  });
});

describe('GET /api/overview-stats on Fuji when the indexed list does not answer', () => {
  it('asks no chain for figures when it has no indexed list', async () => {
    indexedMock.mockResolvedValue(null);
    expect((await get('timeRange=day&network=fuji')).status).toBe(200);
    expect(metricReads()).toEqual([]);
  });

  it('keeps the last indexed list', async () => {
    await get('timeRange=day&network=fuji');
    const first = metricReads().length;
    expect(first).toBeGreaterThan(0);
    indexedMock.mockResolvedValue(null);
    await get('timeRange=day&network=fuji&clearCache=true');
    const again = metricReads().slice(first);
    expect(again.length).toBe(first);
    expect(again.every((url) => url.includes(`/v2/chains/${toStatsChainId('43113')}/metrics/`))).toBe(true);
  });
});

describe('GET /api/overview-stats errors', () => {
  it('refuses an unknown network with the shared text, and the answer is not kept', async () => {
    const res = await get('timeRange=day&network=devnet');
    expect(res.status).toBe(400);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(await res.json()).toEqual({ error: "unknown network 'devnet'" });
  });
});
