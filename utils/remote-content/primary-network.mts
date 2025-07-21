import { FileConfig } from './shared.mts';

export function getPrimaryNetworkConfigs(): FileConfig[] {
  return [
    {
      sourceUrl: "https://raw.githubusercontent.com/ava-labs/coreth/master/plugin/evm/config/config.md",
      outputPath: "content/docs/primary-network/chain-configs/c-chain.mdx",
      title: "C-Chain Configurations",
      description: "This page describes the configuration options available for the C-Chain.",
      contentUrl: "https://github.com/ava-labs/coreth/blob/master/plugin/evm/config/",
    },
    {
      sourceUrl: "https://raw.githubusercontent.com/ava-labs/avalanchego/master/vms/platformvm/config/config.md",
      outputPath: "content/docs/primary-network/chain-configs/p-chain.mdx",
      title: "P-Chain Configurations",
      description: "This page describes the configuration options available for the P-Chain.",
      contentUrl: "https://github.com/ava-labs/avalanchego/blob/master/vms/platformvm/config/",
    },
    {
      sourceUrl: "https://raw.githubusercontent.com/ava-labs/avalanchego/master/vms/avm/config.md",
      outputPath: "content/docs/primary-network/chain-configs/x-chain.mdx",
      title: "X-Chain Configurations",
      description: "This page describes the configuration options available for the X-Chain.",
      contentUrl: "https://github.com/ava-labs/avalanchego/blob/master/vms/avm/",
    },
    {
      sourceUrl: "https://raw.githubusercontent.com/ava-labs/avalanchego/master/config/config.md",
      outputPath: "content/docs/primary-network/configure/configs-flags.mdx",
      title: "AvalancheGo Config Flags",
      description: "This page lists all available configuration options for AvalancheGo nodes.",
      contentUrl: "https://github.com/ava-labs/avalanchego/blob/master/config/",
    },
    {
      sourceUrl: "https://raw.githubusercontent.com/ava-labs/avalanchego/master/subnets/config.md",
      outputPath: "content/docs/primary-network/configure/avalanche-l1-configs.mdx",
      title: "Avalanche L1 Configs",
      description: "This page describes the configuration options available for Avalanche L1s.",
      contentUrl: "https://github.com/ava-labs/avalanchego/blob/master/subnets/",
    },
  ];
} 