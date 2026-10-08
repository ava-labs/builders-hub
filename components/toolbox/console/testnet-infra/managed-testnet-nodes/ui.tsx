'use client';

import { useState } from 'react';
import { ArrowRight, Check, Copy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LiveDot } from '@/components/explorer-v2/ui';
import type { StatusData } from './types';

export const EYEBROW = 'font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400';
export const COUNT = 'font-mono text-[10px] uppercase tracking-[0.14em] tabular-nums text-zinc-400 dark:text-zinc-500';

const BTN =
  'group/btn inline-flex h-9 shrink-0 items-center justify-center gap-2 border px-4 font-mono text-[11px] font-bold uppercase tracking-[0.14em] transition-colors disabled:cursor-not-allowed disabled:opacity-50';
export const PRIMARY_BTN = cn(
  BTN,
  'border-zinc-900 bg-zinc-900 text-white hover:bg-zinc-700 dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300',
);
export const SECONDARY_BTN = cn(
  BTN,
  'border-zinc-300 text-zinc-700 hover:border-zinc-900 hover:text-zinc-900 dark:border-zinc-700 dark:text-zinc-200 dark:hover:border-zinc-100 dark:hover:text-zinc-50',
);
export const DANGER_BTN = cn(
  BTN,
  'border-red-200 text-red-700 hover:border-red-500 hover:bg-red-50 dark:border-red-900/60 dark:text-red-400 dark:hover:border-red-700 dark:hover:bg-red-950/30',
);

/** The red arrow that slides in on a button's hover. */
export function HoverArrow() {
  return (
    <ArrowRight
      aria-hidden
      className="h-3.5 w-3.5 -translate-x-1 text-[#E6212F] opacity-0 transition-all group-hover/btn:translate-x-0 group-hover/btn:opacity-100 group-disabled/btn:hidden"
    />
  );
}

const STATUS_TEXT: Record<StatusData['iconType'], string> = {
  active: 'text-emerald-700 dark:text-emerald-400',
  warning: 'text-amber-700 dark:text-amber-400',
  expired: 'text-zinc-500 dark:text-zinc-400',
};

export function StatusDot({ status }: { status: StatusData['iconType'] }) {
  if (status === 'active') return <LiveDot />;
  return (
    <span
      aria-hidden
      className={cn('h-1.5 w-1.5 shrink-0 rounded-full', status === 'warning' ? 'bg-amber-500' : 'bg-zinc-400')}
    />
  );
}

export function StatusLabel({ status, label }: { status: StatusData['iconType']; label: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.14em]',
        STATUS_TEXT[status],
      )}
    >
      <StatusDot status={status} />
      {label}
    </span>
  );
}

/** A mono block with a copy button in its corner. */
export function CopyBlock({ value, label = 'Copy' }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable — the text is selectable anyway */
    }
  };
  return (
    <div className="group/copy relative border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
      <button
        type="button"
        onClick={copy}
        aria-label={label}
        title={label}
        className="absolute right-2 top-2 p-1.5 text-zinc-400 transition-colors hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-zinc-100"
      >
        {copied ? (
          <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
        ) : (
          <Copy className="h-3.5 w-3.5" />
        )}
      </button>
      <pre className="overflow-x-auto px-4 py-3 pr-10 font-mono text-[12px] leading-relaxed text-zinc-800 dark:text-zinc-200">
        {value}
      </pre>
    </div>
  );
}
