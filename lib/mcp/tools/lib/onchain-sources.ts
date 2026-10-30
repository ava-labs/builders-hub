/**
 * Read sources for the on-chain data tools (data.ts): the public Stats API
 * (indexed EVM, P-Chain and X-Chain data) and each EVM chain's public RPC
 * (live balances, contract reads, recent logs). Neither needs a key.
 */

import {
  createPublicClient,
  erc20Abi,
  formatUnits,
  http,
  parseAbi,
  toHex,
  TransactionNotFoundError,
  TransactionReceiptNotFoundError,
  type Address,
  type Hash,
} from 'viem';
import l1ChainsData from '@/constants/l1-chains.json';
import { STATS_API_BASE } from '@/lib/stats-api';
import { C_CHAIN_EVM_ID } from './constants';

// --- Stats API ----------------------------------------------------------------

// A cold Stats API read (one not in its response cache) can take 20 s or more; the MCP route stops at 30 s.
const STATS_TIMEOUT_MS = 20_000;

/** GET a Stats API path. Null on 404; any other failure throws with the reason the API gives. */
export async function statsGet<T>(
  path: string,
  params: Record<string, string | number | undefined> = {},
  timeoutMs = STATS_TIMEOUT_MS,
): Promise<T | null> {
  const url = new URL(path, STATS_API_BASE);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') url.searchParams.set(key, String(value));
  }
  const res = await fetch(url, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(timeoutMs) });
  if (res.status === 404) return null;
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: unknown; error?: unknown };
    const reason = [body.message, body.error].find((v): v is string => typeof v === 'string');
    const detail = reason ? ` (${reason.replace(/[^\x20-\x7e]/g, '').slice(0, 160)})` : '';
    throw new Error(`Stats API error: ${res.status} ${res.statusText}${detail}`);
  }
  return (await res.json()) as T;
}

// --- Chain catalog --------------------------------------------------------------

export interface CatalogChain {
  chainId: string | number;
  chainName: string;
  blockchainId?: string;
  subnetId?: string;
  slug?: string;
  isTestnet?: boolean;
  rpcUrl?: string;
  networkToken?: { name?: string; symbol?: string; decimals?: number };
  explorers?: Array<{ name: string; link: string }>;
  description?: string;
  website?: string;
}

/** The local L1 catalog (constants/l1-chains.json). An entry without isTestnet is a mainnet chain. */
export const CHAIN_CATALOG = l1ChainsData as CatalogChain[];

const C_CHAIN_RPC: Record<string, string> = {
  [C_CHAIN_EVM_ID.mainnet]: 'https://api.avax.network/ext/bc/C/rpc',
  [C_CHAIN_EVM_ID.fuji]: 'https://api.avax-test.network/ext/bc/C/rpc',
};

function catalogEntry(chainId: string): CatalogChain | undefined {
  return CHAIN_CATALOG.find((c) => String(c.chainId) === chainId);
}

// --- EVM RPC reads --------------------------------------------------------------

/** The public C-Chain RPC caps eth_getLogs at 100 blocks; the same window is used on every chain. */
export const LOG_BLOCK_WINDOW = 100;

const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const ERC721_INTERFACE = '0x80ac58cd';
const ERC1155_INTERFACE = '0xd9b67a26';
const nftAbi = parseAbi([
  'function supportsInterface(bytes4 interfaceId) view returns (bool)',
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function tokenURI(uint256 tokenId) view returns (string)',
  'function uri(uint256 id) view returns (string)',
]);

type EvmClient = ReturnType<typeof makeClient>;
const clients = new Map<string, EvmClient>();

function makeClient(url: string) {
  // batch: the reads of one lookup go out as one JSON-RPC batch.
  return createPublicClient({ transport: http(url, { batch: { batchSize: 50 }, timeout: 10_000, retryCount: 1 }) });
}

function clientFor(chainId: string): EvmClient {
  const url = C_CHAIN_RPC[chainId] ?? catalogEntry(chainId)?.rpcUrl;
  if (!url) throw new Error(`no public RPC is known for chain ${chainId}`);
  let client = clients.get(url);
  if (!client) {
    client = makeClient(url);
    clients.set(url, client);
  }
  return client;
}

/** A read that may revert (an EOA, or a contract without that function): undefined instead of a throw. */
function optional<T>(read: Promise<T>): Promise<T | undefined> {
  return read.catch(() => undefined);
}

export async function readNativeBalance(chainId: string, address: Address) {
  const balance = await clientFor(chainId).getBalance({ address });
  const token = C_CHAIN_RPC[chainId] ? { symbol: 'AVAX', decimals: 18 } : catalogEntry(chainId)?.networkToken;
  const decimals = token?.decimals ?? 18;
  return {
    balance: balance.toString(),
    balanceFormatted: formatUnits(balance, decimals),
    symbol: token?.symbol,
    decimals,
  };
}

export interface ContractInfo {
  isContract: boolean;
  ercType?: 'ERC-20' | 'ERC-721' | 'ERC-1155' | 'UNKNOWN';
  name?: string;
  symbol?: string;
  decimals?: number;
  totalSupply?: string;
}

