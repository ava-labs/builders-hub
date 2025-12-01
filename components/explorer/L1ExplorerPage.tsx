"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { ArrowRightLeft, ArrowRight, Clock, Fuel, Box, Layers, DollarSign, Globe, Circle, Link2 } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Line, LineChart, ResponsiveContainer, Tooltip as RechartsTooltip, YAxis } from "recharts";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { buildBlockUrl, buildTxUrl, buildAddressUrl } from "@/utils/eip3091";
import { useExplorer } from "@/components/explorer/ExplorerContext";
import { formatTokenValue } from "@/utils/formatTokenValue";
import { formatPrice, formatAvaxPrice } from "@/utils/formatPrice";
import l1ChainsData from "@/constants/l1-chains.json";
import { ChainChip, ChainInfo } from "@/components/stats/ChainChip";

// Get chain info from hex blockchain ID
function getChainFromBlockchainId(hexBlockchainId: string): ChainInfo | null {
  const normalizedHex = hexBlockchainId.toLowerCase();
  
  // Find by blockchainId field (hex format)
  const chain = (l1ChainsData as any[]).find(c => 
    c.blockchainId?.toLowerCase() === normalizedHex
  );
  
  if (!chain) return null;
    
  return {
    chainId: chain.chainId,
    chainName: chain.chainName,
    chainSlug: chain.slug,
    chainLogoURI: chain.chainLogoURI || '',
    color: chain.color || '#6B7280',
    tokenSymbol: chain.tokenSymbol || '',
  };
}

interface Block {
  number: string;
  hash: string;
  timestamp: string;
  miner: string;
  transactionCount: number;
  gasUsed: string;
  gasLimit: string;
  baseFeePerGas?: string;
  gasFee?: string; // Gas fee in native token
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
  // Cross-chain info - blockchain IDs in hex format
  sourceBlockchainId?: string;
  destinationBlockchainId?: string;
}

interface ExplorerStats {
  latestBlock: number;
  totalTransactions: number;
  avgBlockTime: number;
  gasPrice: string;
  lastFinalizedBlock?: number;
  totalGasFeesInBlocks?: string;
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
  icmMessages: Transaction[]; // Cross-chain transactions from API
  transactionHistory?: TransactionHistoryPoint[];
  price?: PriceData;
  tokenSymbol?: string;
}

interface L1ExplorerPageProps {
  chainId: string;
  chainName: string;
  chainSlug: string;
  themeColor?: string;
  chainLogoURI?: string;
  nativeToken?: string;
  description?: string;
  website?: string;
  socials?: {
    twitter?: string;
    linkedin?: string;
  };
  rpcUrl?: string;
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


function formatMarketCap(num: number): string {
  if (num >= 1e12) return `$${(num / 1e12).toFixed(2)}T`;
  if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
  if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
  if (num >= 1e3) return `$${(num / 1e3).toFixed(2)}K`;
  return `$${num.toLocaleString()}`;
}

// Token symbol display component
function TokenDisplay({ symbol }: { symbol?: string }) {
  if (!symbol) {
    return <span className="text-zinc-500 dark:text-zinc-400">N/A</span>;
  }
  return <span>{symbol}</span>;
}

// Animated block number component - animates when value changes
function AnimatedBlockNumber({ value }: { value: number }) {
  const [displayValue, setDisplayValue] = useState(value);
  const [isAnimating, setIsAnimating] = useState(false);
  const previousValue = useRef(value);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    // Skip animation on initial render or if value hasn't changed
    if (previousValue.current === value) {
      setDisplayValue(value);
      return;
    }

    const startValue = previousValue.current;
    const endValue = value;
    const duration = 600; // Animation duration in ms
    let startTime: number | null = null;

    setIsAnimating(true);

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      
      // Easing function for smooth animation
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const currentValue = Math.floor(startValue + (endValue - startValue) * easeOut);
      
      setDisplayValue(currentValue);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        setDisplayValue(endValue);
        setIsAnimating(false);
        previousValue.current = endValue;
      }
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [value]);

  // Update previous value ref when value changes
  useEffect(() => {
    previousValue.current = value;
  }, [value]);

  return (
    <span className={`transition-colors duration-300 ${isAnimating ? 'text-green-500' : ''}`}>
      {displayValue.toLocaleString()}
    </span>
  );
}

