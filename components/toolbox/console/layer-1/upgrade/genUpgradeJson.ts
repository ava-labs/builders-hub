import { UpgradeEntry } from "./types";

function filterAddresses(addresses: { address: string; error?: string }[]): string[] {
  return addresses
    .filter(a => a.address && !a.error)
    .map(a => a.address);
}

export function genUpgradeJson(entries: UpgradeEntry[]): object {
  const sorted = [...entries].sort((a, b) => a.blockTimestamp - b.blockTimestamp);

  const precompileUpgrades = sorted.map(entry => {
    if (entry.action === 'disable') {
      return {
        [entry.precompileKey]: {
          blockTimestamp: entry.blockTimestamp,
          disable: true,
        },
      };
    }

    // Enable action
    const config: Record<string, unknown> = {
      blockTimestamp: entry.blockTimestamp,
    };

    if (entry.precompileKey === 'warpConfig') {
      config.quorumNumerator = entry.quorumNumerator ?? 67;
      return { [entry.precompileKey]: config };
    }

    // Allowlist roles (for all except warpConfig)
    const adminAddresses = filterAddresses(entry.adminAddresses);
    const managerAddresses = filterAddresses(entry.managerAddresses);
    const enabledAddresses = filterAddresses(entry.enabledAddresses);

    if (adminAddresses.length > 0) config.adminAddresses = adminAddresses;
    if (managerAddresses.length > 0) config.managerAddresses = managerAddresses;
    if (enabledAddresses.length > 0) config.enabledAddresses = enabledAddresses;

    if (entry.precompileKey === 'feeManagerConfig' && entry.initialFeeConfig) {
      config.initialFeeConfig = entry.initialFeeConfig;
    }

    if (entry.precompileKey === 'rewardManagerConfig') {
      if (entry.allowFeeRecipients === true) {
        config.initialRewardConfig = { allowFeeRecipients: true };
      } else if (entry.rewardAddress) {
        config.initialRewardConfig = { rewardAddress: entry.rewardAddress };
      }
    }

    return { [entry.precompileKey]: config };
  });

  return { precompileUpgrades };
}
