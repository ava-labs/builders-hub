import { NextRequest, NextResponse } from "next/server";
import { Avalanche } from "@avalanche-sdk/chainkit";
import l1ChainsData from "@/constants/l1-chains.json";

// Initialize Avalanche SDK
const avalanche = new Avalanche({
  network: "mainnet",
});

interface Block {
  number: string;
  hash: string;
  timestamp: string;
  miner: string;
  transactionCount: number;
  gasUsed: string;
  gasLimit: string;
  baseFeePerGas?: string;
  gasFee?: string; // Total gas fee in native token (sum of all tx fees)
}

interface RpcTransaction {
  hash: string;
  from: string;
  to: string | null;
  value: string;
  gas: string;
  gasPrice: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  nonce: string;
  blockNumber: string;
  blockHash: string;
  transactionIndex: string;
  input: string;
  type?: string;
  accessList?: unknown[];
  chainId?: string;
  v?: string;
  r?: string;
  s?: string;
  yParity?: string;
}

interface RpcLog {
  address: string;
  topics: string[];
  data: string;
  logIndex: string;
  transactionIndex: string;
  transactionHash: string;
  blockHash: string;
  blockNumber: string;
}

interface RpcTransactionReceipt {
  transactionHash: string;
  gasUsed: string;
  effectiveGasPrice: string;
  status: string;
  logs: RpcLog[];
}

// Cross-chain event topic hashes (from generated signatures)
const CROSS_CHAIN_TOPICS = {
  // TeleporterMessenger events
  SendCrossChainMessage: '0x2a211ad4a59ab9d003852404f9c57c690704ee755f3c79d2c2812ad32da99df8',
  ReceiveCrossChainMessage: '0x292ee90bbaf70b5d4936025e09d56ba08f3e421156b6a568cf3c2840d9343e34',
  MessageExecuted: '0x34795cc6b122b9a0ae684946319f1e14a577b4e8f9b3dda9ac94c21a54d3188c',
  ReceiptReceived: '0xd13a7935f29af029349bed0a2097455b91fd06190a30478c575db3f31e00bf57',
  // Token transfer events from ERC20TokenHome, NativeTokenHome, ERC20TokenRemote, NativeTokenRemote
  // These events share the same signature across all four contracts
  TokensSent: '0x93f19bf1ec58a15dc643b37e7e18a1c13e85e06cd11929e283154691ace9fb52',
  TokensAndCallSent: '0x5d76dff81bf773b908b050fa113d39f7d8135bb4175398f313ea19cd3a1a0b16',
};

interface RpcBlock {
  number: string;
  hash: string;
  parentHash: string;
  timestamp: string;
  miner: string;
  transactions: RpcTransaction[];
  gasUsed: string;
  gasLimit: string;
  baseFeePerGas?: string;
}

interface Transaction {
  hash: string;
  from: string;
  to: string | null;
  value: string;
  blockNumber: string;
  timestamp: string;
  gasPrice: string;
  gas: string;
  isCrossChain?: boolean;
  // Cross-chain info (for ICM messages) - blockchain IDs in hex format
  sourceBlockchainId?: string;
  destinationBlockchainId?: string;
}

interface ExplorerStats {
  latestBlock: number;
  totalTransactions: number;
  avgBlockTime: number;
  gasPrice: string;
  tps: number;
  lastFinalizedBlock?: number;
  totalGasFeesInBlocks?: string; // Total gas fees for latest blocks in native token
}

interface TransactionHistoryPoint {
  date: string;
  transactions: number;
}

interface PriceData {
  price: number;
  priceInAvax?: number;
  change24h: number;
  marketCap: number;
  volume24h: number;
  totalSupply?: number;
  symbol?: string;
}

interface ExplorerData {
  stats: ExplorerStats;
  blocks: Block[];
  transactions: Transaction[];
  icmMessages: Transaction[]; // Cross-chain transactions
  transactionHistory: TransactionHistoryPoint[];
  price?: PriceData;
  tokenSymbol?: string;
}

interface ChainConfig {
  chainId: string;
  chainName: string;
  rpcUrl?: string;
  coingeckoId?: string;
  tokenSymbol?: string;
  blockchainId?: string;
}

// Cache for explorer data
const cache = new Map<string, { data: ExplorerData; timestamp: number }>();
const priceCache = new Map<string, { data: PriceData; timestamp: number }>();
const CACHE_TTL = 10000; // 10 seconds
const PRICE_CACHE_TTL = 60000; // 60 seconds

