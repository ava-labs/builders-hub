import { avalancheRPC, nAvaxToAvax } from '../rpc';
import { withCache, CACHE_TTL } from '../cache';
import type { ToolDomain, ToolResult, Network } from '../types';

export const platformTools: ToolDomain = {
  tools: [
    {
      name: 'platform_get_height',
      description: 'Get the current P-Chain block height',
      inputSchema: {
        type: 'object',
        properties: {
          network: {
            type: 'string',
            enum: ['mainnet', 'fuji'],
            description: 'Avalanche network to query (default: mainnet)',
          },
        },
      },
    },
    {
      name: 'platform_get_block',
      description: 'Get a P-Chain block by its block ID',
      inputSchema: {
        type: 'object',
        properties: {
          blockID: {
            type: 'string',
            description: 'The CB58-encoded block ID',
          },
          encoding: {
            type: 'string',
            enum: ['json', 'hex'],
            description: 'Encoding format for the block (default: json)',
          },
          network: {
            type: 'string',
            enum: ['mainnet', 'fuji'],
            description: 'Avalanche network to query (default: mainnet)',
          },
        },
        required: ['blockID'],
      },
    },
    {
      name: 'platform_get_block_by_height',
      description: 'Get a P-Chain block by its height',
      inputSchema: {
        type: 'object',
        properties: {
          height: {
            type: 'string',
            description: 'The block height as a string',
          },
          encoding: {
            type: 'string',
            enum: ['json', 'hex'],
            description: 'Encoding format for the block (default: json)',
          },
          network: {
            type: 'string',
            enum: ['mainnet', 'fuji'],
            description: 'Avalanche network to query (default: mainnet)',
          },
        },
        required: ['height'],
      },
    },
    {
      name: 'platform_get_blockchains',
      description: 'Get all blockchains that exist on the P-Chain',
      inputSchema: {
        type: 'object',
        properties: {
          network: {
            type: 'string',
            enum: ['mainnet', 'fuji'],
            description: 'Avalanche network to query (default: mainnet)',
          },
        },
      },
    },
    {
      name: 'platform_get_subnets',
      description: 'Get information about subnets on the P-Chain',
      inputSchema: {
        type: 'object',
        properties: {
          ids: {
            type: 'array',
            items: { type: 'string' },
            description: 'Optional list of subnet IDs to filter by',
          },
          network: {
            type: 'string',
            enum: ['mainnet', 'fuji'],
            description: 'Avalanche network to query (default: mainnet)',
          },
        },
      },
    },
    {
      name: 'platform_get_current_validators',
      description: 'Get the current validators of a subnet',
      inputSchema: {
        type: 'object',
        properties: {
          subnetID: {
            type: 'string',
            description: 'The subnet ID to query validators for (default: Primary Network)',
          },
          nodeIDs: {
            type: 'array',
            items: { type: 'string' },
            description: 'Optional list of node IDs to filter by',
          },
          network: {
            type: 'string',
            enum: ['mainnet', 'fuji'],
            description: 'Avalanche network to query (default: mainnet)',
          },
        },
      },
    },
    {
      name: 'platform_get_pending_validators',
      description: 'Get the pending validators of a subnet (validators not yet validating)',
      inputSchema: {
        type: 'object',
        properties: {
          subnetID: {
            type: 'string',
            description: 'The subnet ID to query pending validators for (default: Primary Network)',
          },
          nodeIDs: {
            type: 'array',
            items: { type: 'string' },
            description: 'Optional list of node IDs to filter by',
          },
          network: {
            type: 'string',
            enum: ['mainnet', 'fuji'],
            description: 'Avalanche network to query (default: mainnet)',
          },
        },
      },
    },
    {
      name: 'platform_get_staking_asset_id',
      description: 'Get the asset ID of the token used for staking on a subnet',
      inputSchema: {
        type: 'object',
        properties: {
          subnetID: {
            type: 'string',
            description: 'The subnet ID to query the staking asset for (default: Primary Network)',
          },
          network: {
            type: 'string',
            enum: ['mainnet', 'fuji'],
            description: 'Avalanche network to query (default: mainnet)',
          },
        },
      },
    },
    {
      name: 'platform_get_min_stake',
      description: 'Get the minimum staking amounts for validators and delegators on a subnet',
      inputSchema: {
        type: 'object',
        properties: {
          subnetID: {
            type: 'string',
            description: 'The subnet ID to query minimum stake for (default: Primary Network)',
          },
          network: {
            type: 'string',
            enum: ['mainnet', 'fuji'],
            description: 'Avalanche network to query (default: mainnet)',
          },
        },
      },
    },
    {
      name: 'platform_get_total_stake',
      description: 'Get the total amount staked on a subnet',
      inputSchema: {
        type: 'object',
        properties: {
          subnetID: {
            type: 'string',
            description: 'The subnet ID to query total stake for (default: Primary Network)',
          },
          network: {
            type: 'string',
            enum: ['mainnet', 'fuji'],
            description: 'Avalanche network to query (default: mainnet)',
          },
        },
      },
    },
    {
      name: 'platform_get_balance',
      description: 'Get the AVAX balance of one or more P-Chain addresses',
      inputSchema: {
        type: 'object',
        properties: {
          addresses: {
            type: 'array',
            items: { type: 'string' },
            description: 'List of P-Chain addresses to query (e.g. P-avax1...)',
          },
          network: {
            type: 'string',
            enum: ['mainnet', 'fuji'],
            description: 'Avalanche network to query (default: mainnet)',
          },
        },
        required: ['addresses'],
      },
    },
    {
      name: 'platform_get_utxos',
      description: 'Get UTXOs that reference a given set of P-Chain addresses',
      inputSchema: {
        type: 'object',
        properties: {
          addresses: {
            type: 'array',
            items: { type: 'string' },
            description: 'List of P-Chain addresses to get UTXOs for',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of UTXOs to return',
          },
          sourceChain: {
            type: 'string',
            description: 'If fetching atomic UTXOs, the chain they were exported from',
          },
          network: {
            type: 'string',
            enum: ['mainnet', 'fuji'],
            description: 'Avalanche network to query (default: mainnet)',
          },
        },
        required: ['addresses'],
      },
    },
    {
      name: 'platform_get_tx',
      description: 'Get a P-Chain transaction by its transaction ID',
      inputSchema: {
        type: 'object',
        properties: {
          txID: {
            type: 'string',
            description: 'The CB58-encoded transaction ID',
          },
          encoding: {
            type: 'string',
            enum: ['json', 'hex'],
            description: 'Encoding format for the transaction (default: json)',
          },
          network: {
            type: 'string',
            enum: ['mainnet', 'fuji'],
            description: 'Avalanche network to query (default: mainnet)',
          },
        },
        required: ['txID'],
      },
    },
    {
      name: 'platform_get_tx_status',
      description: 'Get the status of a P-Chain transaction',
      inputSchema: {
        type: 'object',
        properties: {
          txID: {
            type: 'string',
            description: 'The CB58-encoded transaction ID',
          },
          network: {
            type: 'string',
            enum: ['mainnet', 'fuji'],
            description: 'Avalanche network to query (default: mainnet)',
          },
        },
        required: ['txID'],
      },
    },
    {
      name: 'platform_get_current_supply',
      description: 'Get the current total supply of AVAX on a subnet',
      inputSchema: {
        type: 'object',
        properties: {
          subnetID: {
            type: 'string',
            description: 'The subnet ID to query current supply for (default: Primary Network)',
          },
          network: {
            type: 'string',
            enum: ['mainnet', 'fuji'],
            description: 'Avalanche network to query (default: mainnet)',
          },
        },
      },
    },
    {
      name: 'platform_get_validators_at',
      description: 'Get the validators and their weights of a subnet at a given P-Chain height',
      inputSchema: {
        type: 'object',
        properties: {
          height: {
            oneOf: [
              { type: 'number', description: 'A specific P-Chain block height' },
              { type: 'string', enum: ['proposed'], description: 'Use "proposed" for the proposed height' },
            ],
            description: 'The P-Chain height to query validators at, or "proposed"',
          },
          subnetID: {
            type: 'string',
            description: 'The subnet ID to query validators for (default: Primary Network)',
          },
          network: {
            type: 'string',
            enum: ['mainnet', 'fuji'],
            description: 'Avalanche network to query (default: mainnet)',
          },
        },
        required: ['height'],
      },
    },
  ],

  handlers: {
    platform_get_height: async (args): Promise<ToolResult> => {
      const network = (args.network as Network) || 'mainnet';
      try {
        const result = await withCache(
          `platform:height:${network}`,
          CACHE_TTL.HEIGHT,
          () => avalancheRPC(network, 'pchain', 'platform.getHeight', {})
        );
        return { content: [{ type: 'text', text: JSON.stringify(result) }] };
      } catch (err) {
        return {
          content: [{ type: 'text', text: err instanceof Error ? err.message : 'RPC error' }],
          isError: true,
        };
      }
    },

    platform_get_block: async (args): Promise<ToolResult> => {
      const network = (args.network as Network) || 'mainnet';
      const blockID = args.blockID as string;
      const encoding = (args.encoding as string) || 'json';
      const params = { blockID, encoding };
      try {
        const result = await withCache(
          `platform:block:${network}:${JSON.stringify(params)}`,
          CACHE_TTL.IMMUTABLE,
          () => avalancheRPC(network, 'pchain', 'platform.getBlock', params)
        );
        return { content: [{ type: 'text', text: JSON.stringify(result) }] };
      } catch (err) {
        return {
          content: [{ type: 'text', text: err instanceof Error ? err.message : 'RPC error' }],
          isError: true,
        };
      }
    },

    platform_get_block_by_height: async (args): Promise<ToolResult> => {
      const network = (args.network as Network) || 'mainnet';
      const height = args.height as string;
      const encoding = (args.encoding as string) || 'json';
      const params = { height, encoding };
      try {
        const result = await withCache(
          `platform:blockByHeight:${network}:${JSON.stringify(params)}`,
          CACHE_TTL.IMMUTABLE,
          () => avalancheRPC(network, 'pchain', 'platform.getBlockByHeight', params)
        );
        return { content: [{ type: 'text', text: JSON.stringify(result) }] };
      } catch (err) {
        return {
          content: [{ type: 'text', text: err instanceof Error ? err.message : 'RPC error' }],
          isError: true,
        };
      }
    },

    platform_get_blockchains: async (args): Promise<ToolResult> => {
      const network = (args.network as Network) || 'mainnet';
      try {
        const result = await withCache(
          `platform:blockchains:${network}`,
          CACHE_TTL.CHAINS,
          () => avalancheRPC(network, 'pchain', 'platform.getBlockchains', {})
        );
        return { content: [{ type: 'text', text: JSON.stringify(result) }] };
      } catch (err) {
        return {
          content: [{ type: 'text', text: err instanceof Error ? err.message : 'RPC error' }],
          isError: true,
        };
      }
    },

    platform_get_subnets: async (args): Promise<ToolResult> => {
      const network = (args.network as Network) || 'mainnet';
      const ids = args.ids as string[] | undefined;
      const params = { ids: ids || [] };
      try {
        const result = await withCache(
          `platform:subnets:${network}:${JSON.stringify(params)}`,
          CACHE_TTL.CHAINS,
          () => avalancheRPC(network, 'pchain', 'platform.getSubnets', params)
        );
        return { content: [{ type: 'text', text: JSON.stringify(result) }] };
      } catch (err) {
        return {
          content: [{ type: 'text', text: err instanceof Error ? err.message : 'RPC error' }],
          isError: true,
        };
      }
    },

    platform_get_current_validators: async (args): Promise<ToolResult> => {
      const network = (args.network as Network) || 'mainnet';
      const subnetID = args.subnetID as string | undefined;
      const nodeIDs = args.nodeIDs as string[] | undefined;
      const params: Record<string, unknown> = {};
      if (subnetID !== undefined) params.subnetID = subnetID;
      if (nodeIDs !== undefined) params.nodeIDs = nodeIDs;
      try {
        const result = await withCache(
          `platform:currentValidators:${network}:${JSON.stringify(params)}`,
          CACHE_TTL.FEES,
          () => avalancheRPC(network, 'pchain', 'platform.getCurrentValidators', params)
        );
        return { content: [{ type: 'text', text: JSON.stringify(result) }] };
      } catch (err) {
        return {
          content: [{ type: 'text', text: err instanceof Error ? err.message : 'RPC error' }],
          isError: true,
        };
      }
    },

    platform_get_pending_validators: async (args): Promise<ToolResult> => {
      const network = (args.network as Network) || 'mainnet';
      const subnetID = args.subnetID as string | undefined;
      const nodeIDs = args.nodeIDs as string[] | undefined;
      const params: Record<string, unknown> = {};
      if (subnetID !== undefined) params.subnetID = subnetID;
      if (nodeIDs !== undefined) params.nodeIDs = nodeIDs;
      try {
        const result = await withCache(
          `platform:pendingValidators:${network}:${JSON.stringify(params)}`,
          60 * 1000,
          () => avalancheRPC(network, 'pchain', 'platform.getPendingValidators', params)
        );
        return { content: [{ type: 'text', text: JSON.stringify(result) }] };
      } catch (err) {
        return {
          content: [{ type: 'text', text: err instanceof Error ? err.message : 'RPC error' }],
          isError: true,
        };
      }
    },

    platform_get_staking_asset_id: async (args): Promise<ToolResult> => {
      const network = (args.network as Network) || 'mainnet';
      const subnetID = args.subnetID as string | undefined;
      const params: Record<string, unknown> = {};
      if (subnetID !== undefined) params.subnetID = subnetID;
      try {
        const result = await withCache(
          `platform:stakingAssetID:${network}:${JSON.stringify(params)}`,
          CACHE_TTL.VALIDATORS,
          () => avalancheRPC(network, 'pchain', 'platform.getStakingAssetID', params)
        );
        return { content: [{ type: 'text', text: JSON.stringify(result) }] };
      } catch (err) {
        return {
          content: [{ type: 'text', text: err instanceof Error ? err.message : 'RPC error' }],
          isError: true,
        };
      }
    },

    platform_get_min_stake: async (args): Promise<ToolResult> => {
      const network = (args.network as Network) || 'mainnet';
      const subnetID = args.subnetID as string | undefined;
      const params: Record<string, unknown> = {};
      if (subnetID !== undefined) params.subnetID = subnetID;
      try {
        const raw = await withCache(
          `platform:minStake:${network}:${JSON.stringify(params)}`,
          CACHE_TTL.VALIDATORS,
          () => avalancheRPC(network, 'pchain', 'platform.getMinStake', params)
        ) as Record<string, unknown>;
        const result = {
          ...raw,
          minValidatorStake_avax: nAvaxToAvax(raw.minValidatorStake as string),
          minDelegatorStake_avax: nAvaxToAvax(raw.minDelegatorStake as string),
        };
        return { content: [{ type: 'text', text: JSON.stringify(result) }] };
      } catch (err) {
        return {
          content: [{ type: 'text', text: err instanceof Error ? err.message : 'RPC error' }],
          isError: true,
        };
      }
    },

    platform_get_total_stake: async (args): Promise<ToolResult> => {
      const network = (args.network as Network) || 'mainnet';
      const subnetID = args.subnetID as string | undefined;
      const params: Record<string, unknown> = {};
      if (subnetID !== undefined) params.subnetID = subnetID;
      try {
        const raw = await withCache(
          `platform:totalStake:${network}:${JSON.stringify(params)}`,
          CACHE_TTL.FEES,
          () => avalancheRPC(network, 'pchain', 'platform.getTotalStake', params)
        ) as Record<string, unknown>;
        const result = {
          ...raw,
          stake_avax: nAvaxToAvax(raw.stake as string),
        };
        return { content: [{ type: 'text', text: JSON.stringify(result) }] };
      } catch (err) {
        return {
          content: [{ type: 'text', text: err instanceof Error ? err.message : 'RPC error' }],
          isError: true,
        };
      }
    },

    platform_get_balance: async (args): Promise<ToolResult> => {
      const network = (args.network as Network) || 'mainnet';
      const addresses = args.addresses as string[];
      const params = { addresses };
      try {
        const raw = await withCache(
          `platform:balance:${network}:${JSON.stringify(params)}`,
          CACHE_TTL.BALANCE,
          () => avalancheRPC(network, 'pchain', 'platform.getBalance', params)
        ) as Record<string, unknown>;
        const result = {
          ...raw,
          balance_avax: nAvaxToAvax(raw.balance as string),
        };
        return { content: [{ type: 'text', text: JSON.stringify(result) }] };
      } catch (err) {
        return {
          content: [{ type: 'text', text: err instanceof Error ? err.message : 'RPC error' }],
          isError: true,
        };
      }
    },

    platform_get_utxos: async (args): Promise<ToolResult> => {
      const network = (args.network as Network) || 'mainnet';
      const addresses = args.addresses as string[];
      const limit = args.limit as number | undefined;
      const sourceChain = args.sourceChain as string | undefined;
      const params: Record<string, unknown> = { addresses };
      if (limit !== undefined) params.limit = limit;
      if (sourceChain !== undefined) params.sourceChain = sourceChain;
      try {
        const result = await withCache(
          `platform:utxos:${network}:${JSON.stringify(params)}`,
          CACHE_TTL.BALANCE,
          () => avalancheRPC(network, 'pchain', 'platform.getUTXOs', params)
        );
        return { content: [{ type: 'text', text: JSON.stringify(result) }] };
      } catch (err) {
        return {
          content: [{ type: 'text', text: err instanceof Error ? err.message : 'RPC error' }],
          isError: true,
        };
      }
    },

    platform_get_tx: async (args): Promise<ToolResult> => {
      const network = (args.network as Network) || 'mainnet';
      const txID = args.txID as string;
      const encoding = (args.encoding as string) || 'json';
      const params = { txID, encoding };
      try {
        const result = await withCache(
          `platform:tx:${network}:${JSON.stringify(params)}`,
          CACHE_TTL.IMMUTABLE,
          () => avalancheRPC(network, 'pchain', 'platform.getTx', params)
        );
        return { content: [{ type: 'text', text: JSON.stringify(result) }] };
      } catch (err) {
        return {
          content: [{ type: 'text', text: err instanceof Error ? err.message : 'RPC error' }],
          isError: true,
        };
      }
    },

    platform_get_tx_status: async (args): Promise<ToolResult> => {
      const network = (args.network as Network) || 'mainnet';
      const txID = args.txID as string;
      const params = { txID };
      try {
        const result = await withCache(
          `platform:txStatus:${network}:${JSON.stringify(params)}`,
          5000,
          () => avalancheRPC(network, 'pchain', 'platform.getTxStatus', params)
        );
        return { content: [{ type: 'text', text: JSON.stringify(result) }] };
      } catch (err) {
        return {
          content: [{ type: 'text', text: err instanceof Error ? err.message : 'RPC error' }],
          isError: true,
        };
      }
    },

    platform_get_current_supply: async (args): Promise<ToolResult> => {
      const network = (args.network as Network) || 'mainnet';
      const subnetID = args.subnetID as string | undefined;
      const params: Record<string, unknown> = {};
      if (subnetID !== undefined) params.subnetID = subnetID;
      try {
        const raw = await withCache(
          `platform:currentSupply:${network}:${JSON.stringify(params)}`,
          CACHE_TTL.FEES,
          () => avalancheRPC(network, 'pchain', 'platform.getCurrentSupply', params)
        ) as Record<string, unknown>;
        const result = {
          ...raw,
          supply_avax: nAvaxToAvax(raw.supply as string),
        };
        return { content: [{ type: 'text', text: JSON.stringify(result) }] };
      } catch (err) {
        return {
          content: [{ type: 'text', text: err instanceof Error ? err.message : 'RPC error' }],
          isError: true,
        };
      }
    },

    platform_get_validators_at: async (args): Promise<ToolResult> => {
      const network = (args.network as Network) || 'mainnet';
      const height = args.height as number | 'proposed';
      const subnetID = args.subnetID as string | undefined;
      const params: Record<string, unknown> = { height };
      if (subnetID !== undefined) params.subnetID = subnetID;
      try {
        const result = await withCache(
          `platform:validatorsAt:${network}:${JSON.stringify(params)}`,
          CACHE_TTL.IMMUTABLE,
          () => avalancheRPC(network, 'pchain', 'platform.getValidatorsAt', params)
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
