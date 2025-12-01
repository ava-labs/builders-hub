"use client";

import { useState, useEffect, useCallback } from "react";
import { Box, Clock, Fuel, Hash, ArrowLeft, ArrowRight, ChevronUp, ChevronDown, Layers, FileText, ArrowRightLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DetailRow, CopyButton } from "@/components/explorer/DetailRow";
import Link from "next/link";
import { buildBlockUrl, buildTxUrl, buildAddressUrl } from "@/utils/eip3091";
import { useExplorer } from "@/components/explorer/ExplorerContext";
import { decodeFunctionInput } from "@/abi/event-signatures.generated";
import { formatTokenValue, formatUsdValue } from "@/utils/formatTokenValue";
import { formatPrice } from "@/utils/formatPrice";

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
  gasFee?: string; // Gas fee in native token
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
  return formatTokenValue(eth);
}

// Token symbol display component
function TokenDisplay({ symbol }: { symbol?: string }) {
  if (!symbol) {
    return <span className="text-zinc-500 dark:text-zinc-400">N/A</span>;
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
  rpcUrl,
}: BlockDetailPageProps) {
  // Get token data from shared context
  const { tokenSymbol, tokenPrice, glacierSupported, buildApiUrl } = useExplorer();
  
  const [block, setBlock] = useState<BlockDetail | null>(null);
  const [transactions, setTransactions] = useState<TransactionDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [txLoading, setTxLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showMore, setShowMore] = useState(false);
  
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
      const url = buildApiUrl(`/api/explorer/${chainId}/block/${blockNumber}`);
      const response = await fetch(url);
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
  }, [chainId, blockNumber, buildApiUrl]);

  const fetchTransactions = useCallback(async () => {
    if (!block?.transactions || block.transactions.length === 0) return;
    
    try {
      setTxLoading(true);
      const url = buildApiUrl(`/api/explorer/${chainId}/block/${blockNumber}/transactions`);
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setTransactions(data.transactions || []);
      }
    } catch (err) {
      console.error("Error fetching transactions:", err);
    } finally {
      setTxLoading(false);
    }
  }, [chainId, blockNumber, block?.transactions, buildApiUrl]);

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
      <>
        {/* Tabs skeleton */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-6">
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
      </>
    );
  }

  if (error) {
    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
          <div className="text-center">
            <p className="text-red-500 mb-4">{error}</p>
          <Button onClick={fetchBlock} className="cursor-pointer">Retry</Button>
        </div>
      </div>
    );
  }

  return (
    <>
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
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors cursor-pointer ${
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
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors cursor-pointer ${
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
                        href={buildBlockUrl(`/explorer/${chainSlug}`, prevBlock)}
                        className="p-1 rounded bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
                      >
                        <ArrowLeft className="w-3 h-3 text-zinc-600 dark:text-zinc-400" />
                      </Link>
                      <Link
                        href={buildBlockUrl(`/explorer/${chainSlug}`, nextBlock)}
                        className="p-1 rounded bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
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
                    className="inline-flex items-center px-3 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-sm font-medium hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
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

              {/* Gas Fee */}
              {block?.gasFee && parseFloat(block.gasFee) > 0 && (
                <DetailRow
                  icon={<Fuel className="w-4 h-4" />}
                  label="Block Gas Fee"
                  themeColor={themeColor}
                  value={
                    <div className="flex flex-col gap-1">
                    <span className="text-sm text-zinc-900 dark:text-white">
                      {chainId === "43114" && <span className="mr-1">🔥</span>}
                      {formatTokenValue(block.gasFee)} <TokenDisplay symbol={tokenSymbol} />
                      </span>
                      {tokenPrice && (
                        <span className="text-xs text-zinc-500 dark:text-zinc-400">
                          ({formatPrice(parseFloat(block.gasFee) * tokenPrice)} USD)
                        </span>
                      )}
                    </div>
                  }
                />
              )}

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
                className="flex items-center gap-1 text-sm font-medium transition-colors cursor-pointer"
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
                        href={buildBlockUrl(`/explorer/${chainSlug}`, prevBlock)}
                        className="text-sm font-mono break-all hover:underline cursor-pointer"
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
                      block?.miner ? (
                        <Link
                          href={buildAddressUrl(`/explorer/${chainSlug}`, block.miner)}
                          className="text-sm font-mono break-all hover:underline cursor-pointer"
                          style={{ color: themeColor }}
                        >
                          {block.miner}
                        </Link>
                      ) : (
                        <span className="text-sm font-mono">-</span>
                      )
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
                          Method
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
                    {transactions.map((tx, index) => {
                      const decoded = tx.input ? decodeFunctionInput(tx.input) : null;
                      const methodName = decoded?.name || (tx.input === '0x' || !tx.input ? 'Transfer' : tx.input.slice(0, 10));
                      const truncatedMethod = methodName.length > 12 ? methodName.slice(0, 12) + '...' : methodName;
                      return (
                      <tr
                        key={tx.hash || index}
                        className="border-b border-slate-100 dark:border-neutral-800 transition-colors hover:bg-blue-50/50 dark:hover:bg-neutral-800/50"
                      >
                        <td className="border-r border-slate-100 dark:border-neutral-800 px-4 py-2">
                          <div className="flex items-center gap-1.5">
                            <Link
                              href={buildTxUrl(`/explorer/${chainSlug}`, tx.hash)}
                              className="font-mono text-sm hover:underline cursor-pointer"
                              style={{ color: themeColor }}
                            >
                              {formatAddress(tx.hash)}
                            </Link>
                            <CopyButton text={tx.hash} />
                          </div>
                        </td>
                          <td className="border-r border-slate-100 dark:border-neutral-800 px-4 py-2">
                            <span className="px-2 py-1 text-xs font-mono rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700" title={decoded?.signature || methodName}>{truncatedMethod}</span>
                        </td>
                        <td className="border-r border-slate-100 dark:border-neutral-800 px-4 py-2">
                          <div className="flex items-center gap-1.5">
                            <Link
                              href={buildAddressUrl(`/explorer/${chainSlug}`, tx.from)}
                                className="font-mono text-sm hover:underline cursor-pointer"
                              style={{ color: themeColor }}
                            >
                              {formatAddress(tx.from)}
                            </Link>
                            <CopyButton text={tx.from} />
                          </div>
                        </td>
                        <td className="border-r border-slate-100 dark:border-neutral-800 px-4 py-2 text-center">
                          <ArrowRightLeft className="w-4 h-4 text-neutral-400 dark:text-neutral-500 inline-block" />
                        </td>
                        <td className="border-r border-slate-100 dark:border-neutral-800 px-4 py-2">
                          <div className="flex items-center gap-1.5">
                            {tx.to ? (
                              <Link
                                href={buildAddressUrl(`/explorer/${chainSlug}`, tx.to)}
                                  className="font-mono text-sm hover:underline cursor-pointer"
                                style={{ color: themeColor }}
                              >
                                {formatAddress(tx.to)}
                              </Link>
                            ) : (
                              <span className="font-mono text-sm text-neutral-400">Contract Creation</span>
                            )}
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
                      );
                    })}
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
    </>
  );
}
