import { NextRequest, NextResponse } from "next/server";
import l1ChainsData from "@/constants/l1-chains.json";
import { L1Chain } from "@/types/stats";

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_CONCURRENT_CHAINS = 10;
const RPC_TIMEOUT_MS = 8000;
const SOLOKHIN_TIMEOUT_MS = 8000;
const BLOCKS_PER_CHAIN = 10;
const DAILY_TXS_CACHE_TTL = 300_000; // 5 minutes
const CUMULATIVE_TXS_CACHE_TTL = 30_000; // 30 seconds

// Chains that are mainnet and have an RPC URL
const supportedChains = (l1ChainsData as L1Chain[]).filter(
  (c) => c.rpcUrl && c.isTestnet !== true
);

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface RpcBlock {
  number: string;
  hash: string;
  timestamp: string;
  miner: string;
  transactions: RpcTransaction[];
  gasUsed: string;
  gasLimit: string;
  baseFeePerGas?: string;
}

interface RpcTransaction {
  hash: string;
  from: string;
  to: string | null;
  value: string;
  gas: string;
  gasPrice: string;
  blockNumber: string;
}

interface RpcLog {
  topics: string[];
  transactionHash: string;
  blockNumber: string;
}

export interface Block {
  number: string;
  hash: string;
  timestamp: string;
  miner: string;
  transactionCount: number;
  gasUsed: string;
  gasLimit: string;
  baseFeePerGas?: string;
}

export interface Transaction {
  hash: string;
  from: string;
  to: string | null;
  value: string;
  blockNumber: string;
  timestamp: string;
  gasPrice: string;
  gas: string;
  isCrossChain?: boolean;
  sourceBlockchainId?: string;
  destinationBlockchainId?: string;
}

export interface TransactionHistoryPoint {
  date: string;
  transactions: number;
}

export interface ChainResult {
  stats: {
    latestBlock: number;
    totalTransactions: number;
    avgBlockTime: number;
    gasPrice: string;
  };
  blocks: Block[];
  transactions: Transaction[];
  icmMessages: Transaction[];
  transactionHistory?: TransactionHistoryPoint[];
  tokenSymbol?: string;
  error?: string;
}

export interface AllChainsResponse {
  chains: Record<string, ChainResult>;
  lastUpdated: number;
}

// ─── ICM topic hashes ─────────────────────────────────────────────────────────

const ICM_TOPICS = {
  SendCrossChainMessage:
    "0x2a211ad4a59ab9d003852404f9c57c690704ee755f3c79d2c2812ad32da99df8",
  ReceiveCrossChainMessage:
    "0x292ee90bbaf70b5d4936025e09d56ba08f3e421156b6a568cf3c2840d9343e34",
} as const;

// ─── Module-level caches (persist within a Vercel function instance) ──────────

let dailyTxsCache: {
  data: Map<string, TransactionHistoryPoint[]>;
  timestamp: number;
} | null = null;
// Deduplicate concurrent fetches for the global Solokhin endpoint
let pendingDailyTxsFetch: Promise<Map<string, TransactionHistoryPoint[]>> | null =
  null;

const cumulativeTxsCache = new Map<
  string,
  { count: number; timestamp: number }
>();

// ─── Utility helpers ──────────────────────────────────────────────────────────

function hexToNumber(hex: string): number {
  return parseInt(hex, 16);
}

function formatTimestamp(hex: string): string {
  return new Date(hexToNumber(hex) * 1000).toISOString();
}

function formatValue(hex: string): string {
  return (Number(BigInt(hex)) / 1e18).toFixed(6);
}

function formatGasPrice(hex: string): string {
  return (Number(BigInt(hex)) / 1e9).toFixed(4);
}

function shortenMiner(address: string | null): string {
  if (!address) return "Contract Creation";
  return `${address.slice(0, 10)}...${address.slice(-8)}`;
}

// ─── Concurrency helper (from overview-stats pattern) ────────────────────────

async function processInBatches<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  batchSize: number
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    results.push(...(await Promise.allSettled(batch.map(processor))));
  }
  return results;
}

// ─── RPC helper with timeout ──────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchFromRPC(
  rpcUrl: string,
  method: string,
  params: unknown[] = [],
  timeoutMs = RPC_TIMEOUT_MS
): Promise<any> {
  const signal = AbortSignal.timeout(timeoutMs);
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method, params }),
    signal,
  });
  if (!response.ok) throw new Error(`RPC ${method} failed: ${response.status}`);
  const data = await response.json();
  if (data.error) throw new Error(data.error.message ?? "RPC error");
  return data.result;
}

