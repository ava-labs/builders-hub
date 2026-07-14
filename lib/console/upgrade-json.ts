export type PrecompileConfigKey =
  | 'contractDeployerAllowListConfig'
  | 'contractNativeMinterConfig'
  | 'txAllowListConfig'
  | 'feeManagerConfig'
  | 'rewardManagerConfig'
  | 'warpConfig';

// 'update' schedules a disable entry immediately followed by a re-enable with
// the new allowlist — the documented way to change an active precompile's
// configuration (subnet-evm rejects enabling an already-enabled precompile).
export type PrecompileMode = 'none' | 'enable' | 'disable' | 'update';

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
  /** Optional storage-slot initialization, set by predeploy presets (not user-edited). */
  storage?: Record<string, string>;
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
    const structureErrors = validateUpgradeJsonStructure(parsed);
    if (structureErrors.length > 0) {
      const shown = structureErrors.slice(0, 3).join(' ');
      const hidden = structureErrors.length - 3;
      return { config: null, error: hidden > 0 ? `${shown} (+${hidden} more issue${hidden === 1 ? '' : 's'})` : shown };
    }
    return { config: parsed as UpgradeJson, error: null };
  } catch (error) {
    return { config: null, error: error instanceof Error ? error.message : 'Invalid JSON.' };
  }
}

const TOP_LEVEL_KEYS = ['precompileUpgrades', 'stateUpgrades', 'networkUpgradeOverrides'];
const STATE_UPGRADE_ENTRY_KEYS = ['blockTimestamp', 'accounts'];
const STATE_UPGRADE_ACCOUNT_KEYS = ['code', 'storage', 'balanceChange'];
const ALLOWLIST_ROLE_KEYS = ['adminAddresses', 'managerAddresses', 'enabledAddresses'];

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

// blockTimestamp must be a positive integer; the docs show both raw numbers
// and digit strings, so both are accepted.
function isValidUpgradeTimestamp(value: unknown): boolean {
  if (typeof value === 'number') return Number.isInteger(value) && value > 0;
  if (typeof value === 'string') return DECIMAL_POSITIVE_RE.test(value) && Number(value) > 0;
  return false;
}

/**
 * Structural validation for an existing/imported upgrade.json. Checks the
 * shapes subnet-evm actually parses (known top-level keys, one precompile per
 * entry, timestamps, address lists, stateUpgrades accounts) while staying
 * lenient about precompile-specific config fields like initialFeeConfig so
 * real-world files keep working.
 */
export function validateUpgradeJsonStructure(value: unknown): string[] {
  if (!isPlainObject(value)) return ['upgrade.json must be a JSON object.'];

  const errors: string[] = [];
  for (const key of Object.keys(value)) {
    if (!TOP_LEVEL_KEYS.includes(key)) {
      errors.push(`Unknown top-level key "${key}" (allowed: ${TOP_LEVEL_KEYS.join(', ')}).`);
    }
  }

  if (value.precompileUpgrades !== undefined) {
    if (!Array.isArray(value.precompileUpgrades)) {
      errors.push('precompileUpgrades must be an array.');
    } else {
      value.precompileUpgrades.forEach((entry, index) => {
        errors.push(...validatePrecompileUpgradeEntry(entry, `precompileUpgrades[${index}]`));
      });
    }
  }

  if (value.stateUpgrades !== undefined) {
    if (!Array.isArray(value.stateUpgrades)) {
      errors.push('stateUpgrades must be an array.');
    } else {
      value.stateUpgrades.forEach((entry, index) => {
        errors.push(...validateStateUpgradeEntry(entry, `stateUpgrades[${index}]`));
      });
    }
  }

  if (value.networkUpgradeOverrides !== undefined && !isPlainObject(value.networkUpgradeOverrides)) {
    errors.push('networkUpgradeOverrides must be an object.');
  }

  return errors;
}

