export type PrecompileConfigKey =
  | 'contractDeployerAllowListConfig'
  | 'contractNativeMinterConfig'
  | 'txAllowListConfig'
  | 'feeManagerConfig'
  | 'rewardManagerConfig'
  | 'warpConfig';

export type PrecompileMode = 'none' | 'enable' | 'disable';

export interface PrecompileDefinition {
  key: PrecompileConfigKey;
  label: string;
  description: string;
  supportsAllowList: boolean;
  supportsWarpConfig?: boolean;
}

export interface PrecompileSelection {
  key: PrecompileConfigKey;
  mode: PrecompileMode;
  adminAddresses?: string[];
  managerAddresses?: string[];
  enabledAddresses?: string[];
  quorumNumerator?: number;
  requirePrimaryNetworkSigners?: boolean;
}

export interface BalanceChange {
  id: string;
  address: string;
  amount: string;
}

export interface CodeChange {
  id: string;
  address: string;
  code: string;
}

export interface UpgradeJson {
  precompileUpgrades?: Array<Record<string, Record<string, unknown>>>;
  stateUpgrades?: Array<{
    blockTimestamp: number;
    accounts: Record<string, Record<string, unknown>>;
  }>;
  networkUpgradeOverrides?: Record<string, number>;
  [key: string]: unknown;
}

export interface BuildUpgradeJsonInput {
  baseConfig?: UpgradeJson;
  activationTimestamp: number;
  precompiles: PrecompileSelection[];
  balanceChanges: BalanceChange[];
  codeChanges: CodeChange[];
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export const PRECOMPILE_DEFINITIONS: PrecompileDefinition[] = [
  {
    key: 'contractDeployerAllowListConfig',
    label: 'Contract Deployer Allow List',
    description: 'Restrict who can deploy contracts on this L1.',
    supportsAllowList: true,
  },
  {
    key: 'txAllowListConfig',
    label: 'Transaction Allow List',
    description: 'Restrict who can submit transactions on this L1.',
    supportsAllowList: true,
  },
  {
    key: 'contractNativeMinterConfig',
    label: 'Native Minter',
    description: 'Allow selected accounts to mint native gas tokens.',
    supportsAllowList: true,
  },
  {
    key: 'feeManagerConfig',
    label: 'Fee Manager',
    description: 'Allow selected accounts to update gas fee parameters.',
    supportsAllowList: true,
  },
  {
    key: 'rewardManagerConfig',
    label: 'Reward Manager',
    description: 'Allow selected accounts to configure fee rewards.',
    supportsAllowList: true,
  },
  {
    key: 'warpConfig',
    label: 'Warp Messaging',
    description: 'Enable or disable Avalanche Warp Messaging support.',
    supportsAllowList: false,
    supportsWarpConfig: true,
  },
];

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
const BYTECODE_RE = /^0x(?:[a-fA-F0-9]{2})+$/;
const HEX_POSITIVE_RE = /^0x[0-9a-fA-F]+$/;
const DECIMAL_POSITIVE_RE = /^[0-9]+$/;

export function emptyUpgradeJson(): UpgradeJson {
  return { precompileUpgrades: [], stateUpgrades: [] };
}

export function parseUpgradeJson(input: string): { config: UpgradeJson | null; error: string | null } {
  const trimmed = input.trim();
  if (!trimmed) return { config: emptyUpgradeJson(), error: null };

  try {
    const parsed = JSON.parse(trimmed);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { config: null, error: 'upgrade.json must be a JSON object.' };
    }
    return { config: parsed as UpgradeJson, error: null };
  } catch (error) {
    return { config: null, error: error instanceof Error ? error.message : 'Invalid JSON.' };
  }
}

export function formatUpgradeJson(config: UpgradeJson): string {
  return JSON.stringify(config, null, 2);
}

