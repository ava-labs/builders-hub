'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface ChainCardSkeletonProps {
  role: 'home' | 'remote';
  rows?: number;
  className?: string;
}

const ROLE_TOP_ACCENT: Record<ChainCardSkeletonProps['role'], string> = {
  home: 'bg-red-300 dark:bg-red-500/60',
  remote: 'bg-emerald-300 dark:bg-emerald-500/60',
};

export function ChainCardSkeleton({ role, rows = 3, className }: ChainCardSkeletonProps) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900',
        className,
      )}
      aria-busy
      aria-live="polite"
    >
      <span aria-hidden className={cn('absolute inset-x-0 top-0 h-1 opacity-60', ROLE_TOP_ACCENT[role])} />
      <div className="flex items-start gap-3 px-4 pt-4 pb-3">
        <Skeleton className="h-8 w-8 rounded-lg" />
        <div className="flex flex-1 flex-col gap-1.5">
          <Skeleton className="h-2.5 w-24" />
          <Skeleton className="h-4 w-44" />
        </div>
        <Skeleton className="h-5 w-20 rounded-full" />
      </div>
      <div className="flex flex-col gap-1 border-t border-zinc-100 px-2 py-2 dark:border-zinc-800/80">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="grid grid-cols-[14px_1fr_auto] items-center gap-3 px-3 py-2">
            <Skeleton className="h-2.5 w-2.5 rounded-full" />
            <div className="flex flex-col gap-1">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-2 w-20" />
            </div>
            <Skeleton className="h-3.5 w-28" />
          </div>
        ))}
      </div>
    </div>
  );
}
