'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Activity, ExternalLink, MessageSquare } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import type { ActivityEvent } from './types';
import { formatRelativeTime } from './utils/relative-time';
import { truncateAddress } from './utils/explorer-url';

interface ICMRailProps {
  events: ActivityEvent[];
  className?: string;
}

const RECENT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

export function ICMRail({ events, className }: ICMRailProps) {
  const [open, setOpen] = useState(false);

  const icmEvents = useMemo(() => {
    const now = Date.now();
    return events
      .filter((e) => e.kind === 'icm' || e.icmMessageId)
      .filter((e) => now - e.timestampMs <= RECENT_WINDOW_MS)
      .sort((a, b) => b.timestampMs - a.timestampMs);
  }, [events]);

  const recentCount = icmEvents.length;
  const hasRecent = recentCount > 0;

  return (
    <div
      className={cn(
        'flex w-full items-center justify-center gap-2 md:h-full md:w-auto md:flex-col md:items-center md:justify-stretch md:gap-2',
        className,
      )}
      aria-hidden={false}
    >
      <span
        aria-hidden
        className="hidden h-px w-12 border-t border-dashed border-zinc-200 dark:border-zinc-800 md:block md:h-auto md:w-auto md:flex-1 md:border-l md:border-t-0"
      />
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-[11px] font-medium text-zinc-700 shadow-sm transition-colors hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800/40"
          >
            <span
              aria-hidden
              className={cn('h-1.5 w-1.5 rounded-full', hasRecent ? 'animate-pulse bg-emerald-500' : 'bg-zinc-400')}
            />
            <span className="font-mono">ICM {recentCount}</span>
            <span className="text-zinc-500 dark:text-zinc-400">msgs</span>
          </button>
        </SheetTrigger>
        <SheetContent side="right" className="w-full max-w-md sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" aria-hidden />
              Interchain Messaging log
            </SheetTitle>
          </SheetHeader>
          <div className="mt-4 flex flex-col gap-2">
            {icmEvents.length === 0 ? (
              <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-zinc-200 bg-zinc-50/60 p-6 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-400">
                <Activity className="h-5 w-5" aria-hidden />
                No ICM activity in the last hour.
              </div>
            ) : (
              icmEvents.map((e) => (
                <article
                  key={e.id}
                  className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-950/40"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-zinc-900 dark:text-zinc-100">{e.label}</span>
                    <time className="text-[11px] text-zinc-500" dateTime={new Date(e.timestampMs).toISOString()}>
                      {formatRelativeTime(e.timestampMs)}
                    </time>
                  </div>
                  <div className="mt-1 flex items-center gap-2 font-mono text-[11px] text-zinc-500">
                    {e.icmMessageId && <span>msg {truncateAddress(e.icmMessageId, 8, 4)}</span>}
                    {e.txHash && <span>tx {truncateAddress(e.txHash)}</span>}
                  </div>
                </article>
              ))
            )}
            <Link
              href="/console/ictt/legacy/setup/register-with-home"
              className="mt-3 inline-flex items-center justify-center gap-1 text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
            >
              Open registration in legacy view
              <ExternalLink className="h-3 w-3" aria-hidden />
            </Link>
          </div>
        </SheetContent>
      </Sheet>
      <span
        aria-hidden
        className="hidden h-px w-12 border-t border-dashed border-zinc-200 dark:border-zinc-800 md:block md:h-auto md:w-auto md:flex-1 md:border-l md:border-t-0"
      />
    </div>
  );
}
