import { NextResponse } from 'next/server';
import { Avalanche } from '@avalanche-sdk/chainkit';
import { z } from 'zod';
import l1ChainsRaw from '@/constants/l1-chains.json';

const l1ChainsData = l1ChainsRaw as Array<{
  chainId: string;
  chainName: string;
  rpcUrl?: string;
  explorerUrl?: string;
  chainLogoURI?: string;
  isTestnet?: boolean;
  subnetId?: string;
  description?: string;
  networkToken?: { symbol: string; name: string; decimals: number };
}>;

// withApi: not applicable — MCP JSON-RPC protocol with own CORS + rate limiting
export const dynamic = 'force-dynamic';

// ============================================================================
// SDK Initialization
// ============================================================================

const avalancheMainnet = new Avalanche({ network: 'mainnet' });
const avalancheFuji = new Avalanche({ network: 'fuji' });

function getAvalancheSDK(network: string = 'mainnet') {
  return network === 'fuji' ? avalancheFuji : avalancheMainnet;
}

// ============================================================================
// Caching Layer
// ============================================================================

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const cache = new Map<string, CacheEntry<unknown>>();
const CACHE_TTL = {
  VALIDATORS: 24 * 60 * 60 * 1000, // 24 hours
  METRICS: 4 * 60 * 60 * 1000, // 4 hours
  BALANCE: 30 * 1000, // 30 seconds
  CHAINS: 60 * 60 * 1000, // 1 hour
};

function getCached<T>(key: string, ttl: number): T | null {
  const entry = cache.get(key) as CacheEntry<T> | undefined;
  if (entry && Date.now() - entry.timestamp < ttl) {
    return entry.data;
  }
  return null;
}

function setCache<T>(key: string, data: T): void {
  cache.set(key, { data, timestamp: Date.now() });
}

// ============================================================================
// MCP Server Configuration
// ============================================================================

const SERVER_INFO = {
  name: 'avalanche-blockchain',
  version: '1.0.0',
  protocolVersion: '2024-11-05',
};

// Tool definitions following MCP spec
const TOOLS = [
  {
    name: 'blockchain_get_native_balance',
    description: 'Get the native token balance (AVAX) for an address on any Avalanche chain',
    inputSchema: {
      type: 'object',
      properties: {
        address: { type: 'string', description: 'The wallet address (0x format)' },
        chainId: { type: 'string', description: 'The chain ID (e.g., "43114" for C-Chain mainnet, "43113" for Fuji)' },
      },
      required: ['address', 'chainId'],
    },
  },
  {
    name: 'blockchain_get_token_balances',
    description: 'Get all ERC20 token balances for an address',
    inputSchema: {
      type: 'object',
      properties: {
        address: { type: 'string', description: 'The wallet address (0x format)' },
        chainId: { type: 'string', description: 'The chain ID' },
        currency: { type: 'string', description: 'Currency for USD values (default: "usd")' },
      },
      required: ['address', 'chainId'],
    },
  },
  {
    name: 'blockchain_get_transactions',
    description: 'Get transaction history for an address',
    inputSchema: {
      type: 'object',
      properties: {
        address: { type: 'string', description: 'The wallet address (0x format)' },
        chainId: { type: 'string', description: 'The chain ID' },
        pageSize: { type: 'number', description: 'Number of transactions to return (default: 25, max: 100)' },
        pageToken: { type: 'string', description: 'Pagination token for next page' },
      },
      required: ['address', 'chainId'],
    },
  },
  {
    name: 'blockchain_get_contract_info',
    description: 'Get metadata and information about a smart contract',
    inputSchema: {
      type: 'object',
      properties: {
        address: { type: 'string', description: 'The contract address (0x format)' },
        chainId: { type: 'string', description: 'The chain ID' },
      },
      required: ['address', 'chainId'],
    },
  },
  {
    name: 'blockchain_list_validators',
    description: 'List active validators on the Avalanche Primary Network',
    inputSchema: {
      type: 'object',
      properties: {
        network: { type: 'string', enum: ['mainnet', 'fuji'], description: 'Network to query (default: mainnet)' },
        pageSize: { type: 'number', description: 'Number of validators to return (default: 50, max: 100)' },
        sortBy: {
          type: 'string',
          enum: ['stakeAmount', 'delegatorCount', 'uptime'],
          description: 'Sort order (default: stakeAmount)',
        },
      },
      required: [],
    },
  },
  {
    name: 'blockchain_get_validator_details',
    description: 'Get detailed information about a specific validator',
    inputSchema: {
      type: 'object',
      properties: {
        nodeId: { type: 'string', description: 'The validator node ID (NodeID-xxx format)' },
        network: { type: 'string', enum: ['mainnet', 'fuji'], description: 'Network to query (default: mainnet)' },
      },
      required: ['nodeId'],
    },
  },
  {
    name: 'blockchain_get_chain_metrics',
    description: 'Get performance metrics for a chain (TPS, transactions, addresses, gas)',
    inputSchema: {
      type: 'object',
      properties: {
        chainId: { type: 'string', description: 'The chain ID (e.g., "43114" for C-Chain)' },
        metric: {
          type: 'string',
          enum: ['txCount', 'activeAddresses', 'avgTps', 'maxTps', 'gasUsed', 'feesPaid'],
          description: 'Specific metric to fetch (optional, returns all if not specified)',
        },
        timeRange: { type: 'string', enum: ['7d', '30d', '90d'], description: 'Time range for metrics (default: 30d)' },
      },
      required: ['chainId'],
    },
  },
  {
    name: 'blockchain_get_staking_metrics',
    description: 'Get network-wide staking statistics',
    inputSchema: {
      type: 'object',
      properties: {
        network: { type: 'string', enum: ['mainnet', 'fuji'], description: 'Network to query (default: mainnet)' },
      },
      required: [],
    },
  },
  {
    name: 'blockchain_list_chains',
    description: 'List all EVM chains in the Avalanche ecosystem',
    inputSchema: {
      type: 'object',
      properties: {
        includeTestnets: { type: 'boolean', description: 'Include testnet chains (default: false)' },
      },
      required: [],
    },
  },
  {
    name: 'blockchain_get_chain_info',
    description: 'Get detailed information about a specific chain',
    inputSchema: {
      type: 'object',
      properties: {
        chainId: { type: 'string', description: 'The chain ID' },
      },
      required: ['chainId'],
    },
  },
];

