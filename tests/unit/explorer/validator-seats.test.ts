import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { seatsOf, type RegistrySubnet } from '@/lib/pchain-subnets';
import type { SubnetStats } from '@/types/validator-stats';

const { fetchMock, postMock } = vi.hoisted(() => ({ fetchMock: vi.fn(), postMock: vi.fn() }));
vi.mock('@/lib/pchain-rpc', () => ({ pchainPost: postMock }));

/* Made-up IDs. */
const PRIMARY = '11111111111111111111111111111111LpoYY';
const L1 = 'SubnetL1ExampleExampleExampleExampleExampleExa1';
const LEGACY = 'SubnetLegacyExampleExampleExampleExampleExamp1';
const UNKNOWN = 'SubnetUnknownExampleExampleExampleExampleExam1';

const seat = (weight: string, ...nodeIDs: string[]) => ({ weight, nodeIDs });

describe('seatsOf', () => {
  const subnets: RegistrySubnet[] = [
    { subnetId: PRIMARY, isL1: true },
    { subnetId: L1, isL1: true },
    { subnetId: LEGACY, isL1: false },
  ];

  it('splits a shared BLS seat across its nodes, and the weights add up to the seat weight', () => {
    const got = seatsOf({ [L1]: { validators: [seat('101', 'NodeID-A', 'NodeID-B'), seat('100', 'NodeID-C', 'NodeID-D', 'NodeID-E'), seat('7', 'NodeID-F')] } }, subnets);
    expect(got).toEqual([
      { nodeId: 'NodeID-A', subnetId: L1, weight: 51 },
      { nodeId: 'NodeID-B', subnetId: L1, weight: 50 },
      { nodeId: 'NodeID-C', subnetId: L1, weight: 34 },
      { nodeId: 'NodeID-D', subnetId: L1, weight: 33 },
      { nodeId: 'NodeID-E', subnetId: L1, weight: 33 },
      { nodeId: 'NodeID-F', subnetId: L1, weight: 7 },
    ]);
    expect(got.slice(0, 2).reduce((n, v) => n + v.weight, 0)).toBe(101);
    expect(got.slice(2, 5).reduce((n, v) => n + v.weight, 0)).toBe(100);
  });

  it('leaves out a legacy set, a set whose subnet read failed, and the Primary set', () => {
    const got = seatsOf(
      {
        [PRIMARY]: { validators: [seat('2000', 'NodeID-P')] },
        [L1]: { validators: [seat('5', 'NodeID-A')] },
        [LEGACY]: { validators: [seat('5', 'NodeID-L')] },
        [UNKNOWN]: { validators: [seat('5', 'NodeID-U')] },
      },
      subnets,
    );
    expect(got).toEqual([{ nodeId: 'NodeID-A', subnetId: L1, weight: 5 }]);
  });
});

/* /api/validator-stats on Fuji, with the P-Chain and the read API mocked */
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const SETS = {
  [PRIMARY]: { validators: [seat('2000', 'NodeID-P')] },
  [L1]: { validators: [seat('10', 'NodeID-A', 'NodeID-B')] },
  [LEGACY]: { validators: [seat('5', 'NodeID-L')] },
};

function upstream(url: string, down: Set<string>): Response {
  const u = new URL(url);
  if (u.pathname === '/api/fuji/validators') return json({ validators: [{ nodeId: 'NodeID-P', subnetId: PRIMARY, totalStake: '2000', version: 'avalanchego/1.14.1' }] });
  const id = u.pathname.split('/v1/networks/fuji/subnets/')[1];
  if (id && !down.has(id) && id !== PRIMARY) return json({ subnetId: id, isL1: id !== LEGACY, blockchains: [{ blockchainId: `chain-${id}`, blockchainName: `name-${id}` }] });
  if (id) return json({ error: 'Not Found' }, 404);
  return json([]);
}

let down = new Set<string>();
const flush = () => new Promise((r) => setTimeout(r, 50));
const listReads = () => fetchMock.mock.calls.filter(([url]) => String(url).includes('/l1Validators')).length;

async function get() {
  const { GET } = await import('@/app/api/validator-stats/route');
  return GET(new Request('http://localhost/api/validator-stats?network=fuji'));
}

beforeEach(() => {
  // the route keeps its lists in module state: each test starts cold
  vi.resetModules();
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-06T00:00:00Z'));
  down = new Set();
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockImplementation(async (url: string) => upstream(String(url), down));
  postMock.mockImplementation(async () => json({ jsonrpc: '2.0', id: 1, result: { validatorSets: SETS } }));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('GET /api/validator-stats?network=fuji', () => {
  it('counts the L1 sets only, and never reads the l1Validators list', async () => {
    const rows = (await (await get()).json()) as SubnetStats[];
    expect(rows.find((r) => r.id === L1)).toMatchObject({ isL1: true, totalStakeString: '10' });
    expect(rows.some((r) => r.id === LEGACY)).toBe(false);
    expect(listReads()).toBe(0);
  });

  it('answers 500 when the P-Chain fails and no list was read before, and does not fall back to the l1Validators list', async () => {
    postMock.mockImplementation(async () => json({ error: 'rate limited' }, 429));
    const res = await get();
    expect(res.status).toBe(500);
    expect(listReads()).toBe(0);
  });

  it('serves the last good list when a later P-Chain read fails', async () => {
    await get();
    postMock.mockImplementation(async () => json({ error: 'rate limited' }, 429));
    // a day on, the list is old and the stats are stale: the next request refreshes them
    vi.setSystemTime(Date.now() + 25 * 60 * 60 * 1000);
    expect((await get()).headers.get('X-Data-Source')).toBe('stale-while-revalidate');
    await vi.waitFor(() => expect(postMock).toHaveBeenCalledTimes(2));
    await flush();
    // the route reads an age of 0 ms as no age
    vi.setSystemTime(Date.now() + 1000);
    const res = await get();
    expect(res.headers.get('X-Data-Source')).toBe('cache');
    expect(((await res.json()) as SubnetStats[]).find((r) => r.id === L1)).toMatchObject({ totalStakeString: '10' });
    expect(listReads()).toBe(0);
  });

  it('leaves out a running subnet whose read failed, and reads the P-Chain again after 60 s', async () => {
    down = new Set([L1]);
    const rows = (await (await get()).json()) as SubnetStats[];
    expect(rows.some((r) => r.id === L1)).toBe(false);
    // the stats go stale after 15 minutes; their refresh finds the list gone after its 60 s
    down = new Set();
    vi.setSystemTime(Date.now() + 16 * 60 * 1000);
    await get();
    await vi.waitFor(() => expect(postMock).toHaveBeenCalledTimes(2));
    await flush();
    expect(((await (await get()).json()) as SubnetStats[]).find((r) => r.id === L1)).toMatchObject({ isL1: true });
  });

  it('keeps a complete list for the day', async () => {
    await get();
    vi.setSystemTime(Date.now() + 16 * 60 * 1000);
    await get();
    await flush();
    expect(postMock).toHaveBeenCalledTimes(1);
  });
});
