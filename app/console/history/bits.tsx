'use client';

import { forwardRef } from 'react';
import { ArrowUpRight, Check, Copy, Search, X } from 'lucide-react';
import { idInk } from '@/components/explorer-v2/ui';
import { cn } from '@/lib/cn';

export const EYEBROW = 'font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400';
export const COUNT = 'font-mono text-[10px] uppercase tracking-[0.14em] tabular-nums text-zinc-400 dark:text-zinc-500';
export const PRIMARY_BUTTON =
  'inline-flex h-9 shrink-0 items-center justify-center gap-2 border border-zinc-900 bg-zinc-900 px-4 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-white transition-colors hover:bg-zinc-700 dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300';
export const SECONDARY_BUTTON =
  'inline-flex h-11 shrink-0 items-center justify-center gap-2 border border-zinc-300 px-4 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-zinc-600 transition-colors hover:border-zinc-900 hover:text-zinc-900 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-zinc-100 dark:hover:text-zinc-50';
export const DANGER_BUTTON =
  'inline-flex h-11 shrink-0 items-center justify-center gap-2 border border-red-200 bg-red-50/60 px-4 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-red-700 transition-colors hover:border-red-500 hover:bg-red-50 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300 dark:hover:border-red-500';

export type Tone = 'success' | 'pending' | 'failed';

const DOT_TONE: Record<Tone, string> = {
  success: 'bg-emerald-500 dark:bg-emerald-400',
  pending: 'bg-amber-400 animate-pulse',
  failed: 'bg-red-500 dark:bg-red-400',
};

const TEXT_TONE: Record<Tone, string> = {
  success: 'text-emerald-700 dark:text-emerald-400',
  pending: 'text-amber-700 dark:text-amber-400',
  failed: 'text-red-700 dark:text-red-400',
};

export function StatusDot({ tone, label }: { tone: Tone; label: string }) {
  return (
    <span className="flex h-3 w-3 items-center justify-center">
      <span className={cn('h-1.5 w-1.5 rounded-full', DOT_TONE[tone])} aria-hidden />
      <span className="sr-only">{label}</span>
    </span>
  );
}

export function StatusText({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return (
    <span className={cn('font-mono text-[10px] font-bold uppercase tracking-[0.14em]', TEXT_TONE[tone])}>
      {children}
    </span>
  );
}

/** A mono hash or address: opens the explorer in a new tab when it has one, with its own copy button. */
export function HashCell({
  value,
  display,
  href,
  copied,
  onCopy,
  full = false,
}: {
  value: string;
  display?: string;
  href?: string | null;
  copied: boolean;
  onCopy: () => void;
  /** wrap the whole value instead of truncating it to one line */
  full?: boolean;
}) {
  const text = cn('min-w-0 font-mono text-[12.5px] tabular-nums', full ? 'break-all' : 'truncate');
  return (
    <span className="inline-flex min-w-0 max-w-full items-center gap-1.5">
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          title={value}
          onClick={(e) => e.stopPropagation()}
          className={cn(text, idInk, 'group/hash inline-flex items-center gap-1 hover:text-[#E6212F]')}
        >
          <span className={full ? 'break-all' : 'truncate'}>{display ?? value}</span>
          <ArrowUpRight className="h-3 w-3 shrink-0 opacity-60 group-hover/hash:opacity-100" aria-hidden />
        </a>
      ) : (
        <span className={cn(text, 'text-zinc-700 dark:text-zinc-300')} title={value}>
          {display ?? value}
        </span>
      )}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onCopy();
        }}
        aria-label={copied ? 'Copied' : 'Copy'}
        className="-m-1.5 shrink-0 p-1.5 text-zinc-400 transition-colors hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-zinc-100"
      >
        {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
      </button>
    </span>
  );
}

export const SearchField = forwardRef<
  HTMLInputElement,
  { value: string; onChange: (v: string) => void; placeholder: string; label: string }
>(function SearchField({ value, onChange, placeholder, label }, ref) {
  return (
    <label className="group/search relative flex flex-1 items-center border border-zinc-300 bg-white/80 transition-colors focus-within:border-zinc-900 hover:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-950/80 dark:focus-within:border-zinc-100 dark:hover:border-zinc-600">
      <Search className="pointer-events-none ml-3.5 h-4 w-4 shrink-0 text-zinc-400" />
      <input
        ref={ref}
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === 'Escape' && onChange('')}
        aria-label={label}
        className="h-11 w-full bg-transparent px-3 text-[14px] text-zinc-900 placeholder:text-zinc-400 focus:outline-none dark:text-zinc-50 dark:placeholder:text-zinc-500"
      />
      {value ? (
        <button
          type="button"
          onClick={() => {
            onChange('');
            if (ref && typeof ref !== 'function') ref.current?.focus();
          }}
          className="mr-2 p-1.5 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
          aria-label="Clear search"
        >
          <X className="h-4 w-4" />
        </button>
      ) : (
        <kbd className="mr-3 border border-zinc-200 px-1.5 font-mono text-[11px] text-zinc-400 dark:border-zinc-800">
          /
        </kbd>
      )}
    </label>
  );
});
