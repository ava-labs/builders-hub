import { FileConfig } from './shared.mts';

/**
 * API reference content configurations
 * Includes Admin, Health, Info, Metrics, Index APIs and chain-specific APIs
 */
export function getApisConfigs(): FileConfig[] {
  return [
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
      sourceUrl: "https://raw.githubusercontent.com/ava-labs/subnet-evm/master/plugin/evm/service.md",
      outputPath: "content/docs/api-reference/subnet-evm-api.mdx",
      title: "Subnet-EVM API",
      description: "This page describes the API endpoints available for Subnet-EVM based blockchains.",
      contentUrl: "https://github.com/ava-labs/subnet-evm/blob/master/plugin/evm/",
    },
  ];
}

