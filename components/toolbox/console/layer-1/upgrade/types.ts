import { AddressEntry, FeeConfigType } from "@/components/toolbox/components/genesis/types";

export type PrecompileKey =
  | 'txAllowListConfig'
  | 'contractDeployerAllowListConfig'
  | 'contractNativeMinterConfig'
  | 'feeManagerConfig'
  | 'rewardManagerConfig'
  | 'warpConfig';

export type UpgradeAction = 'enable' | 'disable';

export interface UpgradeEntry {
  id: string;
  precompileKey: PrecompileKey;
  action: UpgradeAction;
  blockTimestamp: number; // Unix seconds
  adminAddresses: AddressEntry[];
  managerAddresses: AddressEntry[];
  enabledAddresses: AddressEntry[];
  // feeManagerConfig only
  initialFeeConfig?: FeeConfigType;
  // rewardManagerConfig only
  allowFeeRecipients?: boolean;
  rewardAddress?: string;
  // warpConfig only
  quorumNumerator?: number;
}

export const PRECOMPILE_CONFIG_INFO: Record<PrecompileKey, { name: string; address: string; hasAllowlist: boolean }> = {
  txAllowListConfig: {
    name: 'Transaction Allow List',
    address: '0x0200000000000000000000000000000000000002',
    hasAllowlist: true,
  },
  contractDeployerAllowListConfig: {
    name: 'Contract Deployer Allow List',
    address: '0x0200000000000000000000000000000000000000',
    hasAllowlist: true,
  },
  contractNativeMinterConfig: {
    name: 'Native Minter',
    address: '0x0200000000000000000000000000000000000001',
    hasAllowlist: true,
  },
  feeManagerConfig: {
    name: 'Fee Manager',
    address: '0x0200000000000000000000000000000000000003',
    hasAllowlist: true,
  },
  rewardManagerConfig: {
    name: 'Reward Manager',
    address: '0x0200000000000000000000000000000000000004',
    hasAllowlist: true,
  },
  warpConfig: {
    name: 'Warp Messenger',
    address: '0x0200000000000000000000000000000000000005',
    hasAllowlist: false,
  },
};

export const DEFAULT_FEE_CONFIG: FeeConfigType = {
  baseFeeChangeDenominator: 48,
  blockGasCostStep: 200000,
  maxBlockGasCost: 1000000,
  minBaseFee: 25000000000,
  minBlockGasCost: 0,
  targetGas: 15000000,
};

export interface ValidationResult {
  errors: Record<string, string>;
  warnings: Record<string, string>;
}

export function validateEntries(entries: UpgradeEntry[]): ValidationResult {
  const errors: Record<string, string> = {};
  const warnings: Record<string, string> = {};

  if (entries.length === 0) {
    errors.general = 'Add at least one upgrade entry.';
    return { errors, warnings };
  }

  const now = Math.floor(Date.now() / 1000);
  const timestamps: number[] = [];

  entries.forEach((entry, idx) => {
    const prefix = `entry_${idx}`;

    // Timestamp checks
    if (timestamps.includes(entry.blockTimestamp)) {
      errors[`${prefix}_timestamp`] = 'Each entry must have a unique block timestamp.';
    }
    timestamps.push(entry.blockTimestamp);

    if (entry.blockTimestamp <= now) {
      warnings[`${prefix}_timestamp`] = 'Block timestamp is in the past. The upgrade may have already activated or will fail to activate.';
    }

    if (entry.action === 'enable') {
      const info = PRECOMPILE_CONFIG_INFO[entry.precompileKey];

      // Allowlist precompiles require at least one address when enabling
      if (
        info.hasAllowlist &&
        entry.precompileKey !== 'feeManagerConfig' &&
        entry.precompileKey !== 'rewardManagerConfig'
      ) {
        const allAddresses = [
          ...entry.adminAddresses,
          ...entry.managerAddresses,
          ...entry.enabledAddresses,
        ].filter(a => !a.error && a.address);

        if (allAddresses.length === 0) {
          errors[`${prefix}_addresses`] = 'Add at least one valid address to enable this precompile.';
        }
      }

      // rewardManager address validation
      if (entry.precompileKey === 'rewardManagerConfig' && entry.rewardAddress) {
        if (!/^0x[0-9a-fA-F]{40}$/.test(entry.rewardAddress)) {
          errors[`${prefix}_rewardAddress`] = 'Reward address must be a valid EVM address (0x...).';
        }
      }

      // warpConfig quorumNumerator validation
      if (entry.precompileKey === 'warpConfig') {
        const qn = entry.quorumNumerator ?? 67;
        if (qn < 1 || qn > 100) {
          errors[`${prefix}_quorumNumerator`] = 'Quorum numerator must be between 1 and 100.';
        }
      }
    }
  });

  // Check strictly increasing timestamps
  for (let i = 1; i < timestamps.length; i++) {
    if (timestamps[i] <= timestamps[i - 1]) {
      errors[`entry_${i}_timestamp`] = errors[`entry_${i}_timestamp`]
        ?? 'Block timestamps must be strictly increasing across entries.';
    }
  }

  return { errors, warnings };
}
