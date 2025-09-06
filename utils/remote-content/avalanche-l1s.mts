import { FileConfig } from './shared.mts';

export function getAvalancheL1sConfigs(): FileConfig[] {
  return [
    {
      sourceUrl: "https://raw.githubusercontent.com/ava-labs/icm-contracts/refs/heads/main/contracts/validator-manager/README.md",
      outputPath: "content/docs/avalanche-l1s/validator-manager/contract.mdx",
      title: "Validator Manager Contracts",
      description: "This page lists all available contracts for the Validator Manager.",
      contentUrl: "https://github.com/ava-labs/icm-contracts/blob/main/contracts/validator-manager/",
    },
    {
      sourceUrl: "https://raw.githubusercontent.com/ava-labs/icm-contracts/refs/heads/main/contracts/validator-manager/PoAMigration.md",
      outputPath: "content/docs/avalanche-l1s/validator-manager/pos-migration.mdx",
      title: "PoA Migration to PoS",
      description: "This page describes the process of migrating from PoA to PoS.",
      contentUrl: "https://github.com/ava-labs/icm-contracts/blob/main/contracts/validator-manager/PoAMigration.md",
    },
    {
      sourceUrl: "https://raw.githubusercontent.com/ava-labs/icm-contracts/refs/heads/main/contracts/validator-manager/StateTransition.md",
      outputPath: "content/docs/avalanche-l1s/validator-manager/state-transition.mdx",
      title: "State Transition",
      description: "This state transition diagram illustrates the relationship between validator and delegator state.",
      contentUrl: "https://github.com/ava-labs/icm-contracts/blob/main/contracts/validator-manager/StateTransition.md",
    },
    {
      sourceUrl: "https://raw.githubusercontent.com/ava-labs/subnet-evm/refs/heads/master/plugin/evm/config/config.md",
      outputPath: "content/docs/avalanche-l1s/subnet-evm/config.mdx",
      title: "Subnet EVM Config",
      description: "This page lists all available configs for the Subnet EVM.",
      contentUrl: "https://github.com/ava-labs/subnet-evm/blob/master/plugin/evm/config/config.md",
    },
    {
      sourceUrl: "https://raw.githubusercontent.com/ava-labs/avalanchego/master/subnets/config.md",
      outputPath: "content/docs/avalanche-l1s/configure/avalanche-l1-configs.mdx",
      title: "Avalanche L1 Configs",
      description: "This page describes the configuration options available for Avalanche L1s.",
      contentUrl: "https://github.com/ava-labs/avalanchego/blob/master/subnets/",
    },
  ];
} 