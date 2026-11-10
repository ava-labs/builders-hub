import { afterEach, describe, expect, it, vi } from 'vitest';

import { fetchSubnetsById, runningL1Count, type RegistrySubnet } from '@/lib/pchain-subnets';

/* Mainnet on 2026-09-27: getAllValidatorsAt ran 69 sets, the Primary
   Network's and 68 subnets', and /api/l1-registry listed all 68 as active.
   Two are legacy subnets, not L1s, so /api/validator-stats counts 66. */
const PRIMARY = '11111111111111111111111111111111LpoYY';
const GUNZ = '2MbQjnTg3yxEtZBfnamboi7K9AajwNq7WExiwReBQSBtwbBVer';
const STEP_NETWORK = '7f9jciLEX25NPJEaAz1X7XF44B1Q9UBwq6PdnCHm5mnUq1e1C';

const l1 = (subnetId: string): RegistrySubnet => ({ subnetId, isL1: true });

describe('runningL1Count', () => {
  it('counts the running L1s, not the legacy subnets or the Primary Network that run sets too', () => {
    const counts = new Map([
      [PRIMARY, 605],
      [GUNZ, 11],
      [STEP_NETWORK, 1],
      ['l1-a', 5],
      ['l1-b', 1],
    ]);
    const subnets = [{ subnetId: PRIMARY }, { subnetId: GUNZ, isL1: false }, { subnetId: STEP_NETWORK, isL1: false }, l1('l1-a'), l1('l1-b')];
    expect(runningL1Count(counts, subnets)).toBe(2);
  });

  it('leaves out an L1 whose set is empty, and one the P-Chain did not list', () => {
    const counts = new Map([
      ['l1-a', 3],
      ['l1-drained', 0],
    ]);
    expect(runningL1Count(counts, [l1('l1-a'), l1('l1-drained'), l1('l1-unlisted')])).toBe(1);
  });
});

/* the subnet endpoint as stats-api answers it: the subnet for an ID it
   knows, 404 for one it does not (the Primary Network too) */
const subnetApi = (fail: (id: string) => 'missing' | 'down' | null = () => null) =>
  vi.fn(async (url: string) => {
    const id = decodeURIComponent(String(url).split('/subnets/')[1] ?? '');
    const why = fail(id);
    if (why === 'down') throw new TypeError('fetch failed');
    if (why === 'missing') return Response.json({ error: 'Not Found', statusCode: 404 }, { status: 404 });
    return Response.json({ subnetId: id, isL1: true, blockchains: [{ blockchainId: `chain-${id}`, blockchainName: id }] });
  });

afterEach(() => {
  vi.unstubAllGlobals();
});

// each test uses its own IDs: the module keeps every subnet it read
describe('fetchSubnetsById', () => {
  it('reads each subnet once per network, from the cache after the first read', async () => {
    const fetchMock = subnetApi();
    vi.stubGlobal('fetch', fetchMock);
    const first = await fetchSubnetsById('fuji', ['cache-a', 'cache-b', 'cache-a']);
    expect(first.map((s) => s.subnetId)).toEqual(['cache-a', 'cache-b']);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/v1\/networks\/fuji\/subnets\/cache-a$/);

    expect((await fetchSubnetsById('fuji', ['cache-b', 'cache-a'])).map((s) => s.subnetId)).toEqual(['cache-b', 'cache-a']);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    // the same ID on the other network is another subnet
    await fetchSubnetsById('mainnet', ['cache-a']);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(String(fetchMock.mock.calls[2][0])).toMatch(/\/v1\/networks\/mainnet\/subnets\/cache-a$/);
  });

  it('shares a read in flight between two calls', async () => {
    const fetchMock = subnetApi();
    vi.stubGlobal('fetch', fetchMock);
    const [a, b] = await Promise.all([fetchSubnetsById('fuji', ['shared-a']), fetchSubnetsById('fuji', ['shared-a'])]);
    expect(a).toEqual(b);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('leaves out an ID that is not found or whose read fails, and asks again next time', async () => {
    vi.stubGlobal('fetch', subnetApi((id) => (id === 'fail-missing' ? 'missing' : id === 'fail-down' ? 'down' : null)));
    const got = await fetchSubnetsById('fuji', ['fail-ok', 'fail-missing', 'fail-down']);
    expect(got.map((s) => s.subnetId)).toEqual(['fail-ok']);

    const fetchMock = subnetApi();
    vi.stubGlobal('fetch', fetchMock);
    const again = await fetchSubnetsById('fuji', ['fail-ok', 'fail-missing', 'fail-down']);
    expect(again.map((s) => s.subnetId)).toEqual(['fail-ok', 'fail-missing', 'fail-down']);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('has at most 8 reads in flight, across calls', async () => {
    let now = 0;
    let most = 0;
    const fetchMock = vi.fn(async (url: string) => {
      now++;
      most = Math.max(most, now);
      await new Promise((r) => setTimeout(r, 5));
      now--;
      return Response.json({ subnetId: decodeURIComponent(String(url).split('/subnets/')[1]) });
    });
    vi.stubGlobal('fetch', fetchMock);
    const ids = (from: number) => Array.from({ length: 15 }, (_, i) => `cap-${from + i}`);
    const [a, b] = await Promise.all([fetchSubnetsById('fuji', ids(0)), fetchSubnetsById('fuji', ids(15))]);
    expect(a).toHaveLength(15);
    expect(b).toHaveLength(15);
    expect(fetchMock).toHaveBeenCalledTimes(30);
    expect(most).toBe(8);
  });
});
