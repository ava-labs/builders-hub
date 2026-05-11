'use client';

import { RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NewBridgeButtonProps {
  onClick: () => void;
  className?: string;
}

/**
 * Top-right CTA in the StepFlow nav row. Resets the bridge flow to a clean
 * Token-phase state without touching persisted bridges (they stay in the
 * store for a future "My bridges" picker). Bridge activity is shown by the
 * central `BridgeLogPill` inside `BridgeRibbon` so this button stands alone.
 *
 * Visual contract: `rounded-lg` action button with a `ring-1` border (sits
 * inside the box so the size stays exactly `h-9` regardless of theme). Subtle
 * warm-amber hover tint on the icon signals "this resets state" without
 * making the resting state look alarming. Label collapses to `sr-only` on
 * narrow viewports — icon alone is enough at that size since users can
 * always re-discover the label via the focus ring + tooltip.
 */
export function NewBridgeButton({ onClick, className }: NewBridgeButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Start a new bridge"
      title="Start a new bridge"
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
      <RotateCcw
        aria-hidden
        className="h-3.5 w-3.5 text-zinc-600 transition-colors group-hover:text-amber-600 dark:text-zinc-300 dark:group-hover:text-amber-400"
      />
      <span className="sr-only sm:not-sr-only">New bridge</span>
    </button>
  );
}
