import { FileConfig } from './shared.mts';

/**
 * Cross-chain related content configurations
 * Includes Avalanche Warp Messaging, ICM Contracts, Teleporter, and ICTT
 */
export function getCrossChainConfigs(): FileConfig[] {
  return [
    {
      sourceUrl: "https://raw.githubusercontent.com/ava-labs/avalanchego/master/vms/platformvm/warp/README.md",
      outputPath: "content/docs/cross-chain/avalanche-warp-messaging/deep-dive.mdx",
      title: "Deep Dive into ICM",
      description: "Learn about Avalanche Warp Messaging, a cross-Avalanche L1 communication protocol on Avalanche.",
      contentUrl: "https://github.com/ava-labs/avalanchego/tree/master/vms/platformvm/warp/",
    },
    {
      sourceUrl: "https://raw.githubusercontent.com/ava-labs/icm-services/refs/heads/main/relayer/README.md",
      outputPath: "content/docs/cross-chain/avalanche-warp-messaging/run-relayer.mdx",
      title: "Run a Relayer",
      description: "Reference relayer implementation for cross-chain Avalanche Interchain Message delivery.",
      contentUrl: "https://github.com/ava-labs/icm-services/blob/main/relayer/",
    },
    {
      sourceUrl: "https://raw.githubusercontent.com/ava-labs/icm-contracts/refs/heads/main/contracts/teleporter/README.md",
      outputPath: "content/docs/cross-chain/icm-contracts/overview.mdx",
      title: "What is ICM Contracts?",
      description: "ICM Contracts is a messaging protocol built on top of Avalanche Interchain Messaging that provides a developer-friendly interface for sending and receiving cross-chain messages from the EVM.",
      contentUrl: "https://github.com/ava-labs/icm-contracts/blob/main/contracts/teleporter/",
    },
    {
      sourceUrl: "https://raw.githubusercontent.com/ava-labs/icm-contracts/main/README.md",
      outputPath: "content/docs/cross-chain/icm-contracts/deep-dive.mdx",
      title: "Deep Dive into ICM Contracts",
      description: "ICM Contracts is an EVM compatible cross-Avalanche L1 communication protocol built on top of Avalanche Interchain Messaging (ICM), and implemented as a Solidity smart contract.",
      contentUrl: "https://github.com/ava-labs/teleporter/blob/main/",
    },
    {
      sourceUrl: "https://raw.githubusercontent.com/ava-labs/teleporter/main/cmd/teleporter-cli/README.md",
      outputPath: "content/docs/cross-chain/icm-contracts/cli.mdx",
      title: "Teleporter CLI",
      description: "The CLI is a command line interface for interacting with the Teleporter contracts.",
      contentUrl: "https://github.com/ava-labs/teleporter/blob/main/cmd/teleporter-cli/README.md",
    },
    {
      sourceUrl: "https://raw.githubusercontent.com/ava-labs/teleporter/main/contracts/teleporter/registry/README.md",
      outputPath: "content/docs/cross-chain/icm-contracts/upgradeability.mdx",
      title: "Upgradeability",
      description: "The TeleporterMessenger contract is non-upgradable. However, there could still be new versions of TeleporterMessenger contracts needed to be deployed in the future.",
      contentUrl: "https://github.com/ava-labs/teleporter/blob/main/contracts/teleporter/registry/",
    },
    {
      sourceUrl: "https://raw.githubusercontent.com/ava-labs/avalanchego/master/graft/coreth/precompile/contracts/warp/README.md",
      outputPath: "content/docs/cross-chain/avalanche-warp-messaging/evm-integration.mdx",
      title: "Integration with EVM",
      description: "Avalanche Warp Messaging provides a basic primitive for signing and verifying messages between Avalanche L1s.",
      contentUrl: "https://github.com/ava-labs/avalanchego/blob/master/graft/coreth/precompile/contracts/warp/",
    },
    {
      sourceUrl: "https://raw.githubusercontent.com/ava-labs/icm-contracts/refs/heads/main/contracts/ictt/README.md",
      outputPath: "content/docs/cross-chain/interchain-token-transfer/overview.mdx",
      title: "Avalanche Interchain Token Transfer (ICTT)",
      description: "This page describes the Avalanche Interchain Token Transfer (ICTT)",
      contentUrl: "https://github.com/ava-labs/icm-contracts/blob/main/contracts/ictt/",
    },
  ];
}

