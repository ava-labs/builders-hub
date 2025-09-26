import { FileConfig } from './shared.mts';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Generate meta.json for Avalanche L1s documentation
 */
async function generateAvalancheL1sMeta(): Promise<void> {
  const metaContent = {
    title: "Layer 1s",
    description: "Build Your Layer 1 Blockchain",
    icon: "Logs",
    root: true,
    pages: [
      "---Overview---",
      "index",
      "when-to-build-avalanche-l1",
      "---Deploy an Avalanche L1---",
      "[Wrench][Using Builder Console](https://build.avax.network/console/layer-1/create)",
      "[Globe][Using BaaS Providers](https://build.avax.network/integrations#Blockchain%20as%20a%20Service)",
      "...deploy-a-avalanche-l1",
      "---Validator Manager---",
      "validator-manager/contract",
      "validator-manager/pos-migration",
      "validator-manager/state-transition",
      "---EVM Configuration---",
      "evm-l1-customization",
      "subnet-evm/config",
      "configure/avalanche-l1-configs",
      "...evm-configuration",
      "---Custom Precompiles---",
      "...custom-precompiles",
      "---Upgrade an Avalanche L1---",
      "...upgrade",
      "---Virtual Machines---",
      "vm-overview",
      "manage-vm-binaries",
      "simple-vm-any-language",
      "...golang-vms",
      "...rust-vms",
      "...timestamp-vm",
    ]
  };

  // Ensure directory exists
  const metaDir = path.dirname('content/docs/avalanche-l1s/meta.json');
  if (!fs.existsSync(metaDir)) {
    fs.mkdirSync(metaDir, { recursive: true });
  }

  // Write meta.json file
  const metaPath = path.join('content/docs/avalanche-l1s/meta.json');
  fs.writeFileSync(metaPath, JSON.stringify(metaContent, null, 2));
  
  console.log(`Generated avalanche-l1s meta.json with ${metaContent.pages.length} pages`);
}

export async function getAvalancheL1sConfigs(): Promise<FileConfig[]> {
  // Generate meta.json
  await generateAvalancheL1sMeta();
  
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