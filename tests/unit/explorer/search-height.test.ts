import { afterEach, describe, expect, it, vi } from 'vitest';

import { heightHit, heightHitCached, type EntityTargets } from '@/components/explorer-v2/chain-search';

/* The All Networks search sends a plain height to the P-Chain only when
   the P-Chain has that block. The C-Chain's heights run far past the
   P-Chain tip, and the page's Latest Blocks list shows C-Chain heights,
   so any other height opens the C-Chain's block page. A chain page's
   search keeps its own chain for every height. */

const CHAIN_PAGE: EntityTargets = {
  network: 'mainnet',
  blockBase: '/explorer/mainnet/p-chain',
  blockChainName: 'P-Chain',
  evmAddressBase: '/explorer/mainnet/c-chain',
  evmAddressChainName: 'C-Chain',
};
const NETWORK: EntityTargets = {
  ...CHAIN_PAGE,
  heightFallback: { base: '/explorer/mainnet/c-chain', chainName: 'C-Chain' },
};

describe('heightHit', () => {
  it('keeps a P-Chain height on the P-Chain', () => {
    const hit = heightHit('1000', NETWORK, { type: 'block', id: '1000' });
    expect(hit.href).toBe('/explorer/mainnet/p-chain/block/1000');
    expect(hit.detail).toBe('P-Chain');
    expect(hit.status).toBe('ready');
  });

  it('sends a height the P-Chain lacks to the C-Chain', () => {
    const hit = heightHit('50000000', NETWORK, { type: 'none', id: '50000000' });
    expect(hit.href).toBe('/explorer/mainnet/c-chain/block/50000000');
    expect(hit.detail).toBe('C-Chain');
  });

  it('sends a height the search did not answer as a block to the C-Chain', () => {
    expect(heightHit('7', NETWORK, { type: 'tx', id: 'abc' }).detail).toBe('C-Chain');
    expect(heightHit('7', NETWORK).detail).toBe('C-Chain');
  });

  it('keeps every height on the chain page search on its own chain', () => {
    const hit = heightHit('50000000', CHAIN_PAGE, { type: 'none', id: '50000000' });
    expect(hit.href).toBe('/explorer/mainnet/p-chain/block/50000000');
    expect(hit.detail).toBe('P-Chain');
    expect(heightHit('50000000', CHAIN_PAGE).detail).toBe('P-Chain');
  });
});

describe('heightHitCached', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('asks the P-Chain search once per height', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ type: 'none', id: '61000000' })));
    vi.stubGlobal('fetch', fetchMock);
    const first = await heightHitCached('61000000', NETWORK);
    const again = await heightHitCached('61000000', NETWORK);
    expect(first.href).toBe('/explorer/mainnet/c-chain/block/61000000');
    expect(again.href).toBe(first.href);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]).toEqual(['/api/pchain/mainnet/search?q=61000000']);
  });

  it('opens the C-Chain when the P-Chain search fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 504 })));
    expect((await heightHitCached('62000000', NETWORK)).detail).toBe('C-Chain');
  });
});
