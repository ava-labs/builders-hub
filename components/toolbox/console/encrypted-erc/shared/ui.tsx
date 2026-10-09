'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Check, Eye, EyeOff, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export const EYEBROW = 'font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400';
export const FRAME = 'border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950';
export const INLINE_LINK =
  'font-medium text-zinc-900 underline decoration-zinc-300 underline-offset-4 transition-colors hover:decoration-zinc-900 dark:text-zinc-50 dark:decoration-zinc-600 dark:hover:decoration-zinc-100';
export const GHOST_ACTION =
  'inline-flex h-8 shrink-0 items-center gap-1.5 border border-zinc-200 px-3 font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] text-zinc-700 transition-colors hover:border-zinc-900 hover:text-zinc-900 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:border-zinc-100 dark:hover:text-zinc-50';
export const HEAD_ROW =
  'hidden gap-4 border-b border-zinc-200 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 md:grid dark:border-zinc-800 dark:text-zinc-500';
export const BODY_ROW = 'grid grid-cols-2 items-center gap-x-4 gap-y-1 px-4 py-2.5 md:h-11 md:py-0';

/** A hairline panel with an eyebrow title bar fused inside the border. */
export function Panel({
  label,
  action,
  children,
  className,
  bodyClassName,
}: {
  label: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn(FRAME, className)}>
      <div className="flex min-h-9 items-center justify-between gap-4 border-b border-zinc-200 px-4 py-2 dark:border-zinc-800">
        <p className={cn(EYEBROW, 'min-w-0 truncate')}>{label}</p>
        {action}
      </div>
      <div className={cn('p-4', bodyClassName)}>{children}</div>
    </section>
  );
}

/** One reading: eyebrow over a mono figure, sized for a cell in a hairline grid. */
export function Reading({
  label,
  value,
  unit,
  sub,
  loading,
}: {
  label: string;
  value: React.ReactNode;
  unit?: string;
  sub?: React.ReactNode;
  loading?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5 bg-white p-4 dark:bg-zinc-950">
      <span className={EYEBROW}>{label}</span>
      {loading ? (
        <span className="h-7 w-24 animate-pulse bg-zinc-100 dark:bg-zinc-900" />
      ) : (
        <span className="flex min-w-0 items-baseline gap-1.5 font-mono text-xl tabular-nums tracking-tight text-zinc-900 dark:text-zinc-50">
          <span className="truncate">{value}</span>
          {unit && <span className="text-sm font-normal text-zinc-400 dark:text-zinc-500">{unit}</span>}
        </span>
      )}
      {sub != null && <span className="font-mono text-[10.5px] text-zinc-400 dark:text-zinc-500">{sub}</span>}
    </div>
  );
}

/** Cells laid in a gap-px grid so neighbours share one hairline. */
export function HairlineGrid({ cols = 2, children }: { cols?: 2 | 3 | 4; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        'grid grid-cols-1 gap-px border border-zinc-200 bg-zinc-200 dark:border-zinc-800 dark:bg-zinc-800',
        cols === 2 && 'sm:grid-cols-2',
        cols === 3 && 'sm:grid-cols-3',
        cols === 4 && 'sm:grid-cols-2 lg:grid-cols-4',
      )}
    >
      {children}
    </div>
  );
}

/** A compact choice cell; the chosen one is outlined in ink. */
export function Choice({
  selected,
  onSelect,
  title,
  hint,
}: {
  selected: boolean;
  onSelect: () => void;
  title: string;
  hint?: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        'group/choice relative flex min-w-0 items-center justify-between gap-3 bg-white px-4 py-3 text-left dark:bg-zinc-950',
        selected && 'z-10 outline outline-2 -outline-offset-2 outline-zinc-900 dark:outline-zinc-100',
      )}
    >
      <span className="flex min-w-0 flex-col gap-0.5">
        <span
          className={cn(
            'truncate text-[13.5px] font-semibold decoration-zinc-400 underline-offset-4',
            selected
              ? 'text-zinc-900 dark:text-zinc-50'
              : 'text-zinc-600 group-hover/choice:text-zinc-900 group-hover/choice:underline dark:text-zinc-300 dark:group-hover/choice:text-zinc-50',
          )}
        >
          {title}
        </span>
        {hint && <span className="truncate font-mono text-[10.5px] text-zinc-400 dark:text-zinc-500">{hint}</span>}
      </span>
      <span
        className={cn(
          'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border',
          selected
            ? 'border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900'
            : 'border-zinc-300 dark:border-zinc-700',
        )}
      >
        {selected && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
      </span>
    </button>
  );
}

export function ChoiceGroup({
  label,
  cols = 2,
  children,
}: {
  label: string;
  cols?: 2 | 3 | 4;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className={EYEBROW}>{label}</span>
      <div role="radiogroup" aria-label={label}>
        <HairlineGrid cols={cols}>{children}</HairlineGrid>
      </div>
    </div>
  );
}

export type ProgressState = 'done' | 'active' | 'pending';

