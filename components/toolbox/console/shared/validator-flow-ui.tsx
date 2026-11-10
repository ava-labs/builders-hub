'use client';

import type { ReactNode } from 'react';
import { ArrowRight, Loader2 } from 'lucide-react';
import { BoardHeader } from '@/components/explorer-v2/ui';
import { cn } from '@/lib/utils';
import versions from '@/scripts/versions.json';

const ICM_COMMIT = versions['ava-labs/icm-services'];

/** The shared voice of the validator wizards (add, remove, and the submitters they share). */
export const EYEBROW = 'font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400';
export const LEAD = 'text-[13px] leading-relaxed text-zinc-500 dark:text-zinc-400';
export const MONO = 'font-mono tabular-nums';
export const FRAME = 'border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950';
export const LINK =
  'font-medium text-zinc-900 underline decoration-zinc-300 underline-offset-4 transition-colors hover:decoration-zinc-900 dark:text-zinc-100 dark:decoration-zinc-600 dark:hover:decoration-zinc-100';

/** A step body: the working column, with an optional sticky reference column beside it. */
export function StepLayout({ aside, children }: { aside?: ReactNode; children: ReactNode }) {
  if (!aside) return <div className="flex min-w-0 flex-col gap-5">{children}</div>;
  return (
    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
      <div className="flex min-w-0 flex-col gap-5">{children}</div>
      <div className="min-w-0 lg:sticky lg:top-4 lg:self-start">{aside}</div>
    </div>
  );
}

/** The step's working surface: a titled hairline panel, the action inside, and the call it makes on the foot rail. */
export function ActionPanel({
  label,
  action,
  call,
  meta,
  children,
  className,
}: {
  label: string;
  action?: ReactNode;
  /** what the panel ends up calling, e.g. `initiateValidatorRegistration()` */
  call?: ReactNode;
  /** right side of the foot rail; defaults to the icm-services commit */
  meta?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn(FRAME, 'flex min-w-0 flex-col', className)}>
      <BoardHeader label={label} action={action} />
      <div className="flex min-w-0 flex-col gap-5 px-5 py-5 md:px-6">{children}</div>
      {call && (
        <div className="flex items-center justify-between gap-4 border-t border-zinc-200 px-5 py-2.5 md:px-6 dark:border-zinc-800">
          <span className="min-w-0 truncate font-mono text-[11px] text-zinc-500 dark:text-zinc-400">{call}</span>
          {meta ?? <CommitLink />}
        </div>
      )}
    </section>
  );
}

/** The icm-services commit the contracts come from, linked to its tree. */
export function CommitLink() {
  return (
    <a
      href={`https://github.com/ava-labs/icm-services/tree/${ICM_COMMIT}`}
      target="_blank"
      rel="noopener noreferrer"
      className="group/commit inline-flex shrink-0 items-center gap-1 font-mono text-[11px] text-zinc-400 underline-offset-4 transition-colors hover:text-zinc-900 hover:underline dark:text-zinc-500 dark:hover:text-zinc-100"
    >
      @{ICM_COMMIT.slice(0, 7)}
      <ArrowRight className="h-3 w-3 -translate-x-0.5 text-[#E6212F] opacity-0 transition-all group-hover/commit:translate-x-0 group-hover/commit:opacity-100" />
    </a>
  );
}

/** A spinner and a mono caption, for reads still in flight. */
export function Working({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p
      role="status"
      className={cn(
        'flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400',
        className,
      )}
    >
      <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
      {children}
    </p>
  );
}

/** A collapsed hex payload (warp message, BLS proof): a mono summary line that opens onto the raw value. */
export function Reveal({ label, value }: { label: string; value: string }) {
  return (
    <details className="group/reveal">
      <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.14em] text-zinc-500 underline-offset-4 transition-colors hover:text-zinc-900 hover:underline dark:text-zinc-400 dark:hover:text-zinc-100 [&::-webkit-details-marker]:hidden">
        <ArrowRight className="h-3 w-3 text-[#E6212F] transition-transform group-open/reveal:rotate-90" />
        {label}
        <span className="text-zinc-400 dark:text-zinc-500">· {Math.floor(value.length / 2)} bytes</span>
      </summary>
      <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-all border border-zinc-200 bg-white px-3 py-2.5 font-mono text-[11.5px] leading-relaxed text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
        {value}
      </pre>
    </details>
  );
}

/** One label/value line inside a step: a mono label column, the value beside it. */
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-4">
      <span className="shrink-0 font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-zinc-400 sm:w-28 dark:text-zinc-500">
        {label}
      </span>
      <span className="min-w-0 text-[13px] text-zinc-900 [overflow-wrap:anywhere] dark:text-zinc-50">{children}</span>
    </div>
  );
}

/** A small status word with its tone dot. */
export function Status({ tone, children }: { tone: 'ok' | 'warn' | 'error' | 'idle'; children: ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em]',
        tone === 'ok' && 'text-emerald-700 dark:text-emerald-400',
        tone === 'warn' && 'text-amber-700 dark:text-amber-400',
        tone === 'error' && 'text-red-700 dark:text-red-400',
        tone === 'idle' && 'text-zinc-400 dark:text-zinc-500',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'h-1.5 w-1.5 rounded-full',
          tone === 'ok' && 'bg-emerald-500 dark:bg-emerald-400',
          tone === 'warn' && 'bg-amber-500 dark:bg-amber-400',
          tone === 'error' && 'bg-red-500 dark:bg-red-400',
          tone === 'idle' && 'animate-pulse bg-zinc-300 dark:bg-zinc-600',
        )}
      />
      {children}
    </span>
  );
}
