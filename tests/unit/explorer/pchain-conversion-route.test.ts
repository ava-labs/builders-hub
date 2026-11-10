import { beforeEach, describe, expect, it, vi } from 'vitest';

const { fetchMock } = vi.hoisted(() => ({ fetchMock: vi.fn() }));

/* Made-up IDs. */
const CONVERTED = 'SubnetBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB';
const LEGACY = 'SubnetCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC';
const CONVERT_TX = 'ConvertDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

async function get(network: string, subnetId: string, headers: Record<string, string> = {}) {
  const { GET } = await import('@/app/api/pchain-conversion/[network]/[subnetId]/route');
  return GET(new Request(`http://localhost/api/pchain-conversion/${network}/${subnetId}`, { headers }), { params: Promise.resolve({ network, subnetId }) });
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockImplementation(async (url: string) => {
    const { pathname } = new URL(url);
    if (pathname === `/v1/networks/mainnet/subnets/${CONVERTED}`) return json({ subnetId: CONVERTED, isL1: true, l1ConversionTransactionHash: CONVERT_TX });
    if (pathname === `/v1/networks/mainnet/subnets/${LEGACY}`) return json({ subnetId: LEGACY, isL1: false });
    if (pathname === `/api/mainnet/tx/${CONVERT_TX}`) return json({ txHash: CONVERT_TX, txType: 'ConvertSubnetToL1Tx', blockTimestamp: 1_749_836_379 });
    return json({ error: 'not found' }, 404);
  });
});

describe('/api/pchain-conversion', () => {
  it('answers a converted subnet with its ConvertSubnetToL1Tx and block time, cached hard', async () => {
    const res = await get('mainnet', CONVERTED);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ subnetId: CONVERTED, txHash: CONVERT_TX, timestamp: 1_749_836_379 });
    expect(res.headers.get('cache-control')).toContain('s-maxage=86400');
  });

  it('answers a subnet not converted yet with nulls, asked again in minutes', async () => {
    const res = await get('mainnet', LEGACY);
    expect(await res.json()).toEqual({ subnetId: LEGACY, txHash: null, timestamp: null });
    expect(res.headers.get('cache-control')).toContain('s-maxage=300');
    // no tx to read
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('caches no answer when the conversion tx has no block time yet', async () => {
    fetchMock.mockImplementation(async (url: string) =>
      new URL(url).pathname.startsWith('/v1/') ? json({ l1ConversionTransactionHash: CONVERT_TX }) : json({ error: 'not found' }, 404),
    );
    const res = await get('mainnet', CONVERTED);
    expect(res.status).toBe(504);
    expect(res.headers.get('cache-control')).toBeNull();
  });

  it('answers the page\'s soft read of a miss or an outage as 200, with the status in a header', async () => {
    const miss = await get('mainnet', 'SubnetEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE', { 'x-soft-status': '1' });
    expect(miss.status).toBe(200);
    expect(miss.headers.get('x-status')).toBe('404');
    fetchMock.mockRejectedValue(new Error('timeout'));
    const down = await get('mainnet', CONVERTED, { 'x-soft-status': '1' });
    expect(down.status).toBe(200);
    expect(down.headers.get('x-status')).toBe('504');
  });

  it('refuses an unknown network, a malformed ID and an unknown subnet', async () => {
    expect((await get('devnet', CONVERTED)).status).toBe(404);
    expect((await get('mainnet', '../tx/x')).status).toBe(400);
    expect((await get('mainnet', 'SubnetEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE')).status).toBe(404);
  });
});
