import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MAINNET_VALIDATOR_DISCOVERY_URL } from '@/constants/validator-discovery';
import type { L1FeedRow } from '@/lib/l1-validator-triage';

const { fetchMock, postMock } = vi.hoisted(() => ({ fetchMock: vi.fn(), postMock: vi.fn() }));
vi.mock('@/lib/pchain-rpc', () => ({ pchainPost: postMock }));

/* Made-up IDs and documentation-range addresses. */
const A = 'NodeID-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const B = 'NodeID-BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB';
const C = 'NodeID-CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC';
const SUBNET = 'SubnetExampleExampleExampleExampleExampleExamp1';
const SNAPSHOT_AT = 1_790_000_000;
const SEEN_MS = 1_789_990_000_123;

const seat = (nodeId: string, i: number, over: Record<string, unknown> = {}) => ({
  nodeId,
  validationId: `validation${i}`,
  subnetId: SUBNET,
  weight: '100',
  remainingBalance: 44_236_800,
  creationTimestamp: 1_780_000_000,
  ...over,
});

// a full first page, so the route asks for the second
const PAGE_ONE = Array.from({ length: 100 }, (_, i) => seat(`NodeID-Filler${String(i).padStart(28, '1')}`, i));
const PAGE_TWO = [
  seat(A, 100),
  seat(B, 101),
  seat(C, 102),
  seat(B, 103, { weight: '0' }),
  seat(C, 104, { remainingBalance: 0 }),
];

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

function upstream(url: string): Response {
  if (url === MAINNET_VALIDATOR_DISCOVERY_URL) {
    return json([
      { nodeId: A, version: 'avalanchego/1.14.1', lastSeenOnline: SEEN_MS, ip: '203.0.113.1:9651' },
      { nodeId: B, version: 'avalanchego/1.14.1', lastSeenOnline: SEEN_MS, ip: '203.0.113.2:9651' },
      { nodeId: C, version: '', lastSeenOnline: 0, ip: '' },
    ]);
  }
  const u = new URL(url);
  if (u.pathname === '/api/mainnet/validators') {
    return json({ snapshotTimestamp: SNAPSHOT_AT, validators: [{ nodeId: A, version: 'avalanchego/1.15.2' }] });
  }
  if (u.pathname === '/v1/networks/mainnet/l1Validators') {
    return u.searchParams.get('pageToken') === 'next' ? json({ validators: PAGE_TWO }) : json({ validators: PAGE_ONE, nextPageToken: 'next' });
  }
  return json({ error: 'unexpected' }, 404);
}

async function get(network = 'mainnet') {
  const { GET } = await import('@/app/api/l1-validators/[network]/route');
  return GET(new Request(`http://localhost/api/l1-validators/${network}`), { params: Promise.resolve({ network }) });
}

beforeEach(() => {
  // the route keeps its list in module state: each test starts cold
  vi.resetModules();
  vi.clearAllMocks();
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockImplementation(async (url: string) => upstream(url));
  postMock.mockResolvedValue(json({ jsonrpc: '2.0', id: 1, result: { excess: '0', price: '512', timestamp: '' } }));
});

describe('GET /api/l1-validators/[network]', () => {
  it('pages every seat and joins each to its node reading', async () => {
    const res = await get();
    expect(res.status).toBe(200);
    const body = (await res.json()) as { validators: L1FeedRow[]; price: number | null };
    expect(body.price).toBe(512);
    // the seats with no weight or no balance are not validating
    expect(body.validators).toHaveLength(103);
    const byId = new Map(body.validators.map((v) => [v.validationId, v]));
    // our node peers with A: its reading wins, at the snapshot's time
    expect(byId.get('validation100')).toMatchObject({ nodeId: A, version: '1.15.2', seenAt: SNAPSHOT_AT, ip: '203.0.113.1:9651', weight: 100, balance: 44_236_800 });
    // the crawler's reading, its milliseconds as seconds
    expect(byId.get('validation101')).toMatchObject({ nodeId: B, version: '1.14.1', seenAt: Math.floor(SEEN_MS / 1000), ip: '203.0.113.2:9651' });
    // a node the crawler never reached has no version and no handshake
    expect(byId.get('validation102')).toMatchObject({ nodeId: C, version: null, seenAt: null, ip: null });
    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes('/l1Validators')).length).toBe(2);
  });

  it('answers a second read from the list it holds', async () => {
    const { GET } = await import('@/app/api/l1-validators/[network]/route');
    const params = { params: Promise.resolve({ network: 'mainnet' }) };
    await GET(new Request('http://localhost/api/l1-validators/mainnet'), params);
    const calls = fetchMock.mock.calls.length;
    const res = await GET(new Request('http://localhost/api/l1-validators/mainnet'), { params: Promise.resolve({ network: 'mainnet' }) });
    expect(res.status).toBe(200);
    expect(fetchMock.mock.calls.length).toBe(calls);
  });

  it('still lists the seats when the node does not answer with the fee', async () => {
    postMock.mockRejectedValue(new Error('offline'));
    const body = (await (await get()).json()) as { validators: L1FeedRow[]; price: number | null };
    expect(body.price).toBeNull();
    expect(body.validators).toHaveLength(103);
  });

  it('refuses a network it does not know', async () => {
    expect((await get('devnet')).status).toBe(400);
  });

  it('says the list is unavailable when the read API fails and nothing is held', async () => {
    fetchMock.mockImplementation(async (url: string) => (String(url).includes('/l1Validators') ? json({}, 503) : upstream(url)));
    const res = await get();
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: 'The L1 validator list is unavailable' });
  });
});
