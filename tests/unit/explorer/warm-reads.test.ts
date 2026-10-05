import { afterEach, describe, expect, it, vi } from 'vitest';

import { readsOf, warmReads } from '@/components/explorer-v2/warm-reads';

describe('readsOf', () => {
  it('names the first reads of a chain home, its lists and its records', () => {
    expect(readsOf('/explorer/mainnet/c-chain')).toEqual([
      '/api/evm/43114/stats',
      '/api/evm/43114/txs?limit=11',
      '/api/evm/43114/blocks?limit=20',
      '/api/explorer/43114?priceOnly=true',
    ]);
    expect(readsOf('/explorer/mainnet/c-chain/txs')).toEqual(['/api/evm/43114/txs?limit=25']);
    expect(readsOf('/explorer/fuji/c-chain/blocks')).toEqual(['/api/evm/43113/blocks?limit=25']);
    expect(readsOf('/explorer/mainnet/c-chain/tx/0xabc?tab=logs')).toEqual(['/api/evm/43114/tx/0xabc', '/api/explorer/43114?priceOnly=true']);
    expect(readsOf('/explorer/mainnet/c-chain/address/0x1')).toContain('/api/evm/43114/address/0x1/transfers?limit=50');
  });

  it('reads the P-Chain and X-Chain routes by network', () => {
    expect(readsOf('/explorer/mainnet/p-chain')).toEqual([
      '/api/pchain/mainnet/stats',
      '/api/pchain/mainnet/txs?limit=11',
      '/api/pchain/mainnet/blocks?limit=11',
      '/api/pchain-l1-ops/mainnet?days=30',
      '/api/pchain-activity/mainnet',
      '/api/primary-network-stats?timeRange=all',
    ]);
    // the stake's history is mainnet's: Fuji's home does not read it
    expect(readsOf('/explorer/fuji/p-chain')).toEqual([
      '/api/pchain/fuji/stats',
      '/api/pchain/fuji/txs?limit=11',
      '/api/pchain/fuji/blocks?limit=11',
      '/api/pchain-l1-ops/fuji?days=30',
      '/api/pchain-activity/fuji',
    ]);
    expect(readsOf('/explorer/fuji/p-chain/tx/2abc')).toEqual(['/api/pchain/fuji/tx/2abc']);
    expect(readsOf('/explorer/mainnet/p-chain/blocks')).toEqual(['/api/pchain/mainnet/blocks?limit=25']);
    expect(readsOf('/explorer/mainnet/x-chain/txs')).toEqual(['/api/xchain/mainnet/txs?limit=50']);
  });

  it('reads the network scope on the page clock, mainnet only', () => {
    expect(readsOf('/explorer/mainnet', 'all')).toEqual([
      '/api/overview-stats?timeRange=year',
      '/api/avax-supply',
      '/api/dapps',
      '/api/chain-stats/all?metrics=txCount,activeAddresses,icmMessages&timeRange=all',
      '/api/primary-network-stats?timeRange=all',
      '/api/chain-stats/43114?metrics=cumulativeBurn&timeRange=1y',
    ]);
    expect(readsOf('/explorer/mainnet/token', 'week')).toEqual([
      '/api/avax-supply',
      '/api/chain-stats/43114?metrics=feesPaid&timeRange=1y',
      '/api/icm-contract-fees?timeRange=1y',
      '/api/market-history/43114?days=7',
      '/api/primary-network-stats?timeRange=all',
      '/api/chain-stats/43114?metrics=cumulativeBurn&timeRange=1y',
    ]);
    // no range named: the clock's, a month by default
    expect(readsOf('/explorer/mainnet/')[0]).toBe('/api/overview-stats?timeRange=month');
    expect(readsOf('/explorer/fuji')).toEqual([]);
    expect(readsOf('/explorer/fuji/token')).toEqual([]);
    expect(readsOf('/explorer/mainnet/token/supply')).toEqual([]);
  });

  it('warms nothing for a page it does not list, a chain it does not know or a path outside the explorer', () => {
    expect(readsOf('/explorer/mainnet/c-chain/gas')).toEqual([]);
    expect(readsOf('/explorer/mainnet/c-chain/constructor')).toEqual([]);
    expect(readsOf('/explorer/mainnet/no-such-chain/txs')).toEqual([]);
    expect(readsOf('/docs/explorer/mainnet/c-chain')).toEqual([]);
  });
});

describe('warmReads', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('warms the overview boards of the chains its figures name, at low priority', async () => {
    vi.stubGlobal('window', {});
    const chains = [{ chainId: '43114', chainName: 'Avalanche C-Chain', chainLogoURI: '', txCount: 9 }];
    const fetch = vi.fn(async (url: string, _init?: RequestInit) =>
      new Response(JSON.stringify(url.startsWith('/api/overview-stats') ? { chains } : {}), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetch);
    warmReads('/explorer/mainnet');
    await vi.waitFor(() =>
      expect(fetch.mock.calls.map(([url]) => url)).toContain('/api/explorer/43114?blocksOnly=true&txs=3'),
    );
    expect(fetch.mock.calls.every(([, init]) => init?.priority === 'low')).toBe(true);
  });
});
