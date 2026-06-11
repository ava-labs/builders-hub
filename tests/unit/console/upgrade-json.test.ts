import { describe, expect, it } from 'vitest';
import {
  buildUpgradeJson,
  emptyUpgradeJson,
  getConfiguredPrecompileState,
  getMaxConfiguredTimestamp,
  parseUpgradeJson,
  validateUpgradePlan,
} from '@/lib/console/upgrade-json';

describe('upgrade-json builder', () => {
  it('appends enable and disable precompile upgrades in timestamp order', () => {
    const config = buildUpgradeJson({
      baseConfig: emptyUpgradeJson(),
      activationTimestamp: 2_000_000_000,
      precompiles: [
        {
          key: 'feeManagerConfig',
          mode: 'enable',
          adminAddresses: ['0x8db97C7cEcE249c2b98bDC0226Cc4C2A57BF52FC'],
        },
        {
          key: 'txAllowListConfig',
          mode: 'disable',
        },
      ],
      balanceChanges: [],
      codeChanges: [],
    });

    expect(config.precompileUpgrades).toEqual([
      {
        feeManagerConfig: {
          blockTimestamp: 2_000_000_000,
          adminAddresses: ['0x8db97C7cEcE249c2b98bDC0226Cc4C2A57BF52FC'],
        },
      },
      {
        txAllowListConfig: {
          blockTimestamp: 2_000_000_001,
          disable: true,
        },
      },
    ]);
  });

  it('adds balance and runtime bytecode as stateUpgrades', () => {
    const config = buildUpgradeJson({
      baseConfig: emptyUpgradeJson(),
      activationTimestamp: 2_000_000_000,
      precompiles: [],
      balanceChanges: [
        {
          id: 'balance-1',
          address: '0x1111111111111111111111111111111111111111',
          amount: '100',
        },
      ],
      codeChanges: [
        {
          id: 'code-1',
          address: '0x2222222222222222222222222222222222222222',
          code: '0x60016000',
        },
      ],
    });

    expect(config.stateUpgrades).toEqual([
      {
        blockTimestamp: 2_000_000_000,
        accounts: {
          '0x1111111111111111111111111111111111111111': {
            balanceChange: '100',
          },
        },
      },
      {
        blockTimestamp: 2_000_000_001,
        accounts: {
          '0x2222222222222222222222222222222222222222': {
            code: '0x60016000',
          },
        },
      },
    ]);
  });

  it('preserves imported storage entries while appending generated changes', () => {
    const base = {
      stateUpgrades: [
        {
          blockTimestamp: 1_900_000_000,
          accounts: {
            '0x3333333333333333333333333333333333333333': {
              storage: {
                '0x0000000000000000000000000000000000000000000000000000000000000001':
                  '0x0000000000000000000000000000000000000000000000000000000000000002',
              },
            },
          },
        },
      ],
    };

    const config = buildUpgradeJson({
      baseConfig: base,
      activationTimestamp: 2_000_000_000,
      precompiles: [],
      balanceChanges: [
        {
          id: 'balance-1',
          address: '0x1111111111111111111111111111111111111111',
          amount: '0x64',
        },
      ],
      codeChanges: [],
    });

    expect(config.stateUpgrades?.[0]).toEqual(base.stateUpgrades[0]);
    expect(config.stateUpgrades?.[1]?.accounts['0x1111111111111111111111111111111111111111']).toEqual({
      balanceChange: '0x64',
    });
  });

  it('finds the latest configured timestamp across precompile and state upgrades', () => {
    expect(
      getMaxConfiguredTimestamp({
        precompileUpgrades: [{ warpConfig: { blockTimestamp: 10 } }],
        stateUpgrades: [{ blockTimestamp: 12, accounts: {} }],
      }),
    ).toBe(12);
  });

  it('validates future timestamps, addresses, amounts, and runtime bytecode', () => {
    const result = validateUpgradePlan({
      baseConfig: { precompileUpgrades: [{ warpConfig: { blockTimestamp: 2_000_000_000 } }] },
      activationTimestamp: 1,
      precompiles: [
        {
          key: 'feeManagerConfig',
          mode: 'enable',
          adminAddresses: ['not-an-address'],
        },
      ],
      balanceChanges: [{ id: 'b', address: '0x1', amount: '0' }],
      codeChanges: [{ id: 'c', address: '0x2', code: '0x0' }],
    });

    expect(result.valid).toBe(false);
    expect(result.errors.join('\n')).toContain('future Unix timestamp');
    expect(result.errors.join('\n')).toContain('invalid address');
    expect(result.errors.join('\n')).toContain('must be positive');
    expect(result.errors.join('\n')).toContain('0x-prefixed hex bytecode');
  });

  it('requires admin addresses when enabling allowlist precompiles', () => {
    const result = validateUpgradePlan({
      baseConfig: emptyUpgradeJson(),
      activationTimestamp: 2_000_000_000,
      precompiles: [
        {
          key: 'contractNativeMinterConfig',
          mode: 'enable',
          enabledAddresses: ['0x8db97C7cEcE249c2b98bDC0226Cc4C2A57BF52FC'],
        },
      ],
      balanceChanges: [],
      codeChanges: [],
    });

    expect(result.valid).toBe(false);
    expect(result.errors.join('\n')).toContain('contractNativeMinterConfig requires at least one admin address');
  });

  it('rejects duplicate addresses in allowlists and state upgrades', () => {
    const result = validateUpgradePlan({
      baseConfig: emptyUpgradeJson(),
      activationTimestamp: 2_000_000_000,
      precompiles: [
        {
          key: 'feeManagerConfig',
          mode: 'enable',
          adminAddresses: ['0x1111111111111111111111111111111111111111'],
          managerAddresses: ['0x1111111111111111111111111111111111111111'],
        },
      ],
      balanceChanges: [
        { id: 'b1', address: '0x2222222222222222222222222222222222222222', amount: '1' },
        { id: 'b2', address: '0x2222222222222222222222222222222222222222', amount: '2' },
      ],
      codeChanges: [
        { id: 'c1', address: '0x3333333333333333333333333333333333333333', code: '0x6000' },
        { id: 'c2', address: '0x3333333333333333333333333333333333333333', code: '0x6001' },
      ],
    });

    expect(result.valid).toBe(false);
    expect(result.errors.join('\n')).toContain('feeManagerConfig contains a duplicate address');
    expect(result.errors.join('\n')).toContain('Duplicate balance-change address');
    expect(result.errors.join('\n')).toContain('Duplicate bytecode target address');
  });

  it('parses empty input as an empty upgrade config', () => {
    expect(parseUpgradeJson('').config).toEqual(emptyUpgradeJson());
  });

  it('emits a disable + enable pair for reenable, keeping timestamps strictly increasing', () => {
    const config = buildUpgradeJson({
      baseConfig: emptyUpgradeJson(),
      activationTimestamp: 2_000_000_000,
      precompiles: [
        {
          key: 'contractNativeMinterConfig',
          mode: 'reenable',
          adminAddresses: ['0x8db97C7cEcE249c2b98bDC0226Cc4C2A57BF52FC'],
          enabledAddresses: ['0x1111111111111111111111111111111111111111'],
        },
        {
          key: 'txAllowListConfig',
          mode: 'enable',
          adminAddresses: ['0x2222222222222222222222222222222222222222'],
        },
      ],
      balanceChanges: [{ id: 'b1', address: '0x3333333333333333333333333333333333333333', amount: '5' }],
      codeChanges: [],
    });

    expect(config.precompileUpgrades).toEqual([
      {
        contractNativeMinterConfig: {
          blockTimestamp: 2_000_000_000,
          disable: true,
        },
      },
      {
        contractNativeMinterConfig: {
          blockTimestamp: 2_000_000_001,
          adminAddresses: ['0x8db97C7cEcE249c2b98bDC0226Cc4C2A57BF52FC'],
          enabledAddresses: ['0x1111111111111111111111111111111111111111'],
        },
      },
      {
        txAllowListConfig: {
          blockTimestamp: 2_000_000_002,
          adminAddresses: ['0x2222222222222222222222222222222222222222'],
        },
      },
    ]);
    expect(config.stateUpgrades?.[0]?.blockTimestamp).toBe(2_000_000_003);
  });

  it('validates reenable like enable (requires an admin address)', () => {
    const result = validateUpgradePlan({
      baseConfig: emptyUpgradeJson(),
      activationTimestamp: 2_000_000_000,
      precompiles: [{ key: 'contractNativeMinterConfig', mode: 'reenable' }],
      balanceChanges: [],
      codeChanges: [],
    });

    expect(result.valid).toBe(false);
    expect(result.errors.join('\n')).toContain('contractNativeMinterConfig requires at least one admin address');
  });
});

