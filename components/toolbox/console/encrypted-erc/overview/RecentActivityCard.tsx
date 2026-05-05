'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Activity, ArrowUpRight, CheckCircle2, ChevronRight, Clock3, XCircle } from 'lucide-react';
import { useTxHistoryStore, type TxRecord } from '@/components/toolbox/stores/txHistoryStore';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { boardItem } from '@/components/console/motion';
import { cn } from '@/lib/utils';
import { TileShell } from './TileShell';

/**
 * Surfaces the user's most recent encrypted-ERC writes pulled from the
 * tx-history store (wired by `useEERCNotifiedWrite` since commit
 * `2f812957b`). With the per-network store available we get a real
 * cross-tool activity feed for free.
 *
 * The card is a flex column so the "See all" link pins to the bottom
 * regardless of how many activity rows fit. Filtering is by operation
 * copy rather than a separate tag because every EERC write resolves to
 * a string that already mentions "encrypted-ERC" or "encrypted
 * transfer" (see hooks under `hooks/eerc/use*Write`); a case-
 * insensitive includes-check is enough and keeps the store schema
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
      <TileShell className="flex h-full flex-col">
        <div className="mb-3 flex items-center gap-2">
          <Activity className="h-4 w-4 text-zinc-500 dark:text-zinc-400" strokeWidth={2} />
          <h3 className="text-sm font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">Recent activity</h3>
          <span className="ml-auto font-mono text-[9px] uppercase tracking-[0.16em] text-zinc-400 dark:text-zinc-500">
            {isTestnet ? 'Testnet' : 'Mainnet'}
          </span>
        </div>

        <div className="flex-1">
          {recent.length === 0 ? (
            <EmptyState />
          ) : (
            <ul className="space-y-2">
              {recent.map((tx) => (
                <ActivityRow key={tx.id} tx={tx} />
              ))}
            </ul>
          )}
        </div>

        <Link
          href="/console/history"
          className="mt-4 flex items-center justify-between border-t border-zinc-100 pt-3 text-[11px] font-medium text-zinc-600 transition-colors hover:text-zinc-950 dark:border-zinc-800/80 dark:text-zinc-400 dark:hover:text-zinc-50"
        >
          <span>See all transactions</span>
          <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </TileShell>
    </motion.div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-lg border border-dashed border-zinc-200 px-3 py-4 text-[11px] leading-relaxed text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
      No encrypted-ERC actions yet on this network. Register, deposit, or transfer to see them here.
    </div>
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
      <span className="font-mono text-[11px] tabular-nums text-zinc-400 dark:text-zinc-500">
        {tx.txHash.slice(0, 8)}…
      </span>
      {explorer && <ArrowUpRight className="h-3 w-3 text-zinc-400 dark:text-zinc-500" strokeWidth={2} />}
    </div>
  );

  return (
    <li>
      {explorer ? (
        <a
          href={explorer}
          target="_blank"
          rel="noreferrer"
          className="block rounded-md -mx-1 px-1 py-1 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900/60"
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
    return <CheckCircle2 className={cn('h-3.5 w-3.5 shrink-0 text-emerald-500')} strokeWidth={2} />;
  }
  if (status === 'failed') {
    return <XCircle className="h-3.5 w-3.5 shrink-0 text-rose-500" strokeWidth={2} />;
  }
  return <Clock3 className="h-3.5 w-3.5 shrink-0 text-amber-500" strokeWidth={2} />;
}

function explorerLink(tx: TxRecord): string | undefined {
  if (!tx.txHash) return undefined;
  if (tx.network === 'fuji') return `https://testnet.snowtrace.io/tx/${tx.txHash}`;
  if (tx.network === 'mainnet' && (!tx.chainId || tx.chainId === 43114)) {
    return `https://snowtrace.io/tx/${tx.txHash}`;
  }
  return undefined;
}
