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
 * top-right of `BridgeLayout` on every breakpoint and replaces the previous
 * floating-bell `ActivityDrawer` + header-row count badge.
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
          aria-label={`Bridge activity, ${count} ${count === 1 ? 'event' : 'events'}`}
          className={cn(
            'inline-flex h-9 items-center gap-1.5 rounded-full border border-zinc-200/80 bg-white px-3 text-xs font-medium text-zinc-700 shadow-sm transition-colors',
            'hover:border-zinc-300 hover:bg-zinc-50',
            'dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800/40',
            className,
          )}
        >
          <Activity aria-hidden className="h-3.5 w-3.5 text-zinc-500 dark:text-zinc-400" />
          <span>Activity</span>
          {hasEvents && (
            <span
              className={cn(
                'inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full px-1.5 text-[10px] font-semibold',
                hasPending
                  ? 'animate-pulse bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
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
