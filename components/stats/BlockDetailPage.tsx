"use client";

import { useState, useEffect, useCallback } from "react";
import { Box, Clock, Fuel, Hash, ArrowLeft, ArrowRight, ChevronRight, ChevronUp, ChevronDown, Layers, FileText, ArrowRightLeft, ArrowUpRight, Twitter, Linkedin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AvalancheLogo } from "@/components/navigation/avalanche-logo";
import { L1BubbleNav } from "@/components/stats/l1-bubble.config";
import { DetailRow, CopyButton } from "@/components/stats/DetailRow";
import Link from "next/link";
import { buildBlockUrl, buildTxUrl } from "@/utils/eip3091";

interface BlockDetail {
  number: string;
  hash: string;
  parentHash: string;
  timestamp: string;
  miner: string;
  transactionCount: number;
  transactions: string[];
  gasUsed: string;
  gasLimit: string;
  baseFeePerGas?: string;
  size?: string;
  nonce?: string;
  difficulty?: string;
  totalDifficulty?: string;
  extraData?: string;
  stateRoot?: string;
  receiptsRoot?: string;
  transactionsRoot?: string;
}

interface TransactionDetail {
  hash: string;
  from: string;
  to: string | null;
  value: string;
  gasPrice: string;
  gas: string;
  nonce: string;
  blockNumber: string;
  transactionIndex: string;
  input: string;
}

interface BlockDetailPageProps {
  chainId: string;
  chainName: string;
  chainSlug: string;
  blockNumber: string;
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

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  let timeAgo = "";
  if (diffInSeconds < 60) timeAgo = `${diffInSeconds} secs ago`;
  else if (diffInSeconds < 3600) timeAgo = `${Math.floor(diffInSeconds / 60)} mins ago`;
  else if (diffInSeconds < 86400) timeAgo = `${Math.floor(diffInSeconds / 3600)} hrs ago`;
  else timeAgo = `${Math.floor(diffInSeconds / 86400)} days ago`;

  const formatted = date.toLocaleString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
    timeZoneName: 'short'
  });

  return `${timeAgo} (${formatted})`;
}

function formatGasUsedPercentage(gasUsed: string, gasLimit: string): string {
  const used = parseInt(gasUsed);
  const limit = parseInt(gasLimit);
  const percentage = limit > 0 ? ((used / limit) * 100).toFixed(2) : '0';
  return `${used.toLocaleString()} (${percentage}%)`;
}

function formatAddress(address: string): string {
  if (!address) return '-';
  return `${address.slice(0, 10)}...${address.slice(-8)}`;
}

