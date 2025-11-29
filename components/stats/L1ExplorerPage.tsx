"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { ArrowRightLeft, ArrowRight, Clock, Fuel, Box, Layers, DollarSign, Globe, Circle, Link2 } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Line, LineChart, ResponsiveContainer, Tooltip, YAxis } from "recharts";
import { buildBlockUrl, buildTxUrl, buildAddressUrl } from "@/utils/eip3091";
import { useExplorer } from "@/components/stats/ExplorerContext";
import { formatTokenValue } from "@/utils/formatTokenValue";
import { formatPrice, formatAvaxPrice } from "@/utils/formatPrice";
import l1ChainsData from "@/constants/l1-chains.json";

// Get chain info from hex blockchain ID
interface ChainLookupResult {
  chainName: string;
  chainLogoURI: string;
  slug: string;
  color: string;
  chainId: string;
  tokenSymbol: string;
}

function getChainFromBlockchainId(hexBlockchainId: string): ChainLookupResult | null {
  const normalizedHex = hexBlockchainId.toLowerCase();
  
  // Find by blockchainId field (hex format)
  const chain = (l1ChainsData as any[]).find(c => 
    c.blockchainId?.toLowerCase() === normalizedHex
  );
  
  if (!chain) return null;
    
  return {
    chainName: chain.chainName,
    chainLogoURI: chain.chainLogoURI || '',
    slug: chain.slug,
    color: chain.color || '#6B7280',
    chainId: chain.chainId,
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
  tps: number;
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
  const { tokenSymbol: contextTokenSymbol, priceData: contextPriceData, glacierSupported } = useExplorer();
  
  const [data, setData] = useState<ExplorerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [newBlockNumbers, setNewBlockNumbers] = useState<Set<string>>(new Set());
  const [newTxHashes, setNewTxHashes] = useState<Set<string>>(new Set());
  const [icmMessages, setIcmMessages] = useState<Transaction[]>([]);
  const previousDataRef = useRef<ExplorerData | null>(null);
  const ICM_MESSAGE_LIMIT = 100; // Maximum number of ICM messages to keep

  // Get actual token symbol - prefer context (shared), fallback to API data
  // Don't use nativeToken as placeholder - show N/A instead
  const tokenSymbol = contextTokenSymbol || data?.tokenSymbol || data?.price?.symbol || undefined;

  const fetchData = useCallback(async () => {
    try {
      setIsRefreshing(true);
      const response = await fetch(`/api/explorer/${chainId}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fetch data");
      }
      const result = await response.json();
      
      // Detect new blocks and transactions for animation
      if (previousDataRef.current) {
        const prevBlockNumbers = new Set(previousDataRef.current.blocks.map(b => b.number));
        const prevTxHashes = new Set(previousDataRef.current.transactions.map(t => t.hash));
        const prevIcmHashes = new Set((previousDataRef.current.icmMessages || []).map(t => t.hash));
        
        const newBlocks = result.blocks.filter((b: Block) => !prevBlockNumbers.has(b.number)).map((b: Block) => b.number);
        const newTxs = result.transactions.filter((t: Transaction) => !prevTxHashes.has(t.hash)).map((t: Transaction) => t.hash);
        const newIcmTxs = (result.icmMessages || []).filter((t: Transaction) => !prevIcmHashes.has(t.hash)).map((t: Transaction) => t.hash);
        
        if (newBlocks.length > 0) {
          setNewBlockNumbers(new Set(newBlocks));
          setTimeout(() => setNewBlockNumbers(new Set()), 1000);
        }
        if (newTxs.length > 0) {
          setNewTxHashes(new Set(newTxs));
          setTimeout(() => setNewTxHashes(new Set()), 1000);
        }
        if (newIcmTxs.length > 0) {
          setNewTxHashes(new Set(newIcmTxs));
          setTimeout(() => setNewTxHashes(new Set()), 1000);
        }
      }
      
      // Accumulate ICM messages from API response
      setIcmMessages((prevIcmMessages) => {
        const existingHashes = new Set(prevIcmMessages.map(tx => tx.hash));
        const newIcmTransactions = (result.icmMessages || []).filter((tx: Transaction) => 
          !existingHashes.has(tx.hash)
        );
        
        // Add new ICM messages to the beginning (most recent first)
        const updatedIcmMessages = [...newIcmTransactions, ...prevIcmMessages];
        
        // Apply limit - keep only the most recent messages
        return updatedIcmMessages.slice(0, ICM_MESSAGE_LIMIT);
      });
      
      previousDataRef.current = result;
      setData(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [chainId]);

  useEffect(() => {
    fetchData();
    // Auto-refresh every 10 seconds
    const interval = setInterval(fetchData, 2500);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Generate transaction history if not available
  const transactionHistory = useMemo(() => {
    if (data?.transactionHistory && data.transactionHistory.length > 0) {
      return data.transactionHistory;
    }
    
    // Generate sample data
    const history: TransactionHistoryPoint[] = [];
    const now = new Date();
    for (let i = 13; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      history.push({
        date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        transactions: Math.floor(Math.random() * 50000) + 10000,
      });
    }
    return history;
  }, [data?.transactionHistory]);

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
                    <span className="text-[11px] text-zinc-500">
                      ({data?.stats.tps} TPS)
                    </span>
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
              <div className="h-14">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={transactionHistory}>
                    <YAxis hide domain={['dataMin', 'dataMax']} />
                    <Tooltip
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
                    <Line
                      type="monotone"
                      dataKey="transactions"
                      stroke={themeColor}
                      strokeWidth={1.5}
                      dot={false}
                      activeDot={{ r: 3, fill: themeColor }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="flex justify-between text-[11px] text-zinc-400 mt-1.5">
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
              {data?.blocks.map((block) => (
                <Link 
                  key={block.number}
                  href={buildBlockUrl(`/stats/l1/${chainSlug}/explorer`, block.number)}
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
              {data?.transactions.map((tx, index) => (
                <div 
                  key={`${tx.hash}-${index}`}
                  onClick={() => router.push(buildTxUrl(`/stats/l1/${chainSlug}/explorer`, tx.hash))}
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
                            href={buildAddressUrl(`/stats/l1/${chainSlug}/explorer`, tx.from)} 
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
                              href={buildAddressUrl(`/stats/l1/${chainSlug}/explorer`, tx.to)} 
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
                        onClick={() => router.push(buildTxUrl(`/stats/l1/${chainSlug}/explorer`, tx.hash))}
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
                                      <Link 
                                        href={`/stats/l1/${sourceChain.slug}/explorer`}
                                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium hover:opacity-80 cursor-pointer"
                                        style={{ backgroundColor: `${sourceChain.color}20`, color: sourceChain.color }}
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        {sourceChain.chainLogoURI ? (
                                          <Image
                                            src={sourceChain.chainLogoURI}
                                            alt={sourceChain.chainName}
                                            width={12}
                                            height={12}
                                            className="rounded-full"
                                          />
                                        ) : (
                                          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: sourceChain.color }} />
                                        )}
                                        {sourceChain.chainName}
                                      </Link>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-zinc-100 dark:bg-zinc-700/50 text-zinc-500 dark:text-zinc-400">
                                        <span className="w-3 h-3 rounded-full bg-zinc-300 dark:bg-zinc-600" />
                                        Unknown
                                      </span>
                                    )}
                                    
                                    <span className="text-zinc-400">→</span>
                                    
                                    {/* Destination Chain Chip */}
                                    {destChain ? (
                                      <Link 
                                        href={`/stats/l1/${destChain.slug}/explorer`}
                                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium hover:opacity-80 cursor-pointer"
                                        style={{ backgroundColor: `${destChain.color}20`, color: destChain.color }}
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        {destChain.chainLogoURI ? (
                                          <Image
                                            src={destChain.chainLogoURI}
                                            alt={destChain.chainName}
                                            width={12}
                                            height={12}
                                            className="rounded-full"
                                          />
                                        ) : (
                                          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: destChain.color }} />
                                        )}
                                        {destChain.chainName}
                                      </Link>
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
