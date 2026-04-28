import { describe, expect, it } from 'vitest';
import { Layers, MessagesSquare, Server, Settings, ArrowUpDown } from 'lucide-react';

import { formatGasPrice, formatRelativeFromNow } from '@/app/console/my-l1/_lib/format';
import {
  getSetupSteps,
  setupSummary,
  type SetupStep,
} from '@/app/console/my-l1/_lib/setup-steps';
import {
  C_CHAIN_IDS,
  metadataFromWalletItem,
  walletItemToCombined,
  type CombinedL1,
} from '@/app/console/my-l1/_lib/types';
import type { L1ListItem } from '@/components/toolbox/stores/l1ListStore';
import type { MyL1 } from '@/hooks/useMyL1s';

describe('formatRelativeFromNow', () => {
  it('returns "expired" when the timestamp is in the past', () => {
    const past = new Date(Date.now() - 60_000).toISOString();
    expect(formatRelativeFromNow(past)).toBe('expired');
  });

  it('formats sub-day expiry as "Nh"', () => {
    const fiveHoursFromNow = new Date(Date.now() + 5 * 3_600_000 + 60_000).toISOString();
    expect(formatRelativeFromNow(fiveHoursFromNow)).toBe('5h');
  });

  it('formats multi-day expiry as "Nd Mh"', () => {
    const twoDaysThreeHours = new Date(
      Date.now() + (2 * 24 * 3_600_000) + (3 * 3_600_000) + 60_000,
    ).toISOString();
    expect(formatRelativeFromNow(twoDaysThreeHours)).toBe('2d 3h');
  });

  it('drops the hour suffix when whole-day with 0 hours', () => {
    const exactlyOneDay = new Date(Date.now() + 24 * 3_600_000 + 30_000).toISOString();
    expect(formatRelativeFromNow(exactlyOneDay)).toBe('1d 0h');
  });
});

describe('formatGasPrice', () => {
  it('returns the dash when the value is non-finite or zero', () => {
    expect(formatGasPrice('0')).toBe('—');
    expect(formatGasPrice('not-a-number')).toBe('—');
  });

  it('shows wei when below 1 nAVAX', () => {
    // 0.5e-9 ETH = 5e8 wei
    expect(formatGasPrice('5e-10')).toBe('500000000 wei');
  });

  it('shows nAVAX between 1 and 1000 nAVAX', () => {
    // 25e-9 ETH = 25 nAVAX
    expect(formatGasPrice('2.5e-8')).toBe('25.00 nAVAX');
  });

  it('shows AVAX above 1000 nAVAX', () => {
    // 1e-6 ETH = 1000 nAVAX → falls into the AVAX branch
    expect(formatGasPrice('1e-6')).toBe('0.000001 AVAX');
  });
});

describe('getSetupSteps + setupSummary', () => {
  function baseManagedL1(overrides: Partial<CombinedL1> = {}): CombinedL1 {
    return {
      source: 'managed',
      status: 'active',
      subnetId: 'subnet-1',
      blockchainId: 'blockchain-1',
      evmChainId: 555_999,
      chainName: 'Test L1',
      rpcUrl: 'https://rpc.example.com',
      isTestnet: true,
      ...overrides,
    };
  }

  it('always reports L1-created done', () => {
    const steps = getSetupSteps(baseManagedL1());
    const created = steps.find((s) => s.key === 'created');
    expect(created?.completed).toBe(true);
  });

  it('flags node done only when at least one node is active', () => {
    const inactive = baseManagedL1({
      nodes: [{ id: 'n1', nodeId: 'NodeID-1', status: 'expired', createdAt: '', expiresAt: '' }] as MyL1['nodes'],
    });
    const active = baseManagedL1({
      nodes: [
        { id: 'n1', nodeId: 'NodeID-1', status: 'expired', createdAt: '', expiresAt: '' },
        { id: 'n2', nodeId: 'NodeID-2', status: 'active', createdAt: '', expiresAt: '' },
      ] as MyL1['nodes'],
    });
    expect(getSetupSteps(inactive).find((s) => s.key === 'node')?.completed).toBe(false);
    expect(getSetupSteps(active).find((s) => s.key === 'node')?.completed).toBe(true);
  });

  it('uses non-empty addresses to flag VM, ICM, and bridge done', () => {
    const wired = baseManagedL1({
      validatorManagerAddress: '0xVM',
      teleporterRegistryAddress: '0xTeleporter',
      wrappedTokenAddress: '0xWrapped',
    });
    const steps = getSetupSteps(wired);
    expect(steps.find((s) => s.key === 'vm')?.completed).toBe(true);
    expect(steps.find((s) => s.key === 'icm')?.completed).toBe(true);
    expect(steps.find((s) => s.key === 'bridge')?.completed).toBe(true);
  });

  it('summary returns the right counts and pct', () => {
    const summary = setupSummary(
      baseManagedL1({
        nodes: [
          { id: 'n', nodeId: 'NodeID', status: 'active', createdAt: '', expiresAt: '' },
        ] as MyL1['nodes'],
        validatorManagerAddress: '0xVM',
      }),
    );
    expect(summary.steps).toHaveLength(5);
    // L1 created + node + vm = 3 done, icm + bridge = pending
    expect(summary.done).toBe(3);
    expect(summary.pct).toBe(60);
    expect(summary.nextStep?.key).toBe('icm');
  });

  it('summary returns null nextStep when fully configured', () => {
    const summary = setupSummary(
      baseManagedL1({
        nodes: [
          { id: 'n', nodeId: 'NodeID', status: 'active', createdAt: '', expiresAt: '' },
        ] as MyL1['nodes'],
        validatorManagerAddress: '0xVM',
        teleporterRegistryAddress: '0xT',
        wrappedTokenAddress: '0xW',
      }),
    );
    expect(summary.done).toBe(5);
    expect(summary.pct).toBe(100);
    expect(summary.nextStep).toBeNull();
  });

  it('first nextStep is "node" on a fresh managed L1', () => {
    const summary = setupSummary(baseManagedL1());
    expect(summary.nextStep?.key).toBe('node');
  });

  it('expected step icons line up with the canonical lucide set', () => {
    const steps = getSetupSteps(baseManagedL1());
    const byKey = new Map(steps.map((s: SetupStep) => [s.key, s.icon]));
    expect(byKey.get('created')).toBe(Layers);
    expect(byKey.get('node')).toBe(Server);
    expect(byKey.get('vm')).toBe(Settings);
    expect(byKey.get('icm')).toBe(MessagesSquare);
    expect(byKey.get('bridge')).toBe(ArrowUpDown);
  });
});