// ─── Solokhin: global daily txs (called ONCE per request, then cached) ────────

async function fetchDailyTxsByChain(): Promise<
  Map<string, TransactionHistoryPoint[]>
> {
  if (
    dailyTxsCache &&
    Date.now() - dailyTxsCache.timestamp < DAILY_TXS_CACHE_TTL
  ) {
    return dailyTxsCache.data;
  }

  // Deduplicate concurrent in-flight fetches (within the same instance)
  if (pendingDailyTxsFetch) return pendingDailyTxsFetch;

  const pending: Promise<Map<string, TransactionHistoryPoint[]>> = (async () => {
    const result = new Map<string, TransactionHistoryPoint[]>();
    try {
      const signal = AbortSignal.timeout(SOLOKHIN_TIMEOUT_MS);
      const response = await fetch(
        "https://idx6.solokhin.com/api/global/overview/dailyTxsByChainCompact",
        { headers: { Accept: "application/json" }, signal, next: { revalidate: 300 } }
      );
      if (!response.ok) {
        console.warn(`[all-chains] Daily txs API returned ${response.status}`);
        return result;
      }
      const json = await response.json();
      const { dates, chains } = json as {
        dates: string[];
        chains: Array<{ evmChainId: number; values: number[] }>;
      };
      if (!dates?.length || !chains?.length) return result;

      const last14Start = Math.max(0, dates.length - 14);
      const last14Dates = dates.slice(last14Start);

      for (const chain of chains) {
        const chainId = chain.evmChainId.toString();
        const last14Values = chain.values.slice(last14Start);
        result.set(
          chainId,
          last14Dates.map((dateStr, i) => ({
            date: new Date(dateStr).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            }),
            transactions: last14Values[i] ?? 0,
          }))
        );
      }
      dailyTxsCache = { data: result, timestamp: Date.now() };
      return result;
    } catch (err) {
      console.warn("[all-chains] Failed to fetch daily txs:", err);
      return result;
    } finally {
      pendingDailyTxsFetch = null;
    }
  })();

  pendingDailyTxsFetch = pending;
  return pending;
}

// ─── Solokhin: per-chain cumulative tx count (cached 30s) ─────────────────────

async function fetchCumulativeTxs(chainId: string): Promise<number> {
  const cached = cumulativeTxsCache.get(chainId);
  if (cached && Date.now() - cached.timestamp < CUMULATIVE_TXS_CACHE_TTL) {
    return cached.count;
  }
  try {
    const signal = AbortSignal.timeout(5000);
    const response = await fetch(
      `https://idx6.solokhin.com/api/${chainId}/stats/cumulative-txs`,
      {
        headers: { Accept: "application/json" },
        signal,
        next: { revalidate: 30 },
      }
    );
    if (!response.ok) return 0;
    const data = await response.json();
    const count: number = data.cumulativeTxs ?? 0;
    cumulativeTxsCache.set(chainId, { count, timestamp: Date.now() });
    return count;
  } catch {
    return 0;
  }
}

// ─── ICM: fetch historical messages via eth_getLogs ───────────────────────────

