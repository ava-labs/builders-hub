'use client';

import { RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NewBridgeButtonProps {
  onClick: () => void;
  className?: string;
}

/**
 * Top-right CTA paired with `ActivityChip`. Resets the bridge flow to a clean
 * Token-phase state without touching persisted bridges (they stay in the store
 * for a future "My bridges" picker).
 *
 * Sibling visual with `ActivityChip` (same height, radius, border weight) so
 * the two persistent affordances read as a pair in the StepFlow nav row.
 */
export function NewBridgeButton({ onClick, className }: NewBridgeButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Start a new bridge"
      className={cn(
        'group inline-flex h-9 items-center gap-1.5 rounded-full border border-zinc-200/80 bg-white px-3 text-xs font-medium text-zinc-700 shadow-sm transition-colors',
        'hover:border-zinc-300 hover:bg-zinc-50',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300 focus-visible:ring-offset-2 focus-visible:ring-offset-white',
        'dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800/40 dark:focus-visible:ring-zinc-700 dark:focus-visible:ring-offset-zinc-950',
        className,
      )}
    >
      <RotateCcw
        aria-hidden
        className="h-3.5 w-3.5 text-zinc-500 transition-colors group-hover:text-zinc-700 dark:text-zinc-400 dark:group-hover:text-zinc-200"
      />
      <span>New bridge</span>
    </button>
  );
}
