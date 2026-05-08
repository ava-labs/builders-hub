"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Wallet,
  Coins,
  Lock,
  Unlock,
  ShieldCheck,
  Users,
  Copy,
  Check,
  Clock,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/explorer/DetailRow";

// ============================================================================
// Types
// ============================================================================

interface AddressBalance {
  total: string;
  totalAvax: number;
  unlocked: string;
  unlockedAvax: number;
  lockedStakeable: string;
  lockedStakeableAvax: number;
  lockedNotStakeable: string;
  lockedNotStakeableAvax: number;
}

interface AddressStake {
  staked: string;
  stakedAvax: number;
}

interface UTXOInfo {
  txId: string;
  outputIndex: number;
}

interface ValidationInfo {
  nodeId: string;
  txId: string;
  startTime: string;
  endTime: string;
  stakeAmount: string;
  stakeAmountAvax: number;
  potentialReward: string;
  potentialRewardAvax: number;
  isValidator: boolean;
  delegationFee?: string;
  uptime?: string;
  connected?: boolean;
}

interface GlacierUtxo {
  addresses: string[];
  utxoId: string;
  txHash: string;
  outputIndex: number;
  blockTimestamp: number;
  blockNumber: string;
  assetId: string;
  asset?: { assetId: string; name: string; symbol: string; denomination: number };
  amount?: string;
  consumingTxHash?: string;
}

interface GlacierTransaction {
  txHash: string;
  txType: string;
  blockTimestamp: number;
  blockNumber: string;
  blockHash: string;
  memo?: string;
  consumedUtxos: GlacierUtxo[];
  emittedUtxos: GlacierUtxo[];
  amountBurned: { assetId: string; amount: string }[];
  amountStaked: { assetId: string; amount: string }[];
  sourceChain?: string;
  destinationChain?: string;
  nodeId?: string;
  rewardAddresses?: string[];
  stakingTxHash?: string;
}

interface AddressDetailData {
  address: string;
  network: 'mainnet' | 'fuji';
  balance: AddressBalance;
  stake: AddressStake;
  utxoCount: number;
  utxos: UTXOInfo[];
  validations: ValidationInfo[];
  transactions: GlacierTransaction[];
  nextPageToken?: string;
}

// ============================================================================
// Props
// ============================================================================

interface PChainAddressDetailPageProps {
  address: string;
  network?: 'mainnet' | 'fuji';
}

// ============================================================================
// Constants
// ============================================================================

const THEME_COLOR = "#E84142";

// ============================================================================
// Helpers
// ============================================================================

