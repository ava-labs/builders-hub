import { avalancheRPC, nAvaxToAvax } from '../rpc';
import { withCache, CACHE_TTL } from '../cache';
import type { ToolDomain, ToolResult, Network } from '../types';

export const infoTools: ToolDomain = {
  tools: [
    {
      name: 'info_get_node_version',
      description:
        'Get the version of the node, including the database version, git commit, and API compatibility info.',
      inputSchema: {
        type: 'object',
        properties: {
          network: {
            type: 'string',
            enum: ['mainnet', 'fuji'],
            description: 'The Avalanche network to query (default: mainnet)',
          },
        },
        required: [],
      },
    },
    {
      name: 'info_get_network_id',
      description: 'Get the numeric ID of the Avalanche network this node is participating in.',
      inputSchema: {
        type: 'object',
        properties: {
          network: {
            type: 'string',
            enum: ['mainnet', 'fuji'],
            description: 'The Avalanche network to query (default: mainnet)',
          },
        },
        required: [],
      },
    },
    {
      name: 'info_get_network_name',
      description: 'Get the human-readable name of the Avalanche network this node is participating in.',
      inputSchema: {
        type: 'object',
        properties: {
          network: {
            type: 'string',
            enum: ['mainnet', 'fuji'],
            description: 'The Avalanche network to query (default: mainnet)',
          },
        },
        required: [],
      },
    },
    {
      name: 'info_get_blockchain_id',
      description: 'Get the CB58-encoded blockchain ID for a given blockchain alias (e.g., "X", "P", "C").',
      inputSchema: {
        type: 'object',
        properties: {
          alias: {
            type: 'string',
            description: 'The blockchain alias (e.g., "X", "P", "C", or a full blockchain name)',
          },
          network: {
            type: 'string',
            enum: ['mainnet', 'fuji'],
            description: 'The Avalanche network to query (default: mainnet)',
          },
        },
        required: ['alias'],
      },
    },
    {
      name: 'info_is_bootstrapped',
      description: 'Check whether a given chain has finished bootstrapping on the node.',
      inputSchema: {
        type: 'object',
        properties: {
          chain: {
            type: 'string',
            description: 'The chain ID or alias to check (e.g., "X", "P", "C")',
          },
          network: {
            type: 'string',
            enum: ['mainnet', 'fuji'],
            description: 'The Avalanche network to query (default: mainnet)',
          },
        },
        required: ['chain'],
      },
    },
    {
      name: 'info_get_tx_fee',
      description:
        'Get the current transaction fees for the network, returned in both nAVAX and AVAX.',
      inputSchema: {
        type: 'object',
        properties: {
          network: {
            type: 'string',
            enum: ['mainnet', 'fuji'],
            description: 'The Avalanche network to query (default: mainnet)',
          },
        },
        required: [],
      },
    },
    {
      name: 'info_peers',
      description:
        'Get a list of peers this node is connected to. Optionally filter by specific NodeIDs.',
      inputSchema: {
        type: 'object',
        properties: {
          nodeIDs: {
            type: 'array',
            items: {
              type: 'string',
            },
            description:
              'Optional list of NodeIDs to filter peers by (e.g., ["NodeID-AbC..."]). If omitted, all peers are returned.',
          },
          network: {
            type: 'string',
            enum: ['mainnet', 'fuji'],
            description: 'The Avalanche network to query (default: mainnet)',
          },
        },
        required: [],
      },
    },
    {
      name: 'info_acps',
      description:
        'Get information about Avalanche Community Proposals (ACPs), including their status and vote counts.',
      inputSchema: {
        type: 'object',
        properties: {
          network: {
            type: 'string',
            enum: ['mainnet', 'fuji'],
            description: 'The Avalanche network to query (default: mainnet)',
          },
        },
        required: [],
      },
    },
  ],

  handlers: {
    info_get_node_version: async (args): Promise<ToolResult> => {
      const network = (args.network as Network) || 'mainnet';
      try {
        const result = await withCache(
          `info:nodeVersion:${network}`,
          CACHE_TTL.NODE_INFO,
          () => avalancheRPC(network, 'info', 'info.getNodeVersion', {})
        );
        return { content: [{ type: 'text', text: JSON.stringify(result) }] };
      } catch (err) {
        return {
          content: [{ type: 'text', text: err instanceof Error ? err.message : 'RPC error' }],
          isError: true,
        };
      }
    },

    info_get_network_id: async (args): Promise<ToolResult> => {
      const network = (args.network as Network) || 'mainnet';
      try {
        const result = await withCache(
          `info:networkID:${network}`,
          CACHE_TTL.VALIDATORS,
          () => avalancheRPC(network, 'info', 'info.getNetworkID', {})
        );
        return { content: [{ type: 'text', text: JSON.stringify(result) }] };
      } catch (err) {
        return {
          content: [{ type: 'text', text: err instanceof Error ? err.message : 'RPC error' }],
          isError: true,
        };
      }
    },

    info_get_network_name: async (args): Promise<ToolResult> => {
      const network = (args.network as Network) || 'mainnet';
      try {
        const result = await withCache(
          `info:networkName:${network}`,
          CACHE_TTL.VALIDATORS,
          () => avalancheRPC(network, 'info', 'info.getNetworkName', {})
        );
        return { content: [{ type: 'text', text: JSON.stringify(result) }] };
      } catch (err) {
        return {
          content: [{ type: 'text', text: err instanceof Error ? err.message : 'RPC error' }],
          isError: true,
        };
      }
    },

    info_get_blockchain_id: async (args): Promise<ToolResult> => {
      const network = (args.network as Network) || 'mainnet';
      const alias = args.alias as string;
      if (!alias) {
        return {
          content: [{ type: 'text', text: 'Error: alias parameter is required' }],
          isError: true,
        };
      }
      const params = { alias };
      try {
        const result = await withCache(
          `info:blockchainID:${network}:${JSON.stringify(params)}`,
          CACHE_TTL.VALIDATORS,
          () => avalancheRPC(network, 'info', 'info.getBlockchainID', params)
        );
        return { content: [{ type: 'text', text: JSON.stringify(result) }] };
      } catch (err) {
        return {
          content: [{ type: 'text', text: err instanceof Error ? err.message : 'RPC error' }],
          isError: true,
        };
      }
    },

    info_is_bootstrapped: async (args): Promise<ToolResult> => {
      const network = (args.network as Network) || 'mainnet';
      const chain = args.chain as string;
      if (!chain) {
        return {
          content: [{ type: 'text', text: 'Error: chain parameter is required' }],
          isError: true,
        };
      }
      const params = { chain };
      try {
        const result = await withCache(
          `info:isBootstrapped:${network}:${JSON.stringify(params)}`,
          CACHE_TTL.BALANCE,
          () => avalancheRPC(network, 'info', 'info.isBootstrapped', params)
        );
        return { content: [{ type: 'text', text: JSON.stringify(result) }] };
      } catch (err) {
        return {
          content: [{ type: 'text', text: err instanceof Error ? err.message : 'RPC error' }],
          isError: true,
        };
      }
    },

    info_get_tx_fee: async (args): Promise<ToolResult> => {
      const network = (args.network as Network) || 'mainnet';
      try {
        const result = await withCache(
          `info:txFee:${network}`,
          CACHE_TTL.CHAINS,
          () => avalancheRPC(network, 'info', 'info.getTxFee', {})
        );
        const fees = result as Record<string, unknown>;
        const enriched: Record<string, unknown> = { ...fees };
        for (const [key, value] of Object.entries(fees)) {
          if (typeof value === 'string' || typeof value === 'number') {
            enriched[`${key}_avax`] = nAvaxToAvax(value as string | number);
          }
        }
        return { content: [{ type: 'text', text: JSON.stringify(enriched) }] };
      } catch (err) {
        return {
          content: [{ type: 'text', text: err instanceof Error ? err.message : 'RPC error' }],
          isError: true,
        };
      }
    },

    info_peers: async (args): Promise<ToolResult> => {
      const network = (args.network as Network) || 'mainnet';
      const nodeIDs = Array.isArray(args.nodeIDs) ? (args.nodeIDs as string[]) : [];
      const params = { nodeIDs };
      try {
        const result = await withCache(
          `info:peers:${network}:${JSON.stringify(params)}`,
          60 * 1000,
          () => avalancheRPC(network, 'info', 'info.peers', params)
        );
        return { content: [{ type: 'text', text: JSON.stringify(result) }] };
      } catch (err) {
        return {
          content: [{ type: 'text', text: err instanceof Error ? err.message : 'RPC error' }],
          isError: true,
        };
      }
    },

    info_acps: async (args): Promise<ToolResult> => {
      const network = (args.network as Network) || 'mainnet';
      try {
        const result = await withCache(
          `info:acps:${network}`,
          CACHE_TTL.CHAINS,
          () => avalancheRPC(network, 'info', 'info.acps', {})
        );
        return { content: [{ type: 'text', text: JSON.stringify(result) }] };
      } catch (err) {
        return {
          content: [{ type: 'text', text: err instanceof Error ? err.message : 'RPC error' }],
          isError: true,
        };
      }
    },
  },
};
