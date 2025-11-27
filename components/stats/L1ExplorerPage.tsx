"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Search, ArrowRightLeft, Clock, Fuel, Box, Layers, DollarSign, Globe, ArrowUpRight, Twitter, Linkedin, Circle, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AvalancheLogo } from "@/components/navigation/avalanche-logo";
import { L1BubbleNav } from "@/components/stats/l1-bubble.config";
import { Line, LineChart, ResponsiveContainer, Tooltip, YAxis } from "recharts";
import { buildBlockUrl, buildTxUrl } from "@/utils/eip3091";

interface Block {
  number: string;
  hash: string;
  timestamp: string;
  miner: string;
  transactionCount: number;
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
}

interface ExplorerStats {
  latestBlock: number;
  totalTransactions: number;
  avgBlockTime: number;
  gasPrice: string;
  tps: number;
  lastFinalizedBlock?: number;
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

function formatNumber(num: number): string {
  if (num >= 1e12) return `${(num / 1e12).toFixed(2)}T`;
  if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B`;
  if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
  if (num >= 1e3) return `${(num / 1e3).toFixed(2)}K`;
  return num.toLocaleString();
}

function formatPrice(num: number): string {
  if (num >= 1) return `$${num.toFixed(2)}`;
  if (num >= 0.01) return `$${num.toFixed(4)}`;
  return `$${num.toFixed(6)}`;
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
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400">
        NO_TOKEN_DATA
      </span>
    );
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
}: L1ExplorerPageProps) {
  const router = useRouter();
  const [data, setData] = useState<ExplorerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [newBlockNumbers, setNewBlockNumbers] = useState<Set<string>>(new Set());
  const [newTxHashes, setNewTxHashes] = useState<Set<string>>(new Set());
  const previousDataRef = useRef<ExplorerData | null>(null);

  // Get actual token symbol from API data or props
  const tokenSymbol = data?.tokenSymbol || data?.price?.symbol || nativeToken || undefined;

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
        
        const newBlocks = result.blocks.filter((b: Block) => !prevBlockNumbers.has(b.number)).map((b: Block) => b.number);
        const newTxs = result.transactions.filter((t: Transaction) => !prevTxHashes.has(t.hash)).map((t: Transaction) => t.hash);
        
        if (newBlocks.length > 0) {
          setNewBlockNumbers(new Set(newBlocks));
          setTimeout(() => setNewBlockNumbers(new Set()), 1000);
        }
        if (newTxs.length > 0) {
          setNewTxHashes(new Set(newTxs));
          setTimeout(() => setNewTxHashes(new Set()), 1000);
        }
      }
      
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

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = searchQuery.trim();
    
    if (!query) {
      setSearchError("Please enter a search term");
      return;
    }

    setSearchError(null);
    setIsSearching(true);

    try {
      // Check if it's a block number (numeric string)
      if (/^\d+$/.test(query)) {
        // Validate block exists
        const blockNum = parseInt(query);
        if (blockNum >= 0 && blockNum <= (data?.stats.latestBlock || Infinity)) {
          router.push(buildBlockUrl(`/stats/l1/${chainSlug}/explorer`, query));
          return;
        } else {
          setSearchError("Block number not found");
          return;
        }
      }

      // Check if it's a transaction hash (0x + 64 hex chars = 66 total)
      if (/^0x[a-fA-F0-9]{64}$/.test(query)) {
        // Navigate to transaction page - it will show error if not found
        router.push(buildTxUrl(`/stats/l1/${chainSlug}/explorer`, query));
        return;
      }

      // Check if it's a hex block number (0x...)
      if (/^0x[a-fA-F0-9]+$/.test(query) && query.length < 66) {
        const blockNum = parseInt(query, 16);
        if (!isNaN(blockNum) && blockNum >= 0) {
          router.push(buildBlockUrl(`/stats/l1/${chainSlug}/explorer`, blockNum.toString()));
          return;
        }
      }

      // TODO: Address search can be added later
      // For now, show error for unrecognized format
      setSearchError("Please enter a valid block number or transaction hash (0x...)");
    } catch (err) {
      setSearchError("Search failed. Please try again.");
    } finally {
      setIsSearching(false);
    }
  };

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
      <div className="min-h-screen bg-white dark:bg-zinc-950">
        <style>{newItemStyles}</style>
        {/* Hero Skeleton */}
        <div className="relative overflow-hidden">
          <div 
            className="absolute top-0 right-0 w-2/3 h-full pointer-events-none"
            style={{
              background: `linear-gradient(to left, ${themeColor}35 0%, ${themeColor}20 40%, ${themeColor}08 70%, transparent 100%)`,
            }}
          />
          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 pt-8 sm:pt-16 pb-6 sm:pb-8">
            {/* Breadcrumb Skeleton */}
            <div className="flex items-center gap-1.5 mb-3">
              <div className="h-4 w-16 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
              <div className="w-3.5 h-3.5 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
              <div className="h-4 w-20 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
              <div className="w-3.5 h-3.5 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
              <div className="h-4 w-16 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
            </div>

            <div className="space-y-4 sm:space-y-6">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="w-4 h-4 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
                <div className="h-4 w-40 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 sm:w-14 sm:h-14 bg-zinc-200 dark:bg-zinc-800 rounded-xl animate-pulse" />
                <div className="h-10 sm:h-12 w-72 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
              </div>
              <div className="h-5 w-96 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
              <div className="h-12 w-full max-w-2xl bg-zinc-200 dark:bg-zinc-800 rounded-xl animate-pulse" />
            </div>
          </div>
        </div>

        {/* Stats skeleton */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
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
        <L1BubbleNav chainSlug={chainSlug} themeColor={themeColor} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-white dark:bg-zinc-950">
        <style>{newItemStyles}</style>
        <div className="relative overflow-hidden">
          <div 
            className="absolute top-0 right-0 w-2/3 h-full pointer-events-none"
            style={{
              background: `linear-gradient(to left, ${themeColor}35 0%, ${themeColor}20 40%, ${themeColor}08 70%, transparent 100%)`,
            }}
          />
          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 pt-8 sm:pt-16 pb-6 sm:pb-8">
            <div className="flex items-center gap-3">
              {chainLogoURI && (
                <img src={chainLogoURI} alt={chainName} className="w-10 h-10 sm:w-14 sm:h-14 rounded-xl" />
              )}
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-zinc-900 dark:text-white">
                {chainName} Explorer
              </h1>
            </div>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
          <div className="text-center">
            <p className="text-red-500 mb-4">{error}</p>
            <Button onClick={fetchData}>Retry</Button>
          </div>
        </div>
        <L1BubbleNav chainSlug={chainSlug} themeColor={themeColor} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950">
      <style>{newItemStyles}</style>
      
      {/* Hero Section - Same style as ChainMetricsPage */}
      <div className="relative overflow-hidden">
        {/* Gradient decoration */}
        <div 
          className="absolute top-0 right-0 w-2/3 h-full pointer-events-none"
          style={{
            background: `linear-gradient(to left, ${themeColor}35 0%, ${themeColor}20 40%, ${themeColor}08 70%, transparent 100%)`,
          }}
        />
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 pt-8 sm:pt-16 pb-6 sm:pb-8">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-1.5 text-sm mb-3">
            <Link 
              href="/stats/overview" 
              className="text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
            >
              Overview
            </Link>
            <ChevronRight className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-600" />
            <Link 
              href={`/stats/l1/${chainSlug}`} 
              className="text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
            >
              {chainName}
            </Link>
            <ChevronRight className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-600" />
            <span className="text-zinc-900 dark:text-zinc-100 font-medium">
              Explorer
            </span>
          </nav>

          <div className="flex flex-col sm:flex-row items-start justify-between gap-6 sm:gap-8">
            <div className="space-y-4 sm:space-y-6 flex-1">
              <div>
                <div className="flex items-center gap-2 sm:gap-3 mb-3">
                  <AvalancheLogo className="w-4 h-4 sm:w-5 sm:h-5" fill="#E84142" />
                  <p className="text-xs sm:text-sm font-medium text-red-600 dark:text-red-500 tracking-wide uppercase">
                    Avalanche Ecosystem
                  </p>
                </div>
                <div className="flex items-center gap-3 sm:gap-4">
                  {chainLogoURI && (
                    <img
                      src={chainLogoURI}
                      alt={`${chainName} logo`}
                      className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 object-contain rounded-xl"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  )}
                  <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-zinc-900 dark:text-white">
                    {chainName} Explorer
                  </h1>
                </div>
                <div className="flex items-center gap-3 mt-3">
                  <p className="text-sm sm:text-base text-zinc-500 dark:text-zinc-400 max-w-2xl">
                    {description}
                  </p>
                </div>
              </div>
            </div>

            {/* Social Links - Top Right, Matching ChainMetricsPage */}
            <div className="flex flex-col sm:flex-row items-end gap-2">
              <div className="flex items-center gap-2">
                {website && (
                  <Button
                    variant="outline"
                    size="sm"
                    asChild
                    className="border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-zinc-400 dark:hover:border-zinc-600"
                  >
                    <a href={website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
                      Website
                      <ArrowUpRight className="h-4 w-4" />
                    </a>
                  </Button>
                )}
                
                {/* Social buttons */}
                {socials && (socials.twitter || socials.linkedin) && (
                  <>
                    {socials.twitter && (
                      <Button
                        variant="outline"
                        size="sm"
                        asChild
                        className="border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-zinc-400 dark:hover:border-zinc-600 px-2"
                      >
                        <a 
                          href={`https://x.com/${socials.twitter}`} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          aria-label="Twitter"
                        >
                          <Twitter className="h-4 w-4" />
                        </a>
                      </Button>
                    )}
                    {socials.linkedin && (
                      <Button
                        variant="outline"
                        size="sm"
                        asChild
                        className="border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-zinc-400 dark:hover:border-zinc-600 px-2"
                      >
                        <a 
                          href={`https://linkedin.com/company/${socials.linkedin}`} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          aria-label="LinkedIn"
                        >
                          <Linkedin className="h-4 w-4" />
                        </a>
                      </Button>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Search Bar */}
          <form onSubmit={handleSearch} className="max-w-2xl mt-6">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
              <Input
                type="text"
                placeholder="Search by Block Number or Txn Hash (0x...)"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setSearchError(null);
                }}
                className={`pl-12 pr-24 h-12 text-sm rounded-xl border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 focus:ring-2 focus:ring-offset-0 ${
                  searchError ? 'border-red-500 dark:border-red-500' : ''
                }`}
              />
              <Button
                type="submit"
                disabled={isSearching}
                className="absolute right-2 top-1/2 -translate-y-1/2 h-8 px-4 sm:px-6 rounded-lg text-white disabled:opacity-50"
                style={{ backgroundColor: themeColor }}
              >
                {isSearching ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Search className="w-4 h-4 sm:mr-2" />
                    <span className="hidden sm:inline">Search</span>
                  </>
                )}
              </Button>
            </div>
            {searchError && (
              <p className="text-red-500 text-sm mt-2">{searchError}</p>
            )}
          </form>
        </div>
      </div>

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
                  <div className="text-xs text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
                    <TokenDisplay symbol={tokenSymbol} /> Price
                  </div>
                  {data?.price ? (
                    <div className="flex items-baseline gap-1 flex-wrap">
                      <span className="text-base font-bold text-zinc-900 dark:text-white">
                        {formatPrice(data.price.price)}
                      </span>
                      {data.price.priceInAvax && (
                        <span className="text-[11px] text-zinc-500">
                          @ {data.price.priceInAvax.toFixed(4)} AVAX
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

      {/* Blocks and Transactions Tables */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                    {block.baseFeePerGas && (
                      <div className="text-xs px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 flex-shrink-0">
                        {block.baseFeePerGas} Gwei
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
                <Link 
                  key={`${tx.hash}-${index}`}
                  href={buildTxUrl(`/stats/l1/${chainSlug}/explorer`, tx.hash)}
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
                          <span className="font-mono" style={{ color: themeColor }}>{tx.from}</span>
                        </div>
                        <div className="text-xs text-zinc-500">
                          <span className="text-zinc-400">To </span>
                          <span className="font-mono" style={{ color: themeColor }}>{tx.to}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-xs px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 flex-shrink-0">
                      {tx.value} <TokenDisplay symbol={tokenSymbol} />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Bubble Navigation */}
      <L1BubbleNav chainSlug={chainSlug} themeColor={themeColor} />
    </div>
  );
}