// ============================================================================
// Input Validation Schemas
// ============================================================================

const AddressSchema = z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid address format');
const ChainIdSchema = z.string().min(1, 'Chain ID is required');
const NetworkSchema = z.enum(['mainnet', 'fuji']).default('mainnet');
const NodeIdSchema = z.string().regex(/^NodeID-/, 'Invalid node ID format');

// ============================================================================
// RPC Helper
// ============================================================================

async function fetchFromRPC(rpcUrl: string, method: string, params: unknown[] = []): Promise<unknown> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`RPC request failed: ${response.status}`);
    }

    const data = await response.json();
    if (data.error) {
      throw new Error(data.error.message || 'RPC error');
    }

    return data.result;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

// ============================================================================
// Tool Implementations
// ============================================================================

async function getNativeBalance(address: string, chainId: string) {
  AddressSchema.parse(address);
  ChainIdSchema.parse(chainId);

  const cacheKey = `balance:${chainId}:${address}`;
  const cached = getCached<{ balance: string; balanceFormatted: string; symbol: string }>(cacheKey, CACHE_TTL.BALANCE);
  if (cached) return cached;

  const chain = l1ChainsData.find((c: any) => c.chainId === chainId) as any;
  const rpcUrl = chain?.rpcUrl;

  if (!rpcUrl) {
    throw new Error(`Chain ${chainId} not found or RPC URL not available`);
  }

  const balanceHex = (await fetchFromRPC(rpcUrl, 'eth_getBalance', [address.toLowerCase(), 'latest'])) as string;
  const balanceWei = BigInt(balanceHex);
  const balanceFormatted = (Number(balanceWei) / Math.pow(10, 18)).toFixed(6);

  const result = {
    address,
    chainId,
    chainName: chain?.chainName || 'Unknown',
    balance: balanceWei.toString(),
    balanceFormatted,
    symbol: chain?.networkToken?.symbol || 'AVAX',
  };

  setCache(cacheKey, result);
  return result;
}

