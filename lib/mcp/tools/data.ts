/**
 * Data / Stats tool domain.
 *
 * Indexed on-chain reads via the public Avalanche Data API (Glacier) and the
 * Metrics/Stats API — the modern, indexed alternative to hammering public RPC
 * (which rate-limits and serves no historical data). Reuses the proven
 * glacierFetch client from lib/rwa/glacier.
 */

import { glacierFetch, fetchErc20Balances, fetchErc20Transactions } from '@/lib/rwa/glacier/client';
import { withCache, CACHE_TTL } from '../cache';
import type { ToolDomain, ToolResult, Network } from '../types';

const METRICS_BASE = process.env.METRICS_API_URL || 'https://metrics.avax.network';
const METRICS_TIMEOUT_MS = 10_000;

// C-Chain IDs by network — the Data API addresses endpoints are keyed by EVM chain ID.
const C_CHAIN_ID: Record<Network, string> = { mainnet: '43114', fuji: '43113' };

function getNetwork(args: Record<string, unknown>): Network {
  return args.network === 'fuji' ? 'fuji' : 'mainnet';
}

/** Resolve a chainId: explicit arg wins, else the C-Chain for the chosen network. */
function getChainId(args: Record<string, unknown>): string {
  const explicit = typeof args.chainId === 'string' && args.chainId.trim() ? args.chainId.trim() : '';
  return explicit || C_CHAIN_ID[getNetwork(args)];
}

function getString(args: Record<string, unknown>, key: string): string {
  return typeof args[key] === 'string' ? (args[key] as string).trim() : '';
}

function json(data: unknown): ToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(data) }] };
}

function errorResult(message: string): ToolResult {
  return { content: [{ type: 'text', text: message }], isError: true };
}

function asMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'Data API request failed';
}

// ---------------------------------------------------------------------------
// Metrics API fetch (GET REST with a content-type guard)
// ---------------------------------------------------------------------------

async function metricsFetch(path: string, params: Record<string, string>): Promise<unknown> {
  const url = new URL(`${METRICS_BASE}${path}`);
  for (const [k, v] of Object.entries(params)) {
    if (v) url.searchParams.set(k, v);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), METRICS_TIMEOUT_MS);
  try {
    const res = await fetch(url.toString(), { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`Metrics API error: ${res.status} ${res.statusText}`);
    const contentType = res.headers.get('content-type') || '';
    const text = await res.text();
    if (!contentType.includes('json') && text.trimStart().startsWith('<')) {
      throw new Error(`Non-JSON response from Metrics API (status ${res.status})`);
    }
    return JSON.parse(text);
  } finally {
    clearTimeout(timer);
  }
}

const COMMON_CHAIN_METRICS = [
  'txCount',
  'activeAddresses',
  'activeSenders',
  'cumulativeTxCount',
  'cumulativeAddresses',
  'gasUsed',
  'avgGasPrice',
  'feesPaid',
] as const;

const COMMON_NETWORK_METRICS = ['validatorCount', 'delegatorCount', 'validatorWeight', 'delegatorWeight'] as const;
const TIME_INTERVALS = ['hour', 'day', 'week', 'month'] as const;

// ---------------------------------------------------------------------------
// Tool domain
// ---------------------------------------------------------------------------

