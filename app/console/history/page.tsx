'use client';

import { useSession } from 'next-auth/react';
import { useLoginModalTrigger } from '@/hooks/useLoginModal';

import { useState, useMemo, useRef, useEffect } from 'react';
import useConsoleNotifications from '@/hooks/useConsoleNotifications';
import type { ConsoleLog } from '@/types/console-log';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { useSelectedL1 } from '@/components/toolbox/stores/l1ListStore';
import { useToolboxStore } from '@/components/toolbox/stores/toolboxStore';
import { useCreateChainStore } from '@/components/toolbox/stores/createChainStore';
import { useTxHistoryStore } from '@/components/toolbox/stores/txHistoryStore';
import type { TxRecord, TxStatus } from '@/components/toolbox/stores/txHistoryStore';
import { useNotificationPanelStore } from '@/components/console/notification-panel';
import {
  Board,
  CellLabel,
  EmptyRow,
  HEAD,
  MUTED,
  ROW,
  Rise,
  RowSkeleton,
  SectionHeader,
  SpecPlate,
  SpecRow,
  TxTypePill,
} from '@/components/explorer-v2/ui';
import { ArrowUpRight, Download, LogIn, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/cn';
import {
  COUNT,
  DANGER_BUTTON,
  EYEBROW,
  HashCell,
  PRIMARY_BUTTON,
  SECONDARY_BUTTON,
  SearchField,
  StatusDot,
  StatusText,
  type Tone,
} from './bits';

const MAX_RECENT_ITEMS = 15;

const SESSION_COLS = 'md:grid-cols-[0.75rem_minmax(0,1fr)_minmax(0,18rem)_1.5rem]';
const TX_COLS = 'md:grid-cols-[0.75rem_6.5rem_minmax(0,1fr)_4.5rem_4.5rem_minmax(0,11rem)_5.5rem]';
const LOG_COLS = 'md:grid-cols-[0.75rem_6.5rem_minmax(0,1fr)_5rem_minmax(0,11rem)]';

/** Full outline, so a board standing alone under a section header reads as one box. */
const BOX = 'border-x border-t';

export default function ConsoleHistoryPage() {
  const { data: session, status } = useSession();
  const { openLoginModal } = useLoginModalTrigger();
  const { logs: fullHistory, getExplorerUrl, loading } = useConsoleNotifications();
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const panelNotifications = useNotificationPanelStore((s) => s.notifications);
  const searchRef = useRef<HTMLInputElement>(null);

  const { isTestnet } = useWalletStore();
  const selectedL1 = useSelectedL1();
  const toolboxStore = useToolboxStore();
  const createChainStore = useCreateChainStore()();
  const { transactions: txHistory, clearHistory: clearTxHistory } = useTxHistoryStore();

  // "/" jumps to search from anywhere on the page, unless the reader is already typing somewhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (e.key !== '/' || target?.closest('input, textarea, [contenteditable="true"]')) return;
      e.preventDefault();
      searchRef.current?.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

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
      if (createChainStore.subnetId)
        items.push({ id: 'cc-subnet', title: 'Subnet ID', address: createChainStore.subnetId, type: 'tx' });
      if (createChainStore.chainID)
        items.push({ id: 'cc-chain', title: 'Blockchain ID', address: createChainStore.chainID, type: 'tx' });
      if (createChainStore.convertToL1TxId)
        items.push({
          id: 'cc-l1-tx',
          title: 'Convert to L1 Tx',
          address: createChainStore.convertToL1TxId,
          type: 'tx',
        });
      if (
        createChainStore.managerAddress &&
        createChainStore.managerAddress !== '0xfacade0000000000000000000000000000000000'
      ) {
        items.push({
          id: 'cc-manager',
          title: 'Manager Address',
          address: createChainStore.managerAddress,
          chainId: createChainStore.evmChainId?.toString(),
          type: 'address',
        });
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
    if (tx.type === 'pchain') return `/explorer/${tx.network}/p-chain/tx/${tx.txHash}`;
    if (tx.chainId === 43114) return `/explorer/mainnet/c-chain/tx/${tx.txHash}`;
    if (tx.chainId === 43113) return `/explorer/fuji/c-chain/tx/${tx.txHash}`;
    const base = tx.network === 'mainnet' ? 'https://explorer.avax.network' : 'https://explorer-test.avax.network';
    return `${base}/c-chain/tx/${tx.txHash}`;
  };

  const statusConfig: Record<TxStatus, { label: string; tone: Tone }> = {
    confirmed: { label: 'Confirmed', tone: 'success' },
    pending: { label: 'Pending', tone: 'pending' },
    failed: { label: 'Failed', tone: 'failed' },
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

  const hasAnything = fullHistory.length > 0 || storeItems.length > 0 || txHistory.length > 0;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 pb-20 pt-2">
      <Rise className="flex flex-col gap-6">
        <div className="flex flex-col gap-3">
          <p className={EYEBROW}>History</p>
          <h1 className="max-w-3xl text-3xl font-semibold tracking-tight text-zinc-900 md:text-4xl dark:text-zinc-50">
            What you deployed and signed.
          </h1>
          <p className="max-w-2xl text-[15px] leading-relaxed text-zinc-500 dark:text-zinc-400">
            Saved IDs and addresses, this session&apos;s activity, and your transactions. Search, copy, or export them
            as JSON.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <SearchField
            ref={searchRef}
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Search by name, hash or address"
            label="Search history"
          />
          {hasAnything && (
            <button type="button" onClick={handleExport} className={SECONDARY_BUTTON}>
              <Download className="h-3.5 w-3.5" aria-hidden />
              Export
            </button>
          )}
          {filteredTxHistory.length > 0 && (
            <button type="button" onClick={clearTxHistory} className={DANGER_BUTTON}>
              <Trash2 className="h-3.5 w-3.5" aria-hidden />
              Clear transactions
            </button>
          )}
        </div>
      </Rise>

      {/* Console configuration (store-based) */}
      {filteredStoreItems.length > 0 && (
        <Rise delay={0.04}>
          <section className="flex flex-col gap-4">
            <SectionHeader
              label="Saved values"
              action={
                <span className={COUNT}>
                  {selectedL1 ? `${selectedL1.name} · ` : ''}
                  {filteredStoreItems.length}
                </span>
              }
            />
            <Board divide={false} className={cn(BOX, 'px-5 md:px-6')}>
              <SpecPlate>
                {filteredStoreItems.map((item) => {
                  const network = isTestnet ? 'testnet' : 'mainnet';
                  const explorerUrl =
                    item.type === 'tx'
                      ? getExplorerUrl(item.address, 'tx', network, 'P')
                      : item.chainId
                        ? getExplorerUrl(item.address, 'address', network, item.chainId)
                        : null;
                  return (
                    <SpecRow key={item.id} label={item.title}>
                      <HashCell
                        value={item.address}
                        href={explorerUrl}
                        copied={copiedId === item.id}
                        onCopy={() => handleCopy(item.address, item.id)}
                        full
                      />
                    </SpecRow>
                  );
                })}
              </SpecPlate>
            </Board>
          </section>
        </Rise>
      )}

      {/* Current session activity (from notification panel) */}
      {panelNotifications.length > 0 && (
        <Rise delay={0.06}>
          <section className="flex flex-col gap-4">
            <SectionHeader
              label="This session"
              action={<span className={COUNT}>{Math.min(panelNotifications.length, 10)}</span>}
            />
            <Board className={BOX}>
              <div className={cn(HEAD, SESSION_COLS)}>
                <span />
                <span>Action</span>
                <span>Result</span>
                <span />
              </div>
              {panelNotifications.slice(0, 10).map((n) => {
                const tone: Tone = n.status === 'loading' ? 'pending' : n.status === 'success' ? 'success' : 'failed';
                return (
                  <div key={n.id} className={cn(ROW, SESSION_COLS)}>
                    <StatusDot tone={tone} label={n.status} />
                    <span className="truncate text-[13.5px] font-medium text-zinc-900 dark:text-zinc-50">{n.name}</span>
                    <span className={cn(MUTED, 'col-span-2 truncate md:col-span-1')}>{n.message}</span>
                    <span className="hidden justify-end md:flex">
                      {n.explorerUrl && (
                        <a
                          href={n.explorerUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`Open ${n.name} in explorer`}
                          className="p-1 text-zinc-400 transition-colors hover:text-[#E6212F]"
                        >
                          <ArrowUpRight className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </span>
                  </div>
                );
              })}
            </Board>
          </section>
        </Rise>
      )}

      {/* Local transaction history (from txHistoryStore, persisted in localStorage) */}
      {filteredTxHistory.length > 0 && (
        <Rise delay={0.08}>
          <section className="flex flex-col gap-4">
            <SectionHeader label="Transactions" action={<span className={COUNT}>{filteredTxHistory.length}</span>} />
            <Board className={BOX}>
              <div className={cn(HEAD, TX_COLS)}>
                <span />
                <span>Time</span>
                <span>Action</span>
                <span>Chain</span>
                <span>Network</span>
                <span>Hash</span>
                <span className="text-right">Status</span>
              </div>
              {filteredTxHistory.map((tx) => {
                const explorerUrl = getTxExplorerUrl(tx);
                const txStatus = statusConfig[tx.status];
                return (
                  <div
                    key={tx.id}
                    className={cn(
                      ROW,
                      TX_COLS,
                      'group/row',
                      tx.status === 'failed' && 'bg-red-50/40 dark:bg-red-950/20',
                      explorerUrl && 'cursor-pointer',
                    )}
                    onClick={() => explorerUrl && window.open(explorerUrl, '_blank')}
                  >
                    <StatusDot tone={txStatus.tone} label={txStatus.label} />
                    <span className={MUTED}>
                      <CellLabel>Time</CellLabel>
                      {format(new Date(tx.timestamp), 'MMM d HH:mm')}
                    </span>
                    <span className="col-span-2 min-w-0 md:col-span-1">
                      <CellLabel>Action</CellLabel>
                      <TxTypePill
                        type={tx.operation}
                        label={tx.operation?.trim() || 'Transaction'}
                        className="text-[11px] text-zinc-900 dark:text-zinc-50"
                      />
                    </span>
                    <span className={MUTED}>
                      <CellLabel>Chain</CellLabel>
                      {tx.type === 'pchain' ? 'P-Chain' : 'EVM'}
                    </span>
                    <span className={MUTED}>
                      <CellLabel>Network</CellLabel>
                      {tx.network === 'mainnet' ? 'Mainnet' : 'Fuji'}
                    </span>
                    <span className="min-w-0">
                      <CellLabel>Hash</CellLabel>
                      {tx.txHash ? (
                        <HashCell
                          value={tx.txHash}
                          display={shortAddr(tx.txHash)}
                          href={explorerUrl}
                          copied={copiedId === tx.id}
                          onCopy={() => handleCopy(tx.txHash, tx.id)}
                        />
                      ) : (
                        <span className="font-mono text-[12px] text-zinc-300 dark:text-zinc-700">—</span>
                      )}
                    </span>
                    <span className="md:text-right">
                      <CellLabel>Status</CellLabel>
                      <StatusText tone={txStatus.tone}>{txStatus.label}</StatusText>
                    </span>
                  </div>
                );
              })}
            </Board>
          </section>
        </Rise>
      )}

      {/* Server-side activity log (logged-in users) */}
      <Rise delay={0.1}>
        <section className="flex flex-col gap-4">
          <SectionHeader
            label="Activity log"
            action={
              fullHistory.length > MAX_RECENT_ITEMS ? (
                <span className={COUNT}>{MAX_RECENT_ITEMS} most recent</span>
              ) : undefined
            }
          />

          {status === 'loading' || loading ? (
            <Board className={BOX}>
              <RowSkeleton n={4} />
            </Board>
          ) : !session?.user ? (
            <div className="flex flex-col gap-4 border border-zinc-200 bg-white/80 px-5 py-5 sm:flex-row sm:items-center sm:justify-between md:px-6 dark:border-zinc-800 dark:bg-zinc-950/80">
              <div className="flex flex-col gap-1.5">
                <p className={EYEBROW}>Signed out</p>
                <p className="text-[14px] text-zinc-600 dark:text-zinc-300">
                  Sign in to keep your activity log across sessions.
                </p>
              </div>
              <button type="button" onClick={() => (window.location.href = '/login')} className={PRIMARY_BUTTON}>
                <LogIn className="h-3.5 w-3.5" aria-hidden />
                Sign in
              </button>
            </div>
          ) : filteredHistory.length === 0 ? (
            <Board className={BOX}>
              <EmptyRow>{searchTerm ? 'No activity matches this search.' : 'No activity yet.'}</EmptyRow>
            </Board>
          ) : (
            <Board className={BOX}>
              <div className={cn(HEAD, LOG_COLS)}>
                <span />
                <span>Time</span>
                <span>Action</span>
                <span>Network</span>
                <span>ID</span>
              </div>
              {filteredHistory.map((log) => {
                const data = log.data as any;
                const mainId = data.txHash || data.txID || data.address || '';
                const explorerUrl = getExplorerLink(log);
                const tone: Tone = log.status === 'success' ? 'success' : 'failed';
                return (
                  <div
                    key={log.id}
                    className={cn(
                      ROW,
                      LOG_COLS,
                      log.status === 'error' && 'bg-red-50/40 dark:bg-red-950/20',
                      explorerUrl && 'cursor-pointer',
                    )}
                    onClick={() => explorerUrl && window.open(explorerUrl, '_blank')}
                  >
                    <StatusDot tone={tone} label={log.status} />
                    <span className={MUTED}>
                      <CellLabel>Time</CellLabel>
                      {format(new Date(log.timestamp), 'MMM d HH:mm')}
                    </span>
                    <span className="col-span-2 min-w-0 md:col-span-1">
                      <CellLabel>Action</CellLabel>
                      <TxTypePill
                        type={log.actionPath ?? ''}
                        label={formatTitle(log)}
                        className="text-[11px] text-zinc-900 dark:text-zinc-50"
                      />
                    </span>
                    <span className={MUTED}>
                      <CellLabel>Network</CellLabel>
                      {data.network ? (data.network === 'mainnet' ? 'Mainnet' : 'Testnet') : '—'}
                    </span>
                    <span className="min-w-0">
                      <CellLabel>ID</CellLabel>
                      {mainId ? (
                        <HashCell
                          value={mainId}
                          display={shortAddr(mainId)}
                          href={explorerUrl}
                          copied={copiedId === log.id}
                          onCopy={() => handleCopy(mainId, log.id)}
                        />
                      ) : (
                        <span className="font-mono text-[12px] text-zinc-300 dark:text-zinc-700">—</span>
                      )}
                    </span>
                  </div>
                );
              })}
            </Board>
          )}
        </section>
      </Rise>
    </div>
  );
}
