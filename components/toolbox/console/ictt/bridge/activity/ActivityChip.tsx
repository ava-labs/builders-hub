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
 * Compact persistent entry point to the bridge activity log. Sits in the
 * StepFlow nav row next to `NewBridgeButton`.
 *
 * Visual contract: shares chrome with `NewBridgeButton` (`rounded-lg`,
 * `ring-1`) so the two read as a paired action group. Differentiation comes
 * from the icon and pending state:
 *   - empty (count === 0): muted icon, no count chip
 *   - confirmed-only: zinc count chip
 *   - has-pending: amber icon + pulsing halo dot + amber count chip
 * Label collapses to `sr-only` on narrow viewports.
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
          title={`Bridge activity${hasEvents ? ` (${count})` : ''}`}
          className={cn(
            'group inline-flex h-9 items-center gap-1.5 rounded-lg bg-zinc-50 px-2.5 text-xs font-medium text-zinc-700 ring-1 ring-zinc-200/80 transition-[transform,colors,box-shadow] duration-150',
            'shadow-[0_1px_0_rgba(0,0,0,0.04)] hover:-translate-y-px hover:bg-zinc-100 hover:ring-zinc-300',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-50',
            'dark:bg-zinc-900/60 dark:text-zinc-200 dark:ring-zinc-700/80 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]',
            'dark:hover:bg-zinc-800/80 dark:hover:ring-zinc-600 dark:focus-visible:ring-offset-zinc-950',
            'sm:px-3',
            className,
          )}
        >
          <span className="relative inline-flex items-center justify-center">
            <Activity
              aria-hidden
              className={cn(
                'h-3.5 w-3.5 transition-colors',
                hasPending
                  ? 'text-amber-500 dark:text-amber-400'
                  : hasEvents
                    ? 'text-zinc-600 group-hover:text-zinc-800 dark:text-zinc-300 dark:group-hover:text-zinc-100'
                    : 'text-zinc-400 group-hover:text-zinc-600 dark:text-zinc-500 dark:group-hover:text-zinc-300',
              )}
            />
            {hasPending && (
              <span aria-hidden className="absolute -right-1 -top-1 flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-amber-400 ring-2 ring-amber-500/40 dark:ring-amber-400/30" />
              </span>
            )}
          </span>
          <span className="sr-only sm:not-sr-only">Activity</span>
          {hasEvents && (
            <span
              className={cn(
                'inline-flex h-4 min-w-[1rem] items-center justify-center rounded-md px-1 text-[10px] font-semibold tabular-nums',
                hasPending
                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
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