// Animation styles for new items
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
`;

export default function L1ExplorerPage({
  chainId,
  chainName,
  chainSlug,
  themeColor = "#E57373",
  chainLogoURI,
  nativeToken,
  description,
  website,
  socials,
  rpcUrl,
}: L1ExplorerPageProps) {
  const router = useRouter();
  // Get token data from shared context (avoids duplicate fetches across explorer pages)
  const { tokenSymbol: contextTokenSymbol, priceData: contextPriceData, glacierSupported, buildApiUrl } = useExplorer();
  
  const [data, setData] = useState<ExplorerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isRateLimited, setIsRateLimited] = useState(false); // Track if we hit rate limit
  const [newBlockNumbers, setNewBlockNumbers] = useState<Set<string>>(new Set());
  const [newTxHashes, setNewTxHashes] = useState<Set<string>>(new Set());
  const [accumulatedBlocks, setAccumulatedBlocks] = useState<Block[]>([]); // Accumulated blocks
  const [accumulatedTransactions, setAccumulatedTransactions] = useState<Transaction[]>([]); // Accumulated transactions
  const [icmMessages, setIcmMessages] = useState<Transaction[]>([]);
  const previousDataRef = useRef<ExplorerData | null>(null);
  const isFirstLoadRef = useRef(true); // Track if this is the first load
  const isFetchingRef = useRef(false); // Prevent overlapping fetches
  const lastFetchedBlockRef = useRef<string | null>(null); // Track last fetched block
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null); // Track refresh timeout
  const isMountedRef = useRef(true); // Track if component is mounted
  const BLOCK_LIMIT = 100; // Maximum number of blocks to keep
  const TRANSACTION_LIMIT = 100; // Maximum number of transactions to keep
  const ICM_MESSAGE_LIMIT = 100; // Maximum number of ICM messages to keep
  const NORMAL_INTERVAL = 2500; // Normal refresh interval (ms)
  const RATE_LIMITED_INTERVAL = NORMAL_INTERVAL * 2; // Rate limited interval (2x normal)
  const FETCH_TIMEOUT = NORMAL_INTERVAL * 2; // Timeout for fetch requests (5s)

  // Get actual token symbol - prefer context (shared), fallback to API data
  // Don't use nativeToken as placeholder - show N/A instead
  const tokenSymbol = contextTokenSymbol || data?.tokenSymbol || data?.price?.symbol || undefined;

  // Fetch data and schedule next fetch after completion
  const fetchData = useCallback(async () => {
    // Prevent overlapping fetches or fetches after unmount
    if (isFetchingRef.current || !isMountedRef.current) {
      return;
    }
    
    // Clear any pending timeout
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
      refreshTimeoutRef.current = null;
    }
    
    isFetchingRef.current = true;
    let shouldScheduleNext = false;
    let nextIsRateLimited = false;
    
    try {
      setIsRefreshing(true);
      
      // Build URL with query parameters using context helper (includes rpcUrl for custom chains)
      const additionalParams: Record<string, string> = {};
      if (isFirstLoadRef.current) {
        additionalParams.initialLoad = 'true';
      } else if (lastFetchedBlockRef.current) {
        // Send last fetched block for incremental updates
        additionalParams.lastFetchedBlock = lastFetchedBlockRef.current;
      }
      const url = buildApiUrl(`/api/explorer/${chainId}`, additionalParams);
      
      // Create timeout promise that resolves to null (silent timeout)
      const timeoutPromise = new Promise<null>((resolve) => {
        setTimeout(() => resolve(null), FETCH_TIMEOUT * 2);
      });
      
      // Race fetch against timeout
      const response = await Promise.race([
        fetch(url),
        timeoutPromise
      ]);
      
      // If timeout occurred, silently schedule next fetch
      if (response === null) {
        shouldScheduleNext = true;
        nextIsRateLimited = true; // Use longer interval after timeout
        return;
      }
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fetch data");
      }
      const result = await response.json();
      
      // Update last fetched block from the response
      if (result.blocks && result.blocks.length > 0) {
        // Get the highest block number from the response
        const highestBlock = result.blocks.reduce((max: string, b: Block) => 
          parseInt(b.number) > parseInt(max) ? b.number : max, 
          result.blocks[0].number
        );
        lastFetchedBlockRef.current = highestBlock;
      }
      
      // Accumulate blocks from API response
      setAccumulatedBlocks((prevBlocks) => {
        const existingNumbers = new Set(prevBlocks.map(b => b.number));
        const newBlocks = (result.blocks || []).filter((b: Block) => 
          !existingNumbers.has(b.number)
        );
        
        // Detect new blocks for animation
        if (newBlocks.length > 0) {
          setNewBlockNumbers(new Set(newBlocks.map((b: Block) => b.number)));
          setTimeout(() => setNewBlockNumbers(new Set()), 1000);
        }
        
        // Add new blocks to the beginning (most recent first) and sort by block number
        const updatedBlocks = [...newBlocks, ...prevBlocks]
          .sort((a, b) => parseInt(b.number) - parseInt(a.number));
        
        // Apply limit - keep only the most recent blocks
        return updatedBlocks.slice(0, BLOCK_LIMIT);
      });
      
      // Accumulate transactions from API response
      setAccumulatedTransactions((prevTxs) => {
        const existingHashes = new Set(prevTxs.map(tx => tx.hash));
        const newTxs = (result.transactions || []).filter((tx: Transaction) => 
          !existingHashes.has(tx.hash)
        );
        
        // Detect new transactions for animation
        if (newTxs.length > 0) {
          setNewTxHashes(new Set(newTxs.map((tx: Transaction) => tx.hash)));
          setTimeout(() => setNewTxHashes(new Set()), 1000);
        }
        
        // Add new transactions to the beginning (most recent first)
        const updatedTxs = [...newTxs, ...prevTxs];
        
        // Apply limit - keep only the most recent transactions
        return updatedTxs.slice(0, TRANSACTION_LIMIT);
      });
      
      // Accumulate ICM messages from API response
      setIcmMessages((prevIcmMessages) => {
        const existingHashes = new Set(prevIcmMessages.map(tx => tx.hash));
        const newIcmTransactions = (result.icmMessages || []).filter((tx: Transaction) => 
          !existingHashes.has(tx.hash)
        );
        
        // Detect new ICM messages for animation
        if (newIcmTransactions.length > 0) {
          const newIcmHashes = new Set<string>(newIcmTransactions.map((tx: Transaction) => tx.hash));
          setNewTxHashes((prev) => {
            const combined = new Set<string>(prev);
            newIcmHashes.forEach((hash: string) => combined.add(hash));
            return combined;
          });
          setTimeout(() => {
            setNewTxHashes((prev) => {
              const updated = new Set<string>(prev);
              newIcmHashes.forEach((hash: string) => updated.delete(hash));
              return updated;
            });
          }, 1000);
        }
        
        // Add new ICM messages to the beginning (most recent first)
        const updatedIcmMessages = [...newIcmTransactions, ...prevIcmMessages];
        
        // Apply limit - keep only the most recent messages
        return updatedIcmMessages.slice(0, ICM_MESSAGE_LIMIT);
      });
      
      previousDataRef.current = result;
      // Only update data if there's new content, preserve existing data otherwise
      setData(prevData => {
        // If no new blocks/transactions, preserve existing data but update stats if needed
        if (result.blocks?.length === 0 && result.transactions?.length === 0) {
          // Nothing new - keep previous data as is
          return prevData;
        }
        // Merge new data, keeping transactionHistory from previous if not provided
        return {
          ...result,
          transactionHistory: result.transactionHistory ?? prevData?.transactionHistory ?? [],
        };
      });
      setError(null);
      setIsRateLimited(false);
      nextIsRateLimited = false;
      
      // Mark first load as complete and schedule next fetch
      if (isFirstLoadRef.current) {
        isFirstLoadRef.current = false;
      }
      shouldScheduleNext = true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "An error occurred";
      const rateLimited = errorMessage.includes('429');
      
      // Set rate limit flag for longer retry interval
      if (rateLimited) {
        setIsRateLimited(true);
        nextIsRateLimited = true;
      }
      
      // Only show error if we don't have existing data to display
      if (!data) {
        setError(errorMessage);
      }
      // Schedule next fetch even on error
      shouldScheduleNext = !isFirstLoadRef.current;
    } finally {
      isFetchingRef.current = false;
      setLoading(false);
      setIsRefreshing(false);
      
      // Schedule next fetch AFTER this one completes (wait full interval after response)
      if (shouldScheduleNext && isMountedRef.current) {
        const intervalTime = nextIsRateLimited ? RATE_LIMITED_INTERVAL : NORMAL_INTERVAL;
        refreshTimeoutRef.current = setTimeout(() => {
          if (isMountedRef.current) {
            fetchData();
          }
        }, intervalTime);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chainId]);

  // Track mount state
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Reset state and fetch data when chain changes
  useEffect(() => {
    // Clear any pending timeout
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
      refreshTimeoutRef.current = null;
    }
    
    // Reset refs for new chain
    isFirstLoadRef.current = true;
    lastFetchedBlockRef.current = null;
    isFetchingRef.current = false;
    
    // Clear accumulated data
    setAccumulatedBlocks([]);
    setAccumulatedTransactions([]);
    setIcmMessages([]);
    setData(null);
    setLoading(true);
    
    // Start fetching for this chain
    fetchData();
    
    // Cleanup: clear timeout when chain changes
    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
        refreshTimeoutRef.current = null;
      }
      isFetchingRef.current = false;
    };
  }, [chainId, fetchData]);

  // Get transaction history or show empty placeholder
  const transactionHistory = useMemo(() => {
    if (data?.transactionHistory && data.transactionHistory.length > 0) {
      return data.transactionHistory;
    }
    
    // Return zeros as placeholder when no indexed data
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
  }, [data?.transactionHistory]);

  // Check if we have real indexed transaction history data
  const hasIndexedTransactionHistory = useMemo(() => {
    return data?.transactionHistory && data.transactionHistory.length > 0 && 
           data.transactionHistory.some(point => point.transactions > 0);
  }, [data?.transactionHistory]);

  // Calculate TPS from accumulated blocks
  const calculatedTps = useMemo(() => {
    if (accumulatedBlocks.length < 2) {
      return 0;
    }

    // Get timestamps (blocks are sorted by block number descending - newest first)
    const timestamps = accumulatedBlocks.map(b => new Date(b.timestamp).getTime() / 1000);
    const firstBlockTime = timestamps[0]; // Newest block
    const lastBlockTime = timestamps[timestamps.length - 1]; // Oldest block
    
    // Calculate total time as difference between first and last block
    const totalTime = firstBlockTime - lastBlockTime;
    
    if (totalTime <= 0) {
      return 0;
    }

    // Sum total transactions from accumulated blocks
    const totalTxs = accumulatedBlocks.reduce((sum, b) => sum + b.transactionCount, 0);
    const tps = totalTxs / totalTime;

    return Math.round(tps * 100) / 100;
  }, [accumulatedBlocks]);

  if (loading) {
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

  if (error) {
    return (
      <>
        <style>{newItemStyles}</style>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
          <div className="text-center">
            <p className="text-red-500 mb-4">{error}</p>
            <Button onClick={fetchData}>Retry</Button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{newItemStyles}</style>

      {/* Stats Card - Left stats, Right transaction history */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5">
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Left: Stats Grid */}
            <div className="lg:col-span-2 grid grid-cols-2 md:grid-cols-3 gap-x-5 gap-y-4">
              {/* Token Price */}
              <div className="flex items-center gap-2.5">
                <div 
                  className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: `${themeColor}15` }}
                >
                  {chainLogoURI ? (
                    <img src={chainLogoURI} alt="" className="w-5 h-5 rounded" />
                  ) : (
                    <DollarSign className="w-5 h-5" style={{ color: themeColor }} />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="text-xs text-zinc-500 dark:text-zinc-400 tracking-wide">
                    <TokenDisplay symbol={tokenSymbol} /> Price
                  </div>
                  {data?.price ? (
                    <div className="flex items-baseline gap-1 flex-wrap">
                      <span className="text-base font-bold text-zinc-900 dark:text-white">
                        {formatPrice(data.price.price)}
                      </span>
                      {data.price.priceInAvax && (
                        <span className="text-[11px] text-zinc-500">
                          @ {formatAvaxPrice(data.price.priceInAvax)} AVAX
                        </span>
                      )}
                      <span className={`text-[11px] ${data.price.change24h >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        ({data.price.change24h >= 0 ? '+' : ''}{data.price.change24h.toFixed(2)}%)
                      </span>
                    </div>
                  ) : (
                    <span className="text-base font-bold text-zinc-400">N/A</span>
                  )}
                </div>
              </div>

              {/* Market Cap */}
              <div className="flex items-center gap-2.5">
                <div 
                  className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: `${themeColor}15` }}
                >
                  <Globe className="w-5 h-5" style={{ color: themeColor }} />
                </div>
                <div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
                    Market Cap
                  </div>
                  <div className="text-base font-bold text-zinc-900 dark:text-white">
                    {data?.price?.marketCap ? formatMarketCap(data.price.marketCap) : 'N/A'}
                  </div>
                </div>
              </div>

              {/* Transactions */}
              <div className="flex items-center gap-2.5">
                <div 
                  className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: `${themeColor}15` }}
                >
                  <ArrowRightLeft className="w-5 h-5" style={{ color: themeColor }} />
                </div>
                <div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
                    Transactions
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-base font-bold text-zinc-900 dark:text-white">
                      {formatNumber(data?.stats.totalTransactions || 0)}
                    </span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span 
                          className="text-[11px] text-zinc-500 cursor-help border-b border-dashed border-zinc-400 dark:border-zinc-500"
                        >
                          ({calculatedTps} TPS)
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Calculated from last {accumulatedBlocks.length} block{accumulatedBlocks.length !== 1 ? 's' : ''}</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              </div>

              {/* Gas Price */}
              <div className="flex items-center gap-2.5">
                <div 
                  className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: `${themeColor}15` }}
                >
                  <Fuel className="w-5 h-5" style={{ color: themeColor }} />
                </div>
                <div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
                    Med Gas Price
                  </div>
                  <div className="text-base font-bold text-zinc-900 dark:text-white">
                    {data?.stats.gasPrice}
                  </div>
                </div>
              </div>

              {/* Last Block */}
              <div className="flex items-center gap-2.5">
                <div 
                  className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: `${themeColor}15` }}
                >
                  <Layers className="w-5 h-5" style={{ color: themeColor }} />
                </div>
                <div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
                    Last Block
                  </div>
                  <div className="text-base font-bold text-zinc-900 dark:text-white">
                    <AnimatedBlockNumber value={data?.stats.latestBlock || 0} />
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Transaction History Chart */}
            <div className="lg:col-span-1 border-l-0 lg:border-l border-zinc-100 dark:border-zinc-800 pl-0 lg:pl-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
                  Transaction History (14 Days)
                </span>
              </div>
              <div className="relative">
                <div className={`h-14 ${!hasIndexedTransactionHistory ? 'blur-[2px] opacity-50' : ''}`}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={transactionHistory}>
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
                {/* Overlay for non-indexed chains */}
                {!hasIndexedTransactionHistory && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-xs text-zinc-500 dark:text-zinc-400 bg-white/80 dark:bg-zinc-900/80 px-2 py-1 rounded">
                      No indexed data
                    </span>
                  </div>
                )}
              </div>
              <div className={`flex justify-between text-[11px] text-zinc-400 mt-1.5 ${!hasIndexedTransactionHistory ? 'opacity-50' : ''}`}>
                <span>{transactionHistory[0]?.date}</span>
                <span>{transactionHistory[transactionHistory.length - 1]?.date}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Blocks, Transactions, and ICM Messages Tables */}
      {(() => {
        const hasIcmMessages = icmMessages.length > 0;
        
        return (
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
                  key={block.number}
                  href={buildBlockUrl(`/explorer/${chainSlug}`, block.number)}
                  className={`block px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors cursor-pointer ${
                    newBlockNumbers.has(block.number) ? 'new-item' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: `${themeColor}15` }}
                      >
                        <Box className="w-4 h-4" style={{ color: themeColor }} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm hover:underline" style={{ color: themeColor }}>
                            {block.number}
                          </span>
                          <span className="text-xs text-zinc-400">
                            {formatTimeAgo(block.timestamp)}
                          </span>
                        </div>
                        <div className="text-xs text-zinc-500 mt-0.5">
                          <span style={{ color: themeColor }}>{block.transactionCount} txns</span>
                          <span className="text-zinc-400"> • {block.gasUsed} gas</span>
                        </div>
                      </div>
                    </div>
                    {block.gasFee && parseFloat(block.gasFee) > 0 && (
                      <div className="text-xs px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 flex-shrink-0">
                        {chainId === "43114" && <span className="mr-1">🔥</span>}
                            {formatTokenValue(block.gasFee)} <TokenDisplay symbol={tokenSymbol} />
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
                  onClick={() => router.push(buildTxUrl(`/explorer/${chainSlug}`, tx.hash))}
                  className={`block px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors cursor-pointer ${
                    newTxHashes.has(tx.hash) ? 'new-item' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: `${themeColor}15` }}
                      >
                        <ArrowRightLeft className="w-4 h-4" style={{ color: themeColor }} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-xs hover:underline" style={{ color: themeColor }}>
                            {tx.hash.slice(0, 16)}...
                          </span>
                          <span className="text-xs text-zinc-400">
                            {formatTimeAgo(tx.timestamp)}
                          </span>
                        </div>
                        <div className="text-xs text-zinc-500 mt-0.5">
                          <span className="text-zinc-400">From </span>
                          <Link 
                            href={buildAddressUrl(`/explorer/${chainSlug}`, tx.from)} 
                                className="font-mono hover:underline cursor-pointer" 
                            style={{ color: themeColor }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {shortenAddress(tx.from)}
                          </Link>
                        </div>
                        <div className="text-xs text-zinc-500">
                          <span className="text-zinc-400">To </span>
                          {tx.to ? (
                            <Link 
                              href={buildAddressUrl(`/explorer/${chainSlug}`, tx.to)} 
                                  className="font-mono hover:underline cursor-pointer" 
                              style={{ color: themeColor }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              {shortenAddress(tx.to)}
                            </Link>
                          ) : (
                            <span className="font-mono text-zinc-400">Contract Creation</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-xs px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 flex-shrink-0">
                          {formatTokenValue(tx.value)} <TokenDisplay symbol={tokenSymbol} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

              {/* ICM Messages - Only show if there are cross-chain transactions */}
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
                    {icmMessages.map((tx, index) => (
                      <div 
                        key={`icm-${tx.hash}-${index}`}
                        onClick={() => router.push(buildTxUrl(`/explorer/${chainSlug}`, tx.hash))}
                        className={`block px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors cursor-pointer ${
                          newTxHashes.has(tx.hash) ? 'new-item' : ''
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div 
                              className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                              style={{ backgroundColor: `${themeColor}15` }}
                            >
                              <Link2 className="w-4 h-4" style={{ color: themeColor }} />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono text-xs hover:underline" style={{ color: themeColor }}>
                                  {tx.hash.slice(0, 16)}...
                                </span>
                                <span className="text-xs text-zinc-400">
                                  {formatTimeAgo(tx.timestamp)}
                                </span>
                              </div>
                              {/* Cross-chain transfer chips */}
                              {(() => {
                                const sourceChain = tx.sourceBlockchainId ? getChainFromBlockchainId(tx.sourceBlockchainId) : null;
                                const destChain = tx.destinationBlockchainId ? getChainFromBlockchainId(tx.destinationBlockchainId) : null;
                                
                                return (
                                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                    {/* Source Chain Chip */}
                                    {sourceChain ? (
                                      <ChainChip 
                                        chain={sourceChain} 
                                        size="xs" 
                                        onClick={() => router.push(`/explorer/${sourceChain.chainSlug}`)} 
                                      />
                                    ) : (
                                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-zinc-100 dark:bg-zinc-700/50 text-zinc-500 dark:text-zinc-400">
                                        <span className="w-3 h-3 rounded-full bg-zinc-300 dark:bg-zinc-600" />
                                        Unknown
                                      </span>
                                    )}
                                    
                                    <span className="text-zinc-400">→</span>
                                    
                                    {/* Destination Chain Chip */}
                                    {destChain ? (
                                      <ChainChip 
                                        chain={destChain} 
                                        size="xs" 
                                        onClick={() => router.push(`/explorer/${destChain.chainSlug}`)} 
                                      />
                                    ) : (
                                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-zinc-100 dark:bg-zinc-700/50 text-zinc-500 dark:text-zinc-400">
                                        <span className="w-3 h-3 rounded-full bg-zinc-300 dark:bg-zinc-600" />
                                        Unknown
                                      </span>
                                    )}
                                  </div>
                                );
                              })()}
                            </div>
                          </div>
                          <div className="text-xs px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 flex-shrink-0">
                            {formatTokenValue(tx.value)} <TokenDisplay symbol={tokenSymbol} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
    </div>
        );
      })()}
    </>
  );
}
