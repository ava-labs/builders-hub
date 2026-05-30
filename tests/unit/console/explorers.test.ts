import { describe, expect, it } from 'vitest';

import { getExplorerOptions } from '@/lib/explorers';

describe('getExplorerOptions', () => {
  it('returns the Builder Hub Explorer alone for a custom L1 with no third-party explorer', () => {
    // Previously [] (steered the user to Setup Explorer); now Builder Hub
    // covers the case in-app. The Setup Explorer empty state only triggers
    // when even an EVM chain ID is missing.
    const options = getExplorerOptions({ evmChainId: 12345, isTestnet: true });

    expect(options.map((o) => o.id)).toEqual(['builder-hub']);
    expect(options[0]).toMatchObject({
      label: 'Builder Hub Explorer',
      url: '/explorer/12345',
      internal: true,
    });
  });

  it('returns no options when neither an EVM chain ID nor a third-party explorer is available', () => {
    expect(getExplorerOptions({ evmChainId: null, isTestnet: true })).toEqual([]);
  });

  it('puts Builder Hub Explorer first for a Fuji C-Chain', () => {
    const options = getExplorerOptions({ evmChainId: 43113, isTestnet: true });

    expect(options.map((o) => o.id)).toEqual(['builder-hub', 'subnets', 'snowtrace', 'avascan']);
    expect(options[0]).toMatchObject({
      url: '/explorer/avalanche-c-chain',
      internal: true,
    });
    expect(options[1].url).toBe('https://subnets-test.avax.network');
  });

  it('uses the c-chain slug for mainnet C-Chain', () => {
    const options = getExplorerOptions({ evmChainId: 43114, isTestnet: false });
    const builderHub = options.find((o) => o.id === 'builder-hub');
    expect(builderHub?.url).toBe('/explorer/c-chain');
  });

  it('includes the configured custom explorer alongside the Builder Hub option', () => {
    const options = getExplorerOptions({
      evmChainId: 99999,
      isTestnet: false,
      customExplorerUrl: 'https://explorer.example.com',
    });

    expect(options.map((o) => o.id)).toEqual(['builder-hub', 'subnets', 'snowtrace', 'custom']);
    expect(options[0]).toMatchObject({
      label: 'Builder Hub Explorer',
      url: '/explorer/99999',
    });
    expect(options[3]).toMatchObject({
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

    expect(options.map((o) => o.id)).toEqual(['builder-hub', 'subnets', 'snowtrace', 'avascan']);
    expect(options[1]).toMatchObject({
      id: 'subnets',
      url: 'https://subnets-test.avax.network/my-l1',
    });
  });

  it('marks only the Builder Hub option as internal', () => {
    const options = getExplorerOptions({
      evmChainId: 43113,
      isTestnet: true,
    });
    const internals = options.filter((o) => o.internal);
    expect(internals.map((o) => o.id)).toEqual(['builder-hub']);
  });
});