/** Bytecode check plus the ERC-20/165 reads, in one batch. */
export async function readContractInfo(chainId: string, address: Address): Promise<ContractInfo> {
  const client = clientFor(chainId);
  const [code, name, symbol, decimals, totalSupply, is721, is1155] = await Promise.all([
    client.getCode({ address }),
    optional(client.readContract({ address, abi: erc20Abi, functionName: 'name' })),
    optional(client.readContract({ address, abi: erc20Abi, functionName: 'symbol' })),
    optional(client.readContract({ address, abi: erc20Abi, functionName: 'decimals' })),
    optional(client.readContract({ address, abi: erc20Abi, functionName: 'totalSupply' })),
    optional(client.readContract({ address, abi: nftAbi, functionName: 'supportsInterface', args: [ERC721_INTERFACE] })),
    optional(client.readContract({ address, abi: nftAbi, functionName: 'supportsInterface', args: [ERC1155_INTERFACE] })),
  ]);
  if (!code || code === '0x') return { isContract: false };
  const ercType = is721 ? 'ERC-721' : is1155 ? 'ERC-1155' : decimals !== undefined ? 'ERC-20' : 'UNKNOWN';
  return { isContract: true, ercType, name, symbol, decimals, totalSupply: totalSupply?.toString() };
}

/** balanceOf, symbol and decimals for each token; tokens with a zero or unreadable balance are left out. */
export async function readErc20Balances(chainId: string, owner: Address, tokens: Address[]) {
  const client = clientFor(chainId);
  const rows = await Promise.all(
    tokens.map(async (address) => {
      const [balance, symbol, decimals] = await Promise.all([
        optional(client.readContract({ address, abi: erc20Abi, functionName: 'balanceOf', args: [owner] })),
        optional(client.readContract({ address, abi: erc20Abi, functionName: 'symbol' })),
        optional(client.readContract({ address, abi: erc20Abi, functionName: 'decimals' })),
      ]);
      if (!balance) return null;
      return {
        address,
        symbol,
        decimals,
        balance: balance.toString(),
        balanceFormatted: decimals !== undefined ? formatUnits(balance, decimals) : undefined,
      };
    }),
  );
  return rows.filter((row) => row !== null);
}

const topicAddress = (topic: string | undefined) => (topic ? `0x${topic.slice(-40)}` : undefined);

/** Transfer logs of a token contract in the last LOG_BLOCK_WINDOW blocks, newest first. */
export async function readRecentTransfers(chainId: string, token: Address, limit: number) {
  const client = clientFor(chainId);
  const head = await client.getBlockNumber();
  const fromBlock = head >= BigInt(LOG_BLOCK_WINDOW) ? head - BigInt(LOG_BLOCK_WINDOW - 1) : 0n;
  const logs = await client.request({
    method: 'eth_getLogs',
    params: [{ address: token, topics: [TRANSFER_TOPIC], fromBlock: toHex(fromBlock), toBlock: toHex(head) }],
  });
  const transfers = logs
    .slice(-limit)
    .reverse()
    .map((log) => ({
      txHash: log.transactionHash,
      blockNumber: log.blockNumber ? Number(log.blockNumber) : undefined,
      logIndex: log.logIndex ? Number(log.logIndex) : undefined,
      from: topicAddress(log.topics[1]),
      to: topicAddress(log.topics[2]),
      // ERC-20 has the amount in data; ERC-721 indexes the token id as a fourth topic.
      ...(log.topics[3] ? { tokenId: BigInt(log.topics[3]).toString() } : { value: BigInt(log.data || '0x0').toString() }),
    }));
  return { fromBlock: Number(fromBlock), toBlock: Number(head), transfers };
}

/** Collection info, plus the owner and metadata URI of one token when tokenId is given. */
export async function readNft(chainId: string, collection: Address, tokenId?: bigint) {
  const client = clientFor(chainId);
  const [info, owner, tokenUri, uri] = await Promise.all([
    readContractInfo(chainId, collection),
    tokenId === undefined ? undefined : optional(client.readContract({ address: collection, abi: nftAbi, functionName: 'ownerOf', args: [tokenId] })),
    tokenId === undefined ? undefined : optional(client.readContract({ address: collection, abi: nftAbi, functionName: 'tokenURI', args: [tokenId] })),
    tokenId === undefined ? undefined : optional(client.readContract({ address: collection, abi: nftAbi, functionName: 'uri', args: [tokenId] })),
  ]);
  return {
    collection: info,
    token: tokenId === undefined ? undefined : { tokenId: tokenId.toString(), owner, tokenUri: tokenUri ?? uri },
  };
}

/** A transaction and its receipt by RPC; null when the node does not know the hash. */
export async function readTransaction(chainId: string, hash: Hash) {
  const client = clientFor(chainId);
  const [tx, receipt] = await Promise.all([
    client.getTransaction({ hash }).catch((err) => {
      if (err instanceof TransactionNotFoundError) return null;
      throw err;
    }),
    client.getTransactionReceipt({ hash }).catch((err) => {
      if (err instanceof TransactionReceiptNotFoundError || err instanceof TransactionNotFoundError) return null;
      throw err;
    }),
  ]);
  if (!tx) return null;
  return {
    hash: tx.hash,
    blockNumber: tx.blockNumber?.toString(),
    from: tx.from,
    to: tx.to,
    value: tx.value.toString(),
    nonce: tx.nonce,
    gasLimit: tx.gas.toString(),
    gasPrice: tx.gasPrice?.toString(),
    input: tx.input,
    gasUsed: receipt?.gasUsed.toString(),
    success: receipt ? receipt.status === 'success' : undefined,
    contractAddress: receipt?.contractAddress ?? undefined,
    logCount: receipt?.logs.length,
  };
}
