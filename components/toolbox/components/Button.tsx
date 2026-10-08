'use client';

import type { ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
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
}: ButtonProps) {
  return (
    <>
      <button
        onClick={onClick}
        disabled={disabled || loading}
        className={cn(
          stickLeft ? 'whitespace-nowrap -ml-px' : 'w-full',
          'inline-flex cursor-pointer items-center justify-center gap-2 border font-mono font-bold uppercase tracking-[0.14em] transition-colors',
          SIZES[size],
          VARIANTS[variant],
          DISABLED,
          className,
        )}
      >
        {loading ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            {loadingText || 'Working…'}
          </>
        ) : (
          <>
            {icon}
            {children}
          </>
        )}
      </button>
      {error && <p className="text-[12px] text-red-600 dark:text-red-400">{error}</p>}
    </>
  );
}