describe('walletItemToCombined + metadataFromWalletItem', () => {
  function makeWalletItem(overrides: Partial<L1ListItem> = {}): L1ListItem {
    return {
      id: 'blockchain-id-1',
      name: 'Wallet L1',
      rpcUrl: 'https://wallet-rpc.example.com',
      evmChainId: 7777,
      coinName: 'TEST',
      isTestnet: true,
      subnetId: 'subnet-from-wallet',
      wrappedTokenAddress: '0xWrapped',
      validatorManagerAddress: '0xVM',
      logoUrl: 'https://logo.example.com/test.png',
      ...overrides,
    };
  }

  it('produces a wallet-source CombinedL1 with status active', () => {
    const combined = walletItemToCombined(makeWalletItem());
    expect(combined.source).toBe('wallet');
    expect(combined.status).toBe('active');
    expect(combined.subnetId).toBe('subnet-from-wallet');
    expect(combined.blockchainId).toBe('blockchain-id-1');
    expect(combined.evmChainId).toBe(7777);
    expect(combined.rpcUrl).toBe('https://wallet-rpc.example.com');
  });

  it('coerces empty-string addresses to undefined so Setup Progress treats them as missing', () => {
    const combined = walletItemToCombined(
      makeWalletItem({
        wrappedTokenAddress: '',
        validatorManagerAddress: '',
        wellKnownTeleporterRegistryAddress: '',
        logoUrl: '',
        explorerUrl: '',
        externalFaucetUrl: '',
      }),
    );
    expect(combined.validatorManagerAddress).toBeUndefined();
    expect(combined.teleporterRegistryAddress).toBeUndefined();
    expect(combined.wrappedTokenAddress).toBeUndefined();
    expect(combined.logoUrl).toBeUndefined();
    expect(combined.explorerUrl).toBeUndefined();
    expect(combined.externalFaucetUrl).toBeUndefined();
  });

  it('passes through non-empty optional addresses', () => {
    const meta = metadataFromWalletItem(
      makeWalletItem({
        wellKnownTeleporterRegistryAddress: '0xTeleporter',
        externalFaucetUrl: 'https://faucet.example.com',
        explorerUrl: 'https://explorer.example.com',
      }),
    );
    expect(meta.teleporterRegistryAddress).toBe('0xTeleporter');
    expect(meta.externalFaucetUrl).toBe('https://faucet.example.com');
    expect(meta.explorerUrl).toBe('https://explorer.example.com');
  });

  it('exposes both Fuji + Mainnet C-Chain IDs in C_CHAIN_IDS', () => {
    expect(C_CHAIN_IDS.has(43113)).toBe(true);
    expect(C_CHAIN_IDS.has(43114)).toBe(true);
    expect(C_CHAIN_IDS.has(7777)).toBe(false);
  });
});
