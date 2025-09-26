import { FileConfig } from './shared.mts';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Generate meta.json for Primary Network documentation
 */
async function generatePrimaryNetworkMeta(): Promise<void> {
  const metaContent = {
    title: "Primary Network",
    description: "Learn about the Avalanche Primary Network and its three blockchains.",
    icon: "FileText",
    root: true,
    pages: [
      "---Overview---",
      "index",
      "---The Primary Network---",
      "avax-token",
      "avalanche-consensus",
      "rewards-formula",    
      "---Run a Node---",
      "run-a-node/from-source",
      "run-a-node/using-binary",
      "run-a-node/using-docker",
      "run-a-node/common-errors",
      "on-third-party-services",
      "---Node Configuration---",
      "configure/configs-flags",
      "chain-configs/c-chain",
      "chain-configs/x-chain",
      "chain-configs/p-chain/p-chain",
      "configure/cube-signer",
      "---Maintain a Node---",
      "maintain/bootstrapping",
      "maintain/backup-restore",
      "maintain/enroll-in-avalanche-notify",
      "maintain/monitoring",
      "maintain/reduce-disk-usage",
      "maintain/run-as-background-service",
      "maintain/upgrade",
      "---Staking---",
      "stake/what-is-staking",
      "stake/validate-vs-delegate",
      "stake/how-to-stake",
      "stake/node-validator",
      "---P-Chain Internals---",
      "chain-configs/p-chain/block-formation-logic",
      "chain-configs/p-chain/chain-time-update",
      "chain-configs/p-chain/mempool-gossiping",
      "chain-configs/p-chain/subnets",
      "chain-configs/p-chain/validators-versioning",
      "chain-configs/p-chain/genesis",
    ]
  };

  // Ensure directory exists
  const metaDir = path.dirname('content/docs/primary-network/meta.json');
  if (!fs.existsSync(metaDir)) {
    fs.mkdirSync(metaDir, { recursive: true });
  }

  // Write meta.json file
  const metaPath = path.join('content/docs/primary-network/meta.json');
  fs.writeFileSync(metaPath, JSON.stringify(metaContent, null, 2));
  
  console.log(`Generated primary-network meta.json with ${metaContent.pages.length} pages`);
}

export async function getPrimaryNetworkConfigs(): Promise<FileConfig[]> {
  // Generate meta.json
  await generatePrimaryNetworkMeta();
  
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
      sourceUrl: "https://raw.githubusercontent.com/ava-labs/cube-signer-sidecar/main/README.md",
      outputPath: "content/docs/primary-network/configure/cube-signer.mdx",
      title: "Cube Signer Sidecar",
      description: "This page describes how to integrate AvalancheGo nodes with CubeSigner for secure BLS key management.",
      contentUrl: "https://github.com/ava-labs/cube-signer-sidecar/blob/main/",
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