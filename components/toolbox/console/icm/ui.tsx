'use client';

import { useState, type ReactNode } from 'react';
import { ArrowRight, ArrowUpRight, Check, Copy, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LiveDot } from '@/components/explorer-v2/ui';

export const EYEBROW = 'font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400';
export const MONO_VALUE = 'font-mono text-[12.5px] tabular-nums text-zinc-900 dark:text-zinc-50';
export const BODY = 'text-[13px] leading-relaxed text-zinc-500 dark:text-zinc-400';
/** The selected-cell outline every choice grid shares. */
export const CHOSEN = 'z-10 outline outline-2 -outline-offset-2 outline-zinc-900 dark:outline-zinc-100';
/** A gap-px hairline grid: cells sit on the border colour so the gaps read as rules. */
export const CELL_GRID = 'grid gap-px border border-zinc-200 bg-zinc-200 dark:border-zinc-800 dark:bg-zinc-800';

/** The red arrow that slides in when its `group/link` parent is hovered. */
export function HoverArrow({ className }: { className?: string }) {
  return (
    <ArrowRight
      aria-hidden
      className={cn(
        'h-3 w-3 shrink-0 -translate-x-1 text-[#E6212F] opacity-0 transition-all group-hover/link:translate-x-0 group-hover/link:opacity-100',
        className,
      )}
    />
  );
}

/** A quiet external link for panel footers: mono caps, underline and red arrow on hover. */
export function DocsLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="group/link inline-flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.14em] text-zinc-500 underline-offset-4 transition-colors hover:text-zinc-900 hover:underline dark:text-zinc-400 dark:hover:text-zinc-50"
    >
      {children}
      <ArrowUpRight className="h-3 w-3 shrink-0" aria-hidden />
      <HoverArrow />
    </a>
  );
}

/** The hairline board a tool lives in: eyebrow and title on top, body, optional footer row. */
export function Panel({
  eyebrow,
  title,
  description,
  footer,
  children,
  className,
}: {
  eyebrow: string;
  title: string;
  description?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950', className)}>
      <header className="flex flex-col gap-1 border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
        <p className={EYEBROW}>{eyebrow}</p>
        <h3 className="text-[15px] font-semibold leading-6 text-zinc-900 dark:text-zinc-50">{title}</h3>
        {description && <p className={BODY}>{description}</p>}
      </header>
      <div className="flex flex-col gap-5 px-5 py-5">{children}</div>
      {footer && (
        <footer className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-zinc-200 px-5 py-3 dark:border-zinc-800">
          {footer}
        </footer>
      )}
    </section>
  );
}

/** Key/value hairline rows inside a panel. */
export function Facts({ children }: { children: ReactNode }) {
  return (
    <dl className="divide-y divide-zinc-200 border-y border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
      {children}
    </dl>
  );
}

export function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 py-2.5 sm:flex-row sm:items-baseline sm:gap-6">
      <dt className="shrink-0 font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-zinc-400 sm:w-36 dark:text-zinc-500">
        {label}
      </dt>
      <dd className="min-w-0 text-[13px] font-medium text-zinc-900 [overflow-wrap:anywhere] dark:text-zinc-50">
        {children}
      </dd>
    </div>
  );
}

/** A full-length identifier in mono with a copy button; the panels show whole addresses, not truncated ones. */
export function CopyValue({ value, className }: { value: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable: the text is selectable */
    }
  };
  return (
    <span className={cn('inline-flex min-w-0 max-w-full items-start gap-2', className)}>
      <code className="min-w-0 break-all font-mono text-[12.5px] text-zinc-800 dark:text-zinc-200">{value}</code>
      <button
        type="button"
        onClick={copy}
        aria-label={copied ? 'Copied' : 'Copy'}
        title={copied ? 'Copied' : 'Copy'}
        className="-m-1 shrink-0 p-1 text-zinc-400 transition-colors hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-zinc-100"
      >
        {copied ? (
          <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
        ) : (
          <Copy className="h-3.5 w-3.5" />
        )}
      </button>
    </span>
  );
}

export type DotTone = 'done' | 'live' | 'warn' | 'error' | 'idle';

/** A small round status dot; `live` pulses. */
export function StatusDot({ tone }: { tone: DotTone }) {
  if (tone === 'live') return <LiveDot />;
  return (
    <span
      aria-hidden
      className={cn(
        'h-1.5 w-1.5 shrink-0 rounded-full',
        tone === 'done' && 'bg-emerald-500 dark:bg-emerald-400',
        tone === 'warn' && 'bg-amber-500',
        tone === 'error' && 'bg-red-500',
        tone === 'idle' && 'bg-zinc-300 dark:bg-zinc-700',
      )}
    />
  );
}

/** One line of status: a dot and a mono caption. */
export function StatusLine({ tone, children }: { tone: DotTone; children: ReactNode }) {
  return (
    <p
      className={cn(
        'flex items-center gap-2 font-mono text-[11.5px] tracking-[0.02em]',
        tone === 'done' && 'text-emerald-700 dark:text-emerald-400',
        tone === 'warn' && 'text-amber-700 dark:text-amber-300',
        tone === 'error' && 'text-red-700 dark:text-red-400',
        (tone === 'idle' || tone === 'live') && 'text-zinc-600 dark:text-zinc-300',
      )}
    >
      <StatusDot tone={tone} />
      {children}
    </p>
  );
}

/** Spinner plus a mono caption, for anything still being read from a chain. */
export function Loading({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-center gap-2 font-mono text-[11.5px] text-zinc-500 dark:text-zinc-400">
      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
      {children}
    </p>
  );
}

/** A square pulse block for skeletons. */
export function Bone({ className }: { className?: string }) {
  return <span aria-hidden className={cn('block animate-pulse bg-zinc-100 dark:bg-zinc-900', className)} />;
}

/** A labelled form field: mono eyebrow over its control. */
export function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={htmlFor} className={EYEBROW}>
        {label}
      </label>
      {children}
      {hint && <p className="text-[12px] text-zinc-500 dark:text-zinc-400">{hint}</p>}
    </div>
  );
}

/** A shell command on a hairline board with a mono title bar and a copy button. */
export function CommandBlock({ title = 'Shell', command }: { title?: string; command: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  };
  return (
    <div className="border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex min-h-9 items-center justify-between gap-4 border-b border-zinc-200 px-4 py-2 dark:border-zinc-800">
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">
          {title}
        </p>
        <button
          type="button"
          onClick={copy}
          aria-label={copied ? 'Copied' : 'Copy command'}
          className="-m-1 inline-flex items-center gap-1.5 p-1 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="max-h-72 overflow-auto px-4 py-3.5 font-mono text-[12px] leading-relaxed text-zinc-900 dark:text-zinc-50">
        <span className="select-none text-zinc-400 dark:text-zinc-600">$ </span>
        {command}
      </pre>
    </div>
  );
}
