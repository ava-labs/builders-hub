import { describe, expect, it } from 'vitest';

import { readsOf } from '@/components/explorer-v2/warm-reads';

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
      '/api/pchain/mainnet/txs?limit=8',
      '/api/pchain/mainnet/blocks?limit=20',
    ]);
    expect(readsOf('/explorer/fuji/p-chain/tx/2abc')).toEqual(['/api/pchain/fuji/tx/2abc']);
    expect(readsOf('/explorer/mainnet/x-chain/txs')).toEqual(['/api/xchain/mainnet/txs?limit=50']);
  });

  it('warms nothing for a page it does not list, a chain it does not know or a path outside the explorer', () => {
    expect(readsOf('/explorer/mainnet/c-chain/gas')).toEqual([]);
    expect(readsOf('/explorer/mainnet/c-chain/constructor')).toEqual([]);
    expect(readsOf('/explorer/mainnet/no-such-chain/txs')).toEqual([]);
    expect(readsOf('/explorer/mainnet')).toEqual([]);
    expect(readsOf('/docs/explorer/mainnet/c-chain')).toEqual([]);
  });
});
