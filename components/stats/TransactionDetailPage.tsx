"use client";

import { useState, useEffect, useCallback } from "react";
import { Hash, Clock, Box, Fuel, DollarSign, FileText, ArrowUpRight, Twitter, Linkedin, ChevronRight, ChevronUp, ChevronDown, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AvalancheLogo } from "@/components/navigation/avalanche-logo";
import { L1BubbleNav } from "@/components/stats/l1-bubble.config";
import { DetailRow, CopyButton } from "@/components/stats/DetailRow";
import Link from "next/link";
import { buildBlockUrl, buildTxUrl, buildAddressUrl } from "@/utils/eip3091";
import { useExplorer } from "@/components/stats/ExplorerContext";

interface TransactionDetail {
  hash: string;
  status: 'success' | 'failed' | 'pending';
  blockNumber: string | null;
  blockHash: string | null;
  timestamp: string | null;
  confirmations: number;
  from: string;
  to: string | null;
  contractAddress: string | null;
  value: string;
  valueWei: string;
  gasPrice: string;
  gasPriceWei: string;
  gasLimit: string;
  gasUsed: string;
  txFee: string;
  txFeeWei: string;
  nonce: string;
  transactionIndex: string | null;
  input: string;
  decodedInput: { method: string; params: Record<string, string> } | null;
  transfers: Array<{ from: string; to: string; value: string; formattedValue: string; tokenAddress: string; tokenSymbol: string; tokenDecimals: number }>;
  type: number;
  maxFeePerGas: string | null;
  maxPriorityFeePerGas: string | null;
  logs: Array<{
    address: string;
    topics: string[];
    data: string;
    logIndex: string;
    transactionIndex: string;
    transactionHash: string;
    blockHash: string;
    blockNumber: string;
  }>;
}

interface TransactionDetailPageProps {
  chainId: string;
  chainName: string;
  chainSlug: string;
  txHash: string;
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
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
    timeZoneName: 'short'
  });

  return `${timeAgo} (${formatted})`;
}

function formatAddress(address: string): string {
  if (!address) return '-';
  return `${address.slice(0, 10)}...${address.slice(-8)}`;
}

// Decode Transfer event from log
function decodeTransferEvent(log: { topics: string[]; data: string }): { name: string; params: Array<{ name: string; type: string; value: string }> } | null {
  // Transfer(address,address,uint256) signature
  const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
  
  if (log.topics[0]?.toLowerCase() !== TRANSFER_TOPIC.toLowerCase() || log.topics.length < 3) {
    return null;
  }

  try {
    const from = '0x' + log.topics[1].slice(26);
    const to = '0x' + log.topics[2].slice(26);
    const value = BigInt(log.data || '0x0').toString();
    
    return {
      name: 'Transfer',
      params: [
        { name: '_from', type: 'address', value: from },
        { name: '_to', type: 'address', value: to },
        { name: '_value', type: 'uint256', value: value },
      ],
    };
  } catch {
    return null;
  }
}

// Format hex to number
function hexToNumber(hex: string): string {
  try {
    return BigInt(hex).toString();
  } catch {
    return hex;
  }
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

function StatusBadge({ status }: { status: string }) {
  if (status === 'success') {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-sm font-medium">
        <CheckCircle className="w-4 h-4" />
        Success
      </span>
    );
  }
  if (status === 'failed') {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-sm font-medium">
        <XCircle className="w-4 h-4" />
        Failed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 text-sm font-medium">
      <AlertCircle className="w-4 h-4" />
      Pending
    </span>
  );
}

