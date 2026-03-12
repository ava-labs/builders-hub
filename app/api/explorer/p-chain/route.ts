import { NextRequest, NextResponse } from 'next/server';
import {
  PChainNetwork,
  getHeight,
  getBlockByHeight,
  getCurrentValidators,
  getSubnets,
  getTotalStake,
  getCurrentSupply,
  getMinStake,
  formatAvax as formatNAvax,
  nAvaxToAvax,
} from '@/lib/pchain/rpc';
import { decodePChainTx, getTxTypeDescription, type DecodedTransaction } from '@/lib/pchain/txDecoder';

// Helper to format AVAX values that are already converted (not nAVAX)
function formatAvaxValue(avax: number, decimals: number = 4): string {
  if (avax === 0) return '0';
  if (avax < 0.0001) return '<0.0001';
  return avax.toLocaleString(undefined, { 
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals 
  });
}

// ============================================================================
// Types
// ============================================================================

interface PChainStats {
  height: number;
  totalStake: string;
  totalStakeAvax: number;
  currentSupply: string;
  currentSupplyAvax: number;
  validatorCount: number;
  delegatorCount: number;
  subnetCount: number;
  minValidatorStake: string;
  minDelegatorStake: string;
}

interface PChainBlockSummary {
  height: number;
  parentId: string;
  timestamp?: string;
  txCount: number;
  transactions: TransactionSummary[];
}

interface TransactionSummary {
  txId: string;
  type: string;
  typeDescription: string;
  summary: string;
  fee: number;
  timestamp?: string;
}

interface PChainExplorerData {
  network: PChainNetwork;
  stats: PChainStats;
  latestBlocks: PChainBlockSummary[];
  recentTransactions: TransactionSummary[];
}

// ============================================================================
// Cache
// ============================================================================

interface CacheEntry {
  data: PChainExplorerData;
  timestamp: number;
}

const cache: Record<string, CacheEntry> = {};
const CACHE_TTL = 10000; // 10 seconds

function getCachedData(network: PChainNetwork): PChainExplorerData | null {
  const entry = cache[network];
  if (entry && Date.now() - entry.timestamp < CACHE_TTL) {
    return entry.data;
  }
  return null;
}

function setCachedData(network: PChainNetwork, data: PChainExplorerData): void {
  cache[network] = {
    data,
    timestamp: Date.now(),
  };
}

// ============================================================================
// Data Fetching
// ============================================================================