function validatePrecompileUpgradeEntry(entry: unknown, label: string): string[] {
  if (!isPlainObject(entry)) return [`${label} must be an object with exactly one precompile config.`];

  const keys = Object.keys(entry);
  if (keys.length !== 1) {
    return [`${label} must contain exactly one precompile config, found ${keys.length}.`];
  }

  const key = keys[0];
  if (!PRECOMPILE_DEFINITIONS.some((definition) => definition.key === key)) {
    return [`${label} has unknown precompile "${key}" (known: ${PRECOMPILE_DEFINITIONS.map((d) => d.key).join(', ')}).`];
  }

  const config = entry[key];
  if (!isPlainObject(config)) return [`${label}.${key} must be an object.`];

  const errors: string[] = [];
  if (!isValidUpgradeTimestamp(config.blockTimestamp)) {
    errors.push(`${label}.${key} needs a positive integer blockTimestamp.`);
  }
  if (config.disable !== undefined && typeof config.disable !== 'boolean') {
    errors.push(`${label}.${key}.disable must be a boolean.`);
  }
  for (const role of ALLOWLIST_ROLE_KEYS) {
    const list = config[role];
    if (list === undefined || list === null) continue;
    if (!Array.isArray(list)) {
      errors.push(`${label}.${key}.${role} must be an array of addresses.`);
      continue;
    }
    for (const address of list) {
      if (typeof address !== 'string' || !isValidAddress(address)) {
        errors.push(`${label}.${key}.${role} contains an invalid address: ${JSON.stringify(address)}.`);
      }
    }
  }
  return errors;
}

function validateStateUpgradeEntry(entry: unknown, label: string): string[] {
  if (!isPlainObject(entry)) return [`${label} must be an object.`];

  const errors: string[] = [];
  for (const key of Object.keys(entry)) {
    if (!STATE_UPGRADE_ENTRY_KEYS.includes(key)) {
      errors.push(`${label} has unknown key "${key}" (allowed: ${STATE_UPGRADE_ENTRY_KEYS.join(', ')}).`);
    }
  }
  if (!isValidUpgradeTimestamp(entry.blockTimestamp)) {
    errors.push(`${label} needs a positive integer blockTimestamp.`);
  }
  if (!isPlainObject(entry.accounts)) {
    errors.push(`${label}.accounts must be an object keyed by address.`);
    return errors;
  }

  for (const [address, account] of Object.entries(entry.accounts)) {
    const accountLabel = `${label}.accounts["${address}"]`;
    if (!isValidAddress(address)) {
      errors.push(`${label}.accounts has an invalid address key: "${address}".`);
    }
    if (!isPlainObject(account)) {
      errors.push(`${accountLabel} must be an object.`);
      continue;
    }
    for (const key of Object.keys(account)) {
      if (!STATE_UPGRADE_ACCOUNT_KEYS.includes(key)) {
        errors.push(`${accountLabel} has unknown key "${key}" (allowed: ${STATE_UPGRADE_ACCOUNT_KEYS.join(', ')}).`);
      }
    }
    if (account.code !== undefined && (typeof account.code !== 'string' || !isValidRuntimeBytecode(account.code))) {
      errors.push(`${accountLabel}.code must be 0x-prefixed hex bytecode.`);
    }
    if (account.balanceChange !== undefined && !isValidBalanceChange(account.balanceChange)) {
      errors.push(`${accountLabel}.balanceChange must be a positive decimal or hex amount.`);
    }
    if (account.storage !== undefined && !isPlainObject(account.storage)) {
      errors.push(`${accountLabel}.storage must be an object of storage slots.`);
    }
  }
  return errors;
}

function isValidBalanceChange(value: unknown): boolean {
  if (typeof value === 'number') return Number.isInteger(value) && value > 0;
  return typeof value === 'string' && isPositiveAmount(value);
}

function parseTimestampValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && DECIMAL_POSITIVE_RE.test(value)) return Number(value);
  return null;
}

/**
 * Derive which precompiles are active right now from eth_getChainConfig
 * output: genesis-level precompile configs plus `upgrades.precompileUpgrades`
 * replayed in order up to the chain's latest block timestamp. Fallback for
 * RPCs that don't expose eth_getActiveRulesAt (e.g. hosted public RPCs).
 */
export function deriveActivePrecompiles(
  chainConfig: unknown,
  latestBlockTimestamp: number | null,
): Record<string, unknown> {
  if (!isPlainObject(chainConfig)) return {};
  const cutoff = latestBlockTimestamp ?? Math.floor(Date.now() / 1000);
  const active: Record<string, unknown> = {};

  for (const definition of PRECOMPILE_DEFINITIONS) {
    const genesisConfig = chainConfig[definition.key];
    if (!isPlainObject(genesisConfig)) continue;
    const timestamp = parseTimestampValue(genesisConfig.blockTimestamp);
    // Skip genesis configs with a missing/garbage blockTimestamp instead of
    // defaulting to 0 (which would over-report them as active-from-genesis),
    // matching the upgrades branch below.
    if (timestamp === null || timestamp > cutoff) continue;
    active[definition.key] = genesisConfig;
  }

  const upgrades = isPlainObject(chainConfig.upgrades) ? chainConfig.upgrades.precompileUpgrades : undefined;
  if (Array.isArray(upgrades)) {
    for (const entry of upgrades) {
      if (!isPlainObject(entry)) continue;
      for (const definition of PRECOMPILE_DEFINITIONS) {
        const config = entry[definition.key];
        if (!isPlainObject(config)) continue;
        const timestamp = parseTimestampValue(config.blockTimestamp);
        if (timestamp === null || timestamp > cutoff) continue;
        if (config.disable === true) {
          delete active[definition.key];
        } else {
          active[definition.key] = config;
        }
      }
    }
  }

  return active;
}

