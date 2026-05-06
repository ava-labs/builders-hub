import { describe, expect, it } from 'vitest';

import {
  C_CHAIN_FUJI,
  resolveL1DashboardConnection,
} from '@/lib/console/l1-dashboard';
import type { L1ListItem } from '@/components/toolbox/stores/l1ListStore';

function makeL1(overrides: Partial<L1ListItem> = {}): L1ListItem {
  return {
    id: 'blockchain-id',
    name: 'Custom L1',
    rpcUrl: 'https://rpc.example.com',
    evmChainId: 123_456,
    coinName: 'TEST',
    isTestnet: true,
    subnetId: 'subnet-id',
    wrappedTokenAddress: '',
    validatorManagerAddress: '',
    logoUrl: '',
    ...overrides,
  };
}

describe('resolveL1DashboardConnection', () => {
  it('uses the live provider chain over a stale wallet-store chain', () => {
    const l1 = makeL1();
    const resolved = resolveL1DashboardConnection({
      isConnected: true,
      walletChainId: C_CHAIN_FUJI,
      liveChainId: l1.evmChainId,
      l1Lists: [[l1]],
    });

    expect(resolved.effectiveChainId).toBe(l1.evmChainId);
    expect(resolved.isConnectedToCChain).toBe(false);
    expect(resolved.currentL1).toBe(l1);
  });

  it('searches all supplied L1 stores, not only the active network store', () => {
    const testnetL1 = makeL1({ evmChainId: 555_777 });
    const resolved = resolveL1DashboardConnection({
      isConnected: true,
      walletChainId: testnetL1.evmChainId,
      liveChainId: null,
      l1Lists: [[], [testnetL1], []],
    });

    expect(resolved.currentL1).toBe(testnetL1);
  });

  it('keeps C-Chain classified as C-Chain even when L1 lists are populated', () => {
    const resolved = resolveL1DashboardConnection({
      isConnected: true,
      walletChainId: C_CHAIN_FUJI,
      liveChainId: null,
      l1Lists: [[makeL1()]],
    });

    expect(resolved.isConnectedToCChain).toBe(true);
    expect(resolved.currentL1).toBeNull();
  });

  it('returns no L1 for an unregistered custom chain', () => {
    const resolved = resolveL1DashboardConnection({
      isConnected: true,
      walletChainId: 999_000,
      liveChainId: null,
      l1Lists: [[makeL1()]],
    });

    expect(resolved.isConnectedToCChain).toBe(false);
    expect(resolved.currentL1).toBeNull();
  });

  it('ignores live provider chain state while the wallet is disconnected', () => {
    const l1 = makeL1();
    const resolved = resolveL1DashboardConnection({
      isConnected: false,
      walletChainId: 0,
      liveChainId: l1.evmChainId,
      l1Lists: [[l1]],
    });

    expect(resolved.effectiveChainId).toBe(l1.evmChainId);
    expect(resolved.isConnectedToCChain).toBe(false);
    expect(resolved.currentL1).toBeNull();
  });
});
