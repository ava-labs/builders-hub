import { afterEach, describe, expect, it, vi } from 'vitest';

import { xchainHit, xchainSearchCached } from '@/components/explorer-v2/chain-search';

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
