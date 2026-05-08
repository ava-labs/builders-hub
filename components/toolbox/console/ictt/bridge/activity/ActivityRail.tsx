'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { ActivityItem, ActivityItemEmptyState } from './ActivityItem';
import type { ActivityEvent } from '../types';

interface ActivityRailProps {
  events: ActivityEvent[];
  onClear?: () => void;
  /** Whether to render as a sticky aside (`xl+`) or as inline content (mobile drawer). */
  variant?: 'rail' | 'inline';
  className?: string;
}

export function ActivityRail({ events, onClear, variant = 'rail', className }: ActivityRailProps) {
  const nowMs = useNow();

  const wrapperClass =
    variant === 'rail'
      ? 'sticky top-4 flex max-h-[calc(100vh-6rem)] w-full flex-col overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900'
      : 'flex h-full flex-col overflow-hidden';

  return (
    <aside aria-label="Bridge activity" className={cn(wrapperClass, className)}>
      <header className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-zinc-100 bg-white/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-white/70 dark:border-zinc-800/80 dark:bg-zinc-900/95 dark:supports-[backdrop-filter]:bg-zinc-900/60">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Bridge activity</h3>
          <span className="rounded-full bg-zinc-100 px-1.5 text-[10px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
            {events.length}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {events.length > 0 && onClear && (
            <button
              type="button"
              onClick={onClear}
              className="rounded-md text-[10px] text-zinc-400 transition-colors hover:text-zinc-700 dark:hover:text-zinc-200"
            >
              Clear
            </button>
          )}
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
            <span aria-hidden className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
            live
          </span>
        </div>
      </header>
      <div role="log" aria-live="polite" aria-relevant="additions" className="flex-1 overflow-y-auto px-1.5 py-2">
        {events.length === 0 ? (
          <ActivityItemEmptyState />
        ) : (
          <ul className="flex flex-col gap-0.5">
            {events.map((event) => (
              <li key={event.id}>
                <ActivityItem event={event} nowMs={nowMs} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}

function useNow() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}