function formatValue(value: string): string {
  if (!value) return '0';
  const wei = BigInt(value);
  const eth = Number(wei) / 1e18;
  if (eth === 0) return '0';
  if (eth < 0.000001) return '<0.000001';
  return eth.toFixed(6);
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

export default function BlockDetailPage({
  chainId,
  chainName,
  chainSlug,
  blockNumber,
  themeColor = "#E57373",
  chainLogoURI,
  nativeToken,
  description,
  website,
  socials,
}: BlockDetailPageProps) {
  const [block, setBlock] = useState<BlockDetail | null>(null);
  const [transactions, setTransactions] = useState<TransactionDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [txLoading, setTxLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showMore, setShowMore] = useState(false);
  const [tokenSymbol, setTokenSymbol] = useState<string | undefined>(nativeToken);
  const [tokenPrice, setTokenPrice] = useState<number | null>(null);
  
  // Fetch token symbol and price from explorer API
  useEffect(() => {
    const fetchTokenData = async () => {
      try {
        const response = await fetch(`/api/explorer/${chainId}`);
        if (response.ok) {
          const data = await response.json();
          const symbol = data?.tokenSymbol || data?.price?.symbol || nativeToken;
          if (symbol) setTokenSymbol(symbol);
          if (data?.price?.price) setTokenPrice(data.price.price);
        }
      } catch (err) {
        console.error("Error fetching token data:", err);
      }
    };
    fetchTokenData();
  }, [chainId, nativeToken]);
  
  // Read initial tab from URL hash
  const getInitialTab = (): 'overview' | 'transactions' => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash.slice(1);
      return hash === 'transactions' ? 'transactions' : 'overview';
    }
    return 'overview';
  };
  
  const [activeTab, setActiveTab] = useState<'overview' | 'transactions'>(getInitialTab);
  
  // Update URL hash when tab changes
  const handleTabChange = (tab: 'overview' | 'transactions') => {
    setActiveTab(tab);
    if (typeof window !== 'undefined') {
      const hash = tab === 'overview' ? '' : `#${tab}`;
      window.history.replaceState(null, '', `${window.location.pathname}${hash}`);
    }
  };
  
  // Listen for hash changes (back/forward navigation)
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.slice(1);
      if (hash === 'transactions') {
        setActiveTab('transactions');
      } else {
        setActiveTab('overview');
      }
    };
    
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const fetchBlock = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/explorer/${chainId}/block/${blockNumber}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fetch block");
      }
      const data = await response.json();
      setBlock(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, [chainId, blockNumber]);

  const fetchTransactions = useCallback(async () => {
    if (!block?.transactions || block.transactions.length === 0) return;
    
    try {
      setTxLoading(true);
      const response = await fetch(`/api/explorer/${chainId}/block/${blockNumber}/transactions`);
      if (response.ok) {
        const data = await response.json();
        setTransactions(data.transactions || []);
      }
    } catch (err) {
      console.error("Error fetching transactions:", err);
    } finally {
      setTxLoading(false);
    }
  }, [chainId, blockNumber, block?.transactions]);

  useEffect(() => {
    fetchBlock();
  }, [fetchBlock]);

  useEffect(() => {
    if (activeTab === 'transactions' && block && transactions.length === 0) {
      fetchTransactions();
    }
  }, [activeTab, block, transactions.length, fetchTransactions]);

  const prevBlock = parseInt(blockNumber) - 1;
  const nextBlock = parseInt(blockNumber) + 1;

  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-zinc-950">
        <div className="relative overflow-hidden">
          <div 
            className="absolute top-0 right-0 w-2/3 h-full pointer-events-none"
            style={{
              background: `linear-gradient(to left, ${themeColor}35 0%, ${themeColor}20 40%, ${themeColor}08 70%, transparent 100%)`,
            }}
          />
          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 pt-8 sm:pt-16 pb-6 sm:pb-8">
            <div className="flex items-center gap-1.5 mb-3">
              <div className="h-4 w-16 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
              <div className="w-3.5 h-3.5 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
              <div className="h-4 w-20 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
              <div className="w-3.5 h-3.5 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
              <div className="h-4 w-16 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
              <div className="w-3.5 h-3.5 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
              <div className="h-4 w-24 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
            </div>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-zinc-200 dark:bg-zinc-800 rounded-xl animate-pulse" />
                <div className="h-10 w-64 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
              </div>
            </div>
          </div>
        </div>
        {/* Tabs skeleton */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-10 w-24 bg-zinc-200 dark:bg-zinc-800 rounded-lg animate-pulse" />
            <div className="h-10 w-32 bg-zinc-200 dark:bg-zinc-800 rounded-lg animate-pulse" />
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6">
            <div className="space-y-6">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <div key={i} className="flex items-start gap-4">
                  <div className="h-5 w-32 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
                  <div className="h-5 w-64 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
                </div>
              ))}
            </div>
          </div>
        </div>
        <L1BubbleNav chainSlug={chainSlug} themeColor={themeColor} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-white dark:bg-zinc-950">
        <div className="relative overflow-hidden">
          <div 
            className="absolute top-0 right-0 w-2/3 h-full pointer-events-none"
            style={{
              background: `linear-gradient(to left, ${themeColor}35 0%, ${themeColor}20 40%, ${themeColor}08 70%, transparent 100%)`,
            }}
          />
          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 pt-8 sm:pt-16 pb-6 sm:pb-8">
            <nav className="flex items-center gap-1.5 text-sm mb-3">
              <Link href="/stats/overview" className="text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">
                Overview
              </Link>
              <ChevronRight className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-600" />
              <Link href={`/stats/l1/${chainSlug}`} className="text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">
                {chainName}
              </Link>
              <ChevronRight className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-600" />
              <Link href={`/stats/l1/${chainSlug}/explorer`} className="text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">
                Explorer
              </Link>
              <ChevronRight className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-600" />
              <span className="text-zinc-900 dark:text-zinc-100 font-medium">
                Block #{blockNumber}
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
                      {chainName}
                    </h1>
                  </div>
                  {description && (
                    <div className="flex items-center gap-3 mt-3">
                      <p className="text-sm sm:text-base text-zinc-500 dark:text-zinc-400 max-w-2xl">
                        {description}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Social Links - Top Right, Matching Explorer Page */}
              {(website || socials) && (
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
              )}
            </div>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
          <div className="text-center">
            <p className="text-red-500 mb-4">{error}</p>
            <Button onClick={fetchBlock}>Retry</Button>
          </div>
        </div>
        <L1BubbleNav chainSlug={chainSlug} themeColor={themeColor} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
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
            <Link 
              href={`/stats/l1/${chainSlug}/explorer`} 
              className="text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
            >
              Explorer
            </Link>
            <ChevronRight className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-600" />
            <span className="text-zinc-900 dark:text-zinc-100 font-medium">
              Block #{blockNumber}
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
                    {chainName}
                  </h1>
                </div>
                {description && (
                  <div className="flex items-center gap-3 mt-3">
                    <p className="text-sm sm:text-base text-zinc-500 dark:text-zinc-400 max-w-2xl">
                      {description}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Social Links - Top Right, Matching Explorer Page */}
            {(website || socials) && (
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
            )}
          </div>
        </div>
      </div>

      {/* Block Title */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 pb-4">
        <h2 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-white">
          Block #{blockNumber}
        </h2>
      </div>

      {/* Tabs - Outside Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center gap-2 mb-4">
          <Link
            href={`#overview`}
            onClick={(e) => {
              e.preventDefault();
              handleTabChange('overview');
            }}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              activeTab === 'overview'
                ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900'
                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
            }`}
          >
            Overview
          </Link>
          <Link
            href={`#transactions`}
            onClick={(e) => {
              e.preventDefault();
              handleTabChange('transactions');
            }}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              activeTab === 'transactions'
                ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900'
                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
            }`}
          >
            Transactions ({block?.transactionCount || 0})
          </Link>
        </div>
      </div>

      {/* Block Details */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-6">
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
          {activeTab === 'overview' ? (
            <div className="p-4 sm:p-6 space-y-5">
              {/* Block Height */}
              <DetailRow
                icon={<Box className="w-4 h-4" />}
                label="Block Height"
                themeColor={themeColor}
                value={
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-zinc-900 dark:text-white">
                      {parseInt(blockNumber).toLocaleString()}
                    </span>
                    <div className="flex items-center gap-1">
                      <Link
                        href={buildBlockUrl(`/stats/l1/${chainSlug}/explorer`, prevBlock)}
                        className="p-1 rounded bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                      >
                        <ArrowLeft className="w-3 h-3 text-zinc-600 dark:text-zinc-400" />
                      </Link>
                      <Link
                        href={buildBlockUrl(`/stats/l1/${chainSlug}/explorer`, nextBlock)}
                        className="p-1 rounded bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                      >
                        <ArrowRight className="w-3 h-3 text-zinc-600 dark:text-zinc-400" />
                      </Link>
                    </div>
                  </div>
                }
              />

              {/* Timestamp */}
              <DetailRow
                icon={<Clock className="w-4 h-4" />}
                label="Timestamp"
                themeColor={themeColor}
                value={
                  <span className="text-sm text-zinc-900 dark:text-white">
                    {block?.timestamp ? formatTimestamp(block.timestamp) : '-'}
                  </span>
                }
              />

              {/* Transactions */}
              <DetailRow
                icon={<FileText className="w-4 h-4" />}
                label="Transactions"
                themeColor={themeColor}
                value={
                  <button
                    onClick={() => handleTabChange('transactions')}
                    className="inline-flex items-center px-3 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-sm font-medium hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                    style={{ color: themeColor }}
                  >
                    {block?.transactionCount || 0} transaction{(block?.transactionCount || 0) !== 1 ? 's' : ''}
                  </button>
                }
              />

              {/* Gas Used */}
              <DetailRow
                icon={<Fuel className="w-4 h-4" />}
                label="Gas Used"
                themeColor={themeColor}
                value={
                  <span className="text-sm text-zinc-900 dark:text-white">
                    {block ? formatGasUsedPercentage(block.gasUsed, block.gasLimit) : '-'}
                  </span>
                }
              />

              {/* Gas Limit */}
              <DetailRow
                icon={<Layers className="w-4 h-4" />}
                label="Gas Limit"
                themeColor={themeColor}
                value={
                  <span className="text-sm text-zinc-900 dark:text-white">
                    {block?.gasLimit ? parseInt(block.gasLimit).toLocaleString() : '-'}
                  </span>
                }
              />

              {/* Base Fee Per Gas */}
              {block?.baseFeePerGas && (
                <DetailRow
                  icon={<Fuel className="w-4 h-4" />}
                  label="Base Fee Per Gas"
                  themeColor={themeColor}
                  value={
                    <span className="text-sm text-zinc-900 dark:text-white">
                      {block.baseFeePerGas}
                    </span>
                  }
                />
              )}

              {/* Show More Toggle */}
              <button
                onClick={() => setShowMore(!showMore)}
                className="flex items-center gap-1 text-sm font-medium transition-colors"
                style={{ color: themeColor }}
              >
                {showMore ? 'Click to see Less' : 'Click to see More'}
                {showMore ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {showMore && (
                <>
                  {/* Hash */}
                  <DetailRow
                    icon={<Hash className="w-4 h-4" />}
                    label="Hash"
                    themeColor={themeColor}
                    value={
                      <span className="text-sm font-mono text-zinc-900 dark:text-white break-all">
                        {block?.hash || '-'}
                      </span>
                    }
                    copyValue={block?.hash}
                  />

                  {/* Parent Hash */}
                  <DetailRow
                    icon={<Hash className="w-4 h-4" />}
                    label="Parent Hash"
                    themeColor={themeColor}
                    value={
                      <Link
                        href={buildBlockUrl(`/stats/l1/${chainSlug}/explorer`, prevBlock)}
                        className="text-sm font-mono break-all hover:underline"
                        style={{ color: themeColor }}
                      >
                        {block?.parentHash || '-'}
                      </Link>
                    }
                    copyValue={block?.parentHash}
                  />

                  {/* Miner/Validator */}
                  <DetailRow
                    icon={<Box className="w-4 h-4" />}
                    label="Fee Recipient"
                    themeColor={themeColor}
                    value={
                      <span className="text-sm font-mono break-all" style={{ color: themeColor }}>
                        {block?.miner || '-'}
                      </span>
                    }
                    copyValue={block?.miner}
                  />

                  {/* State Root */}
                  {block?.stateRoot && (
                    <DetailRow
                      icon={<Hash className="w-4 h-4" />}
                      label="State Root"
                      themeColor={themeColor}
                      value={
                        <span className="text-sm font-mono text-zinc-900 dark:text-white break-all">
                          {block.stateRoot}
                        </span>
                      }
                      copyValue={block.stateRoot}
                    />
                  )}

                  {/* Nonce */}
                  {block?.nonce && (
                    <DetailRow
                      icon={<Hash className="w-4 h-4" />}
                      label="Nonce"
                      themeColor={themeColor}
                      value={
                        <span className="text-sm font-mono text-zinc-900 dark:text-white">
                          {block.nonce}
                        </span>
                      }
                    />
                  )}

                  {/* Extra Data */}
                  {block?.extraData && (
                    <DetailRow
                      icon={<FileText className="w-4 h-4" />}
                      label="Extra Data"
                      themeColor={themeColor}
                      value={
                        <span className="text-sm font-mono text-zinc-900 dark:text-white break-all">
                          {block.extraData}
                        </span>
                      }
                    />
                  )}
                </>
              )}
            </div>
          ) : (
            /* Transactions Tab */
            <div className="overflow-x-auto">
              {txLoading ? (
                <div className="p-8 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 mx-auto" style={{ borderColor: themeColor }}></div>
                  <p className="text-zinc-500 dark:text-zinc-400 mt-4">Loading transactions...</p>
                </div>
              ) : transactions.length > 0 ? (
                <table className="w-full">
                  <thead className="bg-[#fcfcfd] dark:bg-neutral-900 border-b border-zinc-100 dark:border-zinc-800">
                    <tr>
                      <th className="px-4 py-2 text-left">
                        <span className="text-xs font-normal text-neutral-700 dark:text-neutral-300">
                          Txn Hash
                        </span>
                      </th>
                      <th className="px-4 py-2 text-left">
                        <span className="text-xs font-normal text-neutral-700 dark:text-neutral-300">
                          From
                        </span>
                      </th>
                      <th className="px-4 py-2 text-center">
                        <span className="text-xs font-normal text-neutral-700 dark:text-neutral-300">
                          
                        </span>
                      </th>
                      <th className="px-4 py-2 text-left">
                        <span className="text-xs font-normal text-neutral-700 dark:text-neutral-300">
                          To
                        </span>
                      </th>
                      <th className="px-4 py-2 text-right">
                        <span className="text-xs font-normal text-neutral-700 dark:text-neutral-300">
                          Value
                        </span>
                      </th>
                      <th className="px-4 py-2 text-right">
                        <span className="text-xs font-normal text-neutral-700 dark:text-neutral-300">
                          Txn Fee
                        </span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-neutral-950">
                    {transactions.map((tx, index) => (
                      <tr
                        key={tx.hash || index}
                        className="border-b border-slate-100 dark:border-neutral-800 transition-colors hover:bg-blue-50/50 dark:hover:bg-neutral-800/50"
                      >
                        <td className="border-r border-slate-100 dark:border-neutral-800 px-4 py-2">
                          <div className="flex items-center gap-1.5">
                            <Link
                              href={buildTxUrl(`/stats/l1/${chainSlug}/explorer`, tx.hash)}
                              className="font-mono text-sm hover:underline cursor-pointer"
                              style={{ color: themeColor }}
                            >
                              {formatAddress(tx.hash)}
                            </Link>
                            <CopyButton text={tx.hash} />
                          </div>
                        </td>
                        <td className="border-r border-slate-100 dark:border-neutral-800 px-4 py-2">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-sm" style={{ color: themeColor }}>
                              {formatAddress(tx.from)}
                            </span>
                            <CopyButton text={tx.from} />
                          </div>
                        </td>
                        <td className="border-r border-slate-100 dark:border-neutral-800 px-4 py-2 text-center">
                          <ArrowRightLeft className="w-4 h-4 text-neutral-400 dark:text-neutral-500 inline-block" />
                        </td>
                        <td className="border-r border-slate-100 dark:border-neutral-800 px-4 py-2">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-sm" style={{ color: themeColor }}>
                              {tx.to ? formatAddress(tx.to) : 'Contract Creation'}
                            </span>
                            {tx.to && <CopyButton text={tx.to} />}
                          </div>
                        </td>
                        <td className="border-r border-slate-100 dark:border-neutral-800 px-4 py-2 text-right">
                          <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                            {formatValue(tx.value)} <TokenDisplay symbol={tokenSymbol} />
                          </span>
                        </td>
                        <td className="px-4 py-2 text-right">
                          <span className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
                            {formatValue(
                              (BigInt(tx.gasPrice || '0') * BigInt(tx.gas || '0')).toString()
                            )} <TokenDisplay symbol={tokenSymbol} />
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="p-8 text-center">
                  <p className="text-zinc-500 dark:text-zinc-400">No transactions in this block.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <L1BubbleNav chainSlug={chainSlug} themeColor={themeColor} />
    </div>
  );
}