async function getTokenBalances(address: string, chainId: string, currency: string = 'usd') {
  AddressSchema.parse(address);
  ChainIdSchema.parse(chainId);

  const avalanche = getAvalancheSDK();
  const result = await avalanche.data.evm.address.balances.listErc20({
    address: address.toLowerCase(),
    chainId,
    currency: currency as any,
    pageSize: 50,
  });

  const tokens: Array<{
    address: string;
    name: string;
    symbol: string;
    decimals: number;
    balance: string;
    balanceFormatted: string;
    logoUri?: string;
    priceUsd?: number;
    valueUsd?: number;
  }> = [];

  for await (const page of result) {
    const balances = page.result?.erc20TokenBalances || [];
    for (const token of balances) {
      const decimals = token.decimals || 18;
      const balance = token.balance || '0';
      const balanceFormatted = (Number(BigInt(balance)) / Math.pow(10, decimals)).toFixed(6);

      tokens.push({
        address: token.address || '',
        name: token.name || 'Unknown',
        symbol: token.symbol || '???',
        decimals,
        balance,
        balanceFormatted,
        logoUri: token.logoUri,
        priceUsd: token.price?.value,
        valueUsd: token.balanceValue?.value,
      });
    }
    break;
  }

  return { address, chainId, tokenCount: tokens.length, tokens };
}

async function getTransactions(address: string, chainId: string, pageSize: number = 25, pageToken?: string) {
  AddressSchema.parse(address);
  ChainIdSchema.parse(chainId);

  const avalanche = getAvalancheSDK();
  const result = await avalanche.data.evm.address.transactions.list({
    address: address.toLowerCase(),
    chainId,
    sortOrder: 'desc',
    pageSize: Math.min(pageSize, 100),
    pageToken,
  });

  const transactions: Array<{
    hash: string;
    blockNumber: string;
    timestamp: number;
    from: string;
    to: string | null;
    value: string;
    valueFormatted: string;
    gasUsed: string;
    gasPrice: string;
    status: string;
    method?: string;
  }> = [];

  let nextPageToken: string | undefined;

  for await (const page of result) {
    const txList = page.result?.transactions || [];
    nextPageToken = page.result?.nextPageToken;

    for (const txDetails of txList) {
      const tx = txDetails.nativeTransaction;
      if (!tx) continue;

      const value = tx.value || '0';
      const valueFormatted = (Number(BigInt(value)) / Math.pow(10, 18)).toFixed(6);

      transactions.push({
        hash: tx.txHash || '',
        blockNumber: tx.blockNumber?.toString() || '',
        timestamp: tx.blockTimestamp ?? 0,
        from: tx.from?.address || '',
        to: tx.to?.address || null,
        value,
        valueFormatted,
        gasUsed: tx.gasUsed || '0',
        gasPrice: tx.gasPrice || '0',
        status: tx.txStatus?.toString() === '1' ? 'success' : 'failed',
        method: tx.method?.methodName?.split('(')[0],
      });
    }
    break;
  }

  return { address, chainId, transactionCount: transactions.length, transactions, nextPageToken };
}

async function getContractInfo(address: string, chainId: string) {
  AddressSchema.parse(address);
  ChainIdSchema.parse(chainId);

  const avalanche = getAvalancheSDK();

  try {
    const result = await avalanche.data.evm.contracts.getMetadata({
      address: address.toLowerCase(),
      chainId,
    });

    const resultAny = result as any;

    return {
      address,
      chainId,
      isContract: true,
      name: result.name || undefined,
      symbol: resultAny.symbol || undefined,
      description: result.description || undefined,
      ercType: result.ercType || 'UNKNOWN',
      logoUri: result.logoAsset?.imageUri || undefined,
      officialSite: result.officialSite || undefined,
      deploymentDetails: result.deploymentDetails
        ? {
            txHash: result.deploymentDetails.txHash,
            deployerAddress: result.deploymentDetails.deployerAddress,
          }
        : undefined,
    };
  } catch {
    return {
      address,
      chainId,
      isContract: false,
      error: 'Contract metadata not found - address may be an EOA or unverified contract',
    };
  }
}