async function fetchHistoricalIcmMessages(
  rpcUrl: string,
  latestBlockNumber: number,
  blockchainId?: string,
  blockRange = 512
): Promise<Transaction[]> {
  try {
    const fromBlock = Math.max(0, latestBlockNumber - blockRange);
    const logs = (await fetchFromRPC(
      rpcUrl,
      "eth_getLogs",
      [
        {
          fromBlock: `0x${fromBlock.toString(16)}`,
          toBlock: `0x${latestBlockNumber.toString(16)}`,
          topics: [
            [ICM_TOPICS.SendCrossChainMessage, ICM_TOPICS.ReceiveCrossChainMessage],
          ],
          limit: 10,
        },
      ],
      RPC_TIMEOUT_MS
    )) as RpcLog[];

    if (!logs?.length) return [];

    // Take the 10 most-recent unique tx hashes
    const seenHashes = new Set<string>();
    const recentLogs: RpcLog[] = [];
    for (let i = logs.length - 1; i >= 0 && seenHashes.size < 10; i--) {
      const log = logs[i];
      if (!seenHashes.has(log.transactionHash)) {
        seenHashes.add(log.transactionHash);
        recentLogs.push(log);
      }
    }

    const txHashes = recentLogs.map((l) => l.transactionHash);
    const blockNums = recentLogs.map((l) => l.blockNumber);
    const logByHash = new Map(recentLogs.map((l) => [l.transactionHash, l]));

    const [txResults, blockResults] = await Promise.all([
      Promise.allSettled(
        txHashes.map((hash) =>
          fetchFromRPC(rpcUrl, "eth_getTransactionByHash", [hash])
        )
      ),
      Promise.allSettled(
        blockNums.map((num) =>
          fetchFromRPC(rpcUrl, "eth_getBlockByNumber", [num, false])
        )
      ),
    ]);

    const transactions: Transaction[] = [];
    for (let i = 0; i < txHashes.length; i++) {
      const txRes = txResults[i];
      const blkRes = blockResults[i];
      const log = logByHash.get(txHashes[i]);
      if (txRes.status !== "fulfilled" || !txRes.value || !log) continue;

      const tx = txRes.value as RpcTransaction;
      const blk = blkRes.status === "fulfilled" ? (blkRes.value as { timestamp: string } | null) : null;

      const topic0 = log.topics[0]?.toLowerCase();
      let sourceBlockchainId: string | undefined;
      let destinationBlockchainId: string | undefined;
      if (topic0 === ICM_TOPICS.SendCrossChainMessage.toLowerCase()) {
        sourceBlockchainId = blockchainId;
        destinationBlockchainId = log.topics[2];
      } else if (topic0 === ICM_TOPICS.ReceiveCrossChainMessage.toLowerCase()) {
        destinationBlockchainId = blockchainId;
        sourceBlockchainId = log.topics[2];
      }

      transactions.push({
        hash: tx.hash,
        from: tx.from,
        to: tx.to,
        value: formatValue(tx.value || "0x0"),
        blockNumber: hexToNumber(tx.blockNumber).toString(),
        timestamp: formatTimestamp(blk?.timestamp ?? "0x0"),
        gasPrice: formatGasPrice(tx.gasPrice || "0x0"),
        gas: hexToNumber(tx.gas || "0x0").toLocaleString(),
        isCrossChain: true,
        sourceBlockchainId,
        destinationBlockchainId,
      });
    }
    return transactions;
  } catch (err) {
    console.warn(`[all-chains] ICM fetch failed for ${rpcUrl}:`, err);
    return [];
  }
}

// ─── Per-chain data fetch ─────────────────────────────────────────────────────

