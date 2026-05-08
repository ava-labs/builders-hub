"use client";

import { useState, useEffect, useCallback } from "react";
import { 
  ShieldCheck, 
  Users, 
  Coins, 
  Clock, 
  Search,
  ChevronDown,
  ChevronUp,
  Circle,
  X as XIcon,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";

// ============================================================================
// Types
// ============================================================================

interface ValidatorSummary {
  nodeId: string;
  txId: string;
  startTime: string;
  endTime: string;
  remainingTime: string;
  stakeAmount: string;
  stakeAmountAvax: number;
  delegationFee: string;
  uptime: string;
  connected: boolean;
  delegatorCount: number;
  delegatorWeight: string;
  delegatorWeightAvax: number;
  potentialReward: string;
  potentialRewardAvax: number;
  stakePercentage: number;
}

interface ValidatorsData {
  network: 'mainnet' | 'fuji';
  totalStake: string;
  totalStakeAvax: number;
  validatorCount: number;
  delegatorCount: number;
  pendingValidatorCount: number;
  pendingDelegatorCount: number;
  validators: ValidatorSummary[];
}

// ============================================================================
// Props
// ============================================================================

interface PChainValidatorsPageProps {
  initialNetwork?: 'mainnet' | 'fuji';
}

// ============================================================================
// Constants
// ============================================================================

const THEME_COLOR = "#E84142";
const PAGE_SIZE = 25;

// ============================================================================
// Helpers
// ============================================================================

function formatAvax(avax: number): string {
  if (avax === 0) return '0';
  if (avax < 0.01) return '<0.01';
  if (avax >= 1e9) return `${(avax / 1e9).toFixed(2)}B`;
  if (avax >= 1e6) return `${(avax / 1e6).toFixed(2)}M`;
  if (avax >= 1e3) return `${(avax / 1e3).toFixed(1)}K`;
  return avax.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function formatNumber(num: number): string {
  if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
  if (num >= 1e3) return `${(num / 1e3).toFixed(1)}K`;
  return num.toLocaleString();
}

function formatUptime(uptime: string): string {
  const uptimeNum = parseFloat(uptime);
  if (isNaN(uptimeNum)) return '-';
  return `${(uptimeNum * 100).toFixed(2)}%`;
}

// ============================================================================
// Component
// ============================================================================

export default function PChainValidatorsPage({ initialNetwork = 'mainnet' }: PChainValidatorsPageProps) {
  const [network, setNetwork] = useState<'mainnet' | 'fuji'>(initialNetwork);
  const [data, setData] = useState<ValidatorsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<'stake' | 'uptime' | 'delegators' | 'fee'>('stake');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);

  const fetchValidators = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/explorer/p-chain/validators?network=${network}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch validators');
      }
      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [network]);

  useEffect(() => {
    fetchValidators();
  }, [fetchValidators]);

  const handleNetworkChange = (newNetwork: 'mainnet' | 'fuji') => {
    setNetwork(newNetwork);
    setPage(1);
    setSearchTerm('');
  };

  const handleSort = (field: 'stake' | 'uptime' | 'delegators' | 'fee') => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
    setPage(1);
  };

  // Filter and sort validators
  const filteredValidators = (data?.validators || [])
    .filter(v => 
      searchTerm === '' || 
      v.nodeId.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'stake':
          comparison = a.stakeAmountAvax - b.stakeAmountAvax;
          break;
        case 'uptime':
          comparison = parseFloat(a.uptime || '0') - parseFloat(b.uptime || '0');
          break;
        case 'delegators':
          comparison = a.delegatorCount - b.delegatorCount;
          break;
        case 'fee':
          comparison = parseFloat(a.delegationFee || '0') - parseFloat(b.delegationFee || '0');
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });

  const totalPages = Math.ceil(filteredValidators.length / PAGE_SIZE);
  const paginatedValidators = filteredValidators.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const SortIcon = ({ field }: { field: 'stake' | 'uptime' | 'delegators' | 'fee' }) => {
    if (sortField !== field) return null;
    return sortDirection === 'desc' ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />;
  };

  if (loading && !data) {
    return (
      <>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-6">
          <div className="h-8 w-64 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse mb-4" />
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 h-24 animate-pulse" />
            ))}
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-6">
          <div className="bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl h-96 animate-pulse" />
        </div>
      </>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error}</p>
          <Button onClick={fetchValidators} className="cursor-pointer">Retry</Button>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Page Title & Network Toggle */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 pb-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-white">
            Validators
          </h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleNetworkChange('mainnet')}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors cursor-pointer ${
                network === 'mainnet'
                  ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
              }`}
            >
              Mainnet
            </button>
            <button
              onClick={() => handleNetworkChange('fuji')}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors cursor-pointer ${
                network === 'fuji'
                  ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
              }`}
            >
              Fuji Testnet
            </button>
          </div>
        </div>
      </div>

      {/* Stats Card */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-4">
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-5 gap-y-4">
            {/* Total Validators */}
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
                <div className="text-base font-bold text-zinc-900 dark:text-white">
                  {formatNumber(data?.validatorCount || 0)}
                </div>
              </div>
            </div>

            {/* Total Delegators */}
            <div className="flex items-center gap-2.5">
              <div 
                className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: '#3B82F615' }}
              >
                <Users className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
                  Delegators
                </div>
                <div className="text-base font-bold text-zinc-900 dark:text-white">
                  {formatNumber(data?.delegatorCount || 0)}
                </div>
              </div>
            </div>

            {/* Total Stake */}
            <div className="flex items-center gap-2.5">
              <div 
                className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: '#8B5CF615' }}
              >
                <Coins className="w-5 h-5 text-purple-500" />
              </div>
              <div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
                  Total Stake
                </div>
                <div className="text-base font-bold text-zinc-900 dark:text-white">
                  {formatAvax(data?.totalStakeAvax || 0)} <span className="text-sm font-normal text-zinc-500">AVAX</span>
                </div>
              </div>
            </div>

            {/* Pending */}
            <div className="flex items-center gap-2.5">
              <div 
                className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: '#F59E0B15' }}
              >
                <Clock className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
                  Pending
                </div>
                <div className="text-base font-bold text-zinc-900 dark:text-white">
                  {data?.pendingValidatorCount || 0} <span className="text-sm font-normal text-zinc-500">validators</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <input
            type="text"
            placeholder="Search by Node ID..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(1);
            }}
            className="w-full pl-10 pr-10 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-sm text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-red-500/50"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded cursor-pointer"
            >
              <XIcon className="w-3 h-3 text-zinc-400" />
            </button>
          )}
        </div>
      </div>

      {/* Validators Table */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-6">
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#fcfcfd] dark:bg-neutral-900 border-b border-zinc-100 dark:border-zinc-800">
                <tr>
                  <th className="px-4 py-2 text-left">
                    <span className="text-xs font-normal text-neutral-700 dark:text-neutral-300">#</span>
                  </th>
                  <th className="px-4 py-2 text-left">
                    <span className="text-xs font-normal text-neutral-700 dark:text-neutral-300">Node ID</span>
                  </th>
                  <th className="px-4 py-2 text-left">
                    <span className="text-xs font-normal text-neutral-700 dark:text-neutral-300">Status</span>
                  </th>
                  <th className="px-4 py-2 text-right">
                    <button 
                      onClick={() => handleSort('stake')}
                      className="flex items-center gap-1 text-xs font-normal text-neutral-700 dark:text-neutral-300 hover:text-zinc-900 dark:hover:text-white ml-auto cursor-pointer"
                    >
                      Stake <SortIcon field="stake" />
                    </button>
                  </th>
                  <th className="px-4 py-2 text-right">
                    <button 
                      onClick={() => handleSort('delegators')}
                      className="flex items-center gap-1 text-xs font-normal text-neutral-700 dark:text-neutral-300 hover:text-zinc-900 dark:hover:text-white ml-auto cursor-pointer"
                    >
                      Delegators <SortIcon field="delegators" />
                    </button>
                  </th>
                  <th className="px-4 py-2 text-right">
                    <button 
                      onClick={() => handleSort('fee')}
                      className="flex items-center gap-1 text-xs font-normal text-neutral-700 dark:text-neutral-300 hover:text-zinc-900 dark:hover:text-white ml-auto cursor-pointer"
                    >
                      Fee <SortIcon field="fee" />
                    </button>
                  </th>
                  <th className="px-4 py-2 text-right">
                    <button 
                      onClick={() => handleSort('uptime')}
                      className="flex items-center gap-1 text-xs font-normal text-neutral-700 dark:text-neutral-300 hover:text-zinc-900 dark:hover:text-white ml-auto cursor-pointer"
                    >
                      Uptime <SortIcon field="uptime" />
                    </button>
                  </th>
                  <th className="px-4 py-2 text-right">
                    <span className="text-xs font-normal text-neutral-700 dark:text-neutral-300">Remaining</span>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-neutral-950">
                {paginatedValidators.map((validator, index) => (
                  <tr
                    key={validator.nodeId}
                    className="border-b border-slate-100 dark:border-neutral-800 transition-colors hover:bg-blue-50/50 dark:hover:bg-neutral-800/50"
                  >
                    <td className="border-r border-slate-100 dark:border-neutral-800 px-4 py-2">
                      <span className="text-sm text-zinc-500">{(page - 1) * PAGE_SIZE + index + 1}</span>
                    </td>
                    <td className="border-r border-slate-100 dark:border-neutral-800 px-4 py-2">
                      <span className="font-mono text-xs text-zinc-900 dark:text-zinc-100">
                        {validator.nodeId.slice(0, 24)}...
                      </span>
                    </td>
                    <td className="border-r border-slate-100 dark:border-neutral-800 px-4 py-2">
                      <div className="flex items-center gap-1.5">
                        <Circle 
                          className={`w-2 h-2 ${validator.connected ? 'fill-green-500 text-green-500' : 'fill-zinc-400 text-zinc-400'}`} 
                        />
                        <span className={`text-xs ${validator.connected ? 'text-green-600 dark:text-green-400' : 'text-zinc-400'}`}>
                          {validator.connected ? 'Active' : 'Offline'}
                        </span>
                      </div>
                    </td>
                    <td className="border-r border-slate-100 dark:border-neutral-800 px-4 py-2 text-right">
                      <div>
                        <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                          {formatAvax(validator.stakeAmountAvax)}
                        </span>
                        <span className="text-xs text-zinc-500 ml-1">AVAX</span>
                      </div>
                      {validator.stakePercentage > 0.01 && (
                        <div className="text-xs text-zinc-400">
                          {validator.stakePercentage.toFixed(2)}%
                        </div>
                      )}
                    </td>
                    <td className="border-r border-slate-100 dark:border-neutral-800 px-4 py-2 text-right">
                      <span className="text-sm text-zinc-600 dark:text-zinc-400">
                        {validator.delegatorCount.toLocaleString()}
                      </span>
                    </td>
                    <td className="border-r border-slate-100 dark:border-neutral-800 px-4 py-2 text-right">
                      <span className="text-sm text-zinc-600 dark:text-zinc-400">
                        {parseFloat(validator.delegationFee || '0').toFixed(2)}%
                      </span>
                    </td>
                    <td className="border-r border-slate-100 dark:border-neutral-800 px-4 py-2 text-right">
                      <span className={`text-sm ${
                        parseFloat(validator.uptime || '0') >= 0.8 
                          ? 'text-green-600 dark:text-green-400' 
                          : parseFloat(validator.uptime || '0') >= 0.6
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-red-600 dark:text-red-400'
                      }`}>
                        {formatUptime(validator.uptime)}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right">
                      <span className="text-sm text-zinc-600 dark:text-zinc-400">
                        {validator.remainingTime}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-zinc-200 dark:border-zinc-800 bg-[#fcfcfd] dark:bg-neutral-900">
              <div className="text-sm text-zinc-500">
                Showing {(page - 1) * PAGE_SIZE + 1} - {Math.min(page * PAGE_SIZE, filteredValidators.length)} of {filteredValidators.length}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(page - 1)}
                  disabled={page === 1}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Previous
                </button>
                <span className="text-sm text-zinc-600 dark:text-zinc-400">
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => setPage(page + 1)}
                  disabled={page === totalPages}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {filteredValidators.length === 0 && (
            <div className="p-8 text-center">
              <p className="text-zinc-500 dark:text-zinc-400">
                {searchTerm ? 'No validators found matching your search.' : 'No validators found.'}
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
