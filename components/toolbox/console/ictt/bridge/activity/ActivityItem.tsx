'use client';

import Link from 'next/link';
import { ArrowRight, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useL1ByChainId } from '@/components/toolbox/stores/l1ListStore';
import { buildIcmMessageUrl, buildTxUrl, truncateAddress } from '../utils/explorer-url';
import { formatRelativeTime } from '../utils/relative-time';
import type { ActivityEvent } from '../types';

interface ActivityItemProps {
  event: ActivityEvent;
  nowMs?: number;
}

const KIND_DOT: Record<ActivityEvent['kind'], string> = {
  deploy: 'bg-emerald-500',
  'register-sent': 'bg-purple-500',
  'register-received': 'bg-purple-500',
  collateral: 'bg-emerald-500',
  send: 'bg-emerald-500',
  receive: 'bg-emerald-500',
  icm: 'bg-sky-500',
};

const STATUS_DOT: Record<ActivityEvent['status'], string> = {
  pending: 'bg-amber-400',
  confirmed: '',
  failed: 'bg-red-500',
};

export function ActivityItem({ event, nowMs }: ActivityItemProps) {
  const chainIdString = typeof event.chainId === 'number' ? String(event.chainId) : (event.chainId ?? '');
  const l1 = useL1ByChainId(chainIdString) ?? null;

  const dotColor =
    event.status === 'pending' || event.status === 'failed' ? STATUS_DOT[event.status] : KIND_DOT[event.kind];

  const explorerUrl = event.icmMessageId
    ? buildIcmMessageUrl(l1, event.txHash ?? null, event.icmMessageId)
    : buildTxUrl(l1, event.txHash ?? null);

  const inner = (
    <div className="flex items-start gap-2.5">
      <span
        aria-hidden
        className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', dotColor, event.status === 'pending' && 'animate-pulse')}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-[13px] font-medium text-zinc-900 dark:text-zinc-100">{event.label}</span>
          <time className="shrink-0 text-[10px] text-zinc-400" dateTime={new Date(event.timestampMs).toISOString()}>
            {formatRelativeTime(event.timestampMs, nowMs)}
          </time>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">
          {event.sublabel && <span className="truncate">{event.sublabel}</span>}
          {event.txHash && (
            <span className="font-mono text-[10px] text-zinc-400">tx {truncateAddress(event.txHash)}</span>
          )}
          {event.icmMessageId && (
            <span className="font-mono text-[10px] text-zinc-400">msg {truncateAddress(event.icmMessageId, 6, 4)}</span>
          )}
        </div>
      </div>
      {explorerUrl && (
        <span className="mt-1 inline-flex h-4 w-4 shrink-0 items-center justify-center text-zinc-400">
          <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </span>
      )}
    </div>
  );

  if (explorerUrl) {
    return (
      <Link
        href={explorerUrl}
        target="_blank"
        rel="noreferrer"
        className="block rounded-lg px-2.5 py-2 transition-colors hover:bg-zinc-100/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900/20 dark:hover:bg-zinc-800/40"
        aria-label={`${event.label} — open in explorer`}
      >
        {inner}
      </Link>
    );
  }

  return <div className="rounded-lg px-2.5 py-2">{inner}</div>;
}

export function ActivityItemEmptyState() {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
      <ExternalLink aria-hidden className="h-5 w-5 text-zinc-300" />
      <p className="text-xs font-medium text-zinc-500">No bridge activity yet</p>
      <p className="text-[10px] text-zinc-400">Deploy your first contract to begin.</p>
    </div>
  );
}
