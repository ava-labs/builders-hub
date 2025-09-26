import { FileConfig } from './shared.mts';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Generate meta.json for API Reference documentation
 */
async function generateApisMeta(): Promise<void> {
  const metaContent = {
    title: "API References",
    description: "Avalanche API References",
    icon: "Webhook",
    root: true,
    pages: [
      "index",
      "---AvalancheGo---",
      "c-chain/",
      "p-chain/",
      "x-chain/",
      "---Other AvalancheGo References---",
      "admin-api",
      "health-api",
      "index-api",
      "info-api",
      "metrics-api",
      "---Avalanche L1s---",
      "subnet-evm-api",
      "---Miscellaneous---",
      "standards",
      "guides"
    ]
  };

  // Ensure directory exists
  const metaDir = path.dirname('content/docs/apis/meta.json');
  if (!fs.existsSync(metaDir)) {
    fs.mkdirSync(metaDir, { recursive: true });
  }

  // Write meta.json file
  const metaPath = path.join('content/docs/apis/meta.json');
  fs.writeFileSync(metaPath, JSON.stringify(metaContent, null, 2));
  
  console.log(`Generated apis meta.json with ${metaContent.pages.length} pages`);
}

export async function getApisConfigs(): Promise<FileConfig[]> {
  // Generate meta.json
  await generateApisMeta();
  
  return [
    {
      sourceUrl: "https://raw.githubusercontent.com/ava-labs/avalanchego/master/api/admin/service.md",
      outputPath: "content/docs/apis/admin-api.mdx",
      title: "Admin API",
      description: "This page is an overview of the Admin API associated with AvalancheGo.",
      contentUrl: "https://github.com/ava-labs/avalanchego/blob/master/api/admin/",
    },
    {
      sourceUrl: "https://raw.githubusercontent.com/ava-labs/avalanchego/master/api/health/service.md",
      outputPath: "content/docs/apis/health-api.mdx",
      title: "Health API",
      description: "This page is an overview of the Health API associated with AvalancheGo.",
      contentUrl: "https://github.com/ava-labs/avalanchego/blob/master/api/health/",
    },
    {
      sourceUrl: "https://raw.githubusercontent.com/ava-labs/avalanchego/master/api/info/service.md",
      outputPath: "content/docs/apis/info-api.mdx",
      title: "Info API",
      description: "This page is an overview of the Info API associated with AvalancheGo.",
      contentUrl: "https://github.com/ava-labs/avalanchego/blob/master/api/info/",
    },
    {
      sourceUrl: "https://raw.githubusercontent.com/ava-labs/avalanchego/master/api/metrics/service.md",
      outputPath: "content/docs/apis/metrics-api.mdx",
      title: "Metrics API",
      description: "This page is an overview of the Metrics API associated with AvalancheGo.",
      contentUrl: "https://github.com/ava-labs/avalanchego/blob/master/api/metrics/",
    },
    {
      sourceUrl: "https://raw.githubusercontent.com/ava-labs/avalanchego/master/indexer/service.md",
      outputPath: "content/docs/apis/index-api.mdx",
      title: "Index API",
      description: "This page is an overview of the Index API associated with AvalancheGo.",
      contentUrl: "https://github.com/ava-labs/avalanchego/blob/master/indexer/",
    },
    {
      sourceUrl: "https://raw.githubusercontent.com/ava-labs/avalanchego/master/vms/platformvm/service.md",
      outputPath: "content/docs/apis/P-Chain/api.mdx",
      title: "P-Chain API",
      description: "This page is an overview of the P-Chain API associated with AvalancheGo.",
      contentUrl: "https://github.com/ava-labs/avalanchego/blob/master/vms/platformvm/",
    },
    {
      sourceUrl: "https://raw.githubusercontent.com/ava-labs/avalanchego/master/vms/avm/service.md",
      outputPath: "content/docs/apis/X-Chain/api.mdx",
      title: "X-Chain API",
      description: "This page is an overview of the X-Chain API associated with AvalancheGo.",
      contentUrl: "https://github.com/ava-labs/avalanchego/blob/master/vms/avm/",
    },
    {
      sourceUrl: "https://raw.githubusercontent.com/ava-labs/coreth/master/plugin/evm/api.md",
      outputPath: "content/docs/apis/C-Chain/api.mdx",
      title: "C-Chain API",
      description: "This page is an overview of the C-Chain API associated with AvalancheGo.",
      contentUrl: "https://github.com/ava-labs/coreth/blob/master/plugin/evm/",
    },
    {
      sourceUrl: "https://raw.githubusercontent.com/ava-labs/subnet-evm/master/plugin/evm/service.md",
      outputPath: "content/docs/apis/subnet-evm-api.mdx",
      title: "Subnet-EVM API",
      description: "This page describes the API endpoints available for Subnet-EVM based blockchains.",
      contentUrl: "https://github.com/ava-labs/subnet-evm/blob/master/plugin/evm/",
    },
  ];
} 