async function fetchPChainData(network: PChainNetwork): Promise<PChainExplorerData> {
  // Fetch basic stats in parallel
  const [
    height,
    totalStake,
    currentSupply,
    validatorsResult,
    subnetsResult,
    minStakeResult,
  ] = await Promise.all([
    getHeight(network),
    getTotalStake(undefined, network),
    getCurrentSupply(network),
    getCurrentValidators(undefined, undefined, network),
    getSubnets(undefined, network),
    getMinStake(network),
  ]);

  // Calculate delegator count using delegatorCount field (not the delegators array)
  const delegatorCount = validatorsResult.validators.reduce((count, v) => {
    // Use delegatorCount string field if available, otherwise fall back to delegators array length
    const vDelegatorCount = v.delegatorCount ? parseInt(v.delegatorCount, 10) : (v.delegators?.length || 0);
    return count + vDelegatorCount;
  }, 0);

  // Build stats
  const stats: PChainStats = {
    height,
    totalStake: totalStake.toString(),
    totalStakeAvax: nAvaxToAvax(totalStake),
    currentSupply: currentSupply.toString(),
    currentSupplyAvax: nAvaxToAvax(currentSupply),
    validatorCount: validatorsResult.validators.length,
    delegatorCount,
    subnetCount: subnetsResult.subnets.length,
    minValidatorStake: formatNAvax(minStakeResult.minValidatorStake),
    minDelegatorStake: formatNAvax(minStakeResult.minDelegatorStake),
  };

  // Fetch recent blocks
  const latestBlocks: PChainBlockSummary[] = [];
  const recentTransactions: TransactionSummary[] = [];
  const blocksToFetch = 10;

  // Fetch blocks in parallel (in batches to avoid overwhelming the RPC)
  const blockPromises: Promise<void>[] = [];
  
  for (let i = 0; i < blocksToFetch; i++) {
    const blockHeight = height - i;
    if (blockHeight < 0) break;
    
    blockPromises.push(
      (async () => {
        try {
          const block = await getBlockByHeight(blockHeight, network);
          const txs = block.txs || (block.tx ? [block.tx] : []);
          
          // Build timestamp if available
          const timestamp = block.time ? new Date(block.time * 1000).toISOString() : undefined;
          
          const decodedTxs: TransactionSummary[] = txs.map((tx) => {
            const decoded = decodePChainTx(tx);
            return {
              txId: tx.id || decoded.txId || '',
              type: decoded.type,
              typeDescription: getTxTypeDescription(decoded.type),
              summary: formatTxSummaryShort(decoded),
              fee: decoded.fee,
              timestamp, // Pass block timestamp to each transaction
            };
          });
          
          latestBlocks.push({
            height: block.height,
            parentId: block.parentID,
            timestamp,
            txCount: txs.length,
            transactions: decodedTxs,
          });
          
          // Add to recent transactions (we'll sort and limit later)
          recentTransactions.push(...decodedTxs);
        } catch (error) {
          console.error(`Error fetching block ${blockHeight}:`, error);
        }
      })()
    );
  }

  await Promise.all(blockPromises);

  // Sort blocks by height (descending)
  latestBlocks.sort((a, b) => b.height - a.height);

  // Limit recent transactions
  const limitedTransactions = recentTransactions.slice(0, 20);

  return {
    network,
    stats,
    latestBlocks: latestBlocks.slice(0, 10),
    recentTransactions: limitedTransactions,
  };
}

function formatTxSummaryShort(decoded: DecodedTransaction): string {
  switch (decoded.type) {
    case 'AddValidatorTx':
      return `Stake ${formatAvaxValue(decoded.totalStake || 0)} AVAX`;
    case 'AddDelegatorTx':
      return `Delegate ${formatAvaxValue(decoded.totalStake || 0)} AVAX`;
    case 'CreateSubnetTx':
      return 'Create subnet';
    case 'CreateChainTx':
      return `Create chain`;
    case 'ExportTx':
      const exportAmount = decoded.exportedOutputs?.reduce((s, o) => s + o.amount, 0) || 0;
      const destChain = decoded.destinationChainName || '';
      return destChain 
        ? `Export ${formatAvaxValue(exportAmount)} AVAX → ${destChain}`
        : `Export ${formatAvaxValue(exportAmount)} AVAX`;
    case 'ImportTx':
      const importAmount = decoded.outputs.reduce((s, o) => s + o.amount, 0);
      const srcChain = decoded.sourceChainName || '';
      return srcChain 
        ? `Import ${formatAvaxValue(importAmount)} AVAX ← ${srcChain}`
        : `Import ${formatAvaxValue(importAmount)} AVAX`;
    case 'BaseTx':
      const transferAmount = decoded.outputs.reduce((s, o) => s + o.amount, 0);
      return `Transfer ${formatAvaxValue(transferAmount)} AVAX`;
    default:
      return getTxTypeDescription(decoded.type);
  }
}

// ============================================================================
// Route Handler
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    // Get network from query params (default to mainnet)
    const { searchParams } = new URL(request.url);
    const networkParam = searchParams.get('network');
    const network: PChainNetwork = networkParam === 'fuji' ? 'fuji' : 'mainnet';

    // Check cache first
    const cached = getCachedData(network);
    if (cached) {
      return NextResponse.json(cached);
    }

    // Fetch fresh data
    const data = await fetchPChainData(network);
    
    // Cache the result
    setCachedData(network, data);

    return NextResponse.json(data);
  } catch (error) {
    console.error('P-Chain explorer error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch P-Chain data' },
      { status: 500 }
    );
  }
}

