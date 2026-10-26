'use client';

import { useEffect, useState, type MouseEvent, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { PRESS, PRESS_TRANSITION, PRESS_WIDE } from '@/components/console/motion';
import { cn } from '../lib/utils';

interface ButtonProps {
  children: ReactNode;
  onClick?: () => void;
  loading?: boolean;
  loadingText?: string;
  icon?: ReactNode;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'outline-danger' | 'light-danger';
  size?: 'default' | 'sm' | 'lg';
  className?: string;
  stickLeft?: boolean;
  error?: string;
  /**
   * The button's HTML type. Unset, the button keeps the HTML default: inside a form, it submits that form. Pass "button"
   * for a control inside a form that must not submit it (AddChainModal's Lookup).
   */
  type?: 'button' | 'submit' | 'reset';
}

const SIZES = {
  sm: 'h-8 px-3 text-[10.5px]',
  default: 'h-10 px-4 text-[11px]',
  lg: 'h-12 px-6 text-[12px]',
} as const;

const VARIANTS = {
  primary:
    'border-zinc-900 bg-zinc-900 text-white hover:bg-zinc-700 dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300',
  secondary:
    'border-zinc-200 bg-zinc-50 text-zinc-900 hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:border-zinc-600',
  outline:
    'border-zinc-300 bg-transparent text-zinc-900 hover:border-zinc-900 dark:border-zinc-700 dark:text-zinc-100 dark:hover:border-zinc-300',
  danger:
    'border-red-600 bg-red-600 text-white hover:bg-red-700 dark:border-red-500 dark:bg-red-500 dark:hover:bg-red-600',
  'outline-danger':
    'border-red-300 bg-transparent text-red-600 hover:border-red-600 dark:border-red-900 dark:text-red-400 dark:hover:border-red-500',
  'light-danger':
    'border-red-200 bg-red-50 text-red-700 hover:border-red-400 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-400 dark:hover:border-red-700',
} as const;

const DISABLED =
  'disabled:cursor-not-allowed disabled:border-zinc-200 disabled:bg-zinc-50 disabled:text-zinc-400 dark:disabled:border-zinc-800 dark:disabled:bg-zinc-900 dark:disabled:text-zinc-500';

/**
 * A busy button ignores clicks, keyboard ones included, does not submit its form again, and keeps the click from its
 * ancestors' handlers (con-busy-keep).
 */
function ignoreBusyClick(event: MouseEvent<HTMLButtonElement>) {
  event.preventDefault();
  event.stopPropagation();
}

export function Button({
  children,
  onClick,
  loading = false,
  loadingText,
  icon,
  disabled = false,
  variant = 'primary',
  size = 'default',
  className,
  stickLeft = false,
  error,
  type,
}: ButtonProps) {
  // con-busy-keep: busy is a state of the action, not an unavailable control. A busy button keeps its own colours and
  // only ignores clicks; the disabled look is for a button that is really disabled.
  const isDisabled = disabled && !loading;
  const classes = cn(
    stickLeft ? 'whitespace-nowrap -ml-px' : 'w-full',
    'relative inline-flex cursor-pointer items-center justify-center gap-2 border font-mono font-bold uppercase tracking-[0.14em] aria-busy:cursor-progress',
    PRESS_TRANSITION,
    SIZES[size],
    VARIANTS[variant],
    DISABLED,
    className,
  );
  // con-press: a button that can act dips under the finger; a full-width one dips less, so its edges do not jump.
  const press = loading || isDisabled ? undefined : classes.split(' ').includes('w-full') ? PRESS_WIDE : PRESS;

  // The busy layer is in the page only while busy and through its 180ms fade-out, so an idle button reads as its label
  // alone (find in page, text dumps). Set while rendering, as React does for state that follows a prop.
  const [busyLayer, setBusyLayer] = useState(loading);
  if (loading && !busyLayer) setBusyLayer(true);
  useEffect(() => {
    if (loading || !busyLayer) return;
    const leave = window.setTimeout(() => setBusyLayer(false), 180);
    return () => window.clearTimeout(leave);
  }, [loading, busyLayer]);

  return (
    <>
      <button
        type={type}
        onClick={loading ? ignoreBusyClick : onClick}
        disabled={isDisabled}
        aria-busy={loading}
        // busy, it is unavailable to assistive technology too; idle, only a really disabled button says so (natively)
        aria-disabled={loading || undefined}
        className={cn(classes, press)}
      >
        {/* The label keeps its place, so the button keeps its width, and fades out while the busy layer fades in. */}
        <span
          aria-hidden={loading || undefined}
          className={cn(
            'inline-flex items-center gap-[inherit] transition-opacity duration-100 ease-[ease]',
            loading && 'opacity-0',
          )}
        >
          {icon}
          {children}
        </span>
        {/* The spinner and the busy label, over the button: they fade in from a 2px blur as the layer mounts, and back
            out before it leaves. A busy label too wide for the button wraps to a second line, which the layer clips, so
            a short button shows the spinner alone. */}
        {busyLayer && (
          <span
            aria-hidden={!loading || undefined}
            className={cn(
              'pointer-events-none absolute inset-0 flex flex-wrap justify-center gap-x-2 overflow-hidden px-1 transition-[opacity,filter] duration-180 ease-out',
              'starting:opacity-0 motion-safe:starting:blur-[2px]',
              !loading && 'opacity-0 motion-safe:blur-[2px]',
            )}
          >
            <span className="flex h-full items-center">
              <Loader2 className="h-3.5 w-3.5 animate-[spin_750ms_linear_infinite]" />
            </span>
            <span className="flex h-full items-center whitespace-nowrap">{loadingText || 'Working…'}</span>
          </span>
        )}
      </button>
      {error && <p className="text-[12px] text-red-600 dark:text-red-400">{error}</p>}
    </>
  );
}
