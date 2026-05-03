'use client';

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Activity, ArrowUpRight, CheckCircle2, Clock3, XCircle } from 'lucide-react';
import { useTxHistoryStore, type TxRecord } from '@/components/toolbox/stores/txHistoryStore';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { boardItem } from '@/components/console/motion';
import { cn } from '@/lib/utils';
import { TileShell } from './TileShell';

/**
 * Surfaces the user's most recent encrypted-ERC writes pulled from the
 * tx-history store (wired by `useEERCNotifiedWrite` since commit
 * `2f812957b`). Earlier the Overview pretended to be a static dashboard;
 * with the per-network store available we get a real cross-tool activity
 * feed for free.
 *
 * Filtering is by operation copy rather than a separate tag because every
 * EERC write resolves to a string that already mentions "encrypted-ERC"
 * or "encrypted transfer" (see hooks under `hooks/eerc/use*Write`); a
 * case-insensitive includes-check is enough and keeps the store schema
 * untouched.
 */
const MAX_ROWS = 5;

interface RecentActivityCardProps {
  className?: string;
}

export function RecentActivityCard({ className }: RecentActivityCardProps) {
  const { transactions } = useTxHistoryStore();
  const isTestnet = useWalletStore((s) => s.isTestnet);

  const recent = useMemo(() => filterEERCRecent(transactions), [transactions]);

  return (
    <motion.div className={className} variants={boardItem}>
      <TileShell className="h-full">
        <div className="flex items-center gap-2 mb-3">
          <Activity className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Recent activity</h3>
          <span className="ml-auto text-[10px] font-mono uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
            {isTestnet ? 'Testnet' : 'Mainnet'}
          </span>
        </div>

        {recent.length === 0 ? (
          <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
            No encrypted-ERC actions yet on this network. Register, deposit, or transfer to see them here.
          </p>
        ) : (
          <ul className="space-y-2">
            {recent.map((tx) => (
              <ActivityRow key={tx.id} tx={tx} />
            ))}
          </ul>
        )}
      </TileShell>
    </motion.div>
  );
}

function filterEERCRecent(transactions: TxRecord[]): TxRecord[] {
  const out: TxRecord[] = [];
  for (const tx of transactions) {
    if (out.length >= MAX_ROWS) break;
    const op = tx.operation?.toLowerCase() ?? '';
    if (op.includes('encrypted-erc') || op.includes('encrypted transfer')) {
      out.push(tx);
    }
  }
  return out;
}

function ActivityRow({ tx }: { tx: TxRecord }) {
  const explorer = explorerLink(tx);
  const inner = (
    <div className="flex items-center gap-2 text-xs">
      <StatusIcon status={tx.status} />
      <span className="flex-1 truncate text-zinc-700 dark:text-zinc-300" title={tx.operation}>
        {tx.operation}
      </span>
      <span className="font-mono text-[11px] text-zinc-400 dark:text-zinc-500">{tx.txHash.slice(0, 8)}…</span>
      {explorer && <ArrowUpRight className="w-3 h-3 text-zinc-400 dark:text-zinc-500" />}
    </div>
  );

  return (
    <li>
      {explorer ? (
        <a
          href={explorer}
          target="_blank"
          rel="noreferrer"
          className="block rounded-md -mx-1 px-1 py-1 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
        >
          {inner}
        </a>
      ) : (
        <div className="px-1 py-1">{inner}</div>
      )}
    </li>
  );
}

function StatusIcon({ status }: { status: TxRecord['status'] }) {
  if (status === 'confirmed') {
    return <CheckCircle2 className={cn('w-3.5 h-3.5 shrink-0 text-emerald-500')} />;
  }
  if (status === 'failed') {
    return <XCircle className="w-3.5 h-3.5 shrink-0 text-rose-500" />;
  }
  return <Clock3 className="w-3.5 h-3.5 shrink-0 text-amber-500" />;
}

function explorerLink(tx: TxRecord): string | undefined {
  if (!tx.txHash) return undefined;
  if (tx.network === 'fuji') return `https://testnet.snowtrace.io/tx/${tx.txHash}`;
  if (tx.network === 'mainnet' && (!tx.chainId || tx.chainId === 43114)) {
    return `https://snowtrace.io/tx/${tx.txHash}`;
  }
  return undefined;
}