async function fetchSingleChainData(
  chain: L1Chain,
  lastFetchedBlock: number | undefined,
  initialLoad: boolean,
  dailyTxs: Map<string, TransactionHistoryPoint[]>
): Promise<ChainResult> {
  const rpcUrl = chain.rpcUrl!;
  const chainId = chain.chainId;

  // 1. Get latest block number
  const latestBlockHex = (await fetchFromRPC(rpcUrl, "eth_blockNumber")) as string;
  const latestBlockNumber = hexToNumber(latestBlockHex);

  // 2. Short-circuit if nothing new
  if (lastFetchedBlock !== undefined && lastFetchedBlock >= latestBlockNumber) {
    return {
      stats: { latestBlock: latestBlockNumber, totalTransactions: 0, avgBlockTime: 0, gasPrice: "0 Gwei" },
      blocks: [],
      transactions: [],
      icmMessages: [],
      tokenSymbol: chain.networkToken?.symbol,
    };
  }

  // 3. Determine how many blocks to fetch (cap at 50 to prevent request explosion)
  let blocksToFetch = BLOCKS_PER_CHAIN;
  if (lastFetchedBlock !== undefined && lastFetchedBlock > 0) {
    blocksToFetch = Math.min(latestBlockNumber - lastFetchedBlock, 50);
  }

  // 4. Fetch blocks in parallel
  const blockPromises: Promise<RpcBlock | null>[] = [];
  for (let i = 0; i < blocksToFetch; i++) {
    const blockNum = latestBlockNumber - i;
    blockPromises.push(
      (fetchFromRPC(rpcUrl, "eth_getBlockByNumber", [
        `0x${blockNum.toString(16)}`,
        true,
      ]) as Promise<RpcBlock>).catch(() => null)
    );
  }
  const rawBlocks = await Promise.all(blockPromises);
  const validBlocks = rawBlocks.filter((b): b is RpcBlock => b !== null);

  // 5. Build Block objects (no receipt fetching — avoids per-tx RPC explosion)
  const blocks: Block[] = validBlocks.map((block) => ({
    number: hexToNumber(block.number).toString(),
    hash: block.hash,
    timestamp: formatTimestamp(block.timestamp),
    miner: shortenMiner(block.miner),
    transactionCount: block.transactions?.length ?? 0,
    gasUsed: hexToNumber(block.gasUsed).toLocaleString(),
    gasLimit: hexToNumber(block.gasLimit).toLocaleString(),
    baseFeePerGas: block.baseFeePerGas
      ? formatGasPrice(block.baseFeePerGas)
      : undefined,
  }));

  // 6. Extract up to 10 transactions from the fetched blocks
  const transactions: Transaction[] = [];
  outer: for (const block of validBlocks) {
    for (const tx of block.transactions ?? []) {
      if (transactions.length >= 10) break outer;
      transactions.push({
        hash: tx.hash,
        from: tx.from,
        to: tx.to,
        value: formatValue(tx.value || "0x0"),
        blockNumber: hexToNumber(tx.blockNumber).toString(),
        timestamp: formatTimestamp(block.timestamp),
        gasPrice: formatGasPrice(tx.gasPrice || "0x0"),
        gas: hexToNumber(tx.gas || "0x0").toLocaleString(),
      });
    }
  }

  // 7. Fetch ICM messages (initial load only, via eth_getLogs)
  // This is an intentional trade-off: eth_getLogs + N eth_getTransactionByHash calls
  // are expensive per chain. Running them on every 15s poll across 50+ chains would
  // recreate the request explosion this route was built to avoid. New ICM messages
  // that arrive during a session won't appear until the user refreshes the page.
  let icmMessages: Transaction[] = [];
  if (initialLoad) {
    icmMessages = await fetchHistoricalIcmMessages(
      rpcUrl,
      latestBlockNumber,
      chain.blockchainId
    );
  }

  // 8. Fetch cumulative tx count (uses module-level cache)
  const totalTransactions = await fetchCumulativeTxs(chainId);

  // 9. Return per-chain transaction history only on initial load
  const transactionHistory = initialLoad
    ? dailyTxs.get(chainId) ?? []
    : undefined;

  return {
    stats: {
      latestBlock: latestBlockNumber,
      totalTransactions,
      avgBlockTime: 0,
      gasPrice: "0 Gwei",
    },
    blocks,
    transactions,
    icmMessages,
    transactionHistory,
    tokenSymbol: chain.networkToken?.symbol,
  };
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const initialLoad = searchParams.get("initialLoad") === "true";

    // Parse lastFetchedBlocks: { [chainId]: blockNumberAsString }
    let lastFetchedBlocks: Record<string, number> = {};
    const rawParam = searchParams.get("lastFetchedBlocks");
    if (rawParam) {
      try {
        const parsed = JSON.parse(rawParam) as Record<string, string>;
        for (const [id, val] of Object.entries(parsed)) {
          const n = parseInt(val, 10);
          if (!isNaN(n)) lastFetchedBlocks[id] = n;
        }
      } catch {
        // Malformed JSON — treat as empty (behave like initial load)
      }
    }

    // Fetch the global Solokhin endpoint ONCE for all chains
    const dailyTxs = await fetchDailyTxsByChain();

    // Fan-out per-chain RPC calls with concurrency cap of MAX_CONCURRENT_CHAINS
    const settledResults = await processInBatches(
      supportedChains,
      (chain) =>
        fetchSingleChainData(
          chain,
          lastFetchedBlocks[chain.chainId],
          initialLoad,
          dailyTxs
        ),
      MAX_CONCURRENT_CHAINS
    );

    // Build the chains map; failed chains get a minimal error entry
    const chains: Record<string, ChainResult> = {};
    for (let i = 0; i < supportedChains.length; i++) {
      const chain = supportedChains[i];
      const result = settledResults[i];
      if (result.status === "fulfilled") {
        chains[chain.chainId] = result.value;
      } else {
        const reason = result.reason;
        chains[chain.chainId] = {
          stats: { latestBlock: 0, totalTransactions: 0, avgBlockTime: 0, gasPrice: "0" },
          blocks: [],
          transactions: [],
          icmMessages: [],
          tokenSymbol: chain.networkToken?.symbol,
          error:
            reason instanceof Error ? reason.message : "fetch failed",
        };
      }
    }

    const body: AllChainsResponse = { chains, lastUpdated: Date.now() };

    return NextResponse.json(body, {
      headers: {
        // Allow CDN/browser to cache for 15s and serve stale up to 60s while revalidating
        "Cache-Control": "public, max-age=15, stale-while-revalidate=60",
        "X-Chain-Count": supportedChains.length.toString(),
        "X-Data-Source": "fresh",
      },
    });
  } catch (error) {
    console.error("[all-chains] Unhandled error:", error);
    return NextResponse.json(
      { error: "Failed to fetch all-chains data" },
      {
        status: 503,
        headers: { "Retry-After": "30" },
      }
    );
  }
}
