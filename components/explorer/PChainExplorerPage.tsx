"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { 
  Box, 
  Layers, 
  Users, 
  Network, 
  Circle, 
  ArrowRightLeft, 
  ShieldCheck,
  Coins,
  DollarSign,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";

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

interface TransactionSummary {
  txId: string;
  type: string;
  typeDescription: string;
  summary: string;
  fee: number;
  timestamp?: string;
}

interface BlockSummary {
  height: number;
  parentId: string;
  timestamp?: string;
  txCount: number;
  transactions: TransactionSummary[];
}

interface PChainExplorerData {
  network: 'mainnet' | 'fuji';
  stats: PChainStats;
  latestBlocks: BlockSummary[];
  recentTransactions: TransactionSummary[];
}

// ============================================================================
// Props
// ============================================================================

interface PChainExplorerPageProps {
  initialNetwork?: 'mainnet' | 'fuji';
}

// ============================================================================
// Constants
// ============================================================================

const THEME_COLOR = "#E84142"; // Avalanche red
const REFRESH_INTERVAL = 10000; // 10 seconds

// ============================================================================
// Helper Functions
// ============================================================================

function formatNumber(num: number): string {
  if (num >= 1e12) return `${(num / 1e12).toFixed(2)}T`;
  if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B`;
  if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
  if (num >= 1e3) return `${(num / 1e3).toFixed(2)}K`;
  return num.toLocaleString();
}

function formatTimeAgo(timestamp: string): string {
  const now = new Date();
  const past = new Date(timestamp);
  const diffInSeconds = Math.floor((now.getTime() - past.getTime()) / 1000);

  if (diffInSeconds < 60) return `${diffInSeconds}s ago`;
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  return `${Math.floor(diffInSeconds / 86400)}d ago`;
}

function formatAvax(avax: number): string {
  if (avax === 0) return '0';
  if (avax < 0.0001) return '<0.0001';
  if (avax >= 1e9) return `${(avax / 1e9).toFixed(2)}B`;
  if (avax >= 1e6) return `${(avax / 1e6).toFixed(2)}M`;
  if (avax >= 1e3) return `${(avax / 1e3).toFixed(2)}K`;
  return avax.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

function shortenTxId(txId: string): string {
  if (!txId) return '';
  if (txId.length <= 16) return txId;
  return `${txId.slice(0, 8)}...${txId.slice(-6)}`;
}

function getTxTypeColor(type: string): string {
  const colors: Record<string, string> = {
    'AddValidatorTx': '#10B981',
    'AddDelegatorTx': '#34D399',
    'AddSubnetValidatorTx': '#059669',
    'AddPermissionlessValidatorTx': '#10B981',
    'AddPermissionlessDelegatorTx': '#34D399',
    'CreateSubnetTx': '#8B5CF6',
    'CreateChainTx': '#A855F7',
    'ExportTx': '#F59E0B',
    'ImportTx': '#FBBF24',
    'RemoveSubnetValidatorTx': '#EF4444',
    'TransferSubnetOwnershipTx': '#EC4899',
    'BaseTx': '#6B7280',
  };
  return colors[type] || '#9CA3AF';
}

// ============================================================================
// Animation Styles
// ============================================================================

const newItemStyles = `
  @keyframes slideInHighlight {
    0% {
      background-color: rgba(232, 65, 66, 0.3);
      transform: translateX(-10px);
      opacity: 0;
    }
    50% {
      background-color: rgba(232, 65, 66, 0.15);
    }
    100% {
      background-color: transparent;
      transform: translateX(0);
      opacity: 1;
    }
  }
  .new-item {
    animation: slideInHighlight 0.8s ease-out;
  }
`;

// ============================================================================
// Component
// ============================================================================

const BLOCK_LIMIT = 50; // Maximum blocks to keep
const TRANSACTION_LIMIT = 50; // Maximum transactions to keep

export default function PChainExplorerPage({ initialNetwork = 'mainnet' }: PChainExplorerPageProps) {
  const searchParams = useSearchParams();
  const network = (searchParams.get('network') as 'mainnet' | 'fuji') || initialNetwork;
  
  const [data, setData] = useState<PChainExplorerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newBlockHeights, setNewBlockHeights] = useState<Set<number>>(new Set());
  const [newTxIds, setNewTxIds] = useState<Set<string>>(new Set());
  
  // Accumulated data (persists across refreshes)
  const [accumulatedBlocks, setAccumulatedBlocks] = useState<BlockSummary[]>([]);
  const [accumulatedTransactions, setAccumulatedTransactions] = useState<TransactionSummary[]>([]);
  
  const isFirstLoadRef = useRef(true);

  // Fetch data
  const fetchData = useCallback(async () => {
    try {
      const response = await fetch(`/api/explorer/p-chain?network=${network}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch data');
      }
      const result: PChainExplorerData = await response.json();

      // Accumulate blocks
      setAccumulatedBlocks((prevBlocks) => {
        const existingHeights = new Set(prevBlocks.map(b => b.height));
        const newBlocks = (result.latestBlocks || []).filter(b => !existingHeights.has(b.height));
        
        // Detect new blocks for animation (only after first load)
        if (!isFirstLoadRef.current && newBlocks.length > 0) {
          setNewBlockHeights(new Set(newBlocks.map(b => b.height)));
          setTimeout(() => setNewBlockHeights(new Set()), 1000);
        }
        
        // Merge and sort by height (descending)
        const merged = [...newBlocks, ...prevBlocks]
          .sort((a, b) => b.height - a.height);
        
        return merged.slice(0, BLOCK_LIMIT);
      });

      // Accumulate transactions
      setAccumulatedTransactions((prevTxs) => {
        const existingTxIds = new Set(prevTxs.map(tx => tx.txId));
        const newTxs = (result.recentTransactions || []).filter(tx => !existingTxIds.has(tx.txId));
        
        // Detect new transactions for animation (only after first load)
        if (!isFirstLoadRef.current && newTxs.length > 0) {
          setNewTxIds(new Set(newTxs.map(tx => tx.txId)));
          setTimeout(() => setNewTxIds(new Set()), 1000);
        }
        
        // Merge and sort by timestamp (most recent first)
        const merged = [...newTxs, ...prevTxs]
          .sort((a, b) => {
            if (!a.timestamp && !b.timestamp) return 0;
            if (!a.timestamp) return 1;
            if (!b.timestamp) return -1;
            return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
          });
        
        return merged.slice(0, TRANSACTION_LIMIT);
      });

      setData(result);
      setError(null);
      isFirstLoadRef.current = false;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [network]);

  // Initial fetch and refresh interval
  useEffect(() => {
    // Reset accumulated data when network changes
    isFirstLoadRef.current = true;
    setAccumulatedBlocks([]);
    setAccumulatedTransactions([]);
    setLoading(true);
    fetchData();

    const interval = setInterval(fetchData, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchData]);

  if (loading && !data) {
    return (
      <>
        <style>{newItemStyles}</style>
        {/* Stats skeleton */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="space-y-1">
                  <div className="h-3 w-20 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
                  <div className="h-6 w-28 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Tables skeleton */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {[1, 2].map((i) => (
              <div key={i} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
                  <div className="h-5 w-32 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
                </div>
                <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {[1, 2, 3, 4, 5].map((j) => (
                    <div key={j} className="p-3">
                      <div className="h-4 w-full bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse mb-2" />
                      <div className="h-4 w-3/4 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <style>{newItemStyles}</style>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
          <div className="text-center">
            <p className="text-red-500 mb-4">{error}</p>
            <Button onClick={fetchData} className="cursor-pointer">Retry</Button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{newItemStyles}</style>

      {/* Stats Card */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5">
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-x-5 gap-y-4">
            {/* Block Height */}
            <div className="flex items-center gap-2.5">
              <div 
                className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: `${THEME_COLOR}15` }}
              >
                <Layers className="w-5 h-5" style={{ color: THEME_COLOR }} />
              </div>
              <div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
                  Block Height
                </div>
                <div className="text-base font-bold text-zinc-900 dark:text-white">
                  {formatNumber(data?.stats.height || 0)}
                </div>
              </div>
            </div>

            {/* Total Stake */}
            <div className="flex items-center gap-2.5">
              <div 
                className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: `${THEME_COLOR}15` }}
              >
                <Coins className="w-5 h-5" style={{ color: THEME_COLOR }} />
              </div>
              <div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
                  Total Stake
                </div>
                <div className="text-base font-bold text-zinc-900 dark:text-white">
                  {formatAvax(data?.stats.totalStakeAvax || 0)} AVAX
                </div>
              </div>
            </div>

            {/* Validators */}
            <div className="flex items-center gap-2.5">
              <div 
                className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: `${THEME_COLOR}15` }}
              >
                <ShieldCheck className="w-5 h-5" style={{ color: THEME_COLOR }} />
              </div>
              <div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
                  Validators
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-base font-bold text-zinc-900 dark:text-white">
                    {formatNumber(data?.stats.validatorCount || 0)}
                  </span>
                  <Link 
                    href={`/explorer/p-chain/validators?network=${network}`}
                    className="text-[11px] hover:underline cursor-pointer"
                    style={{ color: THEME_COLOR }}
                  >
                    View all
                  </Link>
                </div>
              </div>
            </div>

            {/* Delegators */}
            <div className="flex items-center gap-2.5">
              <div 
                className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: `${THEME_COLOR}15` }}
              >
                <Users className="w-5 h-5" style={{ color: THEME_COLOR }} />
              </div>
              <div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
                  Delegators
                </div>
                <div className="text-base font-bold text-zinc-900 dark:text-white">
                  {formatNumber(data?.stats.delegatorCount || 0)}
                </div>
              </div>
            </div>

            {/* Subnets */}
            <div className="flex items-center gap-2.5">
              <div 
                className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: `${THEME_COLOR}15` }}
              >
                <Network className="w-5 h-5" style={{ color: THEME_COLOR }} />
              </div>
              <div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
                  Subnets
                </div>
                <div className="text-base font-bold text-zinc-900 dark:text-white">
                  {formatNumber(data?.stats.subnetCount || 0)}
                </div>
              </div>
            </div>

            {/* Current Supply */}
            <div className="flex items-center gap-2.5">
              <div 
                className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: `${THEME_COLOR}15` }}
              >
                <DollarSign className="w-5 h-5" style={{ color: THEME_COLOR }} />
              </div>
              <div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
                  Supply
                </div>
                <div className="text-base font-bold text-zinc-900 dark:text-white">
                  {formatAvax(data?.stats.currentSupplyAvax || 0)}
                </div>
              </div>
            </div>
          </div>

          {/* Min Stake Info */}
          <div className="mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
            <div className="flex flex-wrap gap-4 text-xs text-zinc-500 dark:text-zinc-400">
              <span>
                Min Validator Stake: <span className="font-medium text-zinc-700 dark:text-zinc-300">{data?.stats.minValidatorStake} AVAX</span>
              </span>
              <span>
                Min Delegator Stake: <span className="font-medium text-zinc-700 dark:text-zinc-300">{data?.stats.minDelegatorStake} AVAX</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Blocks and Transactions Tables */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Latest Blocks */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-200 dark:border-zinc-800">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
                <Box className="w-4 h-4" style={{ color: THEME_COLOR }} />
                Latest Blocks
              </h2>
              <div className="flex items-center gap-1.5">
                <Circle className="w-2 h-2 fill-green-500 text-green-500 animate-pulse" />
                <span className="text-xs text-zinc-500 dark:text-zinc-400 font-normal">Live</span>
              </div>
            </div>
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800 max-h-[400px] overflow-y-auto">
              {accumulatedBlocks.map((block) => (
                <Link 
                  key={block.height}
                  href={`/explorer/p-chain/block/${block.height}?network=${network}`}
                  className={`block px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors cursor-pointer ${
                    newBlockHeights.has(block.height) ? 'new-item' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: `${THEME_COLOR}15` }}
                      >
                        <Box className="w-4 h-4" style={{ color: THEME_COLOR }} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm hover:underline" style={{ color: THEME_COLOR }}>
                            {block.height.toLocaleString()}
                          </span>
                          {block.timestamp && (
                            <span className="text-xs text-zinc-400">
                              {formatTimeAgo(block.timestamp)}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-zinc-500 mt-0.5">
                          <span style={{ color: THEME_COLOR }}>{block.txCount} txns</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
              {accumulatedBlocks.length === 0 && (
                <div className="px-4 py-8 text-center text-zinc-500 dark:text-zinc-400">
                  No blocks found
                </div>
              )}
            </div>
          </div>

          {/* Latest Transactions */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-200 dark:border-zinc-800">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
                <ArrowRightLeft className="w-4 h-4" style={{ color: THEME_COLOR }} />
                Latest Transactions
              </h2>
              <div className="flex items-center gap-1.5">
                <Circle className="w-2 h-2 fill-green-500 text-green-500 animate-pulse" />
                <span className="text-xs text-zinc-500 dark:text-zinc-400 font-normal">Live</span>
              </div>
            </div>
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800 max-h-[400px] overflow-y-auto">
              {accumulatedTransactions.map((tx, index) => (
                <Link
                  key={`${tx.txId}-${index}`}
                  href={`/explorer/p-chain/tx/${tx.txId}?network=${network}`}
                  className={`block px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors cursor-pointer ${
                    newTxIds.has(tx.txId) ? 'new-item' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: `${getTxTypeColor(tx.type)}15` }}
                      >
                        <ArrowRightLeft className="w-4 h-4" style={{ color: getTxTypeColor(tx.type) }} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs hover:underline" style={{ color: THEME_COLOR }}>
                            {shortenTxId(tx.txId)}
                          </span>
                          {tx.timestamp && (
                            <span className="text-xs text-zinc-400">
                              {formatTimeAgo(tx.timestamp)}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-zinc-500 mt-0.5">
                          {tx.summary}
                        </div>
                      </div>
                    </div>
                    <div 
                      className="text-xs px-2 py-0.5 rounded flex-shrink-0"
                      style={{ 
                        backgroundColor: `${getTxTypeColor(tx.type)}15`,
                        color: getTxTypeColor(tx.type) 
                      }}
                    >
                      {tx.typeDescription}
                    </div>
                  </div>
                </Link>
              ))}
              {accumulatedTransactions.length === 0 && (
                <div className="px-4 py-8 text-center text-zinc-500 dark:text-zinc-400">
                  No transactions found
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
