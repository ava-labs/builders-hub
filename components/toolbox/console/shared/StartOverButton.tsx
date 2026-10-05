'use client';

import { RotateCcw } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';

/**
 * Clears a step flow's store, including the selected L1, and removes the ?subnetId= query from the URL.
 * The flow stores keep the L1 and the progress across reloads. This control starts the flow again.
 * Show it on step 1 of the flow: it stays on the current step.
 */
export function StartOverButton({ onStartOver, className }: { onStartOver: () => void; className?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const hasQuery = useSearchParams().toString() !== '';

  return (
    <button
      type="button"
      onClick={() => {
        onStartOver();
        if (hasQuery) router.replace(pathname, { scroll: false });
      }}
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100',
        className,
      )}
    >
      <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
      Start over
    </button>
  );
}
