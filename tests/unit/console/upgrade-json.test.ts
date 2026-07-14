import { describe, expect, it } from 'vitest';
import {
  buildUpgradeJson,
  deriveActivePrecompiles,
  emptyUpgradeJson,
  extractUpgradeJsonFromChainConfig,
  getMaxConfiguredTimestamp,
  parseUpgradeJson,
  validateUpgradeJsonStructure,
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

  it('schedules a disable + re-enable pair for allowlist updates', () => {
    const config = buildUpgradeJson({
      baseConfig: emptyUpgradeJson(),
      activationTimestamp: 2_000_000_000,
      precompiles: [
        {
          key: 'contractNativeMinterConfig',
          mode: 'update',
          adminAddresses: ['0x8db97C7cEcE249c2b98bDC0226Cc4C2A57BF52FC'],
        },
      ],
      balanceChanges: [
        { id: 'b', address: '0x1111111111111111111111111111111111111111', amount: '100' },
      ],
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
        },
      },
    ]);
    // State upgrades keep scheduling after the pair without colliding.
    expect(config.stateUpgrades?.[0]?.blockTimestamp).toBe(2_000_000_002);
  });

  it('requires admin addresses for allowlist updates too', () => {
    const result = validateUpgradePlan({
      baseConfig: emptyUpgradeJson(),
      activationTimestamp: 2_000_000_000,
      precompiles: [{ key: 'contractNativeMinterConfig', mode: 'update' }],
      balanceChanges: [],
      codeChanges: [],
    });

    expect(result.valid).toBe(false);
    expect(result.errors.join('\n')).toContain('contractNativeMinterConfig requires at least one admin address');
  });
});

describe('upgrade.json structure validation', () => {
  it('accepts a realistic upgrade.json with precompile, state, and override entries', () => {
    const errors = validateUpgradeJsonStructure({
      precompileUpgrades: [
        {
          feeManagerConfig: {
            blockTimestamp: 1668950000,
            adminAddresses: ['0x8db97C7cEcE249c2b98bDC0226Cc4C2A57BF52FC'],
            initialFeeConfig: { gasLimit: 20000000 },
          },
        },
        { feeManagerConfig: { blockTimestamp: 1668970000, disable: true } },
        { warpConfig: { blockTimestamp: '1668980000', quorumNumerator: 67 } },
      ],
      stateUpgrades: [
        {
          blockTimestamp: 1668990000,
          accounts: {
            '0x1111111111111111111111111111111111111111': {
              balanceChange: '0x64',
              code: '0x6001',
              storage: {
                '0x0000000000000000000000000000000000000000000000000000000000000001':
                  '0x0000000000000000000000000000000000000000000000000000000000000002',
              },
            },
          },
        },
      ],
      networkUpgradeOverrides: { fortunaTimestamp: 1740000000 },
    });

    expect(errors).toEqual([]);
  });

  it('rejects non-objects and unknown top-level keys', () => {
    expect(validateUpgradeJsonStructure([])).toEqual(['upgrade.json must be a JSON object.']);
    expect(validateUpgradeJsonStructure({ precompiles: [] }).join('\n')).toContain('Unknown top-level key "precompiles"');
  });

  it('rejects malformed precompile entries', () => {
    const errors = validateUpgradeJsonStructure({
      precompileUpgrades: [
        { feeManagerConfig: { blockTimestamp: 1 }, txAllowListConfig: { blockTimestamp: 2 } },
        { notARealPrecompile: { blockTimestamp: 1668950000 } },
        { txAllowListConfig: { disable: 'yes' } },
        { contractNativeMinterConfig: { blockTimestamp: 1668950000, adminAddresses: ['not-an-address'] } },
      ],
    });

    const joined = errors.join('\n');
    expect(joined).toContain('exactly one precompile config, found 2');
    expect(joined).toContain('unknown precompile "notARealPrecompile"');
    expect(joined).toContain('precompileUpgrades[2].txAllowListConfig needs a positive integer blockTimestamp');
    expect(joined).toContain('precompileUpgrades[2].txAllowListConfig.disable must be a boolean');
    expect(joined).toContain('invalid address: "not-an-address"');
  });

  it('rejects malformed stateUpgrades entries', () => {
    const errors = validateUpgradeJsonStructure({
      stateUpgrades: [
        { blockTimestamp: 1668990000, accounts: { 'not-an-address': { code: '0x6001' } } },
        {
          blockTimestamp: 1668990001,
          accounts: { '0x1111111111111111111111111111111111111111': { ballanceChange: '100' } },
          extra: true,
        },
        { blockTimestamp: 1668990002, accounts: { '0x1111111111111111111111111111111111111111': { code: 'nope' } } },
      ],
    });

    const joined = errors.join('\n');
    expect(joined).toContain('invalid address key: "not-an-address"');
    expect(joined).toContain('unknown key "ballanceChange"');
    expect(joined).toContain('unknown key "extra"');
    expect(joined).toContain('code must be 0x-prefixed hex bytecode');
  });

  it('surfaces structure errors through parseUpgradeJson', () => {
    const result = parseUpgradeJson('{"alloc": {}}');
    expect(result.config).toBeNull();
    expect(result.error).toContain('Unknown top-level key "alloc"');

    const valid = parseUpgradeJson('{"precompileUpgrades": []}');
    expect(valid.error).toBeNull();
    expect(valid.config).toEqual({ precompileUpgrades: [] });
  });
});

