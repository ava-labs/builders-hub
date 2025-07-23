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
      outputPath: "content/docs/primary-network/chain-configs/p-chain/p-chain.mdx",
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
    {
      sourceUrl: "https://raw.githubusercontent.com/ava-labs/avalanchego/master/vms/platformvm/docs/block_formation_logic.md",
      outputPath: "content/docs/primary-network/chain-configs/p-chain/block-formation-logic.mdx",
      title: "Block Formation Logic",
      description: "This page describes the block formation logic in the P-Chain.",
      contentUrl: "https://github.com/ava-labs/avalanchego/blob/master/vms/platformvm/docs/",
    },
    {
      sourceUrl: "https://raw.githubusercontent.com/ava-labs/avalanchego/master/vms/platformvm/docs/chain_time_update.md",
      outputPath: "content/docs/primary-network/chain-configs/p-chain/chain-time-update.mdx",
      title: "Chain Time Update",
      description: "This page describes how chain time is updated in the P-Chain.",
      contentUrl: "https://github.com/ava-labs/avalanchego/blob/master/vms/platformvm/docs/",
    },
    {
      sourceUrl: "https://raw.githubusercontent.com/ava-labs/avalanchego/master/vms/platformvm/docs/mempool_gossiping.md",
      outputPath: "content/docs/primary-network/chain-configs/p-chain/mempool-gossiping.mdx",
      title: "Mempool Gossiping",
      description: "This page describes how mempool gossiping works in the P-Chain.",
      contentUrl: "https://github.com/ava-labs/avalanchego/blob/master/vms/platformvm/docs/",
    },
    {
      sourceUrl: "https://raw.githubusercontent.com/ava-labs/avalanchego/master/vms/platformvm/docs/subnets.md",
      outputPath: "content/docs/primary-network/chain-configs/p-chain/subnets.mdx",
      title: "Subnets",
      description: "This page describes how subnets work in the P-Chain.",
      contentUrl: "https://github.com/ava-labs/avalanchego/blob/master/vms/platformvm/docs/",
    },
    {
      sourceUrl: "https://raw.githubusercontent.com/ava-labs/avalanchego/master/vms/platformvm/docs/validators_versioning.md",
      outputPath: "content/docs/primary-network/chain-configs/p-chain/validators-versioning.mdx",
      title: "Validators Versioning",
      description: "This page describes validators versioning in the P-Chain.",
      contentUrl: "https://github.com/ava-labs/avalanchego/blob/master/vms/platformvm/docs/",
    },
    {
      sourceUrl: "https://raw.githubusercontent.com/ava-labs/avalanchego/master/genesis/README.md",
      outputPath: "content/docs/primary-network/chain-configs/p-chain/genesis.mdx",
      title: "Genesis Configuration",
      description: "This page describes the genesis configuration for Avalanche networks.",
      contentUrl: "https://github.com/ava-labs/avalanchego/blob/master/genesis/",
    },
  ];
} 