async function fetchFromRPC(rpcUrl: string, method: string, params: any[] = []): Promise<any> {
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: Date.now(),
      method,
      params,
    }),
  });

  if (!response.ok) {
    throw new Error(`RPC request failed: ${response.status}`);
  }

  const data = await response.json();
  if (data.error) {
    throw new Error(data.error.message || "RPC error");
  }

  return data.result;
}

function hexToNumber(hex: string): number {
  return parseInt(hex, 16);
}

function hexToBigInt(hex: string): bigint {
  return BigInt(hex);
}

function formatTimestamp(hex: string): string {
  const timestamp = hexToNumber(hex);
  return new Date(timestamp * 1000).toISOString();
}

function formatValue(hex: string): string {
  const wei = hexToBigInt(hex);
  const eth = Number(wei) / 1e18;
  return eth.toFixed(6);
}

function formatGasPrice(hex: string): string {
  const wei = hexToBigInt(hex);
  const gwei = Number(wei) / 1e9;
  return gwei.toFixed(4);
}

function shortenAddress(address: string | null): string {
  if (!address) return "Contract Creation";
  return `${address.slice(0, 10)}...${address.slice(-8)}`;
}

// Cache for AVAX price
let avaxPriceCache: { price: number; timestamp: number } | null = null;

// Cache for daily transactions
let dailyTxsCache: { data: Map<string, TransactionHistoryPoint[]>; timestamp: number } | null = null;
const DAILY_TXS_CACHE_TTL = 300000; // 5 minutes

// Cache for cumulative transactions
const cumulativeTxsCache = new Map<string, { cumulativeTxs: number; timestamp: number }>();
const CUMULATIVE_TXS_CACHE_TTL = 30000; // 30 seconds

interface DailyTxsResponse {
  dates: string[];
  chains: Array<{
    evmChainId: number;
    name: string;
    values: number[];
  }>;
}

async function fetchCumulativeTxs(evmChainId: string): Promise<number> {
  // Check cache
  const cached = cumulativeTxsCache.get(evmChainId);
  if (cached && Date.now() - cached.timestamp < CUMULATIVE_TXS_CACHE_TTL) {
    return cached.cumulativeTxs;
  }

  try {
    const response = await fetch(
      `https://idx6.solokhin.com/api/${evmChainId}/stats/cumulative-txs`,
      {
        headers: { 'Accept': 'application/json' },
        next: { revalidate: 30 }
      }
    );

    if (!response.ok) {
      console.warn(`Cumulative txs API error for chain ${evmChainId}: ${response.status}`);
      return 0;
    }

    const data = await response.json();
    const cumulativeTxs = data.cumulativeTxs || 0;

    // Update cache
    cumulativeTxsCache.set(evmChainId, { cumulativeTxs, timestamp: Date.now() });
    return cumulativeTxs;
  } catch (error) {
    console.warn(`Failed to fetch cumulative txs for chain ${evmChainId}:`, error);
    return 0;
  }
}

async function fetchDailyTxsByChain(): Promise<Map<string, TransactionHistoryPoint[]>> {
  // Check cache
  if (dailyTxsCache && Date.now() - dailyTxsCache.timestamp < DAILY_TXS_CACHE_TTL) {
    return dailyTxsCache.data;
  }

  const result = new Map<string, TransactionHistoryPoint[]>();

  try {
    const response = await fetch(
      'https://idx6.solokhin.com/api/global/overview/dailyTxsByChainCompact',
      {
        headers: { 'Accept': 'application/json' },
        next: { revalidate: 300 }
      }
    );

    if (!response.ok) {
      console.warn(`Daily txs API error: ${response.status}`);
      return result;
    }

    const json: DailyTxsResponse = await response.json();
    const { dates, chains } = json;

    if (!dates || !chains || dates.length === 0) {
      return result;
    }

    // Get last 14 days of data
    const last14DatesStart = Math.max(0, dates.length - 14);
    const last14Dates = dates.slice(last14DatesStart);

    // Process each chain
    for (const chain of chains) {
      const chainId = chain.evmChainId.toString();
      const last14Values = chain.values.slice(last14DatesStart);
      
      const history: TransactionHistoryPoint[] = last14Dates.map((dateStr, index) => {
        // Parse date string (format: "2024-11-27") and format to "Nov 27"
        const d = new Date(dateStr);
        const formattedDate = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        
        return {
          date: formattedDate,
          transactions: last14Values[index] || 0,
        };
      });

      result.set(chainId, history);
    }

    // Update cache
    dailyTxsCache = { data: result, timestamp: Date.now() };
    return result;
  } catch (error) {
    console.warn("Failed to fetch daily txs:", error);
    return result;
  }
}

