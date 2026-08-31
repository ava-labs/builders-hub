import { avalancheRPC, nAvaxToAvax } from '../rpc';
import { withCache, CACHE_TTL } from '../cache';
import type { ToolDomain, ToolResult, Network } from '../types';
import { networkSchemaProp } from './lib/constants';
import { PAGINATION_PROPS, paginateArrayField, rpcErrorResult } from './lib/tool-helpers';

/**
 * Every platform_get_* handler is the same shape: cache a P-Chain RPC call, JSON
 * it, and turn a thrown error into an isError result. Only the cache key, TTL,
 * method, params, and an optional post-processor (pagination or nAVAX transform)
 * vary — those are the args here.
 */
async function runRpcTool(
  network: Network,
  cacheKey: string,
  ttl: number,
  method: string,
  params: Record<string, unknown>,
  post?: (result: unknown) => unknown,
): Promise<ToolResult> {
  try {
    const result = await withCache(cacheKey, ttl, () => avalancheRPC(network, 'pchain', method, params));
    return { content: [{ type: 'text', text: JSON.stringify(post ? post(result) : result) }] };
  } catch (err) {
    return rpcErrorResult(err, 'RPC error');
  }
}

/** Append `${field}_avax` (nAVAX→AVAX) to an RPC result object. */
const withAvax = (fields: Record<string, string>) => (result: unknown) => {
  const raw = result as Record<string, unknown>;
  const out: Record<string, unknown> = { ...raw };
  for (const [avaxKey, srcKey] of Object.entries(fields)) out[avaxKey] = nAvaxToAvax(raw[srcKey] as string);
  return out;
};

