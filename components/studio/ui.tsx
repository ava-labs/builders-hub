'use client';

import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

/* Studio atoms in the explorer's voice: square hairlines, mono uppercase labels, zinc ink. */

export const LABEL = 'font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400';

const TONES = {
  neutral: 'border-zinc-300 text-zinc-600 dark:border-zinc-700 dark:text-zinc-300',
  good: 'border-emerald-600/40 text-emerald-700 dark:border-emerald-400/40 dark:text-emerald-300',
  warn: 'border-amber-600/40 text-amber-700 dark:border-amber-400/40 dark:text-amber-300',
  bad: 'border-red-600/40 text-red-700 dark:border-red-400/40 dark:text-red-300',
  info: 'border-[#0061E2]/40 text-[#0061E2] dark:border-[#5f9dff]/40 dark:text-[#5f9dff]',
  prod: 'border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900',
} as const;

export type Tone = keyof typeof TONES;

export function Pill({
  tone = 'neutral',
  children,
  className,
}: {
  tone?: Tone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex h-5 shrink-0 items-center whitespace-nowrap border px-1.5 font-mono text-[9.5px] font-bold uppercase tracking-[0.14em]',
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export const SEVERITY_TONE: Record<string, Tone> = {
  critical: 'bad',
  high: 'bad',
  medium: 'warn',
  low: 'neutral',
  info: 'info',
};

export const STATUS_TONE: Record<string, Tone> = {
  proposed: 'neutral',
  running: 'info',
  succeeded: 'good',
  failed: 'bad',
  cancelled: 'neutral',
  done: 'good',
  skipped: 'neutral',
  sent: 'info',
  ready: 'info',
  deploying: 'info',
  completed: 'good',
};

const buttonClass = (
  variant: 'primary' | 'secondary' | 'ghost' | 'danger',
  className?: string,
) =>
  cn(
    'inline-flex h-8 shrink-0 items-center justify-center gap-2 border px-3 font-mono text-[11px] font-bold uppercase tracking-[0.14em] transition-colors disabled:cursor-not-allowed disabled:opacity-50',
    variant === 'primary' &&
      'border-zinc-900 bg-zinc-900 text-white hover:bg-zinc-700 dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300',
    variant === 'secondary' &&
      'border-zinc-300 bg-white text-zinc-700 hover:border-zinc-900 hover:text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:border-zinc-100 dark:hover:text-zinc-50',
    variant === 'ghost' &&
      'border-transparent text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100',
    variant === 'danger' && 'border-red-600 bg-red-600 text-white hover:bg-red-700',
    className,
  );

export function Button({
  variant = 'primary',
  busy = false,
  className,
  children,
  href,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  busy?: boolean;
  /** Renders the same button as a link, for downloads and navigation. */
  href?: string;
}) {
  const classNames = buttonClass(variant, className);
  if (href) {
    return (
      <a href={href} className={classNames}>
        {children}
      </a>
    );
  }
  return (
    <button {...rest} disabled={rest.disabled || busy} className={classNames}>
      {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
      {children}
    </button>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5">
      <span className={LABEL}>{label}</span>
      {children}
      {hint && <span className="font-mono text-[10px] text-zinc-400 dark:text-zinc-500">{hint}</span>}
    </label>
  );
}

export const INPUT =
  'h-8 w-full min-w-0 border border-zinc-300 bg-white px-2.5 font-mono text-[12px] text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:focus:border-zinc-100';

export function Notice({
  tone = 'neutral',
  children,
}: {
  tone?: 'neutral' | 'bad' | 'good' | 'warn';
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        'border-l-2 px-4 py-2.5 text-[13px] leading-relaxed',
        tone === 'bad' && 'border-red-600 bg-red-50 text-red-800 dark:bg-red-950/30 dark:text-red-200',
        tone === 'good' &&
          'border-emerald-600 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200',
        tone === 'warn' && 'border-amber-500 bg-amber-50 text-amber-900 dark:bg-amber-950/30 dark:text-amber-200',
        tone === 'neutral' &&
          'border-zinc-300 bg-zinc-50 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-300',
      )}
    >
      {children}
    </div>
  );
}

export const shortId = (value: string, head = 6, tail = 4) =>
  value.length > head + tail + 1 ? `${value.slice(0, head)}…${tail > 0 ? value.slice(-tail) : ''}` : value;

export function timeAgo(iso: string | Date): string {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

/** The explorer's underline tabs, where a tab can carry an amber mark: the reason shows on hover and is read aloud. */
export function MarkedTabs<T extends string>({
  tabs,
  active,
  onChange,
  labels,
  marks,
}: {
  tabs: T[];
  active: T;
  onChange: (t: T) => void;
  labels: Record<T, string>;
  marks?: Partial<Record<T, string>>;
}) {
  return (
    // a phone scrolls the tabs sideways rather than letting the last one fall off
    <div className="flex items-center gap-5 overflow-x-auto border-b border-zinc-200 [scrollbar-width:none] sm:gap-6 dark:border-zinc-800 [&::-webkit-scrollbar]:hidden">
      {tabs.map((t) => (
        <button
          key={t}
          type="button"
          onClick={() => onChange(t)}
          aria-pressed={active === t}
          title={marks?.[t]}
          className={cn(
            '-mb-px inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 pb-2.5 font-mono text-[11px] font-bold uppercase tracking-[0.18em] transition-colors',
            active === t
              ? 'border-[#E6212F] text-zinc-900 dark:text-zinc-50'
              : 'border-transparent text-zinc-400 hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-zinc-100',
          )}
        >
          {labels[t]}
          {marks?.[t] && (
            <>
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-amber-400" />
              <span className="sr-only">: {marks[t]}</span>
            </>
          )}
        </button>
      ))}
    </div>
  );
}