async function listValidators(network: string = 'mainnet', pageSize: number = 50, sortBy: string = 'stakeAmount') {
  const parsedNetwork = NetworkSchema.parse(network);

  const cacheKey = `validators:${parsedNetwork}:${pageSize}:${sortBy}`;
  const cached = getCached<any>(cacheKey, CACHE_TTL.VALIDATORS);
  if (cached) return cached;

  const avalanche = getAvalancheSDK(parsedNetwork);
  const result = await avalanche.data.primaryNetwork.listValidators({
    pageSize: Math.min(pageSize, 100),
    sortBy: sortBy as any,
    validationStatus: 'active',
  });

  const validators: Array<{
    nodeId: string;
    stakeAmount: string;
    stakeAmountFormatted: string;
    delegatorCount: number;
    delegatedAmount: string;
    startTime: number;
    endTime: number;
    uptimePerformance?: number;
  }> = [];

  for await (const page of result) {
    const validatorList = page.result?.validators || [];
    for (const validator of validatorList) {
      const v = validator as any;
      const stakeAmount = v.amountStaked || v.stakeAmount || '0';
      const stakeAmountFormatted = (Number(BigInt(stakeAmount)) / Math.pow(10, 9)).toFixed(2);

      validators.push({
        nodeId: v.nodeId || '',
        stakeAmount,
        stakeAmountFormatted: `${stakeAmountFormatted} AVAX`,
        delegatorCount: v.delegatorCount ?? 0,
        delegatedAmount: v.delegatedAmount || v.amountDelegated || '0',
        startTime: v.startTimestamp ?? 0,
        endTime: v.endTimestamp ?? 0,
        uptimePerformance: v.uptimePerformance,
      });
    }
    break;
  }

  const response = { network: parsedNetwork, validatorCount: validators.length, validators };
  setCache(cacheKey, response);
  return response;
}

async function getValidatorDetails(nodeId: string, network: string = 'mainnet') {
  NodeIdSchema.parse(nodeId);
  const parsedNetwork = NetworkSchema.parse(network);

  const avalanche = getAvalancheSDK(parsedNetwork);
  const resultIterator = await avalanche.data.primaryNetwork.getValidatorDetails({ nodeId });

  let validatorData: any = null;
  for await (const page of resultIterator) {
    validatorData = page as any;
    break;
  }

  if (!validatorData) {
    throw new Error(`Validator ${nodeId} not found`);
  }

  const stakeAmount = validatorData.amountStaked || validatorData.stakeAmount || '0';
  const stakeAmountFormatted = (Number(BigInt(stakeAmount)) / Math.pow(10, 9)).toFixed(2);
  const delegatedAmount = validatorData.amountDelegated || validatorData.delegatedAmount || '0';
  const delegatedAmountFormatted = (Number(BigInt(delegatedAmount)) / Math.pow(10, 9)).toFixed(2);

  return {
    nodeId: validatorData.nodeId || nodeId,
    network: parsedNetwork,
    stakeAmount,
    stakeAmountFormatted: `${stakeAmountFormatted} AVAX`,
    delegatedAmount,
    delegatedAmountFormatted: `${delegatedAmountFormatted} AVAX`,
    delegatorCount: validatorData.delegatorCount ?? 0,
    startTime: validatorData.startTimestamp,
    endTime: validatorData.endTimestamp,
    uptimePerformance: validatorData.uptimePerformance,
    validationStatus: validatorData.validationStatus,
    blsCredentials: validatorData.blsCredentials,
  };
}

async function getChainMetrics(chainId: string, metric?: string, timeRange: string = '30d') {
  ChainIdSchema.parse(chainId);

  const cacheKey = `metrics:${chainId}:${metric || 'all'}:${timeRange}`;
  const cached = getCached<any>(cacheKey, CACHE_TTL.METRICS);
  if (cached) return cached;

  const avalanche = getAvalancheSDK();
  const now = Math.floor(Date.now() / 1000);
  const days = timeRange === '7d' ? 7 : timeRange === '90d' ? 90 : 30;
  const startTimestamp = now - days * 24 * 60 * 60;

  const metrics: Record<string, any> = {};
  const metricsToFetch = metric ? [metric] : ['txCount', 'activeAddresses', 'avgTps', 'maxTps', 'gasUsed', 'feesPaid'];

  for (const metricType of metricsToFetch) {
    try {
      const result = await avalanche.metrics.chains.getMetrics({
        chainId,
        metric: metricType as any,
        startTimestamp,
        endTimestamp: now,
        timeInterval: 'day',
        pageSize: days,
      });

      const dataPoints: Array<{ timestamp: number; value: number; date: string }> = [];

      for await (const page of result) {
        const results = page.result?.results || [];
        for (const r of results) {
          dataPoints.push({
            timestamp: r.timestamp || 0,
            value: r.value || 0,
            date: new Date((r.timestamp || 0) * 1000).toISOString().split('T')[0],
          });
        }
        break;
      }

      const values = dataPoints.map((d) => d.value).filter((v) => v > 0);
      const total = values.reduce((a, b) => a + b, 0);
      const average = values.length > 0 ? total / values.length : 0;
      const latest = dataPoints[0]?.value || 0;

      metrics[metricType] = {
        latest,
        average: Math.round(average * 100) / 100,
        total: Math.round(total),
        dataPoints: dataPoints.slice(0, 10),
      };
    } catch {
      metrics[metricType] = { error: 'Failed to fetch metric' };
    }
  }

  const response = { chainId, timeRange, metrics };
  setCache(cacheKey, response);
  return response;
}