/**
 * Pull the node's current upgrade.json content out of eth_getChainConfig
 * output (`upgrades` carries precompileUpgrades / stateUpgrades /
 * networkUpgradeOverrides). Returns null when the chain has no upgrades, so
 * callers can fall back to an empty base.
 */
export function extractUpgradeJsonFromChainConfig(chainConfig: unknown): UpgradeJson | null {
  if (!isPlainObject(chainConfig) || !isPlainObject(chainConfig.upgrades)) return null;

  const upgrades = chainConfig.upgrades;
  const extracted: UpgradeJson = {};
  if (Array.isArray(upgrades.precompileUpgrades) && upgrades.precompileUpgrades.length > 0) {
    extracted.precompileUpgrades = upgrades.precompileUpgrades as UpgradeJson['precompileUpgrades'];
  }
  if (Array.isArray(upgrades.stateUpgrades) && upgrades.stateUpgrades.length > 0) {
    extracted.stateUpgrades = upgrades.stateUpgrades as UpgradeJson['stateUpgrades'];
  }
  if (isPlainObject(upgrades.networkUpgradeOverrides)) {
    extracted.networkUpgradeOverrides = upgrades.networkUpgradeOverrides as Record<string, number>;
  }

  return Object.keys(extracted).length > 0 ? extracted : null;
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
      const ts = entry?.blockTimestamp;
      if (typeof ts === 'number') timestamps.push(ts);
      else if (typeof ts === 'string' && DECIMAL_POSITIVE_RE.test(ts)) timestamps.push(Number(ts));
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

    // 'update' = disable + re-enable pair, the required sequence for changing
    // an already-active precompile's configuration.
    if (selection.mode === 'disable' || selection.mode === 'update') {
      precompileUpgrades.push({
        [selection.key]: {
          blockTimestamp: activationTimestamp + offset,
          disable: true,
        },
      });
      offset += 1;
      if (selection.mode === 'disable') continue;
    }

    const config: Record<string, unknown> = { blockTimestamp: activationTimestamp + offset };
    offset += 1;
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
          ...(change.storage && Object.keys(change.storage).length > 0 ? { storage: change.storage } : {}),
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
    // 'update' falls through: the re-enable half of the pair carries the new
    // allowlist, so it needs the same address validation as a plain enable.
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
    for (const address of findDuplicateAddresses(addresses)) {
      errors.push(`${selection.key} contains a duplicate address: ${address}`);
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
  for (const address of findDuplicateAddresses(input.balanceChanges.map((change) => change.address))) {
    errors.push(`Duplicate balance-change address: ${address}`);
  }

  for (const change of input.codeChanges) {
    if (!isValidAddress(change.address)) errors.push(`Invalid bytecode target address: ${change.address || '(empty)'}`);
    if (!isValidRuntimeBytecode(change.code)) {
      errors.push(`Runtime bytecode for ${change.address || 'an address'} must be non-empty 0x-prefixed hex bytecode.`);
    }
  }
  for (const address of findDuplicateAddresses(input.codeChanges.map((change) => change.address))) {
    errors.push(`Duplicate bytecode target address: ${address}`);
  }

  return { valid: errors.length === 0, errors, warnings };
}

function findDuplicateAddresses(addresses: string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const address of addresses) {
    if (!address) continue;
    const normalized = address.toLowerCase();
    if (seen.has(normalized)) {
      duplicates.add(address);
      continue;
    }
    seen.add(normalized);
  }
  return Array.from(duplicates);
}

function cloneUpgradeJson(config: UpgradeJson): UpgradeJson {
  return JSON.parse(JSON.stringify(config)) as UpgradeJson;
}

function assignAddressArray(target: Record<string, unknown>, key: string, value: string[] | undefined) {
  if (value && value.length > 0) {
    target[key] = value;
  }
}
