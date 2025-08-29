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
      sourceUrl: "https://raw.githubusercontent.com/ava-labs/subnet-evm/refs/heads/master/plugin/evm/config/config.md",
      outputPath: "content/docs/avalanche-l1s/subnet-evm/config.mdx",
      title: "Subnet EVM Config",
      description: "This page lists all available configs for the Subnet EVM.",
      contentUrl: "https://github.com/ava-labs/subnet-evm/blob/master/plugin/evm/config/config.md",
    }
  ];
} 