async function getStakingMetrics(network: string = 'mainnet') {
  const parsedNetwork = NetworkSchema.parse(network);

  const cacheKey = `staking:${parsedNetwork}`;
  const cached = getCached<any>(cacheKey, CACHE_TTL.METRICS);
  if (cached) return cached;

  const avalanche = getAvalancheSDK(parsedNetwork);
  const now = Math.floor(Date.now() / 1000);
  const startTimestamp = now - 30 * 24 * 60 * 60;

  try {
    const [validatorCountResult, validatorWeightResult] = await Promise.all([
      avalanche.metrics.networks.getStakingMetrics({
        metric: 'validatorCount' as any,
        startTimestamp,
        endTimestamp: now,
        pageSize: 7,
      }),
      avalanche.metrics.networks.getStakingMetrics({
        metric: 'validatorWeight' as any,
        startTimestamp,
        endTimestamp: now,
        pageSize: 7,
      }),
    ]);

    const validatorCounts: Array<{ timestamp: number; value: number }> = [];
    const validatorWeights: Array<{ timestamp: number; value: number }> = [];

    for await (const page of validatorCountResult) {
      const pageAny = page as any;
      const results = pageAny.result?.results || [];
      for (const r of results) {
        validatorCounts.push({ timestamp: r.timestamp || 0, value: r.value || 0 });
      }
      break;
    }

    for await (const page of validatorWeightResult) {
      const pageAny = page as any;
      const results = pageAny.result?.results || [];
      for (const r of results) {
        validatorWeights.push({ timestamp: r.timestamp || 0, value: r.value || 0 });
      }
      break;
    }

    const latestCount = validatorCounts[0];
    const latestWeight = validatorWeights[0];
    const totalStakeFormatted = latestWeight?.value
      ? (Number(BigInt(latestWeight.value.toString())) / Math.pow(10, 9)).toFixed(0)
      : '0';

    const response = {
      network: parsedNetwork,
      currentValidatorCount: latestCount?.value || 0,
      totalStaked: latestWeight?.value?.toString() || '0',
      totalStakedFormatted: `${totalStakeFormatted} AVAX`,
      recentValidatorCounts: validatorCounts.slice(0, 7),
      recentValidatorWeights: validatorWeights.slice(0, 7),
    };

    setCache(cacheKey, response);
    return response;
  } catch {
    return { network: parsedNetwork, error: 'Failed to fetch staking metrics' };
  }
}

async function listChains(includeTestnets: boolean = false) {
  const cacheKey = `chains:${includeTestnets}`;
  const cached = getCached<any>(cacheKey, CACHE_TTL.CHAINS);
  if (cached) return cached;

  const chains = (l1ChainsData as any[])
    .filter((chain) => {
      if (!includeTestnets && chain.isTestnet) return false;
      return true;
    })
    .map((chain) => ({
      chainId: chain.chainId,
      chainName: chain.chainName,
      isTestnet: chain.isTestnet || false,
      networkToken: chain.networkToken?.symbol || 'AVAX',
      rpcUrl: chain.rpcUrl,
      explorerUrl: chain.explorerUrl,
      logoUri: chain.chainLogoURI,
    }));

  const response = { chainCount: chains.length, chains };
  setCache(cacheKey, response);
  return response;
}

