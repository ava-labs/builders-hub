'use client';

import { useEffect, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { cn } from '@/components/toolbox/lib/utils';
import { relativeTime } from './relative-time';
import type { ActivityEvent } from './types';

interface ActivityFeedProps {
  events: ActivityEvent[];
  emptyHint?: string;
  getExplorerUrl?: (event: ActivityEvent) => string | null;
}

const KIND_COLOR: Record<ActivityEvent['kind'], string> = {
  deploy: 'bg-emerald-500',
  register: 'bg-amber-500',
  send: 'bg-blue-500',
  collateral: 'bg-violet-500',
  error: 'bg-red-500',
};

export function ActivityFeed({
  events,
  emptyHint = 'No bridge activity yet. Deploy a contract or send tokens to see events here.',
  getExplorerUrl,
}: ActivityFeedProps) {
  // Tick once a second so relative-time labels stay fresh without React
  // having to re-render the entire bridge console on each event.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 overflow-hidden flex flex-col min-h-0">
      <div className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800/60 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">Bridge activity</span>
        </div>
        <span className="text-[10px] text-zinc-400 dark:text-zinc-500">live</span>
      </div>

      {events.length === 0 ? (
        <div className="flex-1 grid place-items-center px-6 py-8">
          <p className="text-xs text-zinc-400 dark:text-zinc-500 text-center max-w-[20rem] leading-relaxed">
            {emptyHint}
          </p>
        </div>
      ) : (
        <div className="overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800/60 flex-1">
          {events.map((event) => {
            const explorerUrl = getExplorerUrl?.(event);
            return (
              <div key={event.id} className="px-4 py-2.5 flex items-center gap-3 text-xs">
                <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', KIND_COLOR[event.kind])} />
                <span className="text-zinc-600 dark:text-zinc-400 font-medium flex-1 truncate">{event.label}</span>
                {event.amount && (
                  <span className="font-mono text-[10px] text-zinc-400 dark:text-zinc-500">{event.amount}</span>
                )}
                {explorerUrl ? (
                  <a
                    href={explorerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-200 w-12 text-right flex items-center justify-end gap-0.5"
                  >
                    {relativeTime(event.timestamp, now)}
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                ) : (
                  <span className="text-[10px] text-zinc-400 dark:text-zinc-500 w-12 text-right">
                    {relativeTime(event.timestamp, now)}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
