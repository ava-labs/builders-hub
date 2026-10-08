'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { AlertTriangle, ArrowDownLeft, ArrowUpRight, Check, Loader2, MessageSquare, Network, Send } from 'lucide-react';
import { useL1CrossChainStats } from '@/hooks/useL1CrossChainStats';
import { useUserActivityForL1 } from '@/hooks/useUserActivityForL1';
import type { CombinedL1 } from '@/lib/console/my-l1/types';
import { cn } from '@/lib/utils';
import { BONE, EYEBROW, HAIRLINE, NOTICE_ERROR } from './chrome';

/**
 * Per-L1 cross-chain metrics card. Three sections:
 *   - **Bridges (ICTT)** — ecosystem-wide ICTT transfers crossing this L1.
 *   - **Your activity** — local activity from `iccttBridgeStore.activityLog`.
 *     Reflects the user's own sends/registrations immediately, regardless of
 *     upstream indexing latency (the canonical "did my test send work?" view).
 *   - **ICM messages** — ecosystem-wide ICM volume from ClickHouse.
 *
 * Each ecosystem section carries a one-line attribution so users can tell
 * which numbers move on their own actions vs. external indexer state.
 *
 * Renders frameless: CrossChainSection supplies the board around it.
 */
export function L1BridgeActivityCard({ l1 }: { l1: CombinedL1 }) {
  const { data, isLoading, error } = useL1CrossChainStats(l1.blockchainId, l1.evmChainId);
  const userActivity = useUserActivityForL1(l1.blockchainId);

  return (
    <div className="flex min-w-0 flex-col">
      <div className="flex min-h-9 items-center gap-4 border-b border-zinc-200 px-5 py-2 md:px-6 dark:border-zinc-800">
        <p className={cn(EYEBROW, 'truncate')}>Activity on {l1.chainName}</p>
      </div>
      <p className="px-5 pt-4 text-[13px] leading-relaxed text-zinc-500 md:px-6 dark:text-zinc-400">
        Aggregate bridge transfers and ICM traffic crossing this L1. Your own activity is tracked separately below.
      </p>
      <div className="flex flex-col gap-5 px-5 py-4 md:px-6">
        {error && (
          <p className={cn(NOTICE_ERROR, 'px-3 py-2 font-mono text-[11px] [overflow-wrap:anywhere]')}>
            Couldn&apos;t load cross-chain stats. {error}
          </p>
        )}

        <section className="flex flex-col gap-2">
          <SectionTitle>Bridges (ICTT)</SectionTitle>
          <SourceHint>Ecosystem-wide, indexed externally — refreshes every 30 min.</SourceHint>
          {isLoading ? (
            <Skeleton rows={2} />
          ) : data?.ictt ? (
            <div className="grid grid-cols-2 border-l border-t border-zinc-200 dark:border-zinc-800">
              <StatCell
                icon={<ArrowUpRight className="h-3.5 w-3.5" aria-hidden />}
                label="Outbound transfers"
                value={formatCount(data.ictt.outboundTransfers)}
              />
              <StatCell
                icon={<ArrowDownLeft className="h-3.5 w-3.5" aria-hidden />}
                label="Inbound transfers"
                value={formatCount(data.ictt.inboundTransfers)}
              />
              <StatCell
                icon={<Network className="h-3.5 w-3.5" aria-hidden />}
                label="Counterparty chains"
                value={formatCount(data.ictt.counterpartyCount)}
              />
              <StatCell
                icon={<span className="text-[10px] font-semibold">{data.ictt.topToken?.symbol?.[0] ?? '·'}</span>}
                label="Top token"
                value={
                  data.ictt.topToken ? `${data.ictt.topToken.symbol} · ${formatCount(data.ictt.topToken.count)}` : '—'
                }
              />
            </div>
          ) : (
            <EmptyLine>No bridge activity recorded.</EmptyLine>
          )}
        </section>

        <section className="flex flex-col gap-2">
          <SectionTitle>Your activity</SectionTitle>
          <SourceHint>Live from your local bridge log — no indexer lag.</SourceHint>
          {userActivity.total === 0 ? (
            <EmptyLine>
              No transfers yet. Send via{' '}
              <Link
                href="/console/ictt/live"
                className="font-mono text-zinc-900 underline underline-offset-4 hover:text-[#E6212F] dark:text-zinc-100"
              >
                /console/ictt/live
              </Link>{' '}
              to test.
            </EmptyLine>
          ) : (
            <div className="grid grid-cols-2 border-l border-t border-zinc-200 dark:border-zinc-800">
              <StatCell
                icon={<Send className="h-3.5 w-3.5" aria-hidden />}
                label="Sends"
                value={formatCount(userActivity.sends)}
              />
              <StatCell
                icon={<Check className="h-3.5 w-3.5" aria-hidden />}
                label="Delivered"
                value={formatCount(userActivity.delivered)}
              />
              <StatCell
                icon={
                  <Loader2 className={cn('h-3.5 w-3.5', userActivity.inFlight > 0 && 'animate-spin')} aria-hidden />
                }
                label="In flight"
                value={formatCount(userActivity.inFlight)}
              />
              <StatCell
                icon={<AlertTriangle className="h-3.5 w-3.5" aria-hidden />}
                label="Failed"
                value={formatCount(userActivity.failed)}
              />
            </div>
          )}
        </section>

        <section className="flex flex-col gap-2">
          <SectionTitle>ICM messages</SectionTitle>
          <SourceHint>Ecosystem-wide, indexed via ClickHouse.</SourceHint>
          {isLoading ? (
            <Skeleton rows={1} />
          ) : data?.icm ? (
            <div className="grid grid-cols-2 border-l border-t border-zinc-200 dark:border-zinc-800">
              <StatCell
                icon={<MessageSquare className="h-3.5 w-3.5" aria-hidden />}
                label="Last 24h"
                value={formatCount(data.icm.msgs24h)}
              />
              <StatCell
                icon={<MessageSquare className="h-3.5 w-3.5" aria-hidden />}
                label="Last 7d"
                value={formatCount(data.icm.msgs7d)}
              />
              <StatCell
                icon={<Network className="h-3.5 w-3.5" aria-hidden />}
                label="Top counterparty"
                value={data.icm.topPair ? `${data.icm.topPair.chainName}` : '—'}
                helper={data.icm.topPair ? `${formatCount(data.icm.topPair.messageCount)} msgs` : undefined}
                wide
              />
            </div>
          ) : (
            <EmptyLine>No ICM activity recorded for this L1.</EmptyLine>
          )}
        </section>
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: string }) {
  return (
    <h3 className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-900 dark:text-zinc-100">
      {children}
    </h3>
  );
}

