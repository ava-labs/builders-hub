import { describe, expect, it } from 'vitest';

import { getExplorerOptions } from '@/lib/explorers';

describe('getExplorerOptions', () => {
  it('returns no options for a non-C-Chain L1 without a configured explorer', () => {
    expect(getExplorerOptions({ evmChainId: 12345, isTestnet: true })).toEqual([]);
  });

  it('keeps C-Chain explorer options even without a custom explorer URL', () => {
    const options = getExplorerOptions({ evmChainId: 43113, isTestnet: true });

    expect(options.map((o) => o.id)).toEqual(['subnets', 'snowtrace', 'avascan']);
    expect(options[0].url).toBe('https://subnets-test.avax.network');
  });

  it('includes the configured custom explorer as the third option', () => {
    const options = getExplorerOptions({
      evmChainId: 99999,
      isTestnet: false,
      customExplorerUrl: 'https://explorer.example.com',
    });

    expect(options.map((o) => o.id)).toEqual(['subnets', 'snowtrace', 'custom']);
    expect(options[2]).toMatchObject({
      label: 'L1 Custom Explorer',
      url: 'https://explorer.example.com',
    });
  });

  it('uses a Subnets deep link when the configured explorer points at Subnets', () => {
    const options = getExplorerOptions({
      evmChainId: 99999,
      isTestnet: true,
      customExplorerUrl: 'https://subnets-test.avax.network/my-l1',
    });

    expect(options[0]).toMatchObject({
      id: 'subnets',
      url: 'https://subnets-test.avax.network/my-l1',
    });
    expect(options.map((o) => o.id)).toEqual(['subnets', 'snowtrace', 'avascan']);
  });
});
