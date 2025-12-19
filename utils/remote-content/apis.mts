import { FileConfig } from './shared.mts';

/**
 * API reference content configurations
 * Includes Admin, Health, Info, Metrics, Index APIs and chain-specific APIs
 */
export function getApisConfigs(): FileConfig[] {
  return [
    {
      sourceUrl: "https://raw.githubusercontent.com/ava-labs/avalanchego/master/api/admin/service.md",
      outputPath: "content/docs/rpcs/other/index.mdx",
      title: "Admin RPC",
      description: "This page is an overview of the Admin RPC associated with AvalancheGo.",
      contentUrl: "https://github.com/ava-labs/avalanchego/blob/master/api/admin/",
    },
    {
      sourceUrl: "https://raw.githubusercontent.com/ava-labs/avalanchego/master/api/health/service.md",
      outputPath: "content/docs/rpcs/other/health-rpc.mdx",
      title: "Health RPC",
      description: "This page is an overview of the Health RPC associated with AvalancheGo.",
      contentUrl: "https://github.com/ava-labs/avalanchego/blob/master/api/health/",
    },
    {
      sourceUrl: "https://raw.githubusercontent.com/ava-labs/avalanchego/master/api/info/service.md",
      outputPath: "content/docs/rpcs/other/info-rpc.mdx",
      title: "Info RPC",
      description: "This page is an overview of the Info RPC associated with AvalancheGo.",
      contentUrl: "https://github.com/ava-labs/avalanchego/blob/master/api/info/",
    },
    {
      sourceUrl: "https://raw.githubusercontent.com/ava-labs/avalanchego/master/api/metrics/service.md",
      outputPath: "content/docs/rpcs/other/metrics-rpc.mdx",
      title: "Metrics RPC",
      description: "This page is an overview of the Metrics RPC associated with AvalancheGo.",
      contentUrl: "https://github.com/ava-labs/avalanchego/blob/master/api/metrics/",
    },
    {
      sourceUrl: "https://raw.githubusercontent.com/ava-labs/avalanchego/master/indexer/service.md",
      outputPath: "content/docs/rpcs/other/index-rpc.mdx",
      title: "Index RPC",
      description: "This page is an overview of the Index RPC associated with AvalancheGo.",
      contentUrl: "https://github.com/ava-labs/avalanchego/blob/master/indexer/",
    },
    {
      sourceUrl: "https://raw.githubusercontent.com/ava-labs/avalanchego/master/vms/platformvm/service.md",
      outputPath: "content/docs/rpcs/p-chain/index.mdx",
      title: "AvalancheGo P-Chain RPC",
      description: "This page is an overview of the P-Chain RPC associated with AvalancheGo.",
      contentUrl: "https://github.com/ava-labs/avalanchego/blob/master/vms/platformvm/",
    },
    {
      sourceUrl: "https://raw.githubusercontent.com/ava-labs/avalanchego/master/vms/avm/service.md",
      outputPath: "content/docs/rpcs/x-chain/index.mdx",
      title: "AvalancheGo X-Chain RPC",
      description: "This page is an overview of the X-Chain RPC associated with AvalancheGo.",
      contentUrl: "https://github.com/ava-labs/avalanchego/blob/master/vms/avm/",
    },
    {
      sourceUrl: "https://raw.githubusercontent.com/ava-labs/avalanchego/master/graft/coreth/plugin/evm/api.md",
      outputPath: "content/docs/rpcs/c-chain/index.mdx",
      title: "AvalancheGo C-Chain RPC",
      description: "This page is an overview of the C-Chain RPC associated with AvalancheGo.",
      contentUrl: "https://github.com/ava-labs/avalanchego/blob/master/graft/coreth/plugin/evm/",
    },
    {
      sourceUrl: "https://raw.githubusercontent.com/ava-labs/subnet-evm/master/plugin/evm/service.md",
      outputPath: "content/docs/rpcs/subnet-evm/index.mdx",
      title: "Subnet-EVM RPC",
      description: "This page describes the RPC endpoints available for Subnet-EVM based blockchains.",
      contentUrl: "https://github.com/ava-labs/subnet-evm/blob/master/plugin/evm/",
    },
    {
      sourceUrl: "https://raw.githubusercontent.com/ava-labs/avalanchego/master/vms/proposervm/service.md",
      outputPath: "content/docs/rpcs/other/proposervm-rpc.mdx",
      title: "ProposerVM RPC",
      description: "This page is an overview of the ProposerVM RPC associated with AvalancheGo.",
      contentUrl: "https://github.com/ava-labs/avalanchego/blob/master/vms/proposervm/",
    },
  ];
}