function SourceHint({ children }: { children: string }) {
  return (
    <p className="-mt-1 font-mono text-[10px] leading-4 tracking-[0.04em] text-zinc-400 dark:text-zinc-500">
      {children}
    </p>
  );
}

function StatCell({
  icon,
  label,
  value,
  helper,
  wide,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  helper?: string;
  wide?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex min-w-0 flex-col gap-1 border-b border-r border-zinc-200 bg-white/80 px-3 py-2.5 dark:border-zinc-800 dark:bg-zinc-950/80',
        wide && 'col-span-2',
      )}
    >
      <span className="flex items-center gap-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400 [&_svg]:h-3 [&_svg]:w-3">
        <span className="flex shrink-0 items-center text-zinc-400">{icon}</span>
        <span className="truncate">{label}</span>
      </span>
      <span className="truncate font-mono text-[15px] tabular-nums tracking-tight text-zinc-900 dark:text-zinc-50">
        {value}
      </span>
      {helper && <span className="truncate font-mono text-[10px] tabular-nums text-zinc-400">{helper}</span>}
    </div>
  );
}

function Skeleton({ rows }: { rows: number }) {
  return (
    <div className="grid grid-cols-2 border-l border-t border-zinc-200 dark:border-zinc-800">
      {Array.from({ length: rows * 2 }).map((_, i) => (
        <div key={i} className="flex flex-col gap-2 border-b border-r border-zinc-200 px-3 py-2.5 dark:border-zinc-800">
          <span className={cn(BONE, 'h-2 w-16')} />
          <span className={cn(BONE, 'h-4 w-10')} />
        </div>
      ))}
    </div>
  );
}

function EmptyLine({ children }: { children: ReactNode }) {
  return <p className={cn(HAIRLINE, 'px-3 py-2.5 text-[12px] text-zinc-500 dark:text-zinc-400')}>{children}</p>;
}

function formatCount(n: number): string {
  if (n === 0) return '0';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}