describe('chainConfig-derived state', () => {
  // Shape returned by Dispatch's hosted RPC (genesis precompiles as top-level
  // keys, current upgrade config under `upgrades`).
  const dispatchLikeChainConfig = {
    chainId: 779672,
    feeConfig: { gasLimit: 12000000 },
    contractNativeMinterConfig: { blockTimestamp: 0 },
    warpConfig: { blockTimestamp: 1700000000, quorumNumerator: 67 },
    upgrades: {
      precompileUpgrades: [
        {
          feeManagerConfig: {
            blockTimestamp: 1761766200,
            adminAddresses: ['0xadfa2910dc148674910c07d18df966a28cd21331'],
          },
        },
      ],
    },
  };

  it('derives active precompiles from genesis config plus applied upgrades', () => {
    const active = deriveActivePrecompiles(dispatchLikeChainConfig, 1761766200 + 100);
    expect(Object.keys(active).sort()).toEqual([
      'contractNativeMinterConfig',
      'feeManagerConfig',
      'warpConfig',
    ]);
  });

  it('treats upgrades after the latest block as scheduled, not active', () => {
    const active = deriveActivePrecompiles(dispatchLikeChainConfig, 1761766200 - 100);
    expect(Object.keys(active).sort()).toEqual(['contractNativeMinterConfig', 'warpConfig']);
  });

  it('replays disable and re-enable entries in order', () => {
    const config = {
      contractNativeMinterConfig: { blockTimestamp: 0 },
      upgrades: {
        precompileUpgrades: [
          { contractNativeMinterConfig: { blockTimestamp: 100, disable: true } },
          {
            contractNativeMinterConfig: {
              blockTimestamp: 200,
              adminAddresses: ['0x8db97C7cEcE249c2b98bDC0226Cc4C2A57BF52FC'],
            },
          },
        ],
      },
    };

    expect(Object.keys(deriveActivePrecompiles(config, 150))).toEqual([]);
    const reEnabled = deriveActivePrecompiles(config, 250);
    expect(reEnabled.contractNativeMinterConfig).toEqual({
      blockTimestamp: 200,
      adminAddresses: ['0x8db97C7cEcE249c2b98bDC0226Cc4C2A57BF52FC'],
    });
    expect(deriveActivePrecompiles(null, 100)).toEqual({});
  });

  it('extracts the current upgrade.json from chainConfig.upgrades', () => {
    const extracted = extractUpgradeJsonFromChainConfig(dispatchLikeChainConfig);
    expect(extracted).toEqual({
      precompileUpgrades: dispatchLikeChainConfig.upgrades.precompileUpgrades,
    });
    // The extracted base must round-trip through our own validation.
    expect(validateUpgradeJsonStructure(extracted)).toEqual([]);
  });

  it('returns null when the chain has no upgrades and strips null members', () => {
    expect(extractUpgradeJsonFromChainConfig({ chainId: 1 })).toBeNull();
    expect(extractUpgradeJsonFromChainConfig({ upgrades: {} })).toBeNull();
    expect(extractUpgradeJsonFromChainConfig(null)).toBeNull();
    expect(
      extractUpgradeJsonFromChainConfig({
        upgrades: { precompileUpgrades: [{ warpConfig: { blockTimestamp: 1 } }], stateUpgrades: null },
      }),
    ).toEqual({ precompileUpgrades: [{ warpConfig: { blockTimestamp: 1 } }] });
  });

  it('includes preset storage initialization in generated stateUpgrades', () => {
    const config = buildUpgradeJson({
      baseConfig: emptyUpgradeJson(),
      activationTimestamp: 2_000_000_000,
      precompiles: [],
      balanceChanges: [],
      codeChanges: [
        {
          id: 'c1',
          address: '0x253b2784c75e510dD0fF1da844684a1aC0aa5fcf',
          code: '0x6001',
          storage: {
            '0x0000000000000000000000000000000000000000000000000000000000000000':
              '0x0000000000000000000000000000000000000000000000000000000000000001',
          },
        },
      ],
    });

    expect(config.stateUpgrades?.[0]?.accounts['0x253b2784c75e510dD0fF1da844684a1aC0aa5fcf']).toEqual({
      code: '0x6001',
      storage: {
        '0x0000000000000000000000000000000000000000000000000000000000000000':
          '0x0000000000000000000000000000000000000000000000000000000000000001',
      },
    });
  });
});
