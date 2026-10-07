import { afterEach, describe, expect, it, vi } from 'vitest';

import { bech32AddressCached, xchainHit, xchainSearchCached } from '@/components/explorer-v2/chain-search';

/* A CB58 id the P-Chain search does not claim can still live on the
   X-Chain: a transaction, or a genesis asset (a CreateAssetTx id with no
   tx page). The x-api has no search endpoint, so the search probes
   tx/{id} and then asset/{id} through the /api/xchain proxy. */

const X_TX = 'UaqkkB9GVGhmyGhQSGMGodmZiMFFbdP2mJdh7JEji1BGjuJo9';

function fetchReturning(txStatus: number, assetStatus: number) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    const status = url.includes('/tx/') ? txStatus : assetStatus;
    return new Response(status === 200 ? '{}' : '', { status });
  });
}

describe('xchainSearchCached', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('claims an id the tx endpoint has', async () => {
    const fetchMock = fetchReturning(200, 404);
    vi.stubGlobal('fetch', fetchMock);
    const hit = await xchainSearchCached('mainnet', X_TX);
    expect(hit).toEqual({ type: 'tx', id: X_TX });
    // a tx hit never pays for the asset probe
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(`/api/xchain/mainnet/tx/${X_TX}`);
  });

  it('falls back to the asset endpoint when the tx probe misses', async () => {
    const fetchMock = fetchReturning(404, 200);
    vi.stubGlobal('fetch', fetchMock);
    const hit = await xchainSearchCached('mainnet', 'FvwEAhmxKfeiG8SnEvq42hc6whRyY3EFYAvebMqDNDGCwN6FT');
    expect(hit.type).toBe('asset');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('answers none when neither endpoint claims the id', async () => {
    vi.stubGlobal('fetch', fetchReturning(404, 404));
    expect((await xchainSearchCached('mainnet', '2oYMBNV4eNHyqk2fjjV5nVQLDbtmNJzq5s3qs3Lo6ftnC6FByM')).type).toBe('none');
  });

  it('answers none when the proxy is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new Error('down'))));
    expect((await xchainSearchCached('mainnet', '2JVSBoinj9C2J33VntvzYtVJNZdN2NKiwwKjcumHUWEb5DbBrm')).type).toBe('none');
  });

  it('probes each id once per session', async () => {
    const fetchMock = fetchReturning(200, 404);
    vi.stubGlobal('fetch', fetchMock);
    const q = 'H8D7ThNJkxmtkuv2jgBa4P1Rn3Qpr4pPr7QYNfcdoS6k6HWpyX';
    await xchainSearchCached('mainnet', q);
    await xchainSearchCached('mainnet', q);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('xchainHit', () => {
  it('routes a tx hit to the X-Chain tx page', () => {
    const hit = xchainHit(X_TX, 'mainnet', { type: 'tx', id: X_TX });
    expect(hit.href).toBe(`/explorer/mainnet/x-chain/tx/${X_TX}`);
    expect(hit.detail).toBe('X-Chain');
    expect(hit.status).toBe('ready');
    expect(hit.label).toBe('Transaction');
  });

  it('routes an asset hit to the X-Chain asset page', () => {
    const id = 'FvwEAhmxKfeiG8SnEvq42hc6whRyY3EFYAvebMqDNDGCwN6FT';
    const hit = xchainHit(id, 'mainnet', { type: 'asset', id });
    expect(hit.href).toBe(`/explorer/mainnet/x-chain/asset/${id}`);
    expect(hit.label).toBe('Asset');
  });

  it('keeps the network segment', () => {
    expect(xchainHit(X_TX, 'fuji', { type: 'tx', id: X_TX }).href).toBe(`/explorer/fuji/x-chain/tx/${X_TX}`);
  });

  it('renders a miss as a disabled nothing-matched row', () => {
    const hit = xchainHit(X_TX, 'mainnet', { type: 'none', id: X_TX });
    expect(hit.href).toBeNull();
    expect(hit.status).toBe('notfound');
  });
});

/* A bech32 address is one account on the P-Chain and the X-Chain. An X-/P-
   prefix selects the chain outright; a bare avax1… asks both APIs whether
   they hold the account and returns a hit per claimant, P-Chain first. */

const ADDR = 'avax1xph3ysxkmj2zlhac6nz9hj9cx2av4f7xa9a245';
const P_EMPTY = { utxoCount: 0, utxos: [], balance: { total: '0' }, breakdown: { atomicMemoryUnlocked: '0', atomicMemoryLocked: '0' } };
const P_LIVE = { utxoCount: 2, utxos: [{}], balance: { total: '5' }, breakdown: { atomicMemoryUnlocked: '0', atomicMemoryLocked: '0' } };
const X_EMPTY = { balances: [], transactions: [] };
const X_LIVE = { balances: [{ balance: '10', utxoCount: 1 }], transactions: [{}] };

function addressFetch(pBody: object | number, xBody: object | number) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    const body = url.includes('/api/pchain/') ? pBody : xBody;
    return typeof body === 'number' ? new Response('', { status: body }) : new Response(JSON.stringify(body), { status: 200 });
  });
}

describe('bech32AddressCached', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('routes an X- prefixed address to the x-chain with no probe', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    expect(await bech32AddressCached('mainnet', `X-${ADDR}`)).toEqual([{ chain: 'x-chain', id: `X-${ADDR}` }]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('routes a P- prefixed address to the p-chain with no probe', async () => {
    vi.stubGlobal('fetch', vi.fn());
    expect(await bech32AddressCached('mainnet', `P-${ADDR}`)).toEqual([{ chain: 'p-chain', id: ADDR }]);
  });

  it('offers only the x-chain for a bare address the p-chain does not hold', async () => {
    vi.stubGlobal('fetch', addressFetch(P_EMPTY, X_LIVE));
    expect(await bech32AddressCached('mainnet', ADDR)).toEqual([{ chain: 'x-chain', id: `X-${ADDR}` }]);
  });

  it('offers only the p-chain for a bare address the x-chain does not hold', async () => {
    vi.stubGlobal('fetch', addressFetch(P_LIVE, X_EMPTY));
    expect(await bech32AddressCached('mainnet', 'avax1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq')).toEqual([
      { chain: 'p-chain', id: 'avax1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq' },
    ]);
  });

  it('offers both chains, p-chain first, when both hold the account', async () => {
    vi.stubGlobal('fetch', addressFetch(P_LIVE, X_LIVE));
    const q = 'avax1aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    const hits = await bech32AddressCached('mainnet', q);
    expect(hits).toEqual([
      { chain: 'p-chain', id: q },
      { chain: 'x-chain', id: `X-${q}` },
    ]);
  });

  it('falls back to the p-chain when no chain holds the account', async () => {
    vi.stubGlobal('fetch', addressFetch(P_EMPTY, X_EMPTY));
    const q = 'avax1bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
    expect(await bech32AddressCached('mainnet', q)).toEqual([{ chain: 'p-chain', id: q }]);
  });

  it('counts atomic memory as p-chain activity', async () => {
    vi.stubGlobal(
      'fetch',
      addressFetch({ ...P_EMPTY, breakdown: { atomicMemoryUnlocked: '7', atomicMemoryLocked: '0' } }, X_EMPTY),
    );
    const q = 'avax1cccccccccccccccccccccccccccccccccccccc';
    expect(await bech32AddressCached('mainnet', q)).toEqual([{ chain: 'p-chain', id: q }]);
  });

  it('probes each address once per session', async () => {
    const fetchMock = addressFetch(P_EMPTY, X_LIVE);
    vi.stubGlobal('fetch', fetchMock);
    const q = 'avax1dddddddddddddddddddddddddddddddddddddd';
    await bech32AddressCached('mainnet', q);
    await bech32AddressCached('mainnet', q);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