/** Proof and transaction progress as a mono step list. */
export function ProgressList({ steps }: { steps: { key: string; label: string; state: ProgressState }[] }) {
  return (
    <ol className={cn(FRAME, 'divide-y divide-zinc-200 dark:divide-zinc-800')} aria-live="polite">
      {steps.map((s, i) => (
        <li key={s.key} className="flex items-center gap-3 px-4 py-2.5 font-mono text-[12px]">
          <span className="flex w-5 shrink-0 justify-center">
            {s.state === 'done' ? (
              <Check className="h-3.5 w-3.5 text-zinc-900 dark:text-zinc-100" />
            ) : s.state === 'active' ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-[#E6212F]" />
            ) : (
              <span className="text-[10.5px] tabular-nums text-zinc-400 dark:text-zinc-600">
                {String(i + 1).padStart(2, '0')}
              </span>
            )}
          </span>
          <span
            className={cn(
              s.state === 'active'
                ? 'text-zinc-900 dark:text-zinc-50'
                : s.state === 'done'
                  ? 'text-zinc-500 dark:text-zinc-400'
                  : 'text-zinc-400 dark:text-zinc-600',
            )}
          >
            {s.label}
          </span>
        </li>
      ))}
    </ol>
  );
}

/** Resolve a linear status into per-step states for ProgressList. */
export function progressFrom<T extends string>(
  order: readonly { key: T; label: string }[],
  status: string,
  finished: boolean,
): { key: string; label: string; state: ProgressState }[] {
  const at = order.findIndex((s) => s.key === status);
  return order.map((s, i) => ({
    key: s.key,
    label: s.label,
    state: finished || (at >= 0 && i < at) ? 'done' : i === at ? 'active' : 'pending',
  }));
}

/** An empty or unavailable state: hairline board, eyebrow, one sentence, one action. */
export function EmptyBoard({
  eyebrow,
  children,
  action,
}: {
  eyebrow: string;
  children: React.ReactNode;
  action?: { href: string; label: string };
}) {
  return (
    <div className={cn(FRAME, 'flex flex-col items-start gap-3 p-6')}>
      <p className={EYEBROW}>{eyebrow}</p>
      <p className="max-w-xl text-[14px] leading-relaxed text-zinc-600 dark:text-zinc-300">{children}</p>
      {action && <ArrowLink href={action.href}>{action.label}</ArrowLink>}
    </div>
  );
}

/** A text link that underlines and slides a small red arrow in on hover. */
export function ArrowLink({
  href,
  children,
  className,
  external = false,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
  external?: boolean;
}) {
  const cls = cn(
    'group/arrow inline-flex items-center gap-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-zinc-900 underline-offset-4 hover:underline dark:text-zinc-50',
    className,
  );
  const inner = (
    <>
      {children}
      <ArrowRight className="h-3 w-3 -translate-x-1 text-[#E6212F] opacity-0 transition-all group-hover/arrow:translate-x-0 group-hover/arrow:opacity-100" />
    </>
  );
  return external ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>
      {inner}
    </a>
  ) : (
    <Link href={href} className={cls}>
      {inner}
    </Link>
  );
}

/** Ciphertext or other encrypted values: masked mono until revealed. */
export function MaskedValue({ value, className }: { value: string; className?: string }) {
  const [shown, setShown] = useState(false);
  return (
    <span className={cn('inline-flex min-w-0 max-w-full items-center gap-2', className)}>
      <span
        className={cn(
          'min-w-0 break-all font-mono text-[12px]',
          shown ? 'text-zinc-700 dark:text-zinc-300' : 'select-none tracking-[0.2em] text-zinc-300 dark:text-zinc-700',
        )}
        title={shown ? value : undefined}
      >
        {shown ? value : '•'.repeat(Math.min(24, Math.max(8, value.length)))}
      </span>
      <button
        type="button"
        onClick={() => setShown((v) => !v)}
        aria-label={shown ? 'Hide value' : 'Reveal value'}
        className="-m-1 shrink-0 p-1 text-zinc-400 transition-colors hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-zinc-100"
      >
        {shown ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
      </button>
    </span>
  );
}

/** Details/summary disclosure in the hairline voice. */
export function Disclosure({ summary, children }: { summary: string; children: React.ReactNode }) {
  return (
    <details className={cn(FRAME, 'group/disc')}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-[13px] font-medium text-zinc-900 underline-offset-4 hover:underline dark:text-zinc-50 [&::-webkit-details-marker]:hidden">
        {summary}
        <ArrowRight className="h-3.5 w-3.5 shrink-0 text-zinc-400 transition-transform group-open/disc:rotate-90" />
      </summary>
      <div className="flex flex-col gap-2 border-t border-zinc-200 px-4 py-3 text-[13px] leading-relaxed text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
        {children}
      </div>
    </details>
  );
}

/** Inline code token in the hairline voice. */
export function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="border border-zinc-200 bg-zinc-50 px-1 py-0.5 font-mono text-[11px] text-zinc-800 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
      {children}
    </code>
  );
}