async function getChainInfo(chainId: string) {
  ChainIdSchema.parse(chainId);

  const chain = (l1ChainsData as any[]).find((c) => c.chainId === chainId);

  if (!chain) {
    const avalanche = getAvalancheSDK();
    try {
      const result = await avalanche.data.evm.chains.get({ chainId });
      return {
        chainId,
        chainName: result.chainName || 'Unknown',
        networkToken: result.networkToken?.symbol || 'Unknown',
        vmName: result.vmName,
        subnetId: result.subnetId,
        isTestnet: result.isTestnet || false,
      };
    } catch {
      throw new Error(`Chain ${chainId} not found`);
    }
  }

  return {
    chainId: chain.chainId,
    chainName: chain.chainName,
    description: chain.description,
    networkToken: chain.networkToken,
    rpcUrl: chain.rpcUrl,
    explorerUrl: chain.explorerUrl,
    logoUri: chain.chainLogoURI,
    isTestnet: chain.isTestnet || false,
    subnetId: chain.subnetId,
  };
}

// ============================================================================
// Tool Handler
// ============================================================================

async function handleToolCall(name: string, args: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    case 'blockchain_get_native_balance':
      return getNativeBalance(args.address as string, args.chainId as string);
    case 'blockchain_get_token_balances':
      return getTokenBalances(args.address as string, args.chainId as string, args.currency as string | undefined);
    case 'blockchain_get_transactions':
      return getTransactions(
        args.address as string,
        args.chainId as string,
        args.pageSize as number | undefined,
        args.pageToken as string | undefined,
      );
    case 'blockchain_get_contract_info':
      return getContractInfo(args.address as string, args.chainId as string);
    case 'blockchain_list_validators':
      return listValidators(
        args.network as string | undefined,
        args.pageSize as number | undefined,
        args.sortBy as string | undefined,
      );
    case 'blockchain_get_validator_details':
      return getValidatorDetails(args.nodeId as string, args.network as string | undefined);
    case 'blockchain_get_chain_metrics':
      return getChainMetrics(
        args.chainId as string,
        args.metric as string | undefined,
        args.timeRange as string | undefined,
      );
    case 'blockchain_get_staking_metrics':
      return getStakingMetrics(args.network as string | undefined);
    case 'blockchain_list_chains':
      return listChains(args.includeTestnets as boolean | undefined);
    case 'blockchain_get_chain_info':
      return getChainInfo(args.chainId as string);
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// ============================================================================
// JSON-RPC Request Processing
// ============================================================================

interface JsonRpcRequest {
  jsonrpc: string;
  id: string | number;
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

async function processRequest(request: JsonRpcRequest): Promise<JsonRpcResponse> {
  const { id, method, params = {} } = request;

  try {
    switch (method) {
      case 'initialize':
        return {
          jsonrpc: '2.0',
          id,
          result: {
            protocolVersion: SERVER_INFO.protocolVersion,
            capabilities: { tools: {} },
            serverInfo: { name: SERVER_INFO.name, version: SERVER_INFO.version },
          },
        };

      case 'tools/list':
        return { jsonrpc: '2.0', id, result: { tools: TOOLS } };

      case 'tools/call': {
        const { name, arguments: args } = params as { name: string; arguments: Record<string, unknown> };
        if (!name) throw new Error('Tool name is required');
        const tool = TOOLS.find((t) => t.name === name);
        if (!tool) throw new Error(`Unknown tool: ${name}`);
        const result = await handleToolCall(name, args || {});
        return {
          jsonrpc: '2.0',
          id,
          result: { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] },
        };
      }

      case 'ping':
        return { jsonrpc: '2.0', id, result: {} };

      default:
        return { jsonrpc: '2.0', id, error: { code: -32601, message: `Method not found: ${method}` } };
    }
  } catch (error) {
    return {
      jsonrpc: '2.0',
      id,
      error: {
        code: -32603,
        message: error instanceof Error ? error.message : 'Internal error',
        data: error instanceof z.ZodError ? error.issues : undefined,
      },
    };
  }
}

// ============================================================================
// HTTP Handlers
// ============================================================================

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Handle batch requests
    if (Array.isArray(body)) {
      const responses = await Promise.all(body.map(processRequest));
      return NextResponse.json(responses);
    }

    // Handle single request
    const response = await processRequest(body);
    return NextResponse.json(response);
  } catch {
    return NextResponse.json(
      { jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } },
      { status: 400 },
    );
  }
}

export async function GET() {
  return NextResponse.json({
    name: SERVER_INFO.name,
    version: SERVER_INFO.version,
    protocolVersion: SERVER_INFO.protocolVersion,
    description: 'Avalanche blockchain data MCP server - query balances, transactions, validators, and chain metrics',
    tools: TOOLS.map((t) => ({ name: t.name, description: t.description })),
  });
}