async function fetchAvaxPrice(): Promise<number> {
  // Check AVAX price cache
  if (avaxPriceCache && Date.now() - avaxPriceCache.timestamp < PRICE_CACHE_TTL) {
    return avaxPriceCache.price;
  }

  try {
    const response = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=avalanche-2&vs_currencies=usd',
      {
        headers: { 'Accept': 'application/json' },
        next: { revalidate: 60 }
      }
    );

    if (response.ok) {
      const data = await response.json();
      const price = data['avalanche-2']?.usd || 0;
      avaxPriceCache = { price, timestamp: Date.now() };
      return price;
    }
  } catch (error) {
    console.warn("Failed to fetch AVAX price:", error);
  }
  return 0;
}

async function fetchPrice(coingeckoId: string): Promise<PriceData | undefined> {
  // Check price cache first
  const cached = priceCache.get(coingeckoId);
  if (cached && Date.now() - cached.timestamp < PRICE_CACHE_TTL) {
    return cached.data;
  }

  try {
    // Fetch price data with more details
    const response = await fetch(
      `https://api.coingecko.com/api/v3/coins/${coingeckoId}?localization=false&tickers=false&community_data=false&developer_data=false&sparkline=false`,
      {
        headers: {
          'Accept': 'application/json',
        },
        next: { revalidate: 60 }
      }
    );

    if (!response.ok) {
      console.warn(`CoinGecko API error: ${response.status}`);
      return undefined;
    }

    const data = await response.json();
    const priceUsd = data.market_data?.current_price?.usd || 0;
    
    // Fetch AVAX price to calculate token price in AVAX
    const avaxPrice = await fetchAvaxPrice();
    const priceInAvax = avaxPrice > 0 ? priceUsd / avaxPrice : undefined;
    
    const priceData: PriceData = {
      price: priceUsd,
      priceInAvax,
      change24h: data.market_data?.price_change_percentage_24h || 0,
      marketCap: data.market_data?.market_cap?.usd || 0,
      volume24h: data.market_data?.total_volume?.usd || 0,
      totalSupply: data.market_data?.total_supply || 0,
      symbol: data.symbol?.toUpperCase() || undefined,
    };

    // Cache the price
    priceCache.set(coingeckoId, { data: priceData, timestamp: Date.now() });
    return priceData;
  } catch (error) {
    console.warn("Failed to fetch price:", error);
    return undefined;
  }
}

