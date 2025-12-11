"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { ArrowRightLeft, Box, Globe, Circle, Link2, Loader2 } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Line, LineChart, ResponsiveContainer, Tooltip as RechartsTooltip, YAxis } from "recharts";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { buildBlockUrl, buildTxUrl, buildAddressUrl } from "@/utils/eip3091";
import { formatTokenValue } from "@/utils/formatTokenValue";
import l1ChainsData from "@/constants/l1-chains.json";
import { L1Chain } from "@/types/stats";
import { ChainChip, ChainInfo } from "@/components/stats/ChainChip";

interface Block {
  number: string;
  hash: string;
  timestamp: string;
  miner: string;
  transactionCount: number;
  gasUsed: string;
  gasLimit: string;
  baseFeePerGas?: string;
  gasFee?: string;
  // Chain info for merged data
  chain?: ChainInfo;
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
  sourceBlockchainId?: string;
  destinationBlockchainId?: string;
  // Chain info for merged data
  chain?: ChainInfo;
}

interface TransactionHistoryPoint {
  date: string;
  transactions: number;
}

interface ChainStats {
  latestBlock: number;
  totalTransactions: number;
  avgBlockTime: number;
  gasPrice: string;
}

// Get chain info from hex blockchain ID
function getChainFromBlockchainId(hexBlockchainId: string): ChainInfo | null {
  const normalizedHex = hexBlockchainId.toLowerCase();
  const chain = (l1ChainsData as L1Chain[]).find(c => 
    (c as any).blockchainId?.toLowerCase() === normalizedHex
  );
  
  if (!chain) return null;
    
  return {
    chainId: chain.chainId,
    chainName: chain.chainName,
    chainSlug: chain.slug,
    chainLogoURI: chain.chainLogoURI || '',
    color: chain.color || '#6B7280',
    tokenSymbol: chain.networkToken?.symbol || '',
  };
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

function shortenAddress(address: string | null): string {
  if (!address) return '';
  if (address.length < 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatNumber(num: number): string {
  if (num >= 1e12) return `${(num / 1e12).toFixed(2)}T`;
  if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B`;
  if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
  if (num >= 1e3) return `${(num / 1e3).toFixed(2)}K`;
  return num.toLocaleString();
}

// Animation styles for new items and loading dots
const newItemStyles = `
  @keyframes slideInHighlight {
    0% {
      background-color: rgba(34, 197, 94, 0.3);
      transform: translateX(-10px);
      opacity: 0;
    }
    50% {
      background-color: rgba(34, 197, 94, 0.15);
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
  
  @keyframes jumpingDots {
    0%, 80%, 100% {
      transform: translateY(0);
    }
    40% {
      transform: translateY(-6px);
    }
  }
  .jumping-dot {
    display: inline-block;
    width: 4px;
    height: 4px;
    margin: 0 2px;
    border-radius: 50%;
    background-color: currentColor;
    animation: jumpingDots 1.4s infinite ease-in-out both;
  }
  .jumping-dot:nth-child(1) {
    animation-delay: -0.32s;
  }
  .jumping-dot:nth-child(2) {
    animation-delay: -0.16s;
  }
  .jumping-dot:nth-child(3) {
    animation-delay: 0s;
  }
`;

// Jumping dots component for loading state
function JumpingDots({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center ${className}`}>
      <span className="jumping-dot" />
      <span className="jumping-dot" />
      <span className="jumping-dot" />
    </span>
  );
}

// Get supported chains with RPC URLs
const supportedChains = (l1ChainsData as L1Chain[]).filter(c => c.rpcUrl && c.isTestnet !== true);

// Module-level constants - block limit based on active chains for accurate metrics
const BLOCK_LIMIT = supportedChains.length * 10 * 2;
const TRANSACTION_LIMIT = 100;
const ICM_MESSAGE_LIMIT = 100;
const NORMAL_INTERVAL = 3000;
const STAGGER_DELAY = 200; // Stagger fetches to avoid overwhelming the API

// Wait for this many blocks before showing blocks/sec
const MIN_BLOCKS_FOR_CALCULATION = supportedChains.length * 10 * 2;
// Calculate blocks/sec over this many recent blocks (smaller window for accuracy)
const BLOCKS_FOR_CALCULATION = supportedChains.length * 10 * 1;

export default function AllChainsExplorerPage() {
  const router = useRouter();
  const themeColor = "#E84142"; // Avalanche red for all-chains view
  
  // State for accumulated data from all chains
  const [accumulatedBlocks, setAccumulatedBlocks] = useState<Block[]>([]);
  const [accumulatedTransactions, setAccumulatedTransactions] = useState<Transaction[]>([]);
  const [icmMessages, setIcmMessages] = useState<Transaction[]>([]);
  const [chainStats, setChainStats] = useState<Map<string, ChainStats>>(new Map());
  // Per-chain transaction history (chainId -> history array)
  const [chainTransactionHistories, setChainTransactionHistories] = useState<Map<string, TransactionHistoryPoint[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [newBlockIds, setNewBlockIds] = useState<Set<string>>(new Set());
  const [newTxHashes, setNewTxHashes] = useState<Set<string>>(new Set());
  
  // Refs
  const isMountedRef = useRef(true);
  const fetchingChainsRef = useRef<Set<string>>(new Set());
  const lastFetchedBlocksRef = useRef<Map<string, string>>(new Map());
  const refreshTimeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const isFirstLoadRef = useRef<Map<string, boolean>>(new Map());
  const retryCountRef = useRef<Map<string, number>>(new Map());
  const passiveChainsRef = useRef<Set<string>>(new Set());
  
  // Track active chains count for UI
  const [activeChainCount, setActiveChainCount] = useState(supportedChains.length);
  // Track how many chains have completed their initial load
  const [completedInitialLoads, setCompletedInitialLoads] = useState(0);

  // Initialize first load tracking for each chain
  useEffect(() => {
    supportedChains.forEach(chain => {
      isFirstLoadRef.current.set(chain.chainId, true);
      retryCountRef.current.set(chain.chainId, 0);
    });
  }, []);

  // Fetch data for a single chain
  const fetchChainData = useCallback(async (chain: L1Chain) => {
    const chainId = chain.chainId;
    
    // Skip passive chains (failed 3+ times on initial load)
    if (passiveChainsRef.current.has(chainId)) {
      return;
    }
    
    // Prevent overlapping fetches for the same chain
    if (fetchingChainsRef.current.has(chainId) || !isMountedRef.current) {
      return;
    }
    
    // Clear pending timeout for this chain
    const existingTimeout = refreshTimeoutsRef.current.get(chainId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
      refreshTimeoutsRef.current.delete(chainId);
    }
    
    fetchingChainsRef.current.add(chainId);
    
    try {
      const params = new URLSearchParams();
      const isFirstLoad = isFirstLoadRef.current.get(chainId) ?? true;
      
      if (isFirstLoad) {
        params.set('initialLoad', 'true');
      } else {
        const lastBlock = lastFetchedBlocksRef.current.get(chainId);
        if (lastBlock) {
          params.set('lastFetchedBlock', lastBlock);
        }
      }
      
      const url = `/api/explorer/${chainId}${params.toString() ? `?${params.toString()}` : ''}`;
      
      const response = await fetch(url, { 
        signal: AbortSignal.timeout(10000) // 10s timeout
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch ${chain.chainName}`);
      }
      
      const result = await response.json();

      // Get tokenSymbol from API response (which may come from CoinGecko) or fall back to static data
      const tokenSymbol = result.tokenSymbol || chain.networkToken?.symbol || 'N/A';

      const chainInfo: ChainInfo = {
        chainId: chain.chainId,
        chainName: chain.chainName,
        chainSlug: chain.slug,
        chainLogoURI: chain.chainLogoURI || '',
        color: chain.color || '#6B7280',
        tokenSymbol: tokenSymbol,
      };
      
      // Update last fetched block
      if (result.blocks && result.blocks.length > 0) {
        const highestBlock = result.blocks.reduce((max: string, b: Block) => 
          parseInt(b.number) > parseInt(max) ? b.number : max, 
          result.blocks[0].number
        );
        lastFetchedBlocksRef.current.set(chainId, highestBlock);
      }
      
      // Accumulate blocks with chain info
      if (result.blocks && result.blocks.length > 0) {
        const blocksWithChain = result.blocks.map((b: Block) => ({
          ...b,
          chain: chainInfo,
        }));
        
        setAccumulatedBlocks(prev => {
          // Create unique key for each block (chainId + blockNumber)
          const existingKeys = new Set(prev.map(b => `${b.chain?.chainId}-${b.number}`));
          const newBlocks = blocksWithChain.filter((b: Block) => 
            !existingKeys.has(`${b.chain?.chainId}-${b.number}`)
          );
          
          if (newBlocks.length > 0) {
            setNewBlockIds(new Set(newBlocks.map((b: Block) => `${b.chain?.chainId}-${b.number}`)));
            setTimeout(() => setNewBlockIds(new Set()), 1000);
          }
          
          // Merge and sort by timestamp (most recent first)
          const merged = [...newBlocks, ...prev]
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
          
          return merged.slice(0, BLOCK_LIMIT);
        });
      }
      
      // Accumulate transactions with chain info
      if (result.transactions && result.transactions.length > 0) {
        const txsWithChain = result.transactions.map((tx: Transaction) => ({
          ...tx,
          chain: chainInfo,
        }));
        
        setAccumulatedTransactions(prev => {
          const existingHashes = new Set(prev.map(tx => tx.hash));
          const newTxs = txsWithChain.filter((tx: Transaction) => !existingHashes.has(tx.hash));
          
          if (newTxs.length > 0) {
            setNewTxHashes(prevHashes => {
              const updated = new Set(prevHashes);
              newTxs.forEach((tx: Transaction) => updated.add(tx.hash));
              return updated;
            });
            setTimeout(() => {
              setNewTxHashes(prevHashes => {
                const updated = new Set(prevHashes);
                newTxs.forEach((tx: Transaction) => updated.delete(tx.hash));
                return updated;
              });
            }, 1000);
          }
          
          const merged = [...newTxs, ...prev]
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
          
          return merged.slice(0, TRANSACTION_LIMIT);
        });
      }
      
      // Accumulate ICM messages with chain info
      if (result.icmMessages && result.icmMessages.length > 0) {
        const icmWithChain = result.icmMessages.map((tx: Transaction) => ({
          ...tx,
          chain: chainInfo,
        }));
        
        setIcmMessages(prev => {
          const existingHashes = new Set(prev.map(tx => tx.hash));
          const newIcm = icmWithChain.filter((tx: Transaction) => !existingHashes.has(tx.hash));
          
          if (newIcm.length > 0) {
            setNewTxHashes(prevHashes => {
              const updated = new Set(prevHashes);
              newIcm.forEach((tx: Transaction) => updated.add(tx.hash));
              return updated;
            });
            setTimeout(() => {
              setNewTxHashes(prevHashes => {
                const updated = new Set(prevHashes);
                newIcm.forEach((tx: Transaction) => updated.delete(tx.hash));
                return updated;
              });
            }, 1000);
          }
          
          const merged = [...newIcm, ...prev]
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
          
          return merged.slice(0, ICM_MESSAGE_LIMIT);
        });
      }
      
      // Update chain stats - only store totalTransactions on initial load
      // because subsequent fetches don't return the correct total
      if (result.stats) {
        setChainStats(prev => {
          const updated = new Map(prev);
          if (isFirstLoad) {
            // Initial load - store all stats including totalTransactions
            updated.set(chainId, result.stats);
          } else {
            // Subsequent fetches - preserve totalTransactions from initial load
            const existingStats = prev.get(chainId);
            if (existingStats) {
              updated.set(chainId, {
                ...result.stats,
                totalTransactions: existingStats.totalTransactions, // Keep original total
              });
            }
          }
          return updated;
        });
      }
      
      // Store/replace transaction history for this chain (not accumulate)
      // Only on initial load since history is static
      if (isFirstLoad && result.transactionHistory && result.transactionHistory.length > 0) {
        setChainTransactionHistories(prev => {
          const updated = new Map(prev);
          // Replace this chain's history (don't add to it)
          updated.set(chainId, result.transactionHistory);
          return updated;
        });
      }
      
      // Mark first load complete and reset retry count on success
      if (isFirstLoad) {
        isFirstLoadRef.current.set(chainId, false);
        retryCountRef.current.set(chainId, 0);
        setCompletedInitialLoads(prev => prev + 1);
      }
      
    } catch (error) {
      // Silently handle errors - other chains will continue to work
      console.warn(`Error fetching ${chain.chainName}:`, error);
      
      const isFirstLoad = isFirstLoadRef.current.get(chainId) ?? true;
      
      // Track retry count for initial load failures
      if (isFirstLoad) {
        const currentRetries = retryCountRef.current.get(chainId) || 0;
        const newRetries = currentRetries + 1;
        retryCountRef.current.set(chainId, newRetries);
        
        // After 3 failed attempts on initial load, mark chain as passive
        if (newRetries >= 3) {
          console.warn(`Marking ${chain.chainName} as passive after ${newRetries} failed attempts`);
          passiveChainsRef.current.add(chainId);
          setActiveChainCount(supportedChains.length - passiveChainsRef.current.size);
          setCompletedInitialLoads(prev => prev + 1); // Count as "completed" even though it failed
          fetchingChainsRef.current.delete(chainId);
          setLoading(false);
          return; // Don't schedule retry for passive chains
        }
      }
    } finally {
      fetchingChainsRef.current.delete(chainId);
      setLoading(false);
      
      // Schedule next fetch for this chain (unless passive)
      if (isMountedRef.current && !passiveChainsRef.current.has(chainId)) {
        const timeout = setTimeout(() => {
          if (isMountedRef.current) {
            fetchChainData(chain);
          }
        }, NORMAL_INTERVAL);
        refreshTimeoutsRef.current.set(chainId, timeout);
      }
    }
  }, []);

  // Start fetching data from all chains with staggered delays
  useEffect(() => {
    isMountedRef.current = true;
    
    // Stagger initial fetches to avoid overwhelming APIs
    supportedChains.forEach((chain, index) => {
      setTimeout(() => {
        if (isMountedRef.current) {
          fetchChainData(chain);
        }
      }, index * STAGGER_DELAY);
    });
    
    return () => {
      isMountedRef.current = false;
      // Clear all timeouts
      refreshTimeoutsRef.current.forEach(timeout => clearTimeout(timeout));
      refreshTimeoutsRef.current.clear();
      fetchingChainsRef.current.clear();
    };
  }, [fetchChainData]);

  // Aggregate stats across all chains (per-chain totals stored in chainStats Map)
  const aggregatedStats = useMemo(() => {
    let totalTransactions = 0;
    
    // Sum totalTransactions from each chain (each chain's value is already stored/replaced, not accumulated)
    chainStats.forEach(stats => {
      totalTransactions += stats.totalTransactions;
    });
    
    // Total chains in l1-chains.json
    const allChainsCount = (l1ChainsData as L1Chain[]).filter(chain => chain.isTestnet !== true).length;
    
    return {
      chainsWithRpc: supportedChains.length, // Chains with RPC URLs (supported)
      totalChains: allChainsCount, // All chains in l1-chains.json
      totalTransactions,
    };
  }, [chainStats]);

  // Check if we have enough blocks to calculate TPS and blocks/sec
  const hasEnoughBlocksForCalculation = accumulatedBlocks.length >= MIN_BLOCKS_FOR_CALCULATION;

  // Calculate aggregate TPS from accumulated blocks (only when we have enough blocks)
  // Uses only the most recent BLOCKS_FOR_CALCULATION blocks for accuracy
  const calculatedTps = useMemo(() => {
    if (!hasEnoughBlocksForCalculation || accumulatedBlocks.length < 2) return null;
    
    // Use only the most recent blocks for calculation (smaller window = more accurate)
    const blocksForCalc = accumulatedBlocks.slice(0, BLOCKS_FOR_CALCULATION);
    
    if (blocksForCalc.length < 2) return null;
    
    const timestamps = blocksForCalc.map(b => new Date(b.timestamp).getTime() / 1000);
    const firstBlockTime = timestamps[0];
    const lastBlockTime = timestamps[timestamps.length - 1];
    const totalTime = firstBlockTime - lastBlockTime;
    
    if (totalTime <= 0) return null;
    
    const totalTxs = blocksForCalc.reduce((sum, b) => sum + b.transactionCount, 0);
    return Math.round((totalTxs / totalTime) * 100) / 100;
  }, [accumulatedBlocks, hasEnoughBlocksForCalculation]);
  
  // Calculate blocks per second (only when we have enough blocks)
  // Uses only the most recent BLOCKS_FOR_CALCULATION blocks for accuracy
  const blocksPerSecond = useMemo(() => {
    if (!hasEnoughBlocksForCalculation || accumulatedBlocks.length < 2) return null;
    
    // Use only the most recent blocks for calculation (smaller window = more accurate)
    const blocksForCalc = accumulatedBlocks.slice(0, BLOCKS_FOR_CALCULATION);
    
    if (blocksForCalc.length < 2) return null;
    
    const timestamps = blocksForCalc.map(b => new Date(b.timestamp).getTime() / 1000);
    const firstBlockTime = timestamps[0];
    const lastBlockTime = timestamps[timestamps.length - 1];
    const totalTime = firstBlockTime - lastBlockTime;
    
    if (totalTime <= 0) return null;
    
    return Math.round((blocksForCalc.length / totalTime) * 100) / 100;
  }, [accumulatedBlocks, hasEnoughBlocksForCalculation]);

  // Calculate ICM messages per second using a rolling 60-second window
  const icmPerSecond = useMemo(() => {
    if (icmMessages.length < 2) return null;
    
    const now = Date.now() / 1000;
    const windowSeconds = 60; // 60 second window for rate calculation
    
    // Count messages within the time window
    const recentMessages = icmMessages.filter(m => {
      const msgTime = new Date(m.timestamp).getTime() / 1000;
      return (now - msgTime) <= windowSeconds;
    });
    
    if (recentMessages.length >= 2) {
      // Calculate rate from messages within the window
      return Math.round((recentMessages.length / windowSeconds) * 1000) / 1000;
    }
    
    // Fall back to using the time span between messages if not enough recent ones
    const timestamps = icmMessages.slice(0, Math.min(50, icmMessages.length))
      .map(m => new Date(m.timestamp).getTime() / 1000);
    
    if (timestamps.length < 2) return null;
    
    const newestTime = timestamps[0];
    const oldestTime = timestamps[timestamps.length - 1];
    const timeSpan = newestTime - oldestTime;
    
    if (timeSpan <= 0) return null;
    
    // For N messages over time T, rate = (N-1)/T (intervals, not count)
    // But for display, we use N/T as it's more intuitive
    return Math.round((timestamps.length / timeSpan) * 1000) / 1000;
  }, [icmMessages]);

  // Aggregate transaction history from all chains (sum by date)
  const aggregatedTransactionHistory = useMemo(() => {
    if (chainTransactionHistories.size === 0) return [];
    
    // Merge all chain histories by date
    const historyMap = new Map<string, number>();
    chainTransactionHistories.forEach((history) => {
      history.forEach((point) => {
        const existing = historyMap.get(point.date) || 0;
        historyMap.set(point.date, existing + point.transactions);
      });
    });
    
    // Convert to array and keep last 14 entries
    return Array.from(historyMap.entries())
      .map(([date, transactions]) => ({ date, transactions }))
      .slice(-14);
  }, [chainTransactionHistories]);

  // Check if we have transaction history data
  const hasIndexedTransactionHistory = useMemo(() => {
    return aggregatedTransactionHistory.length > 0 && aggregatedTransactionHistory.some(point => point.transactions > 0);
  }, [aggregatedTransactionHistory]);

  // Generate placeholder history if no data
  const displayTransactionHistory = useMemo(() => {
    if (hasIndexedTransactionHistory) return aggregatedTransactionHistory;
    
    const history: TransactionHistoryPoint[] = [];
    const now = new Date();
    for (let i = 13; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      history.push({
        date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        transactions: 0,
      });
    }
    return history;
  }, [aggregatedTransactionHistory, hasIndexedTransactionHistory]);

  if (loading && accumulatedBlocks.length === 0) {
    return (
      <>
        <style>{newItemStyles}</style>
        {/* Stats skeleton */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-4">
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

  const hasIcmMessages = icmMessages.length > 0;

  return (
    <>
      <style>{newItemStyles}</style>

      {/* Stats Card */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5">
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Left: Stats Grid */}
            <div className="lg:col-span-2 grid grid-cols-2 md:grid-cols-3 gap-x-5 gap-y-4">
              {/* Active Chains */}
              <div className="flex items-center gap-2.5">
                <div 
                  className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: `${themeColor}15` }}
                >
                  <Globe className="w-5 h-5" style={{ color: themeColor }} />
                </div>
                <div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
                    Active Chains
                  </div>
                  <div className="flex items-baseline gap-1">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="text-base font-bold text-zinc-900 dark:text-white cursor-help">
                          {activeChainCount}
                    </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{activeChainCount} of {supportedChains.length} chains responding</p>
                        {passiveChainsRef.current.size > 0 && (
                          <p className="text-zinc-400">{passiveChainsRef.current.size} chains unavailable</p>
                        )}
                      </TooltipContent>
                    </Tooltip>
                    <span className="text-xs text-zinc-500">
                      / {aggregatedStats.totalChains}
                    </span>
                  </div>
                </div>
              </div>

              {/* Total Transactions */}
              <div className="flex items-center gap-2.5">
                <div 
                  className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: `${themeColor}15` }}
                >
                  <ArrowRightLeft className="w-5 h-5" style={{ color: themeColor }} />
                </div>
                <div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
                    Total Transactions
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-base font-bold text-zinc-900 dark:text-white">
                      {formatNumber(aggregatedStats.totalTransactions)}
                    </span>
                    {calculatedTps !== null ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="text-[11px] text-zinc-500 cursor-help border-b border-dashed border-zinc-400">
                            ({calculatedTps} TPS)
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Calculated from last {Math.min(accumulatedBlocks.length, BLOCKS_FOR_CALCULATION)} blocks</p>
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="text-[11px] text-zinc-500 cursor-help">
                            (<JumpingDots /> TPS)
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Warming up: {accumulatedBlocks.length} / {MIN_BLOCKS_FOR_CALCULATION} blocks</p>
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                </div>
              </div>

              {/* Blocks Per Second */}
              <div className="flex items-center gap-2.5">
                <div 
                  className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: `${themeColor}15` }}
                >
                  <Box className="w-5 h-5" style={{ color: themeColor }} />
                </div>
                <div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
                    Blocks/sec
                  </div>
                  <div className="flex items-baseline gap-1">
                    {blocksPerSecond !== null ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="text-base font-bold text-zinc-900 dark:text-white cursor-help border-b border-dashed border-zinc-400 dark:border-zinc-500">
                            {blocksPerSecond}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Calculated from last {Math.min(accumulatedBlocks.length, BLOCKS_FOR_CALCULATION)} blocks</p>
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="text-base font-bold text-zinc-500 dark:text-zinc-400 cursor-help">
                            <JumpingDots />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Warming up: {accumulatedBlocks.length} / {MIN_BLOCKS_FOR_CALCULATION} blocks</p>
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                </div>
              </div>

              {/* ICM Messages Per Second */}
              <div className="flex items-center gap-2.5">
                <div 
                  className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: `${themeColor}15` }}
                >
                  <Link2 className="w-5 h-5" style={{ color: themeColor }} />
                </div>
                <div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
                    ICM/sec
                  </div>
                  <div className="flex items-baseline gap-1">
                    {icmPerSecond !== null ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="text-base font-bold text-zinc-900 dark:text-white cursor-help border-b border-dashed border-zinc-400 dark:border-zinc-500">
                          {icmPerSecond}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                          <p>Calculated from {icmMessages.length} cross-chain messages (60s window)</p>
                      </TooltipContent>
                    </Tooltip>
                    ) : (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="text-base font-bold text-zinc-500 dark:text-zinc-400 cursor-help">
                            <JumpingDots />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Waiting for ICM messages ({icmMessages.length} collected)</p>
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Transaction History Chart */}
            <div className="lg:col-span-1 border-l-0 lg:border-l border-zinc-100 dark:border-zinc-800 pl-0 lg:pl-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-zinc-500 dark:text-zinc-400 uppercase tracking-wide flex items-center gap-2">
                  Ecosystem Activity (14 Days)
                  {completedInitialLoads < activeChainCount && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Loader2 className="w-3 h-3 animate-spin text-zinc-400" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Loading: {completedInitialLoads} / {activeChainCount} chains</p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                </span>
              </div>
              <div className="relative">
                <div className={`h-14 ${!hasIndexedTransactionHistory ? 'blur-[2px] opacity-50' : ''}`}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={displayTransactionHistory}>
                      <YAxis hide domain={hasIndexedTransactionHistory ? ['dataMin', 'dataMax'] : [0, 100]} />
                      {hasIndexedTransactionHistory && (
                        <RechartsTooltip
                          content={({ active, payload }) => {
                            if (!active || !payload?.[0]) return null;
                            return (
                              <div className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-1 shadow-lg">
                                <p className="text-[10px] text-zinc-500">{payload[0].payload.date}</p>
                                <p className="text-xs font-semibold" style={{ color: themeColor }}>
                                  {payload[0].value?.toLocaleString()} txns
                                </p>
                              </div>
                            );
                          }}
                        />
                      )}
                      <Line
                        type="monotone"
                        dataKey="transactions"
                        stroke={hasIndexedTransactionHistory ? themeColor : '#9CA3AF'}
                        strokeWidth={1.5}
                        dot={false}
                        activeDot={hasIndexedTransactionHistory ? { r: 3, fill: themeColor } : false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                {!hasIndexedTransactionHistory && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-xs text-zinc-500 dark:text-zinc-400 bg-white/80 dark:bg-zinc-900/80 px-2 py-1 rounded">
                      Loading data...
                    </span>
                  </div>
                )}
              </div>
              <div className={`flex justify-between text-[11px] text-zinc-400 mt-1.5 ${!hasIndexedTransactionHistory ? 'opacity-50' : ''}`}>
                <span>{displayTransactionHistory[0]?.date}</span>
                <span>{displayTransactionHistory[displayTransactionHistory.length - 1]?.date}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tables */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
        <div className={`grid grid-cols-1 gap-6 ${hasIcmMessages ? 'lg:grid-cols-3' : 'lg:grid-cols-2'}`}>
          {/* Latest Blocks */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-200 dark:border-zinc-800">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
                <Box className="w-4 h-4" style={{ color: themeColor }} />
                Latest Blocks
              </h2>
              <div className="flex items-center gap-1.5">
                <Circle className="w-2 h-2 fill-green-500 text-green-500 animate-pulse" />
                <span className="text-xs text-zinc-500 dark:text-zinc-400 font-normal">Live</span>
              </div>
            </div>
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800 max-h-[400px] overflow-y-auto">
              {accumulatedBlocks.slice(0, 10).map((block) => (
                <Link 
                  key={`${block.chain?.chainId}-${block.number}`}
                  href={buildBlockUrl(`/explorer/${block.chain?.chainSlug}`, block.number)}
                  className={`block px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors cursor-pointer ${
                    newBlockIds.has(`${block.chain?.chainId}-${block.number}`) ? 'new-item' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: `${block.chain?.color || themeColor}15` }}
                      >
                        {block.chain?.chainLogoURI ? (
                          <Image
                            src={block.chain.chainLogoURI}
                            alt={block.chain.chainName}
                            width={18}
                            height={18}
                            className="rounded"
                          />
                        ) : (
                          <Box className="w-4 h-4" style={{ color: block.chain?.color || themeColor }} />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm hover:underline" style={{ color: block.chain?.color || themeColor }}>
                            #{block.number}
                          </span>
                          <span className="text-xs text-zinc-400">
                            {formatTimeAgo(block.timestamp)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          {block.chain && <ChainChip chain={block.chain} size="xs" onClick={() => router.push(`/explorer/${block.chain?.chainSlug}`)} />}
                          <span className="text-xs text-zinc-500">
                            <span style={{ color: block.chain?.color || themeColor }}>{block.transactionCount} txns</span>
                          </span>
                        </div>
                      </div>
                    </div>
                    {block.gasFee && parseFloat(block.gasFee) > 0 && (
                      <div className="text-xs px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 flex-shrink-0">
                        {block.chain?.chainId === "43114" && <span className="mr-1">🔥</span>}
                        {formatTokenValue(block.gasFee)} {block.chain?.tokenSymbol || ''}
                      </div>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Latest Transactions */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-200 dark:border-zinc-800">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
                <ArrowRightLeft className="w-4 h-4" style={{ color: themeColor }} />
                Latest Transactions
              </h2>
              <div className="flex items-center gap-1.5">
                <Circle className="w-2 h-2 fill-green-500 text-green-500 animate-pulse" />
                <span className="text-xs text-zinc-500 dark:text-zinc-400 font-normal">Live</span>
              </div>
            </div>
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800 max-h-[400px] overflow-y-auto">
              {accumulatedTransactions.slice(0, 10).map((tx, index) => (
                <div 
                  key={`${tx.hash}-${index}`}
                  onClick={() => router.push(buildTxUrl(`/explorer/${tx.chain?.chainSlug}`, tx.hash))}
                  className={`block px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors cursor-pointer ${
                    newTxHashes.has(tx.hash) ? 'new-item' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: `${tx.chain?.color || themeColor}15` }}
                      >
                        {tx.chain?.chainLogoURI ? (
                          <Image
                            src={tx.chain.chainLogoURI}
                            alt={tx.chain.chainName}
                            width={18}
                            height={18}
                            className="rounded"
                          />
                        ) : (
                          <ArrowRightLeft className="w-4 h-4" style={{ color: tx.chain?.color || themeColor }} />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono text-xs hover:underline" style={{ color: tx.chain?.color || themeColor }}>
                            {tx.hash.slice(0, 14)}...
                          </span>
                          <span className="text-xs text-zinc-400">
                            {formatTimeAgo(tx.timestamp)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          {tx.chain && <ChainChip chain={tx.chain} size="xs" onClick={() => router.push(`/explorer/${tx.chain?.chainSlug}`)} />}
                        </div>
                        <div className="text-xs text-zinc-500 mt-0.5">
                          <span className="text-zinc-400">From </span>
                          <Link 
                            href={buildAddressUrl(`/explorer/${tx.chain?.chainSlug}`, tx.from)} 
                            className="font-mono hover:underline cursor-pointer" 
                            style={{ color: tx.chain?.color || themeColor }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {shortenAddress(tx.from)}
                          </Link>
                          <span className="text-zinc-400"> → </span>
                          {tx.to ? (
                            <Link 
                              href={buildAddressUrl(`/explorer/${tx.chain?.chainSlug}`, tx.to)} 
                              className="font-mono hover:underline cursor-pointer" 
                              style={{ color: tx.chain?.color || themeColor }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              {shortenAddress(tx.to)}
                            </Link>
                          ) : (
                            <span className="font-mono text-zinc-400">Contract</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-xs px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 flex-shrink-0">
                      {formatTokenValue(tx.value)} {tx.chain?.tokenSymbol || ''}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ICM Messages */}
          {hasIcmMessages && (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-200 dark:border-zinc-800">
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
                  <Link2 className="w-4 h-4" style={{ color: themeColor }} />
                  ICM Messages
                </h2>
                <div className="flex items-center gap-1.5">
                  <Circle className="w-2 h-2 fill-green-500 text-green-500 animate-pulse" />
                  <span className="text-xs text-zinc-500 dark:text-zinc-400 font-normal">Live</span>
                </div>
              </div>
              <div className="divide-y divide-zinc-100 dark:divide-zinc-800 max-h-[400px] overflow-y-auto">
                {icmMessages.slice(0, 10).map((tx, index) => {
                  const sourceChain = tx.sourceBlockchainId ? getChainFromBlockchainId(tx.sourceBlockchainId) : null;
                  const destChain = tx.destinationBlockchainId ? getChainFromBlockchainId(tx.destinationBlockchainId) : null;
                  const iconColor = sourceChain?.color || tx.chain?.color || themeColor;
                  
                  return (
                    <div 
                      key={`icm-${tx.hash}-${index}`}
                      onClick={() => router.push(buildTxUrl(`/explorer/${tx.chain?.chainSlug}`, tx.hash))}
                      className={`block px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors cursor-pointer ${
                        newTxHashes.has(tx.hash) ? 'new-item' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div 
                            className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{ backgroundColor: `${iconColor}15` }}
                          >
                            <Link2 className="w-4 h-4" style={{ color: iconColor }} />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-mono text-xs hover:underline" style={{ color: iconColor }}>
                                {tx.hash.slice(0, 14)}...
                              </span>
                              <span className="text-xs text-zinc-400">
                                {formatTimeAgo(tx.timestamp)}
                              </span>
                            </div>
                            {/* Cross-chain chips */}
                            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                              {sourceChain ? (
                                <ChainChip chain={sourceChain} size="xs" onClick={() => router.push(`/explorer/${sourceChain.chainSlug}`)} />
                              ) : (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-zinc-100 dark:bg-zinc-700/50 text-zinc-500">
                                  Unknown
                                </span>
                              )}
                              <span className="text-zinc-400">→</span>
                              {destChain ? (
                                <ChainChip chain={destChain} size="xs" onClick={() => router.push(`/explorer/${destChain.chainSlug}`)} />
                              ) : (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-zinc-100 dark:bg-zinc-700/50 text-zinc-500">
                                  Unknown
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="text-xs px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 flex-shrink-0">
                          {formatTokenValue(tx.value)} {tx.chain?.tokenSymbol || ''}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

