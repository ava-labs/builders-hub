'use client';

import { ArrowDownLeft, ArrowUpRight, MessageSquare, Network } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useL1CrossChainStats } from '@/hooks/useL1CrossChainStats';
import type { CombinedL1 } from '@/lib/console/my-l1/types';
import { cn } from '@/lib/utils';

/**
 * Aggregate per-L1 cross-chain metrics:
 *   - ICTT bridge transfers in/out (from /api/ictt-stats, filtered server-side)
 *   - ICM message counts 24h / 7d (from ClickHouse via /api/console/cross-chain-stats)
 *
 * Read-only summary card. Drill-down lives in /console/ictt (My bridges)
 * and /console/icm. Renders gracefully when either source returns null —
 * the cross-chain-stats route is designed to give partial results.
 */
export function L1BridgeActivityCard({ l1 }: { l1: CombinedL1 }) {
  const { data, isLoading, error } = useL1CrossChainStats(l1.blockchainId, l1.evmChainId);

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold">Activity on {l1.chainName}</CardTitle>
        <CardDescription className="text-xs">
          Aggregate bridge transfers and ICM traffic crossing this L1.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <p className="rounded-md border border-rose-200 bg-rose-50/40 px-2.5 py-1.5 text-[11px] text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/20 dark:text-rose-300">
            Couldn&apos;t load cross-chain stats. {error}
          </p>
        )}

        <section className="space-y-2">
          <SectionTitle>Bridges (ICTT)</SectionTitle>
          {isLoading ? (
            <Skeleton rows={2} />
          ) : data?.ictt ? (
            <div className="grid grid-cols-2 gap-2">
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
                value={data.ictt.topToken ? `${data.ictt.topToken.symbol} · ${formatCount(data.ictt.topToken.count)}` : '—'}
              />
            </div>
          ) : (
            <EmptyLine>No bridge activity recorded.</EmptyLine>
          )}
        </section>

        <section className="space-y-2">
          <SectionTitle>ICM messages</SectionTitle>
          {isLoading ? (
            <Skeleton rows={1} />
          ) : data?.icm ? (
            <div className="grid grid-cols-2 gap-2">
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
      </CardContent>
    </Card>
  );
}

function SectionTitle({ children }: { children: string }) {
  return (
    <h3 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">{children}</h3>
  );
}

function StatCell({
  icon,
  label,
  value,
  helper,
  wide,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  helper?: string;
  wide?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-md border border-zinc-200 bg-white px-2.5 py-2 dark:border-zinc-800 dark:bg-zinc-950/40',
        wide && 'col-span-2',
      )}
    >
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
        {icon}
      </span>
      <div className="flex min-w-0 flex-1 flex-col leading-tight">
        <span className="text-[10px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400">{label}</span>
        <span className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">{value}</span>
        {helper && <span className="truncate text-[11px] text-zinc-500 dark:text-zinc-400">{helper}</span>}
      </div>
    </div>
  );
}

function Skeleton({ rows }: { rows: number }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {Array.from({ length: rows * 2 }).map((_, i) => (
        <div key={i} className="h-12 animate-pulse rounded-md bg-zinc-100 dark:bg-zinc-800" />
      ))}
    </div>
  );
}

function EmptyLine({ children }: { children: string }) {
  return (
    <p className="rounded-md border border-dashed border-zinc-200 bg-zinc-50/40 px-2.5 py-2 text-[11px] text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-400">
      {children}
    </p>
  );
}

function formatCount(n: number): string {
  if (n === 0) return '0';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}