export const dataTools: ToolDomain = {
  tools: [
    {
      name: 'data_get_address_balances',
      description:
        'Get an address\'s balances via the indexed Data API — native AVAX plus ERC-20 token balances. Faster and richer than raw RPC; no rate limiting.',
      inputSchema: {
        type: 'object',
        properties: {
          address: { type: 'string', description: 'EVM address (0x...)' },
          chainId: { type: 'string', description: 'EVM chain ID (default: C-Chain for the chosen network)' },
          network: { type: 'string', enum: ['mainnet', 'fuji'], description: 'Network (default: mainnet)' },
        },
        required: ['address'],
      },
    },
    {
      name: 'data_list_transactions',
      description: 'List recent transactions for an address via the indexed Data API (paginated).',
      inputSchema: {
        type: 'object',
        properties: {
          address: { type: 'string', description: 'EVM address (0x...)' },
          chainId: { type: 'string', description: 'EVM chain ID (default: C-Chain for the chosen network)' },
          network: { type: 'string', enum: ['mainnet', 'fuji'], description: 'Network (default: mainnet)' },
          pageSize: { type: 'number', minimum: 1, maximum: 100, description: 'Page size (default: 20)' },
          pageToken: { type: 'string', description: 'Pagination token from a previous response' },
        },
        required: ['address'],
      },
    },
    {
      name: 'data_list_transfers',
      description: 'List ERC-20 token transfers for an address via the indexed Data API (paginated).',
      inputSchema: {
        type: 'object',
        properties: {
          address: { type: 'string', description: 'EVM address (0x...)' },
          chainId: { type: 'string', description: 'EVM chain ID (default: C-Chain for the chosen network)' },
          network: { type: 'string', enum: ['mainnet', 'fuji'], description: 'Network (default: mainnet)' },
          pageSize: { type: 'number', minimum: 1, maximum: 100, description: 'Page size (default: 20)' },
          pageToken: { type: 'string', description: 'Pagination token from a previous response' },
        },
        required: ['address'],
      },
    },
    {
      name: 'data_list_blockchains',
      description: 'List blockchains/subnets indexed by the Data API for a network (paginated — avoids the RPC getBlockchains overflow).',
      inputSchema: {
        type: 'object',
        properties: {
          network: { type: 'string', enum: ['mainnet', 'fuji'], description: 'Network (default: mainnet)' },
          pageSize: { type: 'number', minimum: 1, maximum: 100, description: 'Page size (default: 50)' },
          pageToken: { type: 'string', description: 'Pagination token from a previous response' },
        },
        required: [],
      },
    },
    {
      name: 'data_lookup_subnet',
      description: 'Look up rich subnet metadata via the Data API — blockchains, validator count, and configuration.',
      inputSchema: {
        type: 'object',
        properties: {
          subnetId: { type: 'string', description: 'The subnet ID' },
          network: { type: 'string', enum: ['mainnet', 'fuji'], description: 'Network (default: mainnet)' },
        },
        required: ['subnetId'],
      },
    },
    {
      name: 'data_lookup_validator',
      description: 'Look up a validator via the Data API — stake, uptime, delegations, and details.',
      inputSchema: {
        type: 'object',
        properties: {
          nodeId: { type: 'string', description: 'Node ID (NodeID-...)' },
          network: { type: 'string', enum: ['mainnet', 'fuji'], description: 'Network (default: mainnet)' },
        },
        required: ['nodeId'],
      },
    },
    {
      name: 'stats_chain_metrics',
      description:
        'Time-series metrics for a chain via the Metrics/Stats API (txCount, activeAddresses, gasUsed, feesPaid, etc.).',
      inputSchema: {
        type: 'object',
        properties: {
          chainId: { type: 'string', description: 'EVM chain ID (default: C-Chain for the chosen network)' },
          metric: { type: 'string', description: `Metric name, e.g. ${COMMON_CHAIN_METRICS.join(', ')}` },
          timeInterval: { type: 'string', enum: [...TIME_INTERVALS], description: 'Aggregation interval (default: day)' },
          network: { type: 'string', enum: ['mainnet', 'fuji'], description: 'Network (default: mainnet)' },
          pageSize: { type: 'number', minimum: 1, maximum: 365, description: 'Number of data points (default: 30)' },
        },
        required: ['metric'],
      },
    },
    {
      name: 'stats_network_metrics',
      description:
        'Network-wide time-series metrics via the Metrics/Stats API (validatorCount, delegatorCount, weights). Optionally scope to a subnet.',
      inputSchema: {
        type: 'object',
        properties: {
          metric: { type: 'string', description: `Metric name, e.g. ${COMMON_NETWORK_METRICS.join(', ')}` },
          network: { type: 'string', enum: ['mainnet', 'fuji'], description: 'Network (default: mainnet)' },
          subnetId: { type: 'string', description: 'Optional subnet ID to scope the metric to' },
          pageSize: { type: 'number', minimum: 1, maximum: 365, description: 'Number of data points (default: 30)' },
        },
        required: ['metric'],
      },
    },
  ],

  handlers: {
    data_get_address_balances: async (args): Promise<ToolResult> => {
      const address = getString(args, 'address');
      if (!address) return errorResult('Error: address is required');
      const chainId = getChainId(args);
      try {
        const [native, erc20] = await Promise.allSettled([
          glacierFetch<unknown>(`/v1/chains/${chainId}/addresses/${address}/balances:getNative`),
          fetchErc20Balances(chainId, address),
        ]);
        return json({
          address,
          chainId,
          nativeBalance: native.status === 'fulfilled' ? native.value : null,
          erc20Balances: erc20.status === 'fulfilled' ? erc20.value.erc20TokenBalances : [],
        });
      } catch (err) {
        return errorResult(asMessage(err));
      }
    },

    data_list_transactions: async (args): Promise<ToolResult> => {
      const address = getString(args, 'address');
      if (!address) return errorResult('Error: address is required');
      const chainId = getChainId(args);
      const pageSize = typeof args.pageSize === 'number' ? String(Math.floor(args.pageSize)) : '20';
      const pageToken = getString(args, 'pageToken');
      try {
        const result = await glacierFetch<unknown>(
          `/v1/chains/${chainId}/addresses/${address}/transactions`,
          pageToken ? { pageSize, pageToken } : { pageSize }
        );
        return json(result);
      } catch (err) {
        return errorResult(asMessage(err));
      }
    },

    data_list_transfers: async (args): Promise<ToolResult> => {
      const address = getString(args, 'address');
      if (!address) return errorResult('Error: address is required');
      const chainId = getChainId(args);
      const pageSize = typeof args.pageSize === 'number' ? Math.floor(args.pageSize) : 20;
      const pageToken = getString(args, 'pageToken') || undefined;
      try {
        const result = await fetchErc20Transactions(chainId, address, pageSize, pageToken);
        return json(result);
      } catch (err) {
        return errorResult(asMessage(err));
      }
    },

    data_list_blockchains: async (args): Promise<ToolResult> => {
      const network = getNetwork(args);
      const pageSize = typeof args.pageSize === 'number' ? String(Math.floor(args.pageSize)) : '50';
      const pageToken = getString(args, 'pageToken');
      try {
        const result = await glacierFetch<unknown>(
          `/v1/networks/${network}/blockchains`,
          pageToken ? { pageSize, pageToken } : { pageSize }
        );
        return json(result);
      } catch (err) {
        return errorResult(asMessage(err));
      }
    },

    data_lookup_subnet: async (args): Promise<ToolResult> => {
      const subnetId = getString(args, 'subnetId');
      if (!subnetId) return errorResult('Error: subnetId is required');
      const network = getNetwork(args);
      try {
        const result = await withCache(
          `data:subnet:${network}:${subnetId}`,
          CACHE_TTL.CHAINS,
          () => glacierFetch<unknown>(`/v1/networks/${network}/subnets/${subnetId}`)
        );
        return json(result);
      } catch (err) {
        return errorResult(asMessage(err));
      }
    },

    data_lookup_validator: async (args): Promise<ToolResult> => {
      const nodeId = getString(args, 'nodeId');
      if (!nodeId) return errorResult('Error: nodeId is required');
      const network = getNetwork(args);
      try {
        const result = await glacierFetch<unknown>(`/v1/networks/${network}/validators/${nodeId}`);
        return json(result);
      } catch (err) {
        return errorResult(asMessage(err));
      }
    },

    stats_chain_metrics: async (args): Promise<ToolResult> => {
      const metric = getString(args, 'metric');
      if (!metric) return errorResult('Error: metric is required');
      const chainId = getChainId(args);
      const timeInterval = (TIME_INTERVALS as readonly string[]).includes(getString(args, 'timeInterval'))
        ? getString(args, 'timeInterval')
        : 'day';
      const pageSize = typeof args.pageSize === 'number' ? String(Math.floor(args.pageSize)) : '30';
      try {
        const result = await metricsFetch(`/v2/chains/${chainId}/metrics/${metric}`, { timeInterval, pageSize });
        return json(result);
      } catch (err) {
        return errorResult(asMessage(err));
      }
    },

    stats_network_metrics: async (args): Promise<ToolResult> => {
      const metric = getString(args, 'metric');
      if (!metric) return errorResult('Error: metric is required');
      const network = getNetwork(args);
      const subnetId = getString(args, 'subnetId');
      const pageSize = typeof args.pageSize === 'number' ? String(Math.floor(args.pageSize)) : '30';
      try {
        const params: Record<string, string> = { pageSize };
        if (subnetId) params.subnetId = subnetId;
        const result = await metricsFetch(`/v2/networks/${network}/metrics/${metric}`, params);
        return json(result);
      } catch (err) {
        return errorResult(asMessage(err));
      }
    },
  },
};