export const platformTools: ToolDomain = {
  tools: [
    {
      name: 'platform_get_height',
      description: 'Get the current P-Chain block height',
      inputSchema: {
        type: 'object',
        properties: {
          network: networkSchemaProp({ description: 'Avalanche network to query (default: mainnet)' }),
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
          network: networkSchemaProp({ description: 'Avalanche network to query (default: mainnet)' }),
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
          network: networkSchemaProp({ description: 'Avalanche network to query (default: mainnet)' }),
        },
        required: ['height'],
      },
    },
    {
      name: 'platform_get_blockchains',
      description: 'Get all blockchains that exist on the P-Chain (paginated; use limit/offset)',
      inputSchema: {
        type: 'object',
        properties: {
          network: networkSchemaProp({ description: 'Avalanche network to query (default: mainnet)' }),
          ...PAGINATION_PROPS,
        },
      },
    },
    {
      name: 'platform_get_subnets',
      description: 'Get information about Subnets/L1s on the P-Chain',
      inputSchema: {
        type: 'object',
        properties: {
          ids: {
            type: 'array',
            items: { type: 'string' },
            description: 'Optional list of Subnet IDs to filter by',
          },
          network: networkSchemaProp({ description: 'Avalanche network to query (default: mainnet)' }),
          ...PAGINATION_PROPS,
        },
      },
    },
    {
      name: 'platform_get_current_validators',
      description: 'Get the current validators of a Subnet/L1 (paginated; use limit/offset)',
      inputSchema: {
        type: 'object',
        properties: {
          subnetID: {
            type: 'string',
            description: 'The Subnet ID to query validators for (default: Primary Network)',
          },
          nodeIDs: {
            type: 'array',
            items: { type: 'string' },
            description: 'Optional list of node IDs to filter by',
          },
          network: networkSchemaProp({ description: 'Avalanche network to query (default: mainnet)' }),
          ...PAGINATION_PROPS,
        },
      },
    },
    {
      name: 'platform_get_pending_validators',
      description: 'Get the pending validators of a Subnet/L1 (paginated; use limit/offset)',
      inputSchema: {
        type: 'object',
        properties: {
          subnetID: {
            type: 'string',
            description: 'The Subnet ID to query pending validators for (default: Primary Network)',
          },
          nodeIDs: {
            type: 'array',
            items: { type: 'string' },
            description: 'Optional list of node IDs to filter by',
          },
          network: networkSchemaProp({ description: 'Avalanche network to query (default: mainnet)' }),
          ...PAGINATION_PROPS,
        },
      },
    },
    {
      name: 'platform_get_staking_asset_id',
      description: 'Get the asset ID of the token used for staking on a Subnet/L1',
      inputSchema: {
        type: 'object',
        properties: {
          subnetID: {
            type: 'string',
            description: 'The Subnet ID to query the staking asset for (default: Primary Network)',
          },
          network: networkSchemaProp({ description: 'Avalanche network to query (default: mainnet)' }),
        },
      },
    },
    {
      name: 'platform_get_min_stake',
      description: 'Get the minimum staking amounts for validators and delegators on a Subnet/L1',
      inputSchema: {
        type: 'object',
        properties: {
          subnetID: {
            type: 'string',
            description: 'The Subnet ID to query minimum stake for (default: Primary Network)',
          },
          network: networkSchemaProp({ description: 'Avalanche network to query (default: mainnet)' }),
        },
      },
    },
    {
      name: 'platform_get_total_stake',
      description: 'Get the total amount staked on a Subnet/L1',
      inputSchema: {
        type: 'object',
        properties: {
          subnetID: {
            type: 'string',
            description: 'The Subnet ID to query total stake for (default: Primary Network)',
          },
          network: networkSchemaProp({ description: 'Avalanche network to query (default: mainnet)' }),
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
          network: networkSchemaProp({ description: 'Avalanche network to query (default: mainnet)' }),
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
          network: networkSchemaProp({ description: 'Avalanche network to query (default: mainnet)' }),
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
          network: networkSchemaProp({ description: 'Avalanche network to query (default: mainnet)' }),
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
          network: networkSchemaProp({ description: 'Avalanche network to query (default: mainnet)' }),
        },
        required: ['txID'],
      },
    },
    {
      name: 'platform_get_current_supply',
      description: 'Get the current total supply of AVAX on a Subnet/L1',
      inputSchema: {
        type: 'object',
        properties: {
          subnetID: {
            type: 'string',
            description: 'The Subnet ID to query current supply for (default: Primary Network)',
          },
          network: networkSchemaProp({ description: 'Avalanche network to query (default: mainnet)' }),
        },
      },
    },
    {
      name: 'platform_get_validators_at',
      description: 'Get the validators and their weights of a Subnet/L1 at a given P-Chain height',
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
            description: 'The Subnet ID to query validators for (default: Primary Network)',
          },
          network: networkSchemaProp({ description: 'Avalanche network to query (default: mainnet)' }),
        },
        required: ['height'],
      },
    },
  ],

  handlers: {
    platform_get_height: (args): Promise<ToolResult> => {
      const network = (args.network as Network) || 'mainnet';
      return runRpcTool(network, `platform:height:${network}`, CACHE_TTL.HEIGHT, 'platform.getHeight', {});
    },

    platform_get_block: (args): Promise<ToolResult> => {
      const network = (args.network as Network) || 'mainnet';
      const params = { blockID: args.blockID as string, encoding: (args.encoding as string) || 'json' };
      return runRpcTool(network, `platform:block:${network}:${JSON.stringify(params)}`, CACHE_TTL.IMMUTABLE, 'platform.getBlock', params);
    },

    platform_get_block_by_height: (args): Promise<ToolResult> => {
      const network = (args.network as Network) || 'mainnet';
      const params = { height: args.height as string, encoding: (args.encoding as string) || 'json' };
      return runRpcTool(network, `platform:blockByHeight:${network}:${JSON.stringify(params)}`, CACHE_TTL.IMMUTABLE, 'platform.getBlockByHeight', params);
    },

    platform_get_blockchains: (args): Promise<ToolResult> => {
      const network = (args.network as Network) || 'mainnet';
      return runRpcTool(network, `platform:blockchains:${network}`, CACHE_TTL.CHAINS, 'platform.getBlockchains', {}, (r) => paginateArrayField(r, 'blockchains', args));
    },

    platform_get_subnets: (args): Promise<ToolResult> => {
      const network = (args.network as Network) || 'mainnet';
      const params = { ids: (args.ids as string[] | undefined) || [] };
      return runRpcTool(network, `platform:subnets:${network}:${JSON.stringify(params)}`, CACHE_TTL.CHAINS, 'platform.getSubnets', params, (r) => paginateArrayField(r, 'subnets', args));
    },

    platform_get_current_validators: (args): Promise<ToolResult> => {
      const network = (args.network as Network) || 'mainnet';
      const params: Record<string, unknown> = {};
      if (args.subnetID !== undefined) params.subnetID = args.subnetID;
      if (args.nodeIDs !== undefined) params.nodeIDs = args.nodeIDs;
      return runRpcTool(network, `platform:currentValidators:${network}:${JSON.stringify(params)}`, CACHE_TTL.FEES, 'platform.getCurrentValidators', params, (r) => paginateArrayField(r, 'validators', args));
    },

    platform_get_pending_validators: (args): Promise<ToolResult> => {
      const network = (args.network as Network) || 'mainnet';
      const params: Record<string, unknown> = {};
      if (args.subnetID !== undefined) params.subnetID = args.subnetID;
      if (args.nodeIDs !== undefined) params.nodeIDs = args.nodeIDs;
      return runRpcTool(network, `platform:pendingValidators:${network}:${JSON.stringify(params)}`, 60 * 1000, 'platform.getPendingValidators', params, (r) => paginateArrayField(r, 'validators', args));
    },

    platform_get_staking_asset_id: (args): Promise<ToolResult> => {
      const network = (args.network as Network) || 'mainnet';
      const params: Record<string, unknown> = {};
      if (args.subnetID !== undefined) params.subnetID = args.subnetID;
      return runRpcTool(network, `platform:stakingAssetID:${network}:${JSON.stringify(params)}`, CACHE_TTL.VALIDATORS, 'platform.getStakingAssetID', params);
    },

    platform_get_min_stake: (args): Promise<ToolResult> => {
      const network = (args.network as Network) || 'mainnet';
      const params: Record<string, unknown> = {};
      if (args.subnetID !== undefined) params.subnetID = args.subnetID;
      return runRpcTool(network, `platform:minStake:${network}:${JSON.stringify(params)}`, CACHE_TTL.VALIDATORS, 'platform.getMinStake', params, withAvax({ minValidatorStake_avax: 'minValidatorStake', minDelegatorStake_avax: 'minDelegatorStake' }));
    },

    platform_get_total_stake: (args): Promise<ToolResult> => {
      const network = (args.network as Network) || 'mainnet';
      const params: Record<string, unknown> = {};
      if (args.subnetID !== undefined) params.subnetID = args.subnetID;
      return runRpcTool(network, `platform:totalStake:${network}:${JSON.stringify(params)}`, CACHE_TTL.FEES, 'platform.getTotalStake', params, withAvax({ stake_avax: 'stake' }));
    },

    platform_get_balance: (args): Promise<ToolResult> => {
      const network = (args.network as Network) || 'mainnet';
      const params = { addresses: args.addresses as string[] };
      return runRpcTool(network, `platform:balance:${network}:${JSON.stringify(params)}`, CACHE_TTL.BALANCE, 'platform.getBalance', params, withAvax({ balance_avax: 'balance' }));
    },

    platform_get_utxos: (args): Promise<ToolResult> => {
      const network = (args.network as Network) || 'mainnet';
      const params: Record<string, unknown> = { addresses: args.addresses as string[] };
      if (args.limit !== undefined) params.limit = args.limit;
      if (args.sourceChain !== undefined) params.sourceChain = args.sourceChain;
      return runRpcTool(network, `platform:utxos:${network}:${JSON.stringify(params)}`, CACHE_TTL.BALANCE, 'platform.getUTXOs', params);
    },

    platform_get_tx: (args): Promise<ToolResult> => {
      const network = (args.network as Network) || 'mainnet';
      const params = { txID: args.txID as string, encoding: (args.encoding as string) || 'json' };
      return runRpcTool(network, `platform:tx:${network}:${JSON.stringify(params)}`, CACHE_TTL.IMMUTABLE, 'platform.getTx', params);
    },

    platform_get_tx_status: (args): Promise<ToolResult> => {
      const network = (args.network as Network) || 'mainnet';
      const params = { txID: args.txID as string };
      return runRpcTool(network, `platform:txStatus:${network}:${JSON.stringify(params)}`, 5000, 'platform.getTxStatus', params);
    },

    platform_get_current_supply: (args): Promise<ToolResult> => {
      const network = (args.network as Network) || 'mainnet';
      const params: Record<string, unknown> = {};
      if (args.subnetID !== undefined) params.subnetID = args.subnetID;
      return runRpcTool(network, `platform:currentSupply:${network}:${JSON.stringify(params)}`, CACHE_TTL.FEES, 'platform.getCurrentSupply', params, withAvax({ supply_avax: 'supply' }));
    },

    platform_get_validators_at: (args): Promise<ToolResult> => {
      const network = (args.network as Network) || 'mainnet';
      const params: Record<string, unknown> = { height: args.height as number | 'proposed' };
      if (args.subnetID !== undefined) params.subnetID = args.subnetID;
      return runRpcTool(network, `platform:validatorsAt:${network}:${JSON.stringify(params)}`, CACHE_TTL.IMMUTABLE, 'platform.getValidatorsAt', params);
    },
  },
};
