'use client';

import React, { useMemo } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { useTxHistoryStore, type TxRecord } from '@/components/toolbox/stores/txHistoryStore';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { CellLabel, MUTED } from '@/components/explorer-v2/ui';
import { cn } from '@/lib/utils';
import { ArrowLink, BODY_ROW, EYEBROW, FRAME, HEAD_ROW } from '../shared/ui';

/**
 * The user's most recent encrypted-ERC writes from the tx-history store
 * (wired by `useEERCNotifiedWrite`). Filtering is by operation copy: every
 * EERC write resolves to a string mentioning "encrypted-ERC" or "encrypted
 * transfer", so a case-insensitive includes-check is enough.
 */
const MAX_ROWS = 5;
const COLS = 'md:grid-cols-[0.75rem_minmax(0,1fr)_minmax(0,9rem)]';

interface RecentActivityCardProps {
  className?: string;
}

export function RecentActivityCard({ className }: RecentActivityCardProps) {
  const { transactions } = useTxHistoryStore();
  const isTestnet = useWalletStore((s) => s.isTestnet);

  const recent = useMemo(() => filterEERCRecent(transactions), [transactions]);

  return (
    <section className={cn(FRAME, 'flex flex-col', className)}>
      <div className="flex min-h-9 items-center justify-between gap-4 border-b border-zinc-200 px-4 py-2 dark:border-zinc-800">
        <p className={EYEBROW}>Recent activity</p>
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
          {isTestnet ? 'Testnet' : 'Mainnet'}
        </span>
      </div>

      <div className="flex-1">
        {recent.length === 0 ? (
          <div className="flex flex-col items-start gap-2 px-4 py-6">
            <p className={EYEBROW}>No activity yet</p>
            <p className="text-[13px] leading-relaxed text-zinc-500 dark:text-zinc-400">
              Register, deposit, or transfer on this network to see it here.
            </p>
          </div>
        ) : (
          <>
            <div className={cn(HEAD_ROW, COLS)}>
              <span />
              <span>Action</span>
              <span>Hash</span>
            </div>
            <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {recent.map((tx) => (
                <ActivityRow key={tx.id} tx={tx} />
              ))}
            </ul>
          </>
        )}
      </div>

      <div className="border-t border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <ArrowLink href="/console/history">See all transactions</ArrowLink>
      </div>
    </section>
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

const STATUS_DOT: Record<TxRecord['status'], string> = {
  confirmed: 'bg-emerald-500 dark:bg-emerald-400',
  failed: 'bg-red-500 dark:bg-red-400',
  pending: 'bg-amber-500 dark:bg-amber-400',
};

function ActivityRow({ tx }: { tx: TxRecord }) {
  const explorer = explorerLink(tx);
  return (
    <li className={cn(BODY_ROW, COLS)}>
      <span
        role="img"
        aria-label={tx.status}
        title={tx.status}
        className={cn('h-1.5 w-1.5 rounded-full', STATUS_DOT[tx.status] ?? STATUS_DOT.pending)}
      />
      <span className="truncate text-[13px] font-medium text-zinc-900 dark:text-zinc-50" title={tx.operation}>
        {tx.operation}
      </span>
      <span className="col-span-2 min-w-0 md:col-span-1">
        <CellLabel>Hash</CellLabel>
        {explorer ? (
          <a
            href={explorer}
            target="_blank"
            rel="noreferrer"
            className="group/hash inline-flex items-center gap-1 font-mono text-[12px] tabular-nums text-zinc-700 underline-offset-4 hover:text-zinc-900 hover:underline dark:text-zinc-300 dark:hover:text-zinc-50"
          >
            {tx.txHash.slice(0, 10)}…
            <ArrowUpRight className="h-3 w-3 text-zinc-400 transition-colors group-hover/hash:text-[#E6212F]" />
          </a>
        ) : (
          <span className={MUTED}>{tx.txHash ? `${tx.txHash.slice(0, 10)}…` : '—'}</span>
        )}
      </span>
    </li>
  );
}

function explorerLink(tx: TxRecord): string | undefined {
  if (!tx.txHash) return undefined;
  // Fuji C-Chain isn't fully served by our explorer yet — keep it on Snowtrace.
  if (tx.network === 'fuji') return `https://testnet.snowtrace.io/tx/${tx.txHash}`;
  if (tx.network === 'mainnet' && (!tx.chainId || tx.chainId === 43114)) {
    return `/explorer/mainnet/c-chain/tx/${tx.txHash}`;
  }
  return undefined;
}
