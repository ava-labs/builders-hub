'use client';

import { useMemo, useState } from 'react';
import { Activity } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { ActivityRail } from './ActivityRail';
import type { ActivityEvent } from '../types';

interface ActivityChipProps {
  events: ActivityEvent[];
  onClear?: () => void;
  className?: string;
}

/**
 * Compact persistent entry point to the bridge activity log. Sits at the
 * top-right of `BridgeLayout` next to `NewBridgeButton` and replaces the older
 * floating-bell `ActivityDrawer` + header-row count badge.
 *
 * Visual contract: matches `NewBridgeButton`'s pill shape so the two read as
 * siblings. Three resting states:
 *   - empty (`count === 0`): muted icon, no badge, chip recedes
 *   - confirmed-only: zinc badge with count
 *   - has-pending: small amber dot animates next to the icon AND the badge
 *     shifts amber. The pulse stays localized so the whole chip doesn't blink.
 */
export function ActivityChip({ events, onClear, className }: ActivityChipProps) {
  const [open, setOpen] = useState(false);
  const { count, hasPending } = useMemo(
    () => ({
      count: events.length,
      hasPending: events.some((e) => e.status === 'pending'),
    }),
    [events],
  );
  const hasEvents = count > 0;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          aria-haspopup="dialog"
          aria-label={`Bridge activity, ${count} ${count === 1 ? 'event' : 'events'}${hasPending ? ', some pending' : ''}`}
          className={cn(
            'group inline-flex h-9 items-center gap-1.5 rounded-full border border-zinc-200/80 bg-white px-3 text-xs font-medium text-zinc-700 shadow-sm transition-colors',
            'hover:border-zinc-300 hover:bg-zinc-50',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300 focus-visible:ring-offset-2 focus-visible:ring-offset-white',
            'dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800/40 dark:focus-visible:ring-zinc-700 dark:focus-visible:ring-offset-zinc-950',
            className,
          )}
        >
          <span className="relative inline-flex items-center justify-center">
            <Activity
              aria-hidden
              className={cn(
                'h-3.5 w-3.5 transition-colors',
                hasPending
                  ? 'text-amber-600 dark:text-amber-400'
                  : hasEvents
                    ? 'text-zinc-600 group-hover:text-zinc-800 dark:text-zinc-300 dark:group-hover:text-zinc-100'
                    : 'text-zinc-400 group-hover:text-zinc-600 dark:text-zinc-500 dark:group-hover:text-zinc-300',
              )}
            />
            {hasPending && (
              <span aria-hidden className="absolute -right-1 -top-1 flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-amber-500" />
              </span>
            )}
          </span>
          <span>Activity</span>
          {hasEvents && (
            <span
              className={cn(
                'inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full px-1.5 text-[10px] font-semibold tabular-nums',
                hasPending
                  ? 'bg-amber-500/15 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300'
                  : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300',
              )}
            >
              {count > 99 ? '99+' : count}
            </span>
          )}
        </button>
      </SheetTrigger>
      <SheetContent side="right" className="flex w-full max-w-md flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b border-zinc-100 px-4 py-3 dark:border-zinc-800/80">
          <SheetTitle className="flex items-center gap-2 text-sm font-semibold">
            <Activity aria-hidden className="h-4 w-4" />
            Bridge activity
          </SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-hidden">
          <ActivityRail events={events} onClear={onClear} variant="inline" />
        </div>
      </SheetContent>
    </Sheet>
  );
}