async function fetchExplorerData(chainId: string, evmChainId: string, rpcUrl: string, coingeckoId?: string, tokenSymbol?: string, currentBlockchainId?: string): Promise<ExplorerData> {
  // Get latest block number
  const latestBlockHex = await fetchFromRPC(rpcUrl, "eth_blockNumber");
  const latestBlockNumber = hexToNumber(latestBlockHex);

  // Fetch latest 10 blocks with full transaction objects (using true parameter)
  const blockPromises: Promise<RpcBlock>[] = [];
  for (let i = 0; i < 10; i++) {
    const blockNum = latestBlockNumber - i;
    if (blockNum >= 0) {
      blockPromises.push(fetchFromRPC(rpcUrl, "eth_getBlockByNumber", [`0x${blockNum.toString(16)}`, true]));
    }
  }

  const blockResults = await Promise.all(blockPromises);
  const validBlocks = blockResults.filter(block => block !== null);

  // Collect all transaction hashes from all blocks for receipt fetching
  const allTxHashes: { blockIndex: number; txHash: string }[] = [];
  for (let blockIndex = 0; blockIndex < validBlocks.length; blockIndex++) {
    const block = validBlocks[blockIndex];
    if (block?.transactions) {
      for (const tx of block.transactions) {
        allTxHashes.push({ blockIndex, txHash: tx.hash });
      }
    }
  }

  // Fetch all transaction receipts in parallel
  const receiptPromises = allTxHashes.map(({ txHash }) =>
    fetchFromRPC(rpcUrl, "eth_getTransactionReceipt", [txHash]).catch(() => null) as Promise<RpcTransactionReceipt | null>
  );
  const receipts = await Promise.all(receiptPromises);

  // Create a map of txHash -> receipt for quick lookup
  const receiptMap = new Map<string, RpcTransactionReceipt>();
  for (let i = 0; i < allTxHashes.length; i++) {
    const receipt = receipts[i];
    if (receipt) {
      receiptMap.set(allTxHashes[i].txHash, receipt);
    }
  }

  // Calculate gas fees per block by summing transaction fees
  const blockGasFees = new Map<number, bigint>();
  for (let i = 0; i < allTxHashes.length; i++) {
    const { blockIndex, txHash } = allTxHashes[i];
    const receipt = receiptMap.get(txHash);
    if (receipt && receipt.gasUsed && receipt.effectiveGasPrice) {
      const gasUsed = BigInt(receipt.gasUsed);
      const effectiveGasPrice = BigInt(receipt.effectiveGasPrice);
      const txFee = gasUsed * effectiveGasPrice;
      const currentFee = blockGasFees.get(blockIndex) || BigInt(0);
      blockGasFees.set(blockIndex, currentFee + txFee);
    }
  }

  // Build Block array with gas fees from receipts
  const blocks: Block[] = validBlocks.map((block, blockIndex) => {
    const gasFeeWei = blockGasFees.get(blockIndex) || BigInt(0);
    const gasFee = gasFeeWei > 0 ? (Number(gasFeeWei) / 1e18).toFixed(6) : undefined;
    
    return {
      number: hexToNumber(block.number).toString(),
      hash: block.hash,
      timestamp: formatTimestamp(block.timestamp),
      miner: shortenAddress(block.miner),
      transactionCount: block.transactions?.length || 0,
      gasUsed: hexToNumber(block.gasUsed).toLocaleString(),
      gasLimit: hexToNumber(block.gasLimit).toLocaleString(),
      baseFeePerGas: block.baseFeePerGas ? formatGasPrice(block.baseFeePerGas) : undefined,
      gasFee,
    };
  });

  // Extract transactions from blocks
  const allTransactions: (RpcTransaction & { blockTimestamp: string })[] = [];
  for (const block of validBlocks) {
    if (block?.transactions) {
      for (const tx of block.transactions) {
        allTransactions.push({ ...tx, blockTimestamp: block.timestamp });
      }
    }
  }

  // Helper function to check if a transaction has cross-chain events
  function isCrossChainTx(txHash: string): boolean {
    const receipt = receiptMap.get(txHash);
    if (!receipt?.logs) return false;
    
    const crossChainTopics = Object.values(CROSS_CHAIN_TOPICS).map(t => t.toLowerCase());
    return receipt.logs.some(log => 
      log.topics?.[0] && crossChainTopics.includes(log.topics[0].toLowerCase())
    );
  }

  // Helper function to extract blockchain IDs from SendCrossChainMessage or ReceiveCrossChainMessage logs
  function extractCrossChainInfo(txHash: string): {
    sourceBlockchainId?: string;
    destinationBlockchainId?: string;
  } {
    const receipt = receiptMap.get(txHash);
    if (!receipt?.logs) return {};

    const sendTopic = CROSS_CHAIN_TOPICS.SendCrossChainMessage.toLowerCase();
    const receiveTopic = CROSS_CHAIN_TOPICS.ReceiveCrossChainMessage.toLowerCase();

    let sourceBlockchainId: string | undefined;
    let destinationBlockchainId: string | undefined;

    for (const log of receipt.logs) {
      const topic0 = log.topics?.[0]?.toLowerCase();
      if (!topic0) continue;

      if (topic0 === sendTopic) {
        // SendCrossChainMessage: current chain is the source, destination is in topic[2]
        sourceBlockchainId = currentBlockchainId;
        if (log.topics.length > 2) {
          destinationBlockchainId = log.topics[2];
        }
      } else if (topic0 === receiveTopic) {
        // ReceiveCrossChainMessage: current chain is the destination, source is in topic[2]
        destinationBlockchainId = currentBlockchainId;
        if (log.topics.length > 2) {
          sourceBlockchainId = log.topics[2];
        }
      }
    }

    return { sourceBlockchainId, destinationBlockchainId };
  }

  // Map all transactions first to check cross-chain status
  const allMappedTransactions: Transaction[] = allTransactions.map(tx => {
    const isCrossChain = isCrossChainTx(tx.hash);
    const baseTx: Transaction = {
      hash: tx.hash,
      from: tx.from,
      to: tx.to,
      value: formatValue(tx.value || "0x0"),
      blockNumber: hexToNumber(tx.blockNumber).toString(),
      timestamp: formatTimestamp(tx.blockTimestamp),
      gasPrice: formatGasPrice(tx.gasPrice || "0x0"),
      gas: hexToNumber(tx.gas || "0x0").toLocaleString(),
      isCrossChain,
    };

    // For cross-chain transactions, extract chain info
    if (isCrossChain) {
      const chainInfo = extractCrossChainInfo(tx.hash);
      return { ...baseTx, ...chainInfo };
    }

    return baseTx;
  });

  // Separate cross-chain transactions (ICM messages) from all transactions
  const icmMessages = allMappedTransactions.filter(tx => tx.isCrossChain);
  
  // Get latest 10 non-cross-chain transactions
  const transactions = allMappedTransactions
    .slice(0, 10);

  // Get current gas price
  let gasPrice = "0";
  try {
    const gasPriceHex = await fetchFromRPC(rpcUrl, "eth_gasPrice");
    gasPrice = formatGasPrice(gasPriceHex);
  } catch {
    // Some chains might not support eth_gasPrice
  }

  // Calculate average block time from last 10 blocks
  let avgBlockTime = 2; // Default
  if (blocks.length >= 2) {
    const timestamps = blocks.map(b => new Date(b.timestamp).getTime() / 1000);
    const timeDiffs: number[] = [];
    for (let i = 0; i < timestamps.length - 1; i++) {
      timeDiffs.push(timestamps[i] - timestamps[i + 1]);
    }
    avgBlockTime = timeDiffs.reduce((a, b) => a + b, 0) / timeDiffs.length;
  }

  // Calculate TPS from recent blocks
  let tps = 0;
  if (blocks.length >= 2 && avgBlockTime > 0) {
    const totalTxs = blocks.reduce((sum, b) => sum + b.transactionCount, 0);
    const totalTime = blocks.length * avgBlockTime;
    tps = totalTxs / totalTime;
  }

  // Fetch real cumulative transactions from API
  const totalTransactions = await fetchCumulativeTxs(evmChainId);

  // Calculate total gas fees for latest blocks by summing all block fees
  let totalGasFeesWei = BigInt(0);
  for (const gasFee of blockGasFees.values()) {
    totalGasFeesWei += gasFee;
  }
  // Convert from wei to native token (divide by 1e18)
  const totalGasFeesInBlocks = (Number(totalGasFeesWei) / 1e18).toFixed(6);

  const stats: ExplorerStats = {
    latestBlock: latestBlockNumber,
    totalTransactions,
    avgBlockTime: Math.round(avgBlockTime * 100) / 100,
    totalGasFeesInBlocks,
    gasPrice: `${gasPrice} Gwei`,
    tps: Math.round(tps * 100) / 100,
    lastFinalizedBlock: latestBlockNumber - 2, // Approximate finalized block
  };

  // Fetch real daily transaction history
  const dailyTxsData = await fetchDailyTxsByChain();
  const transactionHistory: TransactionHistoryPoint[] = dailyTxsData.get(evmChainId) || [];

  // Fetch price if coingeckoId is available
  let price: PriceData | undefined;
  if (coingeckoId) {
    price = await fetchPrice(coingeckoId);
  }

  return { 
    stats, 
    blocks, 
    transactions, 
    icmMessages,
    transactionHistory, 
    price,
    tokenSymbol: price?.symbol || tokenSymbol
  };
}

