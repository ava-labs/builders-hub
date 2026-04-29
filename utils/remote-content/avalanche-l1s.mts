import { FileConfig } from './shared.mts';

/**
 * Avalanche L1s (formerly Subnets) configuration content
 * Includes L1 configs, Subnet-EVM, and Validator Manager
 */
export function getAvalancheL1sConfigs(): FileConfig[] {
  return [
    {
      sourceUrl: "https://raw.githubusercontent.com/ava-labs/avalanchego/master/subnets/config.md",
      outputPath: "content/docs/nodes/configure/avalanche-l1-configs.mdx",
      title: "Avalanche L1 Configs",
      description: "This page describes the configuration options available for Avalanche L1s.",
      contentUrl: "https://github.com/ava-labs/avalanchego/blob/master/subnets/",
    },
    {
      sourceUrl: "https://raw.githubusercontent.com/ava-labs/avalanchego/master/graft/subnet-evm/plugin/evm/config/config.md",
      outputPath: "content/docs/nodes/chain-configs/subnet-evm.mdx",
      title: "Subnet-EVM Configs",
      description: "This page describes the configuration options available for the Subnet-EVM.",
      contentUrl: "https://github.com/ava-labs/avalanchego/blob/master/graft/subnet-evm/plugin/evm/config/",
    },
    {
      sourceUrl: "https://raw.githubusercontent.com/ava-labs/icm-services/refs/heads/main/icm-contracts/avalanche/validator-manager/README.md",
      outputPath: "content/docs/avalanche-l1s/validator-manager/contract.mdx",
      title: "Validator Manager Contracts",
      description: "This page lists all available contracts for the Validator Manager.",
      contentUrl: "https://github.com/ava-labs/icm-services/blob/main/icm-contracts/avalanche/validator-manager/",
      postProcess: (content) => content.replace(
        "Disabled L1 validators can re-activate at any time by increasing their balance with an `IncreaseBalanceTx`. Anyone can call `IncreaseBalanceTx` for any validator on the P-Chain. A disabled validator can only be completely and permanently removed from the validator set by a call to `initiateValidatorRemoval`.",
        `Disabled L1 validators can re-activate at any time by increasing their balance with an \`IncreaseBalanceTx\`. Anyone can call \`IncreaseBalanceTx\` for any validator on the P-Chain. A disabled validator can only be completely and permanently removed from the validator set by a call to \`initiateValidatorRemoval\`.

<Callout type="warn">
If all registered validators become inactive and the L1 stops producing blocks,
a later \`IncreaseBalanceTx\` may not recover block production by itself. See
[Recovering a Halted L1 After Validator Inactivity](/docs/avalanche-l1s/maintain/halted-block-production).
</Callout>`
      ),
    },
    {
      sourceUrl: "https://raw.githubusercontent.com/ava-labs/avalanchego/master/graft/subnet-evm/precompile/contracts/warp/README.md",
      outputPath: "content/docs/avalanche-l1s/evm-configuration/warpmessenger.mdx",
      title: "WarpMessenger Precompile - Technical Details",
      description: "Technical documentation for the WarpMessenger precompile implementation in subnet-evm.",
      contentUrl: "https://github.com/ava-labs/avalanchego/blob/master/graft/subnet-evm/precompile/contracts/warp/",
    },
  ];
}