describe('getConfiguredPrecompileState', () => {
  const admin = '0x8db97C7cEcE249c2b98bDC0226Cc4C2A57BF52FC';
  const enabled = '0x1111111111111111111111111111111111111111';

  it('reads genesis precompiles from the chain config root, normalizing null address arrays', () => {
    const states = getConfiguredPrecompileState({
      chainId: 99999,
      contractNativeMinterConfig: { blockTimestamp: 0, adminAddresses: [admin], enabledAddresses: null },
      warpConfig: { blockTimestamp: 0, quorumNumerator: 67 },
    });

    expect(states.contractNativeMinterConfig).toMatchObject({
      enabled: true,
      source: 'genesis',
      adminAddresses: [admin],
      enabledAddresses: [],
    });
    expect(states.warpConfig).toMatchObject({ enabled: true, quorumNumerator: 67 });
    expect(states.txAllowListConfig).toBeUndefined();
  });

  it('applies upgradeConfig entries in order with disable clearing state', () => {
    const states = getConfiguredPrecompileState({
      contractNativeMinterConfig: { blockTimestamp: 0, adminAddresses: [admin] },
      upgradeConfig: {
        precompileUpgrades: [
          { contractNativeMinterConfig: { blockTimestamp: 100, disable: true } },
          { contractNativeMinterConfig: { blockTimestamp: 200, adminAddresses: [admin], enabledAddresses: [enabled] } },
          { feeManagerConfig: { blockTimestamp: 300, disable: true } },
        ],
      },
    });

    expect(states.contractNativeMinterConfig).toMatchObject({
      source: 'upgrade',
      adminAddresses: [admin],
      enabledAddresses: [enabled],
    });
    expect(states.feeManagerConfig).toBeUndefined();
  });

  it('lets the loaded base upgrade.json override node-reported state', () => {
    const states = getConfiguredPrecompileState(
      { txAllowListConfig: { blockTimestamp: 0, adminAddresses: [admin] } },
      {
        precompileUpgrades: [{ txAllowListConfig: { blockTimestamp: 500, disable: true } }],
      },
    );

    expect(states.txAllowListConfig).toBeUndefined();
  });

  it('returns empty state for null or malformed chain config', () => {
    expect(getConfiguredPrecompileState(null)).toEqual({});
    expect(getConfiguredPrecompileState('garbage')).toEqual({});
    expect(getConfiguredPrecompileState({ upgradeConfig: { precompileUpgrades: 'nope' } })).toEqual({});
  });
});
