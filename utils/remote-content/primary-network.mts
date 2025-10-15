import { FileConfig } from './shared.mts';

/**
 * Primary Network (P-Chain, C-Chain, X-Chain) configuration content
 */
export function getPrimaryNetworkConfigs(): FileConfig[] {
  return [
    {
      sourceUrl: "https://raw.githubusercontent.com/ava-labs/avalanchego/master/vms/platformvm/config/config.md",
      outputPath: "content/docs/nodes/chain-configs/p-chain.mdx",
      title: "P-Chain Configs",
      description: "This page describes the configuration options available for the P-Chain.",
      contentUrl: "https://github.com/ava-labs/avalanchego/blob/master/vms/platformvm/config/",
    },
    {
      sourceUrl: "https://raw.githubusercontent.com/ava-labs/coreth/master/plugin/evm/config/config.md",
      outputPath: "content/docs/nodes/chain-configs/c-chain.mdx",
      title: "C-Chain Configs",
      description: "This page describes the configuration options available for the C-Chain.",
      contentUrl: "https://github.com/ava-labs/coreth/blob/master/plugin/evm/config/",
    },
    {
      sourceUrl: "https://raw.githubusercontent.com/ava-labs/avalanchego/master/vms/avm/config.md",
      outputPath: "content/docs/nodes/chain-configs/x-chain.mdx",
      title: "X-Chain Configs",
      description: "This page describes the configuration options available for the X-Chain.",
      contentUrl: "https://github.com/ava-labs/avalanchego/blob/master/vms/avm/",
    },
    {
      sourceUrl: "https://raw.githubusercontent.com/ava-labs/avalanchego/master/config/config.md",
      outputPath: "content/docs/nodes/configure/configs-flags.mdx",
      title: "AvalancheGo Config Flags",
      description: "This page lists all available configuration options for AvalancheGo nodes.",
      contentUrl: "https://github.com/ava-labs/avalanchego/blob/master/config/",
    },
  ];
}

