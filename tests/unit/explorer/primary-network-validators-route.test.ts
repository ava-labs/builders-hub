import { beforeEach, describe, expect, it, vi } from 'vitest';

const { fetchMock } = vi.hoisted(() => ({ fetchMock: vi.fn() }));

/* A made-up ID. */
const A = 'NodeID-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const SNAPSHOT = {
  snapshotTimestamp: 1_790_000_000,
  validators: [
    {
      nodeId: A,
      weight: 2_000_000_000_000_000,
      delegatorWeight: 300_000_000_000_000,
      delegatorCount: 4,
      delegationFeePercent: 2,
      uptimePercent: 99.5,
      endTimestamp: 1_800_000_000,
      connected: true,
      version: 'avalanchego/1.15.0',
    },
  ],
};

async function get(query = '') {
  const { GET } = await import('@/app/api/primary-network-validators/route');
  return GET(new Request(`http://localhost/api/primary-network-validators${query}`));
}

beforeEach(() => {
  // the route keeps its copies in module state: each test starts cold
  vi.resetModules();
  vi.clearAllMocks();
  vi.stubGlobal('fetch', fetchMock);
  vi.spyOn(console, 'log').mockImplementation(() => {});
  fetchMock.mockImplementation(async (url: string) => {
    const { pathname } = new URL(url);
    return pathname === '/api/mainnet/validators' || pathname === '/api/fuji/validators' ? json(SNAPSHOT) : json({ error: 'unexpected' }, 404);
  });
});

describe('GET /api/primary-network-validators', () => {
  it('reads the network the query names, with our node reading of uptime and end time', async () => {
    const res = await get('?network=fuji');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(new URL(fetchMock.mock.calls[0][0] as string).pathname).toBe('/api/fuji/validators');
    expect(body.network).toBe('fuji');
    expect(body.validators[0]).toEqual({
      nodeId: A,
      amountStaked: '2000000000000000',
      delegationFee: '2',
      validationStatus: 'active',
      delegatorCount: 4,
      amountDelegated: '300000000000000',
      version: 'avalanchego/1.15.0',
      connected: true,
      uptime: 99.5,
      endTime: 1_800_000_000,
    });
  });

  it('reads mainnet when the query names no network', async () => {
    const body = await (await get()).json();
    expect(new URL(fetchMock.mock.calls[0][0] as string).pathname).toBe('/api/mainnet/validators');
    expect(body.network).toBe('mainnet');
  });

  it('keeps one copy a network', async () => {
    await get('?network=fuji');
    await get();
    await get('?network=fuji');
    expect(fetchMock.mock.calls.map((c) => new URL(c[0] as string).pathname)).toEqual(['/api/fuji/validators', '/api/mainnet/validators']);
  });

  it('refuses a network it does not know', async () => {
    const res = await get('?network=devnet');
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
