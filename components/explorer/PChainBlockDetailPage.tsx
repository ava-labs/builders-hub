"use client";

import { useState, useEffect, useCallback } from "react";
import { Box, ArrowLeft, ArrowRight, ArrowRightLeft, Hash, Clock, FileText } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { DetailRow, CopyButton } from "@/components/explorer/DetailRow";
import type { DecodedTransaction } from "@/lib/pchain/txDecoder";

// ============================================================================
// Types
// ============================================================================

interface TransactionDetail {
  txId: string;
  type: string;
  typeDescription: string;
  decoded: DecodedTransaction;
}

interface BlockDetailData {
  height: number;
  blockId: string;
  parentId: string;
  timestamp?: string;
  timestampUnix?: number;
  txCount: number;
  transactions: TransactionDetail[];
}

// ============================================================================
// Props
// ============================================================================

interface PChainBlockDetailPageProps {
  blockId: string;
  network?: 'mainnet' | 'fuji';
}

// ============================================================================
// Constants
// ============================================================================

const THEME_COLOR = "#E84142";

// ============================================================================
// Helpers
// ============================================================================

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

function formatAvax(avax: number): string {
  if (avax === 0) return '0';
  if (avax < 0.0001) return '<0.0001';
  return avax.toLocaleString(undefined, { maximumFractionDigits: 6 });
}

function shortenTxId(txId: string): string {
  if (!txId) return '';
  if (txId.length <= 20) return txId;
  return `${txId.slice(0, 10)}...${txId.slice(-8)}`;
}

function formatAddress(address: string): string {
  if (!address) return '-';
  return `${address.slice(0, 10)}...${address.slice(-8)}`;
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

// ============================================================================
// Component
// ============================================================================

export default function PChainBlockDetailPage({ blockId, network = 'mainnet' }: PChainBlockDetailPageProps) {
  const [data, setData] = useState<BlockDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
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
      window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}${hash}`);
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
      const response = await fetch(`/api/explorer/p-chain/block/${blockId}?network=${network}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch block');
      }
      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [blockId, network]);

  useEffect(() => {
    fetchBlock();
  }, [fetchBlock]);

  const blockHeight = parseInt(blockId, 10);
  const isNumericBlock = !isNaN(blockHeight);
  const prevBlock = isNumericBlock ? blockHeight - 1 : null;
  const nextBlock = isNumericBlock ? blockHeight + 1 : null;

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
          Block #{data?.height.toLocaleString()}
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
            Transactions ({data?.txCount || 0})
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
                themeColor={THEME_COLOR}
                value={
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-zinc-900 dark:text-white">
                      {data?.height.toLocaleString()}
                    </span>
                    {isNumericBlock && (
                      <div className="flex items-center gap-1">
                        {prevBlock !== null && prevBlock >= 0 && (
                          <Link
                            href={`/explorer/p-chain/block/${prevBlock}?network=${network}`}
                            className="p-1 rounded bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
                          >
                            <ArrowLeft className="w-3 h-3 text-zinc-600 dark:text-zinc-400" />
                          </Link>
                        )}
                        {nextBlock !== null && (
                          <Link
                            href={`/explorer/p-chain/block/${nextBlock}?network=${network}`}
                            className="p-1 rounded bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
                          >
                            <ArrowRight className="w-3 h-3 text-zinc-600 dark:text-zinc-400" />
                          </Link>
                        )}
                      </div>
                    )}
                  </div>
                }
              />

              {/* Block Hash */}
              <DetailRow
                icon={<Hash className="w-4 h-4" />}
                label="Hash"
                themeColor={THEME_COLOR}
                value={
                  <span className="text-sm font-mono break-all text-zinc-900 dark:text-white">
                    {data?.blockId || '-'}
                  </span>
                }
                copyValue={data?.blockId}
              />

              {/* Parent Hash */}
              <DetailRow
                icon={<Hash className="w-4 h-4" />}
                label="Parent Hash"
                themeColor={THEME_COLOR}
                value={
                  prevBlock !== null && prevBlock >= 0 ? (
                    <Link
                      href={`/explorer/p-chain/block/${prevBlock}?network=${network}`}
                      className="text-sm font-mono break-all hover:underline cursor-pointer"
                      style={{ color: THEME_COLOR }}
                    >
                      {data?.parentId || '-'}
                    </Link>
                  ) : (
                    <span className="text-sm font-mono break-all text-zinc-900 dark:text-white">
                      {data?.parentId || '-'}
                    </span>
                  )
                }
                copyValue={data?.parentId}
              />

              {/* Timestamp */}
              {data?.timestamp && (
                <DetailRow
                  icon={<Clock className="w-4 h-4" />}
                  label="Timestamp"
                  themeColor={THEME_COLOR}
                  value={
                    <span className="text-sm text-zinc-900 dark:text-white">
                      {formatTimeAgo(data.timestamp)} ({new Date(data.timestamp).toLocaleString()})
                    </span>
                  }
                />
              )}

              {/* Transactions */}
              <DetailRow
                icon={<FileText className="w-4 h-4" />}
                label="Transactions"
                themeColor={THEME_COLOR}
                value={
                  <button
                    onClick={() => handleTabChange('transactions')}
                    className="inline-flex items-center px-3 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-sm font-medium hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
                    style={{ color: THEME_COLOR }}
                  >
                    {data?.txCount || 0} transaction{(data?.txCount || 0) !== 1 ? 's' : ''}
                  </button>
                }
              />
            </div>
          ) : (
            /* Transactions Tab */
            <div className="overflow-x-auto">
              {data?.transactions && data.transactions.length > 0 ? (
                <table className="w-full">
                  <thead className="bg-[#fcfcfd] dark:bg-neutral-900 border-b border-zinc-100 dark:border-zinc-800">
                    <tr>
                      <th className="px-4 py-2 text-left">
                        <span className="text-xs font-normal text-neutral-700 dark:text-neutral-300">Txn ID</span>
                      </th>
                      <th className="px-4 py-2 text-left">
                        <span className="text-xs font-normal text-neutral-700 dark:text-neutral-300">Type</span>
                      </th>
                      <th className="px-4 py-2 text-right">
                        <span className="text-xs font-normal text-neutral-700 dark:text-neutral-300">Fee</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-neutral-950">
                    {data.transactions.map((tx, index) => (
                      <tr
                        key={tx.txId || index}
                        className="border-b border-slate-100 dark:border-neutral-800 transition-colors hover:bg-blue-50/50 dark:hover:bg-neutral-800/50"
                      >
                        <td className="border-r border-slate-100 dark:border-neutral-800 px-4 py-2">
                          <div className="flex items-center gap-1.5">
                            <Link
                              href={`/explorer/p-chain/tx/${tx.txId}?network=${network}`}
                              className="font-mono text-sm hover:underline cursor-pointer"
                              style={{ color: THEME_COLOR }}
                            >
                              {formatAddress(tx.txId)}
                            </Link>
                            <CopyButton text={tx.txId} />
                          </div>
                        </td>
                        <td className="border-r border-slate-100 dark:border-neutral-800 px-4 py-2">
                          <span 
                            className="px-2 py-1 text-xs font-medium rounded"
                            style={{ 
                              backgroundColor: `${getTxTypeColor(tx.type)}15`,
                              color: getTxTypeColor(tx.type) 
                            }}
                          >
                            {tx.typeDescription}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-right">
                          <span className="text-sm text-zinc-600 dark:text-zinc-400">
                            {formatAvax(tx.decoded.fee)} AVAX
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
    </>
  );
}