export default function TransactionDetailPage({
  chainId,
  chainName,
  chainSlug,
  txHash,
  themeColor = "#E57373",
  chainLogoURI,
  nativeToken,
  description,
  website,
  socials,
  rpcUrl,
}: TransactionDetailPageProps) {
  // Get token data from shared context
  const { tokenSymbol, tokenPrice, glacierSupported } = useExplorer();
  
  const [tx, setTx] = useState<TransactionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showMore, setShowMore] = useState(false);
  
  // Read initial tab from URL hash
  const getInitialTab = (): 'overview' | 'logs' => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash.slice(1);
      return hash === 'logs' ? 'logs' : 'overview';
    }
    return 'overview';
  };
  
  const [activeTab, setActiveTab] = useState<'overview' | 'logs'>(getInitialTab);
  
  // Update URL hash when tab changes
  const handleTabChange = (tab: 'overview' | 'logs') => {
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
      if (hash === 'logs') {
        setActiveTab('logs');
      } else {
        setActiveTab('overview');
      }
    };
    
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const fetchTransaction = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/explorer/${chainId}/tx/${txHash}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fetch transaction");
      }
      const data = await response.json();
      setTx(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, [chainId, txHash]);

  useEffect(() => {
    fetchTransaction();
  }, [fetchTransaction]);

  const shortHash = `${txHash.slice(0, 10)}...${txHash.slice(-8)}`;

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
            </div>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-zinc-200 dark:bg-zinc-800 rounded-xl animate-pulse" />
                <div className="h-10 w-64 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
              </div>
              <div className="h-8 w-80 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
            </div>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
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
        <L1BubbleNav chainSlug={chainSlug} themeColor={themeColor} rpcUrl={rpcUrl} />
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
            </div>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
          <div className="text-center">
            <p className="text-red-500 mb-4">{error}</p>
            <Button onClick={fetchTransaction}>Retry</Button>
          </div>
        </div>
        <L1BubbleNav chainSlug={chainSlug} themeColor={themeColor} rpcUrl={rpcUrl} />
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
              Transaction
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

            {/* Social Links */}
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
                  {socials && (socials.twitter || socials.linkedin) && (
                    <>
                      {socials.twitter && (
                        <Button
                          variant="outline"
                          size="sm"
                          asChild
                          className="border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-zinc-400 dark:hover:border-zinc-600 px-2"
                        >
                          <a href={`https://x.com/${socials.twitter}`} target="_blank" rel="noopener noreferrer" aria-label="Twitter">
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
                          <a href={`https://linkedin.com/company/${socials.linkedin}`} target="_blank" rel="noopener noreferrer" aria-label="LinkedIn">
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

      {/* Glacier Support Warning Banner */}
      {!glacierSupported && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-4">
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0">
                <svg className="w-5 h-5 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <p className="text-sm text-amber-800 dark:text-amber-200">
                <span className="font-medium">Indexing support is not available for this chain.</span>{' '}
                Some functionalities like address portfolios, token transfers, and detailed transaction history may not be available.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Transaction Details Title */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 pb-4">
        <h2 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-white">
          Transaction Details
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
            href={`#logs`}
            onClick={(e) => {
              e.preventDefault();
              handleTabChange('logs');
            }}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              activeTab === 'logs'
                ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900'
                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
            }`}
          >
            Logs ({tx?.logs?.length || 0})
          </Link>
        </div>
      </div>

      {/* Transaction Details */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-6">
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
          {activeTab === 'overview' ? (
            <div className="p-4 sm:p-6 space-y-5">
            {/* Transaction Hash */}
            <DetailRow
              icon={<Hash className="w-4 h-4" />}
              label="Transaction Hash"
              themeColor={themeColor}
              value={
                <span className="text-sm font-mono text-zinc-900 dark:text-white break-all">
                  {tx?.hash || '-'}
                </span>
              }
              copyValue={tx?.hash}
            />

            {/* Status */}
            <DetailRow
              icon={<CheckCircle className="w-4 h-4" />}
              label="Status"
              themeColor={themeColor}
              value={<StatusBadge status={tx?.status || 'pending'} />}
            />

            {/* Block */}
            <DetailRow
              icon={<Box className="w-4 h-4" />}
              label="Block"
              themeColor={themeColor}
              value={
                tx?.blockNumber ? (
                  <div className="flex items-center gap-2">
                    <Link
                      href={buildBlockUrl(`/stats/l1/${chainSlug}/explorer`, tx.blockNumber)}
                      className="text-sm font-medium hover:underline"
                      style={{ color: themeColor }}
                    >
                      {parseInt(tx.blockNumber).toLocaleString()}
                    </Link>
                    <span className="text-xs px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400">
                      {tx.confirmations} Block Confirmations
                    </span>
                  </div>
                ) : (
                  <span className="text-sm text-zinc-500">Pending</span>
                )
              }
            />

            {/* Timestamp */}
            <DetailRow
              icon={<Clock className="w-4 h-4" />}
              label="Timestamp"
              themeColor={themeColor}
              value={
                <span className="text-sm text-zinc-900 dark:text-white">
                  {tx?.timestamp ? formatTimestamp(tx.timestamp) : 'Pending'}
                </span>
              }
            />

            {/* From */}
            <DetailRow
              icon={<Hash className="w-4 h-4" />}
              label="From"
              themeColor={themeColor}
              value={
                tx?.from ? (
                  <Link
                    href={buildAddressUrl(`/stats/l1/${chainSlug}/explorer`, tx.from)}
                    className="text-sm font-mono break-all hover:underline"
                    style={{ color: themeColor }}
                  >
                    {tx.from}
                  </Link>
                ) : (
                  <span className="text-sm font-mono">-</span>
                )
              }
              copyValue={tx?.from}
            />

            {/* To / Contract */}
            <DetailRow
              icon={<Hash className="w-4 h-4" />}
              label={tx?.contractAddress ? "Interacted With (To)" : "Interacted With (To)"}
              themeColor={themeColor}
              value={
                tx?.to ? (
                  <Link
                    href={buildAddressUrl(`/stats/l1/${chainSlug}/explorer`, tx.to)}
                    className="text-sm font-mono break-all hover:underline"
                    style={{ color: themeColor }}
                  >
                    {tx.to}
                  </Link>
                ) : tx?.contractAddress ? (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-zinc-500">[Contract Created]</span>
                    <Link
                      href={buildAddressUrl(`/stats/l1/${chainSlug}/explorer`, tx.contractAddress)}
                      className="text-sm font-mono hover:underline"
                      style={{ color: themeColor }}
                    >
                      {tx.contractAddress}
                    </Link>
                  </div>
                ) : (
                  <span className="text-sm text-zinc-500">-</span>
                )
              }
              copyValue={tx?.to || tx?.contractAddress || undefined}
            />

            {/* Decoded Method */}
            {tx?.decodedInput && (
              <DetailRow
                icon={<FileText className="w-4 h-4" />}
                label="Method"
                themeColor={themeColor}
                value={
                  <span className="inline-flex items-center px-3 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-sm font-mono">
                    {tx.decodedInput.method}
                  </span>
                }
              />
            )}

            {/* ERC-20 Transfers */}
            {tx?.transfers && tx.transfers.length > 0 && (
              <DetailRow
                icon={<FileText className="w-4 h-4" />}
                label={`ERC-20 Tokens Transferred (${tx.transfers.length})`}
                themeColor={themeColor}
                value={
                  <div className="space-y-3">
                    {tx.transfers.map((transfer, idx) => (
                      <div key={idx} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 text-sm p-2 rounded-lg bg-zinc-50 dark:bg-zinc-800/50">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-zinc-500">From</span>
                          <Link 
                            href={buildAddressUrl(`/stats/l1/${chainSlug}/explorer`, transfer.from)}
                            className="font-mono text-xs hover:underline" 
                            style={{ color: themeColor }}
                          >
                            {formatAddress(transfer.from)}
                          </Link>
                          <span className="text-zinc-400">→</span>
                          <span className="text-zinc-500">To</span>
                          <Link 
                            href={buildAddressUrl(`/stats/l1/${chainSlug}/explorer`, transfer.to)}
                            className="font-mono text-xs hover:underline" 
                            style={{ color: themeColor }}
                          >
                            {formatAddress(transfer.to)}
                          </Link>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-zinc-500">For</span>
                          <span className="font-semibold text-zinc-900 dark:text-white">
                            {transfer.formattedValue}
                          </span>
                          <Link 
                            href={buildAddressUrl(`/stats/l1/${chainSlug}/explorer`, transfer.tokenAddress)}
                            className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium hover:underline"
                            style={{ backgroundColor: `${themeColor}20`, color: themeColor }}
                          >
                            {transfer.tokenSymbol}
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                }
              />
            )}

            {/* Value */}
            <DetailRow
              icon={<DollarSign className="w-4 h-4" />}
              label="Value"
              themeColor={themeColor}
              value={
                <div className="flex flex-col sm:flex-row sm:items-center gap-1">
                  <span className="text-sm font-medium text-zinc-900 dark:text-white">
                    {tx?.value || '0'} <TokenDisplay symbol={tokenSymbol} />
                  </span>
                  {tokenPrice && tx?.value && parseFloat(tx.value) > 0 && (
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">
                      (${(parseFloat(tx.value) * tokenPrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD)
                    </span>
                  )}
                </div>
              }
            />

            {/* Transaction Fee */}
            <DetailRow
              icon={<Fuel className="w-4 h-4" />}
              label="Transaction Fee"
              themeColor={themeColor}
              value={
                <div className="flex flex-col sm:flex-row sm:items-center gap-1">
                  <span className="text-sm text-zinc-900 dark:text-white">
                    {tx?.txFee || '0'} <TokenDisplay symbol={tokenSymbol} />
                  </span>
                  {tokenPrice && tx?.txFee && parseFloat(tx.txFee) > 0 && (
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">
                      (${(parseFloat(tx.txFee) * tokenPrice).toFixed(6)} USD)
                    </span>
                  )}
                </div>
              }
            />

            {/* Gas Price */}
            <DetailRow
              icon={<Fuel className="w-4 h-4" />}
              label="Gas Price"
              themeColor={themeColor}
              value={
                <span className="text-sm text-zinc-900 dark:text-white">
                  {tx?.gasPrice || '-'}
                </span>
              }
            />

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
                {/* Gas Limit & Usage */}
                <DetailRow
                  icon={<Fuel className="w-4 h-4" />}
                  label="Gas Limit & Usage"
                  themeColor={themeColor}
                  value={
                    <span className="text-sm text-zinc-900 dark:text-white">
                      {tx?.gasLimit ? parseInt(tx.gasLimit).toLocaleString() : '-'} | {tx?.gasUsed ? parseInt(tx.gasUsed).toLocaleString() : '-'} ({tx?.gasLimit && tx?.gasUsed ? ((parseInt(tx.gasUsed) / parseInt(tx.gasLimit)) * 100).toFixed(2) : '0'}%)
                    </span>
                  }
                />

                {/* Nonce */}
                <DetailRow
                  icon={<Hash className="w-4 h-4" />}
                  label="Nonce"
                  themeColor={themeColor}
                  value={
                    <span className="text-sm text-zinc-900 dark:text-white">
                      {tx?.nonce || '-'}
                    </span>
                  }
                />

                {/* Transaction Index */}
                <DetailRow
                  icon={<Hash className="w-4 h-4" />}
                  label="Position In Block"
                  themeColor={themeColor}
                  value={
                    <span className="text-sm text-zinc-900 dark:text-white">
                      {tx?.transactionIndex || '-'}
                    </span>
                  }
                />

                {/* Input Data */}
                <DetailRow
                  icon={<FileText className="w-4 h-4" />}
                  label="Input Data"
                  themeColor={themeColor}
                  value={
                    <div className="w-full">
                      <pre className="text-xs font-mono bg-zinc-100 dark:bg-zinc-800 p-3 rounded-lg overflow-x-auto max-h-32 text-zinc-700 dark:text-zinc-300">
                        {tx?.input || '0x'}
                      </pre>
                    </div>
                  }
                />
              </>
            )}
            </div>
          ) : (
            /* Logs Tab */
            <div className="p-4 sm:p-6">
              {tx?.logs && tx.logs.length > 0 ? (
                <div className="space-y-4">
                  {tx.logs.map((log, index) => {
                    const logIndex = parseInt(log.logIndex || '0', 16);
                    const decodedEvent = decodeTransferEvent(log);
                    
                    return (
                      <div
                        key={index}
                        className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 space-y-4"
                      >
                        {/* Header with Index Badge */}
                        <div className="flex items-start gap-4">
                          <div className="flex-shrink-0">
                            <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                              <span className="text-sm font-semibold text-green-700 dark:text-green-400">
                                {logIndex}
                              </span>
                            </div>
                          </div>
                          
                          <div className="flex-1 space-y-3">
                            {/* Address */}
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase">
                                  Address
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-sm break-all" style={{ color: themeColor }}>
                                  {log.address}
                                </span>
                                <CopyButton text={log.address} />
                                <Link
                                  href={`/stats/l1/${chainSlug}/explorer`}
                                  className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                                  title="View contract"
                                >
                                  <Hash className="w-4 h-4" />
                                </Link>
                              </div>
                            </div>

                            {/* Event Name */}
                            {decodedEvent ? (
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase">
                                    Name
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-sm font-semibold text-zinc-900 dark:text-white">
                                    {decodedEvent.name}
                                  </span>
                                  <span className="text-sm text-zinc-600 dark:text-zinc-400">
                                    (
                                  </span>
                                  {decodedEvent.params.map((param, paramIdx) => (
                                    <span key={paramIdx} className="text-sm">
                                      <span className="text-zinc-600 dark:text-zinc-400">{param.type} </span>
                                      <span className="font-medium" style={{ color: paramIdx === 0 ? '#10b981' : paramIdx === 1 ? '#ef4444' : '#10b981' }}>
                                        {param.name}
                                      </span>
                                      {paramIdx < decodedEvent.params.length - 1 && (
                                        <span className="text-zinc-600 dark:text-zinc-400">, </span>
                                      )}
                                    </span>
                                  ))}
                                  <span className="text-sm text-zinc-600 dark:text-zinc-400">)</span>
                                </div>
                              </div>
                            ) : (
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase">
                                    Name
                                  </span>
                                </div>
                                <span className="text-sm text-zinc-500 dark:text-zinc-400">Unknown Event</span>
                              </div>
                            )}

                            {/* Topics */}
                            {log.topics && log.topics.length > 0 && (
                              <div>
                                <div className="flex items-center gap-2 mb-2">
                                  <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase">
                                    Topics
                                  </span>
                                </div>
                                <div className="space-y-2">
                                  {log.topics.map((topic, topicIdx) => (
                                    <div key={topicIdx} className="flex items-start gap-2">
                                      <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 w-6 flex-shrink-0">
                                        {topicIdx}:
                                      </span>
                                      <div className="flex items-center gap-2 flex-1 min-w-0">
                                        <span className="font-mono text-xs break-all text-zinc-600 dark:text-zinc-400">
                                          {topic}
                                        </span>
                                        <CopyButton text={topic} />
                                        {topicIdx > 0 && topicIdx <= 2 && decodedEvent && decodedEvent.params[topicIdx - 1] && (
                                          <span className="text-xs text-zinc-500 dark:text-zinc-400">
                                            ({formatAddress(decodedEvent.params[topicIdx - 1].value)})
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Data */}
                            {log.data && log.data !== '0x' && (
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase">
                                    Data
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  {decodedEvent && decodedEvent.params[2] ? (
                                    <>
                                      <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mr-1">
                                        Num:
                                      </span>
                                      <span className="text-sm font-medium text-zinc-900 dark:text-white">
                                        {decodedEvent.params[2].value}
                                      </span>
                                    </>
                                  ) : (
                                    <>
                                      <span className="font-mono text-xs break-all text-zinc-600 dark:text-zinc-400">
                                        {log.data}
                                      </span>
                                      <CopyButton text={log.data} />
                                    </>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-8 text-center">
                  <p className="text-zinc-500 dark:text-zinc-400">No logs found for this transaction.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <L1BubbleNav chainSlug={chainSlug} themeColor={themeColor} rpcUrl={rpcUrl} />
    </div>
  );
}