// Check if Glacier supports this chain
async function checkGlacierSupport(chainId: string): Promise<boolean> {
  try {
    const result = await avalanche.data.evm.chains.get({
      chainId: chainId,
    });
    // If we get a result with a chainId, the chain is supported
    return !!result?.chainId;
  } catch (error) {
    // Chain not supported by Glacier
    return false;
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ chainId: string }> }
) {
  try {
    const { chainId } = await params;
    
    // Find chain config
    const chain = l1ChainsData.find(c => c.chainId === chainId) as ChainConfig | undefined;
    if (!chain) {
      return NextResponse.json({ error: "Chain not found" }, { status: 404 });
    }

    const rpcUrl = chain.rpcUrl;
    if (!rpcUrl) {
      return NextResponse.json({ error: "RPC URL not configured" }, { status: 400 });
    }

    // Check cache
    const cached = cache.get(chainId);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return NextResponse.json(cached.data);
    }

    // Fetch fresh data and check Glacier support in parallel
    const [data, glacierSupported] = await Promise.all([
      fetchExplorerData(chainId, chainId, rpcUrl, chain.coingeckoId, chain.tokenSymbol, chain.blockchainId),
      checkGlacierSupport(chainId),
    ]);

    // Add glacierSupported to the response
    const responseData = { ...data, glacierSupported };

    // Update cache
    cache.set(chainId, { data: responseData, timestamp: Date.now() });

    return NextResponse.json(responseData);
  } catch (error) {
    console.error("Explorer API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch explorer data" },
      { status: 500 }
    );
  }
}