export function splitAddressList(value: string): string[] {
  return value
    .split(/[,\s]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function isValidAddress(address: string): boolean {
  return ADDRESS_RE.test(address);
}

export function isValidRuntimeBytecode(code: string): boolean {
  return BYTECODE_RE.test(code);
}

export function isPositiveAmount(amount: string): boolean {
  if (!amount) return false;
  if (HEX_POSITIVE_RE.test(amount)) return BigInt(amount) > 0n;
  if (DECIMAL_POSITIVE_RE.test(amount)) return BigInt(amount) > 0n;
  return false;
}

export function getMaxConfiguredTimestamp(config: UpgradeJson | null | undefined): number {
  if (!config) return 0;
  const timestamps: number[] = [];

  if (Array.isArray(config.precompileUpgrades)) {
    for (const entry of config.precompileUpgrades) {
      if (!entry || typeof entry !== 'object') continue;
      const values = Object.values(entry);
      for (const value of values) {
        if (value && typeof value === 'object') {
          const ts = (value as { blockTimestamp?: unknown }).blockTimestamp;
          if (typeof ts === 'number') timestamps.push(ts);
          if (typeof ts === 'string' && DECIMAL_POSITIVE_RE.test(ts)) timestamps.push(Number(ts));
        }
      }
    }
  }

  if (Array.isArray(config.stateUpgrades)) {
    for (const entry of config.stateUpgrades) {
      if (typeof entry?.blockTimestamp === 'number') timestamps.push(entry.blockTimestamp);
    }
  }

  return timestamps.length > 0 ? Math.max(...timestamps) : 0;
}

export function buildUpgradeJson({
  baseConfig,
  activationTimestamp,
  precompiles,
  balanceChanges,
  codeChanges,
}: BuildUpgradeJsonInput): UpgradeJson {
  const next = cloneUpgradeJson(baseConfig ?? emptyUpgradeJson());
  const precompileUpgrades = Array.isArray(next.precompileUpgrades) ? [...next.precompileUpgrades] : [];
  const stateUpgrades = Array.isArray(next.stateUpgrades) ? [...next.stateUpgrades] : [];

  let offset = 0;
  for (const selection of precompiles) {
    if (selection.mode === 'none') continue;

    const blockTimestamp = activationTimestamp + offset;
    offset += 1;

    if (selection.mode === 'disable') {
      precompileUpgrades.push({
        [selection.key]: {
          blockTimestamp,
          disable: true,
        },
      });
      continue;
    }

    const config: Record<string, unknown> = { blockTimestamp };
    if (selection.key === 'warpConfig') {
      config.quorumNumerator = selection.quorumNumerator ?? 67;
      config.requirePrimaryNetworkSigners = selection.requirePrimaryNetworkSigners ?? true;
    } else {
      assignAddressArray(config, 'adminAddresses', selection.adminAddresses);
      assignAddressArray(config, 'managerAddresses', selection.managerAddresses);
      assignAddressArray(config, 'enabledAddresses', selection.enabledAddresses);
    }

    precompileUpgrades.push({ [selection.key]: config });
  }

  for (const change of balanceChanges) {
    if (!change.address || !change.amount) continue;
    stateUpgrades.push({
      blockTimestamp: activationTimestamp + offset,
      accounts: {
        [change.address]: {
          balanceChange: change.amount,
        },
      },
    });
    offset += 1;
  }

  for (const change of codeChanges) {
    if (!change.address || !change.code) continue;
    stateUpgrades.push({
      blockTimestamp: activationTimestamp + offset,
      accounts: {
        [change.address]: {
          code: change.code,
        },
      },
    });
    offset += 1;
  }

  next.precompileUpgrades = precompileUpgrades;
  next.stateUpgrades = stateUpgrades;
  return next;
}

export function validateUpgradePlan(input: BuildUpgradeJsonInput): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const now = Math.floor(Date.now() / 1000);
  const latestExistingTimestamp = getMaxConfiguredTimestamp(input.baseConfig);

  if (!Number.isInteger(input.activationTimestamp) || input.activationTimestamp <= now) {
    errors.push('Activation timestamp must be a future Unix timestamp.');
  }

  if (latestExistingTimestamp > 0 && input.activationTimestamp <= latestExistingTimestamp) {
    errors.push('New upgrades must be scheduled after existing upgrade timestamps.');
  }

  for (const selection of input.precompiles) {
    if (selection.mode === 'none' || selection.mode === 'disable') continue;
    if (selection.key === 'warpConfig') {
      const quorum = selection.quorumNumerator ?? 67;
      if (!Number.isInteger(quorum) || quorum < 1 || quorum > 100) {
        errors.push('Warp quorum numerator must be an integer from 1 to 100.');
      }
      continue;
    }

    const addresses = [
      ...(selection.adminAddresses ?? []),
      ...(selection.managerAddresses ?? []),
      ...(selection.enabledAddresses ?? []),
    ];
    for (const address of addresses) {
      if (!isValidAddress(address)) errors.push(`${selection.key} contains an invalid address: ${address}`);
    }
    if ((selection.adminAddresses ?? []).length === 0) {
      errors.push(`${selection.key} requires at least one admin address before it can be enabled.`);
    }
  }

  for (const change of input.balanceChanges) {
    if (!isValidAddress(change.address)) errors.push(`Invalid balance-change address: ${change.address || '(empty)'}`);
    if (!isPositiveAmount(change.amount))
      errors.push(`Balance change for ${change.address || 'an address'} must be positive.`);
  }

  for (const change of input.codeChanges) {
    if (!isValidAddress(change.address)) errors.push(`Invalid bytecode target address: ${change.address || '(empty)'}`);
    if (!isValidRuntimeBytecode(change.code)) {
      errors.push(`Runtime bytecode for ${change.address || 'an address'} must be non-empty 0x-prefixed hex bytecode.`);
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

function cloneUpgradeJson(config: UpgradeJson): UpgradeJson {
  return JSON.parse(JSON.stringify(config)) as UpgradeJson;
}

function assignAddressArray(target: Record<string, unknown>, key: string, value: string[] | undefined) {
  if (value && value.length > 0) {
    target[key] = value;
  }
}
