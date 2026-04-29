'use client';

import { useSession } from 'next-auth/react';
import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import useConsoleNotifications from '@/hooks/useConsoleNotifications';
import type { ConsoleLog } from '@/types/console-log';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { sectionContainer, sectionItem } from '@/components/console/motion';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { useSelectedL1 } from '@/components/toolbox/stores/l1ListStore';
import { useToolboxStore } from '@/components/toolbox/stores/toolboxStore';
import { useCreateChainStore } from '@/components/toolbox/stores/createChainStore';
import { useTxHistoryStore } from '@/components/toolbox/stores/txHistoryStore';
import type { TxRecord, TxStatus } from '@/components/toolbox/stores/txHistoryStore';
import { useNotificationPanelStore } from '@/components/console/notification-panel';
import { Search, ExternalLink, Copy, Check, Download, LogIn, Clock, Database, Loader2, X, ArrowUpDown, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/cn';

const MAX_RECENT_ITEMS = 15;

export default function ConsoleHistoryPage() {
  const { data: session, status } = useSession();
  const { logs: fullHistory, getExplorerUrl, loading } = useConsoleNotifications();
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const panelNotifications = useNotificationPanelStore((s) => s.notifications);

  const { isTestnet } = useWalletStore();
  const selectedL1 = useSelectedL1();
  const toolboxStore = useToolboxStore();
  const createChainStore = useCreateChainStore()();
  const { transactions: txHistory, clearHistory: clearTxHistory } = useTxHistoryStore();

  // Build store-based config items (only show items the user actually deployed on this chain)
  const storeItems = useMemo(() => {
    const items: Array<{
      id: string;
      title: string;
      address: string;
      chainId?: string;
      type: 'address' | 'tx';
    }> = [];

    if (createChainStore) {
      if (createChainStore.subnetId) items.push({ id: 'cc-subnet', title: 'Subnet ID', address: createChainStore.subnetId, type: 'tx' });
      if (createChainStore.chainID) items.push({ id: 'cc-chain', title: 'Blockchain ID', address: createChainStore.chainID, type: 'tx' });
      if (createChainStore.convertToL1TxId) items.push({ id: 'cc-l1-tx', title: 'Convert to L1 Tx', address: createChainStore.convertToL1TxId, type: 'tx' });
      if (createChainStore.managerAddress && createChainStore.managerAddress !== '0xfacade0000000000000000000000000000000000') {
        items.push({ id: 'cc-manager', title: 'Manager Address', address: createChainStore.managerAddress, chainId: createChainStore.evmChainId?.toString(), type: 'address' });
      }
    }

    if (toolboxStore) {
      const chainId = selectedL1?.evmChainId?.toString();
      const add = (id: string, title: string, address: string) => {
        if (address) items.push({ id, title, address, chainId, type: 'address' });
      };
      add('tb-vm', 'Validator Manager', toolboxStore.validatorManagerAddress);
      add('tb-native-sm', 'Native Staking Manager', toolboxStore.nativeStakingManagerAddress);
      add('tb-erc20-sm', 'ERC20 Staking Manager', toolboxStore.erc20StakingManagerAddress);
      add('tb-poa', 'PoA Manager', toolboxStore.poaManagerAddress);
      add('tb-teleporter', 'Teleporter Registry', toolboxStore.teleporterRegistryAddress);
      add('tb-icm', 'ICM Receiver', toolboxStore.icmReceiverAddress);
      add('tb-erc20-home', 'ERC20 Token Home', toolboxStore.erc20TokenHomeAddress);
      add('tb-native-home', 'Native Token Home', toolboxStore.nativeTokenHomeAddress);
    }

    return items;
  }, [createChainStore, toolboxStore, selectedL1]);

  // Limit and filter
  const recentHistory = useMemo(() => fullHistory.slice(0, MAX_RECENT_ITEMS), [fullHistory]);

  const filteredHistory = useMemo(() => {
    if (!searchTerm) return recentHistory;
    const s = searchTerm.toLowerCase();
    return recentHistory.filter(
      (n) => n.actionPath?.toLowerCase().includes(s) || JSON.stringify(n.data).toLowerCase().includes(s),
    );
  }, [recentHistory, searchTerm]);

  const filteredStoreItems = useMemo(() => {
    if (!searchTerm) return storeItems;
    const s = searchTerm.toLowerCase();
    return storeItems.filter((item) => item.title.toLowerCase().includes(s) || item.address.toLowerCase().includes(s));
  }, [storeItems, searchTerm]);

  const handleCopy = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const filteredTxHistory = useMemo(() => {
    if (!searchTerm) return txHistory;
    const s = searchTerm.toLowerCase();
    return txHistory.filter(
      (tx) =>
        tx.operation.toLowerCase().includes(s) ||
        tx.txHash.toLowerCase().includes(s) ||
        tx.type.toLowerCase().includes(s) ||
        tx.status.toLowerCase().includes(s),
    );
  }, [txHistory, searchTerm]);

  const getTxExplorerUrl = (tx: TxRecord): string | null => {
    if (!tx.txHash) return null;
    if (tx.type === 'pchain') {
      const base = tx.network === 'mainnet' ? 'https://subnets.avax.network' : 'https://subnets-test.avax.network';
      return `${base}/p-chain/tx/${tx.txHash}`;
    }
    // EVM tx — use built-in explorer path
    if (tx.chainId === 43114 || tx.chainId === 43113) {
      return `/explorer/avalanche-c-chain/tx/${tx.txHash}`;
    }
    // For custom L1 chains, link to subnets explorer with c-chain fallback
    const base = tx.network === 'mainnet' ? 'https://subnets.avax.network' : 'https://subnets-test.avax.network';
    return `${base}/c-chain/tx/${tx.txHash}`;
  };

  const statusConfig: Record<TxStatus, { label: string; className: string }> = {
    confirmed: {
      label: 'Confirmed',
      className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    },
    pending: {
      label: 'Pending',
      className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    },
    failed: {
      label: 'Failed',
      className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    },
  };

  const handleExport = () => {
    const data = { history: filteredHistory, configuration: filteredStoreItems, txHistory: filteredTxHistory };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `console-history-${format(new Date(), 'yyyy-MM-dd-HHmmss')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getExplorerLink = (log: ConsoleLog): string | null => {
    const data = log.data as any;
    const network = data.network || 'testnet';
    if (data.txID) return getExplorerUrl(data.txID, 'tx', network, 'P');
    if (data.txHash) return getExplorerUrl(data.txHash, 'tx', network, data.chainId || 'C');
    if (data.contractAddress) return getExplorerUrl(data.contractAddress, 'address', network, data.chainId || 'C');
    return null;
  };

  const formatTitle = (log: ConsoleLog) => {
    const parts = log.actionPath?.split('/') || [];
    const name = (parts[parts.length - 1] || 'Event').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    return name;
  };

  const shortAddr = (s: string) => (s.length > 14 ? `${s.slice(0, 8)}...${s.slice(-6)}` : s);

  return (
    <motion.div
      className="mx-auto max-w-3xl py-8 px-4"
      variants={sectionContainer}
      initial="hidden"
      animate="visible"
    >
      <motion.div className="flex items-center justify-between mb-6" variants={sectionItem}>
        <h1 className="text-xl font-semibold">History</h1>
        {(fullHistory.length > 0 || storeItems.length > 0 || txHistory.length > 0) && (
          <Button variant="ghost" size="sm" onClick={handleExport}>
            <Download className="h-3.5 w-3.5 mr-1.5" />
            Export
          </Button>
        )}
      </motion.div>

      <motion.div className="relative max-w-sm mb-6" variants={sectionItem}>
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
        <Input placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9 h-8 text-sm" />
      </motion.div>

      {/* Current session activity (from notification panel) */}
      {panelNotifications.length > 0 && (
        <motion.section className="mb-8" variants={sectionItem}>
          <div className="flex items-center gap-2 mb-3">
            <Clock className="h-3.5 w-3.5 text-zinc-400" />
            <h2 className="text-sm font-medium text-zinc-600 dark:text-zinc-400">This Session</h2>
          </div>
          <div className="space-y-1.5">
            {panelNotifications.slice(0, 10).map((n) => (
              <div key={n.id} className="flex items-center gap-3 px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/30">
                {n.status === 'loading' ? (
                  <Loader2 className="h-3.5 w-3.5 text-zinc-400 animate-spin shrink-0" />
                ) : n.status === 'success' ? (
                  <Check className="h-3.5 w-3.5 text-green-500 shrink-0" />
                ) : (
                  <X className="h-3.5 w-3.5 text-red-500 shrink-0" />
                )}
                <span className="text-sm text-zinc-900 dark:text-zinc-100 flex-1 truncate">{n.name}</span>
                <span className="text-[10px] text-zinc-400">{n.message}</span>
                {n.explorerUrl && (
                  <a href={n.explorerUrl} target="_blank" rel="noopener noreferrer" className="shrink-0">
                    <ExternalLink className="h-3 w-3 text-zinc-400 hover:text-zinc-600" />
                  </a>
                )}
              </div>
            ))}
          </div>
        </motion.section>
      )}

      {/* Local transaction history (from txHistoryStore — persisted in localStorage) */}
      {filteredTxHistory.length > 0 && (
        <motion.section className="mb-8" variants={sectionItem}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <ArrowUpDown className="h-3.5 w-3.5 text-zinc-400" />
              <h2 className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Transaction History</h2>
              <span className="text-[10px] text-zinc-400">({filteredTxHistory.length})</span>
            </div>
            <Button variant="ghost" size="sm" onClick={clearTxHistory} className="h-6 px-2 text-[10px] text-zinc-400 hover:text-zinc-600">
              <Trash2 className="h-3 w-3 mr-1" />
              Clear
            </Button>
          </div>
          <div className="space-y-1.5">
            {filteredTxHistory.map((tx) => {
              const explorerUrl = getTxExplorerUrl(tx);
              const status = statusConfig[tx.status];
              return (
                <div
                  key={tx.id}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2 rounded-lg border transition-colors',
                    tx.status === 'failed'
                      ? 'border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-900/10'
                      : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/30',
                    explorerUrl && 'cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800/50',
                  )}
                  onClick={() => explorerUrl && window.open(explorerUrl, '_blank')}
                >
                  {tx.status === 'confirmed' ? (
                    <Check className="h-3.5 w-3.5 text-green-500 shrink-0" />
                  ) : tx.status === 'pending' ? (
                    <Loader2 className="h-3.5 w-3.5 text-yellow-500 animate-spin shrink-0" />
                  ) : (
                    <X className="h-3.5 w-3.5 text-red-500 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{tx.operation}</span>
                    {tx.txHash && (
                      <code className="ml-2 text-[10px] text-zinc-400 font-mono">{shortAddr(tx.txHash)}</code>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-medium', status.className)}>
                      {status.label}
                    </span>
                    <span
                      className={cn(
                        'text-[10px] px-1.5 py-0.5 rounded-full font-medium',
                        tx.type === 'pchain'
                          ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                          : 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
                      )}
                    >
                      {tx.type === 'pchain' ? 'P-Chain' : 'EVM'}
                    </span>
                    <span
                      className={cn(
                        'text-[10px] px-1.5 py-0.5 rounded-full font-medium',
                        tx.network === 'mainnet'
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
                      )}
                    >
                      {tx.network === 'mainnet' ? 'Mainnet' : 'Fuji'}
                    </span>
                    <span className="text-[10px] text-zinc-400">{format(new Date(tx.timestamp), 'MMM d HH:mm')}</span>
                    {tx.txHash && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopy(tx.txHash, tx.id);
                        }}
                        className="p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700"
                      >
                        {copiedId === tx.id ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3 text-zinc-400" />}
                      </button>
                    )}
                    {explorerUrl && (
                      <a
                        href={explorerUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="shrink-0"
                      >
                        <ExternalLink className="h-3 w-3 text-zinc-400 hover:text-zinc-600" />
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </motion.section>
      )}

      {/* Server-side activity log (logged-in users) */}
      <motion.section className="mb-8" variants={sectionItem}>
        <div className="flex items-center gap-2 mb-3">
          <Clock className="h-3.5 w-3.5 text-zinc-400" />
          <h2 className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Activity Log</h2>
          {fullHistory.length > MAX_RECENT_ITEMS && (
            <span className="text-[10px] text-zinc-400">(showing {MAX_RECENT_ITEMS} most recent)</span>
          )}
        </div>

        {status === 'loading' || loading ? (
          <div className="py-8 text-center text-sm text-zinc-400">Loading...</div>
        ) : !session?.user ? (
          <div className="py-8 text-center border rounded-lg border-dashed border-zinc-300 dark:border-zinc-700">
            <p className="text-sm text-zinc-500 mb-3">Sign in to save activity log across sessions</p>
            <Button variant="outline" size="sm" onClick={() => (window.location.href = '/login')} className="gap-2">
              <LogIn className="h-3.5 w-3.5" />
              Sign In
            </Button>
          </div>
        ) : filteredHistory.length === 0 ? (
          <div className="py-8 text-center text-sm text-zinc-400">No activity yet</div>
        ) : (
          <div className="space-y-1.5">
            {filteredHistory.map((log) => {
              const data = log.data as any;
              const mainId = data.txHash || data.txID || data.address || '';
              const explorerUrl = getExplorerLink(log);
              return (
                <div
                  key={log.id}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2 rounded-lg border transition-colors',
                    log.status === 'error'
                      ? 'border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-900/10'
                      : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/30',
                    explorerUrl && 'cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800/50',
                  )}
                  onClick={() => explorerUrl && window.open(explorerUrl, '_blank')}
                >
                  {log.status === 'success' ? (
                    <Check className="h-3.5 w-3.5 text-green-500 shrink-0" />
                  ) : (
                    <X className="h-3.5 w-3.5 text-red-500 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{formatTitle(log)}</span>
                    {mainId && (
                      <code className="ml-2 text-[10px] text-zinc-400 font-mono">{shortAddr(mainId)}</code>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {data.network && (
                      <span
                        className={cn(
                          'text-[10px] px-1.5 py-0.5 rounded-full font-medium',
                          data.network === 'mainnet'
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
                        )}
                      >
                        {data.network === 'mainnet' ? 'Mainnet' : 'Testnet'}
                      </span>
                    )}
                    <span className="text-[10px] text-zinc-400">{format(new Date(log.timestamp), 'MMM d HH:mm')}</span>
                    {mainId && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopy(mainId, log.id);
                        }}
                        className="p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700"
                      >
                        {copiedId === log.id ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3 text-zinc-400" />}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </motion.section>

      {/* Console configuration (store-based) */}
      {filteredStoreItems.length > 0 && (
        <motion.section variants={sectionItem}>
          <div className="flex items-center gap-2 mb-3">
            <Database className="h-3.5 w-3.5 text-zinc-400" />
            <h2 className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Active Configuration</h2>
            {selectedL1 && <span className="text-[10px] text-zinc-400">({selectedL1.name})</span>}
          </div>
          <div className="space-y-1.5">
            {filteredStoreItems.map((item) => {
              const network = isTestnet ? 'testnet' : 'mainnet';
              const explorerUrl =
                item.type === 'tx'
                  ? getExplorerUrl(item.address, 'tx', network, 'P')
                  : item.chainId
                    ? getExplorerUrl(item.address, 'address', network, item.chainId)
                    : null;
              return (
                <div
                  key={item.id}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/30',
                    explorerUrl && 'cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800/50',
                  )}
                  onClick={() => explorerUrl && window.open(explorerUrl, '_blank')}
                >
                  <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300 w-36 shrink-0">{item.title}</span>
                  <code className="text-xs text-zinc-500 font-mono flex-1 truncate">{item.address}</code>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCopy(item.address, item.id);
                    }}
                    className="p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 shrink-0"
                  >
                    {copiedId === item.id ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3 text-zinc-400" />}
                  </button>
                </div>
              );
            })}
          </div>
        </motion.section>
      )}
    </motion.div>
  );
}