function formatAvax(avax: number): string {
  if (avax === 0) return '0';
  if (avax < 0.0001) return '<0.0001';
  return avax.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

function formatUsd(value: number | undefined): string {
  if (value === undefined || value === 0) return '$0.00';
  if (value < 0.01) return '<$0.01';
  return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatTimeRemaining(endTime: string): string {
  const end = new Date(endTime).getTime();
  const now = Date.now();
  const remaining = end - now;
  
  if (remaining <= 0) return 'Ended';
  
  const days = Math.floor(remaining / (1000 * 60 * 60 * 24));
  const hours = Math.floor((remaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  
  if (days > 30) {
    const months = Math.floor(days / 30);
    return `${months}mo remaining`;
  }
  if (days > 0) {
    return `${days}d remaining`;
  }
  return `${hours}h remaining`;
}

function formatAddressShort(address: string): string {
  if (!address) return '-';
  return `${address.slice(0, 10)}...${address.slice(-8)}`;
}

function formatTxType(txType: string): string {
  // "AddValidatorTx" → "Add Validator", "ExportTx" → "Export"
  return txType
    .replace(/Tx$/, '')
    .replace(/([a-z])([A-Z])/g, '$1 $2');
}

// Raw type badge label — strips "Tx" suffix for display e.g. "AddValidatorTx" → "AddValidator"
function txTypeBadge(txType: string): string {
  return txType.replace(/Tx$/, '');
}

function formatTimestamp(ts: number): string {
  const date = new Date(ts * 1000);
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatAge(ts: number): string {
  const diffInSeconds = Math.floor((Date.now() - ts * 1000) / 1000);
  if (diffInSeconds < 60) return `${diffInSeconds} secs ago`;
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} mins ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hrs ago`;
  return `${Math.floor(diffInSeconds / 86400)} days ago`;
}

function calcTxAmount(tx: GlacierTransaction): string {
  // Sum emitted UTXO amounts, converting from nAVAX (9 decimals) to AVAX
  let total = BigInt(0);
  for (const utxo of tx.emittedUtxos) {
    if (utxo.amount) {
      total += BigInt(utxo.amount);
    }
  }
  if (total === BigInt(0)) return '0';
  const avax = Number(total) / 1e9;
  if (avax < 0.0001) return '<0.0001';
  return avax.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

// ============================================================================
// Component
// ============================================================================

export default function PChainAddressDetailPage({ address, network = 'mainnet' }: PChainAddressDetailPageProps) {
  const [data, setData] = useState<AddressDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [allTransactions, setAllTransactions] = useState<GlacierTransaction[]>([]);
  const [nextPageToken, setNextPageToken] = useState<string | undefined>();
  const [loadingMore, setLoadingMore] = useState(false);
  
  // Read initial tab from URL hash
  const getInitialTab = (): string => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash.slice(1);
      if (['validations', 'utxos', 'transactions'].includes(hash)) {
        return hash;
      }
    }
    return 'validations';
  };

  const [activeTab, setActiveTab] = useState<string>(getInitialTab);
  
  // Update URL hash when tab changes
  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    if (typeof window !== 'undefined') {
      const hash = tab === 'validations' ? '' : `#${tab}`;
      window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}${hash}`);
    }
  };
  
  // Listen for hash changes
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.slice(1);
      if (['validations', 'utxos', 'transactions'].includes(hash)) {
        setActiveTab(hash);
      } else {
        setActiveTab('validations');
      }
    };
    
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const fetchAddress = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/explorer/p-chain/address/${address}?network=${network}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch address');
      }
      const result: AddressDetailData = await response.json();
      setData(result);
      setAllTransactions(result.transactions ?? []);
      setNextPageToken(result.nextPageToken);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [address, network]);

  useEffect(() => {
    fetchAddress();
  }, [fetchAddress]);

  const loadMoreTransactions = useCallback(async () => {
    if (!nextPageToken || loadingMore) return;
    setLoadingMore(true);
    try {
      const response = await fetch(
        `/api/explorer/p-chain/address/${address}?network=${network}&pageToken=${encodeURIComponent(nextPageToken)}`
      );
      if (response.ok) {
        const result: AddressDetailData = await response.json();
        setAllTransactions((prev) => [...prev, ...(result.transactions ?? [])]);
        setNextPageToken(result.nextPageToken);
      }
    } catch {
      // Silently fail — user can retry
    } finally {
      setLoadingMore(false);
    }
  }, [address, network, nextPageToken, loadingMore]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 h-48 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error}</p>
          <Button onClick={fetchAddress} className="cursor-pointer">Retry</Button>
        </div>
      </div>
    );
  }

  const hasValidations = data?.validations && data.validations.length > 0;
  const validatorCount = data?.validations.filter(v => v.isValidator).length || 0;
  const delegatorCount = data?.validations.filter(v => !v.isValidator).length || 0;

  const tabs = [
    { id: 'validations', label: 'Validations' },
    { id: 'transactions', label: `Transactions (${allTransactions.length}${nextPageToken ? '+' : ''})` },
    { id: 'utxos', label: `UTXOs (${data?.utxoCount || 0})` },
  ];

  return (
    <>
      {/* Address Title */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
          <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-zinc-900 dark:text-white">
            Address
          </h2>
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-zinc-500 dark:text-zinc-400 font-mono text-xs sm:text-sm truncate">
              {data?.address}
            </span>
            <CopyButton text={data?.address || ''} />
          </div>
        </div>
      </div>

      {/* Three Panel Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Overview Panel */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5">
            <h3 className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-4">Overview</h3>
            
            {/* Native Balance */}
            <div className="mb-4">
              <div className="text-xs text-zinc-400 dark:text-zinc-500 uppercase tracking-wide mb-1">
                AVAX BALANCE
              </div>
              <div className="flex items-center gap-2">
                <span className="text-zinc-900 dark:text-white font-medium">
                  {formatAvax(data?.balance.totalAvax || 0)} AVAX
                </span>
              </div>
            </div>

            {/* Unlocked Balance */}
            <div className="mb-4">
              <div className="text-xs text-zinc-400 dark:text-zinc-500 uppercase tracking-wide mb-1">
                AVAILABLE (UNLOCKED)
              </div>
              <div className="flex items-center gap-2">
                <Unlock className="w-4 h-4 text-green-500" />
                <span className="text-zinc-900 dark:text-white">
                  {formatAvax(data?.balance.unlockedAvax || 0)} AVAX
                </span>
              </div>
            </div>

            {/* Staked */}
            <div>
              <div className="text-xs text-zinc-400 dark:text-zinc-500 uppercase tracking-wide mb-1">
                STAKED
              </div>
              <div className="flex items-center gap-2">
                <Coins className="w-4 h-4 text-purple-500" />
                <span className="text-zinc-900 dark:text-white">
                  {formatAvax(data?.stake.stakedAvax || 0)} AVAX
                </span>
              </div>
            </div>
          </div>

          {/* Balance Breakdown Panel */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5">
            <h3 className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-4">Balance Breakdown</h3>
            
            {/* Locked Stakeable */}
            <div className="mb-4">
              <div className="text-xs text-zinc-400 dark:text-zinc-500 uppercase tracking-wide mb-1">
                LOCKED (STAKEABLE)
              </div>
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-amber-500" />
                <span className="text-zinc-900 dark:text-white">
                  {formatAvax(data?.balance.lockedStakeableAvax || 0)} AVAX
                </span>
              </div>
            </div>

            {/* Locked Not Stakeable */}
            <div className="mb-4">
              <div className="text-xs text-zinc-400 dark:text-zinc-500 uppercase tracking-wide mb-1">
                LOCKED (NOT STAKEABLE)
              </div>
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-red-500" />
                <span className="text-zinc-900 dark:text-white">
                  {formatAvax(data?.balance.lockedNotStakeableAvax || 0)} AVAX
                </span>
              </div>
            </div>

            {/* UTXOs */}
            <div>
              <div className="text-xs text-zinc-400 dark:text-zinc-500 uppercase tracking-wide mb-1">
                UTXO COUNT
              </div>
              <div className="text-zinc-900 dark:text-white">
                {data?.utxoCount || 0}
              </div>
            </div>
          </div>

          {/* Staking Activity Panel */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5">
            <h3 className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-4">Staking Activity</h3>
            
            {hasValidations ? (
              <>
                {/* Validators */}
                <div className="mb-4">
                  <div className="text-xs text-zinc-400 dark:text-zinc-500 uppercase tracking-wide mb-1">
                    ACTIVE VALIDATIONS
                  </div>
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-green-500" />
                    <span className="text-zinc-900 dark:text-white font-medium">
                      {validatorCount}
                    </span>
                    <span className="text-zinc-500 text-sm">validator{validatorCount !== 1 ? 's' : ''}</span>
                  </div>
                </div>

                {/* Delegators */}
                <div className="mb-4">
                  <div className="text-xs text-zinc-400 dark:text-zinc-500 uppercase tracking-wide mb-1">
                    ACTIVE DELEGATIONS
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-blue-500" />
                    <span className="text-zinc-900 dark:text-white font-medium">
                      {delegatorCount}
                    </span>
                    <span className="text-zinc-500 text-sm">delegation{delegatorCount !== 1 ? 's' : ''}</span>
                  </div>
                </div>

                {/* Total Potential Rewards */}
                <div>
                  <div className="text-xs text-zinc-400 dark:text-zinc-500 uppercase tracking-wide mb-1">
                    POTENTIAL REWARDS
                  </div>
                  <div className="text-green-600 dark:text-green-400 font-medium">
                    +{formatAvax(data.validations.reduce((sum, v) => sum + v.potentialRewardAvax, 0))} AVAX
                  </div>
                </div>
              </>
            ) : (
              <div className="text-zinc-500 dark:text-zinc-400 text-sm">
                No active validations or delegations
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabs - Outside Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-stretch gap-2 mb-4 overflow-x-auto pb-1 scrollbar-hide">
          {tabs.map((tab) => (
            <Link
              key={tab.id}
              href={tab.id === 'validations' ? '#' : `#${tab.id}`}
              onClick={(e) => {
                e.preventDefault();
                handleTabChange(tab.id);
              }}
              className={`flex items-center justify-center gap-1.5 px-3 sm:px-4 h-10 text-xs sm:text-sm font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap flex-shrink-0 ${
                activeTab === tab.id
                  ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-6">
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
          {/* Validations Tab */}
          {activeTab === 'validations' && (
            <div className="overflow-x-auto">
              {data?.validations && data.validations.length > 0 ? (
                <table className="w-full">
                  <thead className="bg-[#fcfcfd] dark:bg-neutral-900 border-b border-zinc-100 dark:border-zinc-800">
                    <tr>
                      <th className="px-4 py-2 text-left">
                        <span className="text-xs font-normal text-neutral-700 dark:text-neutral-300">Node ID</span>
                      </th>
                      <th className="px-4 py-2 text-left">
                        <span className="text-xs font-normal text-neutral-700 dark:text-neutral-300">Type</span>
                      </th>
                      <th className="px-4 py-2 text-right">
                        <span className="text-xs font-normal text-neutral-700 dark:text-neutral-300">Stake</span>
                      </th>
                      <th className="px-4 py-2 text-right">
                        <span className="text-xs font-normal text-neutral-700 dark:text-neutral-300">Potential Reward</span>
                      </th>
                      <th className="px-4 py-2 text-right">
                        <span className="text-xs font-normal text-neutral-700 dark:text-neutral-300">End Time</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-neutral-950">
                    {data.validations.map((validation, index) => (
                      <tr
                        key={`${validation.txId}-${index}`}
                        className="border-b border-slate-100 dark:border-neutral-800 transition-colors hover:bg-blue-50/50 dark:hover:bg-neutral-800/50"
                      >
                        <td className="border-r border-slate-100 dark:border-neutral-800 px-4 py-2">
                          <span className="font-mono text-sm text-zinc-900 dark:text-zinc-100">
                            {validation.nodeId.slice(0, 20)}...
                          </span>
                        </td>
                        <td className="border-r border-slate-100 dark:border-neutral-800 px-4 py-2">
                          <span 
                            className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded ${
                              validation.isValidator 
                                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                                : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                            }`}
                          >
                            {validation.isValidator ? (
                              <><ShieldCheck className="w-3 h-3" /> Validator</>
                            ) : (
                              <><Users className="w-3 h-3" /> Delegator</>
                            )}
                          </span>
                        </td>
                        <td className="border-r border-slate-100 dark:border-neutral-800 px-4 py-2 text-right">
                          <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                            {formatAvax(validation.stakeAmountAvax)} AVAX
                          </span>
                        </td>
                        <td className="border-r border-slate-100 dark:border-neutral-800 px-4 py-2 text-right">
                          <span className="text-sm text-green-600 dark:text-green-400">
                            +{formatAvax(validation.potentialRewardAvax)} AVAX
                          </span>
                        </td>
                        <td className="px-4 py-2 text-right">
                          <div className="text-sm text-zinc-600 dark:text-zinc-400">
                            {formatTimeRemaining(validation.endTime)}
                          </div>
                          <div className="text-xs text-zinc-400 dark:text-zinc-500">
                            {new Date(validation.endTime).toLocaleDateString()}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="p-8 text-center">
                  <p className="text-zinc-500 dark:text-zinc-400">No active validations or delegations found.</p>
                </div>
              )}
            </div>
          )}

          {/* Transactions Tab */}
          {activeTab === 'transactions' && (
            <div className="overflow-x-auto">
              {allTransactions.length > 0 ? (
                <>
                  <table className="w-full">
                    <thead className="bg-[#fcfcfd] dark:bg-neutral-900 border-b border-zinc-100 dark:border-zinc-800">
                      <tr>
                        <th className="px-4 py-2 text-left">
                          <span className="text-xs font-normal text-neutral-700 dark:text-neutral-300">Tx Hash</span>
                        </th>
                        <th className="px-4 py-2 text-left">
                          <span className="text-xs font-normal text-neutral-700 dark:text-neutral-300">Type</span>
                        </th>
                        <th className="px-4 py-2 text-left">
                          <span className="text-xs font-normal text-neutral-700 dark:text-neutral-300">Block</span>
                        </th>
                        <th className="px-4 py-2 text-right">
                          <span className="text-xs font-normal text-neutral-700 dark:text-neutral-300">Amount (AVAX)</span>
                        </th>
                        <th className="px-4 py-2 text-right">
                          <span className="text-xs font-normal text-neutral-700 dark:text-neutral-300">Age</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-neutral-950">
                      {allTransactions.map((tx, index) => (
                        <tr
                          key={`${tx.txHash}-${index}`}
                          className="border-b border-slate-100 dark:border-neutral-800 transition-colors hover:bg-blue-50/50 dark:hover:bg-neutral-800/50"
                        >
                          <td className="border-r border-slate-100 dark:border-neutral-800 px-4 py-2">
                            <div className="flex items-center gap-1.5">
                              <Link
                                href={`/explorer/p-chain/tx/${tx.txHash}?network=${network}`}
                                className="font-mono text-sm hover:underline cursor-pointer"
                                style={{ color: THEME_COLOR }}
                              >
                                {formatAddressShort(tx.txHash)}
                              </Link>
                              <CopyButton text={tx.txHash} />
                            </div>
                          </td>
                          <td className="border-r border-slate-100 dark:border-neutral-800 px-4 py-2">
                            <span
                              className="px-2 py-1 text-xs font-mono rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700"
                              title={formatTxType(tx.txType)}
                            >
                              {txTypeBadge(tx.txType)}
                            </span>
                          </td>
                          <td className="border-r border-slate-100 dark:border-neutral-800 px-4 py-2">
                            <Link
                              href={`/explorer/p-chain/block/${tx.blockNumber}?network=${network}`}
                              className="font-mono text-sm hover:underline cursor-pointer"
                              style={{ color: THEME_COLOR }}
                            >
                              {parseInt(tx.blockNumber).toLocaleString()}
                            </Link>
                          </td>
                          <td className="border-r border-slate-100 dark:border-neutral-800 px-4 py-2 text-right">
                            <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                              {calcTxAmount(tx)}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-right text-sm text-neutral-500 dark:text-neutral-400" title={formatTimestamp(tx.blockTimestamp)}>
                            {formatAge(tx.blockTimestamp)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {nextPageToken && (
                    <div className="p-4 text-center border-t border-zinc-100 dark:border-zinc-800">
                      <Button
                        onClick={loadMoreTransactions}
                        disabled={loadingMore}
                        className="cursor-pointer"
                      >
                        {loadingMore ? (
                          <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Loading...</>
                        ) : (
                          'Load more'
                        )}
                      </Button>
                    </div>
                  )}
                </>
              ) : (
                <div className="p-8 text-center">
                  <p className="text-zinc-500 dark:text-zinc-400">No transactions found for this address.</p>
                </div>
              )}
            </div>
          )}

          {/* UTXOs Tab */}
          {activeTab === 'utxos' && (
            <div className="overflow-x-auto">
              {data?.utxos && data.utxos.length > 0 ? (
                <table className="w-full">
                  <thead className="bg-[#fcfcfd] dark:bg-neutral-900 border-b border-zinc-100 dark:border-zinc-800">
                    <tr>
                      <th className="px-4 py-2 text-left">
                        <span className="text-xs font-normal text-neutral-700 dark:text-neutral-300">Transaction ID</span>
                      </th>
                      <th className="px-4 py-2 text-right">
                        <span className="text-xs font-normal text-neutral-700 dark:text-neutral-300">Output Index</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-neutral-950">
                    {data.utxos.map((utxo, index) => (
                      <tr
                        key={`${utxo.txId}-${utxo.outputIndex}-${index}`}
                        className="border-b border-slate-100 dark:border-neutral-800 transition-colors hover:bg-blue-50/50 dark:hover:bg-neutral-800/50"
                      >
                        <td className="border-r border-slate-100 dark:border-neutral-800 px-4 py-2">
                          <div className="flex items-center gap-1.5">
                            <Link
                              href={`/explorer/p-chain/tx/${utxo.txId}?network=${network}`}
                              className="font-mono text-sm hover:underline cursor-pointer"
                              style={{ color: THEME_COLOR }}
                            >
                              {formatAddressShort(utxo.txId)}
                            </Link>
                            <CopyButton text={utxo.txId} />
                          </div>
                        </td>
                        <td className="px-4 py-2 text-right">
                          <span className="text-sm text-zinc-600 dark:text-zinc-400">
                            {utxo.outputIndex}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="p-8 text-center">
                  <p className="text-zinc-500 dark:text-zinc-400">No UTXOs found for this address.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
