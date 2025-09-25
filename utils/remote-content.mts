// Main orchestrator script for remote content processing
import { updateGitignore, processFile, type FileConfig } from './remote-content/shared.mts';
import { parsers } from './remote-content/parsers/index.mts';
import { getCrossChainConfigs } from './remote-content/cross-chain.mts';
import { getApisConfigs } from './remote-content/apis.mts';
import { getPrimaryNetworkConfigs } from './remote-content/primary-network.mts';
import { getAvalancheL1sConfigs } from './remote-content/avalanche-l1s.mts';
import { getAcpsConfigs } from './remote-content/acps.mts';
import { getToolingConfigs } from './remote-content/tooling.mts';
// import { getSDKSConfigs } from './remote-content/sdks.mts';

/**
 * Process files for a specific section
 */
async function processSection(sectionName: string, configs: FileConfig[]): Promise<void> {
  console.log(`\n🔄 Processing ${sectionName} section (${configs.length} files)...`);
  
  for (const fileConfig of configs) {
    await processFile(fileConfig, parsers[sectionName]);
  }
  
  console.log(`✅ Completed ${sectionName} section`);
}

async function main(): Promise<void> {
  const fileConfigs: FileConfig[] = [
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
      outputPath: "content/docs/cross-chain/teleporter/overview.mdx",
      title: "What is ICM Contracts?",
      description: "ICM Contracts is a messaging protocol built on top of Avalanche Interchain Messaging that provides a developer-friendly interface for sending and receiving cross-chain messages from the EVM.",
      contentUrl: "https://github.com/ava-labs/icm-contracts/blob/main/contracts/teleporter/",
    },
    {
      sourceUrl: "https://raw.githubusercontent.com/ava-labs/icm-contracts/main/README.md",
      outputPath: "content/docs/cross-chain/teleporter/deep-dive.mdx",
      title: "Deep Dive into ICM Contracts",
      description: "ICM Contracts is an EVM compatible cross-Avalanche L1 communication protocol built on top of Avalanche Interchain Messaging (ICM), and implemented as a Solidity smart contract.",
      contentUrl: "https://github.com/ava-labs/teleporter/blob/main/",
    },
    {
      sourceUrl: "https://raw.githubusercontent.com/ava-labs/teleporter/main/cmd/teleporter-cli/README.md",
      outputPath: "content/docs/cross-chain/teleporter/cli.mdx",
      title: "Teleporter CLI",
      description: "The CLI is a command line interface for interacting with the Teleporter contracts.",
      contentUrl: "https://github.com/ava-labs/teleporter/blob/main/cmd/teleporter-cli/README.md",
    },
    {
      sourceUrl: "https://raw.githubusercontent.com/ava-labs/teleporter/main/contracts/teleporter/registry/README.md",
      outputPath: "content/docs/cross-chain/teleporter/upgradeability.mdx",
      title: "Upgradeability",
      description: "The TeleporterMessenger contract is non-upgradable. However, there could still be new versions of TeleporterMessenger contracts needed to be deployed in the future.",
      contentUrl: "https://github.com/ava-labs/teleporter/blob/main/contracts/teleporter/registry/",
    },
    {
      sourceUrl: "https://raw.githubusercontent.com/ava-labs/coreth/master/precompile/contracts/warp/README.md",
      outputPath: "content/docs/cross-chain/avalanche-warp-messaging/evm-integration.mdx",
      title: "Integration with EVM",
      description: "Avalanche Warp Messaging provides a basic primitive for signing and verifying messages between Avalanche L1s.",
      contentUrl: "https://github.com/ava-labs/coreth/blob/master/precompile/contracts/warp/",
    },
    {
      sourceUrl: "https://raw.githubusercontent.com/ava-labs/avalanchego/master/api/admin/service.md",
      outputPath: "content/docs/api-reference/admin-api.mdx",
      title: "Admin API",
      description: "This page is an overview of the Admin API associated with AvalancheGo.",
      contentUrl: "https://github.com/ava-labs/avalanchego/blob/master/api/admin/",
    },
    {
      sourceUrl: "https://raw.githubusercontent.com/ava-labs/avalanchego/master/api/health/service.md",
      outputPath: "content/docs/api-reference/health-api.mdx",
      title: "Health API",
      description: "This page is an overview of the Health API associated with AvalancheGo.",
      contentUrl: "https://github.com/ava-labs/avalanchego/blob/master/api/health/",
    },
    {
      sourceUrl: "https://raw.githubusercontent.com/ava-labs/avalanchego/master/api/info/service.md",
      outputPath: "content/docs/api-reference/info-api.mdx",
      title: "Info API",
      description: "This page is an overview of the Info API associated with AvalancheGo.",
      contentUrl: "https://github.com/ava-labs/avalanchego/blob/master/api/info/",
    },
    {
      sourceUrl: "https://raw.githubusercontent.com/ava-labs/avalanchego/master/api/metrics/service.md",
      outputPath: "content/docs/api-reference/metrics-api.mdx",
      title: "Metrics API",
      description: "This page is an overview of the Metrics API associated with AvalancheGo.",
      contentUrl: "https://github.com/ava-labs/avalanchego/blob/master/api/metrics/",
    },
    {
      sourceUrl: "https://raw.githubusercontent.com/ava-labs/avalanchego/master/indexer/service.md",
      outputPath: "content/docs/api-reference/index-api.mdx",
      title: "Index API",
      description: "This page is an overview of the Index API associated with AvalancheGo.",
      contentUrl: "https://github.com/ava-labs/avalanchego/blob/master/indexer/",
    },
    {
      sourceUrl: "https://raw.githubusercontent.com/ava-labs/avalanchego/master/vms/platformvm/service.md",
      outputPath: "content/docs/api-reference/p-chain/api.mdx",
      title: "P-Chain API",
      description: "This page is an overview of the P-Chain API associated with AvalancheGo.",
      contentUrl: "https://github.com/ava-labs/avalanchego/blob/master/vms/platformvm/",
    },
    {
      sourceUrl: "https://raw.githubusercontent.com/ava-labs/avalanchego/master/vms/avm/service.md",
      outputPath: "content/docs/api-reference/x-chain/api.mdx",
      title: "X-Chain API",
      description: "This page is an overview of the X-Chain API associated with AvalancheGo.",
      contentUrl: "https://github.com/ava-labs/avalanchego/blob/master/vms/avm/",
    },
    {
      sourceUrl: "https://raw.githubusercontent.com/ava-labs/coreth/master/plugin/evm/api.md",
      outputPath: "content/docs/api-reference/c-chain/api.mdx",
      title: "C-Chain API",
      description: "This page is an overview of the C-Chain API associated with AvalancheGo.",
      contentUrl: "https://github.com/ava-labs/coreth/blob/master/plugin/evm/",
    },
    {
      sourceUrl: "https://raw.githubusercontent.com/ava-labs/avalanche-cli/main/cmd/commands.md",
      outputPath: "content/docs/tooling/cli-commands.mdx",
      title: "CLI Commands",
      description: "Complete list of Avalanche CLI commands and their usage.",
      contentUrl: "https://github.com/ava-labs/avalanche-cli/blob/main/cmd/",
    },
    {
      sourceUrl: "https://raw.githubusercontent.com/ava-labs/avalanchego/master/subnets/config.md",
      outputPath: "content/docs/nodes/configure/avalanche-l1-configs.mdx",
      title: "Avalanche L1 Configs",
      description: "This page describes the configuration options available for Avalanche L1s.",
      contentUrl: "https://github.com/ava-labs/avalanchego/blob/master/subnets/",
    },
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
      sourceUrl: "https://raw.githubusercontent.com/ava-labs/subnet-evm/master/plugin/evm/config/config.md",
      outputPath: "content/docs/nodes/chain-configs/subnet-evm.mdx",
      title: "Subnet-EVM Configs",
      description: "This page describes the configuration options available for the Subnet-EVM.",
      contentUrl: "https://github.com/ava-labs/subnet-evm/blob/master/plugin/evm/config/",
    },
    {
      sourceUrl: "https://raw.githubusercontent.com/ava-labs/avalanchego/master/config/config.md",
      outputPath: "content/docs/nodes/configure/configs-flags.mdx",
      title: "AvalancheGo Config Flags",
      description: "This page lists all available configuration options for AvalancheGo nodes.",
      contentUrl: "https://github.com/ava-labs/avalanchego/blob/master/config/",
    },
    {
      sourceUrl: "https://raw.githubusercontent.com/ava-labs/subnet-evm/master/plugin/evm/service.md",
      outputPath: "content/docs/api-reference/subnet-evm-api.mdx",
      title: "Subnet-EVM API",
      description: "This page describes the API endpoints available for Subnet-EVM based blockchains.",
      contentUrl: "https://github.com/ava-labs/subnet-evm/blob/master/plugin/evm/",
    },
    {
      sourceUrl: "https://raw.githubusercontent.com/ava-labs/icm-contracts/refs/heads/main/contracts/validator-manager/README.md",
      outputPath: "content/docs/avalanche-l1s/validator-manager/contract.mdx",
      title: "Validator Manager Contracts",
      description: "This page lists all available contracts for the Validator Manager.",
      contentUrl: "https://github.com/ava-labs/icm-contracts/blob/main/contracts/validator-manager/",
    },
    {
      sourceUrl: "https://raw.githubusercontent.com/ava-labs/icm-contracts/refs/heads/main/contracts/ictt/README.md",
      outputPath: "content/docs/cross-chain/interchain-token-transfer/overview.mdx",
      title: "Avalanche Interchain Token Transfer (ICTT)",
      description: "This page describes the Avalanche Interchain Token Transfer (ICTT)",
      contentUrl: "https://github.com/ava-labs/icm-contracts/blob/main/contracts/ictt/",
    },
    {
      sourceUrl: "https://raw.githubusercontent.com/ava-labs/subnet-evm/1ab7114c339f866b65cc02dfd586b2ed9041dd0b/precompile/contracts/warp/README.md",
      outputPath: "content/docs/avalanche-l1s/evm-configuration/warpmessenger.mdx",
      title: "WarpMessenger Precompile - Technical Details",
      description: "Technical documentation for the WarpMessenger precompile implementation in subnet-evm.",
      contentUrl: "https://github.com/ava-labs/subnet-evm/blob/1ab7114c339f866b65cc02dfd586b2ed9041dd0b/precompile/contracts/warp/",
    }
  ];

  // Flatten all configs for gitignore update
  const allConfigs = allSections.flatMap(section => section.configs);
  
  console.log(`📝 Updating .gitignore with ${allConfigs.length} output paths...`);
  await updateGitignore(allConfigs);

  // Process each section
  for (const section of allSections) {
    await processSection(section.name, section.configs);
  }

  console.log(`\n🎉 All sections completed! Processed ${allConfigs.length} files total.`);
}

main().catch(console.error);
