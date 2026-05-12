'use client';

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Shared visual contract for trailing pills in the StepFlow nav row.
 *
 * Replaces two near-identical hand-rolled buttons that drifted apart:
 *   - `ManageBridgesButton` (used `gap-2.5 px-4`, which crowded the icon
 *     against the rounded edge once a label and count badge were added)
 *   - `BridgeLogPill` (already `gap-1.5 px-2.5 sm:px-3` — visually correct)
 *
 * The pill takes a leading icon (optionally decorated with a status dot),
 * a label that hides on narrow viewports, and an optional trailing badge.
 * `forwardRef` is required so Radix `<SheetTrigger asChild>` can attach its
 * ref/handlers to the underlying `<button>` element.
 */
export type NavTrailingPillProps = {
  icon: LucideIcon;
  iconClassName?: string;
  label: string;
  badge?: ReactNode;
  badgeClassName?: string;
  /** Override the default `focus-visible:ring-zinc-400/60` to match the
   *  pill's role (e.g. amber for the bridge log, emerald for new-bridge CTA). */
  focusRingClassName?: string;
  /** Extra element rendered absolutely inside the icon wrapper. Used by
   *  `BridgeLogPill` for the pulsing status dot. */
  decoration?: ReactNode;
} & ButtonHTMLAttributes<HTMLButtonElement>;

export const NavTrailingPill = forwardRef<HTMLButtonElement, NavTrailingPillProps>(function NavTrailingPill(
  { icon: Icon, iconClassName, label, badge, badgeClassName, focusRingClassName, decoration, className, type, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type ?? 'button'}
      className={cn(
        'group inline-flex h-9 items-center gap-1.5 rounded-lg bg-zinc-50 px-2.5 text-xs font-medium text-zinc-700 ring-1 ring-zinc-200/80 transition-[transform,colors,box-shadow] duration-150',
        'shadow-[0_1px_0_rgba(0,0,0,0.04)] hover:-translate-y-px hover:bg-zinc-100 hover:ring-zinc-300',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-50',
        focusRingClassName ?? 'focus-visible:ring-zinc-400/60',
        'dark:bg-zinc-900/60 dark:text-zinc-200 dark:ring-zinc-700/80 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]',
        'dark:hover:bg-zinc-800/80 dark:hover:ring-zinc-600 dark:focus-visible:ring-offset-zinc-950',
        'sm:px-3',
        className,
      )}
      {...rest}
    >
      <span className="relative inline-flex items-center justify-center">
        <Icon
          aria-hidden
          className={cn('h-3.5 w-3.5 transition-colors', iconClassName ?? 'text-zinc-600 dark:text-zinc-300')}
        />
        {decoration}
      </span>
      <span className="sr-only sm:not-sr-only">{label}</span>
      {badge != null && (
        <span
          className={cn(
            'inline-flex h-4 min-w-[1rem] items-center justify-center rounded-md px-1 text-[10px] font-semibold tabular-nums',
            badgeClassName ?? 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300',
          )}
        >
          {badge}
        </span>
      )}
    </button>
  );
});
