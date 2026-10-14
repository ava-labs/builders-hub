'use client';

import { ChartBoard } from '@/components/explorer-v2/ui';

const LABELS = ['Block time', 'Transactions per block', 'Gas utilization', 'Base fee'];

export function ChartsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2" role="status" aria-label="Loading charts">
      {LABELS.map((label) => (
        <ChartBoard key={label} label={label}>
          <div className="mb-3 h-7 w-28 animate-pulse bg-zinc-100 dark:bg-zinc-900" />
          <div className="h-44 animate-pulse bg-zinc-100 dark:bg-zinc-900" />
        </ChartBoard>
      ))}
    </div>
  );
}
