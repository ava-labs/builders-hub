import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { mergeSubnetReads, type RegistrySubnet } from '@/lib/pchain-subnets';

const { fetchMock, postMock } = vi.hoisted(() => ({ fetchMock: vi.fn(), postMock: vi.fn() }));
vi.mock('@/lib/pchain-rpc', () => ({ pchainPost: postMock }));

/* Made-up IDs. */
const PRIMARY = '11111111111111111111111111111111LpoYY';
const NEW = 'SubnetNewExampleExampleExampleExampleExampleEx1';
const OLD = 'SubnetOldExampleExampleExampleExampleExampleEx1';
const GONE = 'SubnetGoneExampleExampleExampleExampleExampleE1';

const subnet = (subnetId: string, chainAt: number, isL1 = true): RegistrySubnet => ({
  subnetId,
  isL1,
  blockchains: [{ blockchainId: `chain-${subnetId}`, blockchainName: `name-${subnetId}`, createBlockTimestamp: chainAt }],
});

describe('mergeSubnetReads', () => {
  it('puts the newest page first, then the running subnets it does not hold', () => {
    const { subnets } = mergeSubnetReads([subnet(NEW, 300)], [subnet(OLD, 100)], [NEW, OLD]);
    expect(subnets.map((s) => s.subnetId)).toEqual([NEW, OLD]);
  });

  it('keeps one copy of a subnet on both the page and the by-ID read', () => {
    const page = subnet(NEW, 300);
    const { subnets, missing } = mergeSubnetReads([page], [subnet(NEW, 300), subnet(OLD, 100)], [NEW, OLD]);
    expect(subnets).toHaveLength(2);
    expect(subnets[0]).toBe(page);
    expect(missing).toBe(0);
  });

  it('counts a running ID that no read gave back', () => {
    const { subnets, missing } = mergeSubnetReads([subnet(NEW, 300)], [subnet(OLD, 100)], [NEW, OLD, GONE]);
    expect(subnets.map((s) => s.subnetId)).toEqual([NEW, OLD]);
    expect(missing).toBe(1);
  });

  it('counts a running ID on the page as read, even when its by-ID read failed', () => {
    expect(mergeSubnetReads([subnet(NEW, 300)], [], [NEW]).missing).toBe(0);
  });
});

/* /api/l1-registry/fuji, with the P-Chain and the read API mocked */
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const seats = (n: number) => Array.from({ length: n }, (_, i) => ({ weight: '1', nodeIDs: [`NodeID-${i}`] }));

// OLD is an old subnet, so it is not on the newest page, but its chain is the newest chain
const BY_ID: Record<string, RegistrySubnet> = { [NEW]: subnet(NEW, 1_790_000_000), [OLD]: subnet(OLD, 1_790_000_500) };

function upstream(url: string): Response {
  const u = new URL(url);
  if (u.pathname === '/v1/networks/fuji/subnets') return json({ subnets: [BY_ID[NEW]] });
  const id = u.pathname.split('/v1/networks/fuji/subnets/')[1];
  return id && BY_ID[id] ? json(BY_ID[id]) : json({ error: 'Not Found' }, 404);
}

const sets = (...running: string[]) =>
  json({ jsonrpc: '2.0', id: 1, result: { validatorSets: Object.fromEntries([[PRIMARY, { validators: seats(3) }], ...running.map((id) => [id, { validators: seats(2) }])]) } });

async function get(network = 'fuji') {
  const { GET } = await import('@/app/api/l1-registry/[network]/route');
  return GET(new Request(`http://localhost/api/l1-registry/${network}`), { params: Promise.resolve({ network }) });
}

beforeEach(() => {
  // the route and the by-ID reads keep module state: each test starts cold
  vi.resetModules();
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-06T00:00:00Z'));
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockImplementation(async (url: string) => upstream(String(url)));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('GET /api/l1-registry/fuji', () => {
  it('lists the recent chains newest first, a by-ID subnet with them', async () => {
    postMock.mockImplementation(async () => sets(NEW, OLD));
    const body = (await (await get()).json()) as { recent: { subnetId: string; createdAt: number; validators: number }[]; active: { subnetId: string }[] };
    expect(body.recent.map((r) => r.subnetId)).toEqual([OLD, NEW]);
    expect(body.recent[0]).toMatchObject({ validators: 2 });
    expect(body.active.map((r) => r.subnetId)).toEqual([OLD, NEW]);
  });

  it('holds a registry with a running subnet no read named for a minute only', async () => {
    postMock.mockImplementation(async () => sets(NEW, OLD, GONE));
    await get();
    vi.setSystemTime(Date.now() + 61_000);
    await get();
    expect(postMock).toHaveBeenCalledTimes(2);
  });

  it('holds a complete registry for the hour', async () => {
    postMock.mockImplementation(async () => sets(NEW, OLD));
    await get();
    vi.setSystemTime(Date.now() + 61_000);
    await get();
    expect(postMock).toHaveBeenCalledTimes(1);
  });

  it('refuses a network it does not know', async () => {
    const res = await get('devnet');
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "unknown network 'devnet'" });
  });
});
