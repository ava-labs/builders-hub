'use client';

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Check, Loader2, type LucideIcon } from 'lucide-react';
import { SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import type { L1ListItem } from '@/components/toolbox/stores/l1ListStore';

/* The ICTT wizard's shared voice: square hairline surfaces, mono eyebrows, ink outlines for the chosen option,
   underline + red arrow on hover (never a fill). */

export const EYEBROW = 'font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400';
export const BODY = 'text-[13px] leading-relaxed text-zinc-500 dark:text-zinc-400';
export const INK_TEXT = 'text-zinc-900 dark:text-zinc-50';
export const MONO = 'font-mono text-[12.5px] tabular-nums text-zinc-900 dark:text-zinc-50';
export const MONO_MUTED = 'font-mono text-[11px] tabular-nums text-zinc-400 dark:text-zinc-500';
export const FRAME = 'border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950';

export const FIELD =
  'h-10 w-full min-w-0 rounded-none border border-zinc-200 bg-white px-3 text-[13px] text-zinc-900 transition-colors placeholder:text-zinc-400 hover:border-zinc-400 focus:border-zinc-900 focus:outline-none disabled:cursor-not-allowed disabled:bg-zinc-50 disabled:text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-600 dark:hover:border-zinc-600 dark:focus:border-zinc-300 dark:disabled:bg-zinc-900 dark:disabled:text-zinc-400 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none';
export const MONO_FIELD = cn(FIELD, 'font-mono text-[12.5px] tabular-nums');

/** A small square button fused to the right edge of a field (Max, Self, Verify). */
export const FIELD_ADDON =
  '-ml-px inline-flex h-10 shrink-0 items-center gap-1.5 border border-zinc-200 bg-white px-3 font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] text-zinc-600 transition-colors hover:z-10 hover:border-zinc-900 hover:text-zinc-900 disabled:cursor-not-allowed disabled:text-zinc-400 disabled:hover:border-zinc-200 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:border-zinc-100 dark:hover:text-zinc-50 dark:disabled:text-zinc-600 dark:disabled:hover:border-zinc-800';

/** The red arrow that slides in on hover; give the parent `group/<name>` and pass the matching hover class. */
export function HoverArrow({ className }: { className?: string }) {
  return (
    <ArrowRight
      aria-hidden
      className={cn(
        'h-3 w-3 shrink-0 -translate-x-1 text-[#E6212F] opacity-0 transition-all group-hover/act:translate-x-0 group-hover/act:opacity-100',
        className,
      )}
    />
  );
}

/** Inline text action: mono caps, underline on hover, red arrow sliding right. No fill. */
export function TextAction({
  children,
  onClick,
  href,
  icon: Icon,
  disabled,
  tone = 'ink',
  className,
}: {
  children: ReactNode;
  onClick?: () => void;
  href?: string;
  icon?: LucideIcon;
  disabled?: boolean;
  tone?: 'ink' | 'muted';
  className?: string;
}) {
  const cls = cn(
    'group/act inline-flex shrink-0 items-center gap-1.5 font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] underline-offset-4 transition-colors hover:underline disabled:cursor-not-allowed disabled:no-underline disabled:opacity-50',
    tone === 'ink'
      ? 'text-zinc-900 dark:text-zinc-100'
      : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100',
    className,
  );
  const inner = (
    <>
      {Icon && <Icon aria-hidden className="h-3 w-3" />}
      <span>{children}</span>
      <HoverArrow />
    </>
  );
  if (href) {
    return (
      <Link href={href} className={cls}>
        {inner}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={cls}>
      {inner}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Inspector — the step body frame: title bar, banner, body, footer actions on the right */
export function Inspector({
  children,
  banner,
  footer,
  label,
  meta,
  className,
}: {
  children: ReactNode;
  banner?: ReactNode;
  footer?: ReactNode;
  /** eyebrow shown in the frame's title bar */
  label?: string;
  meta?: ReactNode;
  className?: string;
}) {
  return (
    <article className={cn(FRAME, className)}>
      {label && (
        <header className="flex min-h-9 items-center justify-between gap-4 border-b border-zinc-200 px-5 py-2 dark:border-zinc-800">
          <p className={cn(EYEBROW, 'truncate')}>{label}</p>
          {meta}
        </header>
      )}
      {banner && <div className="border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">{banner}</div>}
      <div className="px-5 py-5">{children}</div>
      {footer && (
        <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-zinc-200 px-5 py-4 dark:border-zinc-800">
          {footer}
        </footer>
      )}
    </article>
  );
}

/** Label above, control, then a quiet hint or a red error line. */
export function Field({
  label,
  hint,
  error,
  htmlFor,
  children,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <label htmlFor={htmlFor} className={EYEBROW}>
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-[12px] text-red-600 dark:text-red-400">{error}</p>
      ) : hint ? (
        <p className="text-[12px] leading-relaxed text-zinc-500 dark:text-zinc-400">{hint}</p>
      ) : null}
    </div>
  );
}

/** A read-only value set in a field-shaped hairline box. */
export function ReadOnlyValue({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-10 min-w-0 items-center border border-dashed border-zinc-300 px-3 dark:border-zinc-700">
      <span className={cn(MONO, 'truncate')}>{children}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Option cells — a gap-px hairline grid, the chosen cell outlined in ink */
export function OptionGrid({
  label,
  cols = 2,
  children,
  className,
}: {
  label: string;
  cols?: 2 | 3;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn(
        'grid grid-cols-1 gap-px border border-zinc-200 bg-zinc-200 dark:border-zinc-800 dark:bg-zinc-800',
        cols === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function Option({
  selected,
  onSelect,
  title,
  description,
  icon,
  meta,
  disabled,
  disabledReason,
}: {
  selected: boolean;
  onSelect: () => void;
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  meta?: ReactNode;
  disabled?: boolean;
  disabledReason?: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      disabled={disabled}
      title={disabled ? disabledReason : undefined}
      className={cn(
        'group/act relative flex min-w-0 flex-col gap-2 bg-white p-4 text-left transition-colors dark:bg-zinc-950',
        selected && 'z-10 outline outline-2 -outline-offset-2 outline-zinc-900 dark:outline-zinc-100',
        disabled && 'cursor-not-allowed opacity-50',
      )}
    >
      <span className="flex items-start justify-between gap-3">
        <span className="flex min-w-0 items-center gap-3">
          {icon}
          <span
            className={cn(
              'flex min-w-0 items-center gap-1.5 text-[14px] font-semibold text-zinc-900 decoration-zinc-400 underline-offset-4 dark:text-zinc-50 dark:decoration-zinc-500',
              !selected && !disabled && 'group-hover/act:underline',
            )}
          >
            <span className="truncate">{title}</span>
            {!selected && !disabled && <HoverArrow />}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2.5">
          {meta}
          <span
            aria-hidden
            className={cn(
              'flex h-4 w-4 items-center justify-center rounded-full border',
              selected
                ? 'border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900'
                : 'border-zinc-300 dark:border-zinc-700',
            )}
          >
            {selected && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
          </span>
        </span>
      </span>
      {description && (
        <span className="text-[12.5px] leading-relaxed text-zinc-500 dark:text-zinc-400">{description}</span>
      )}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Route — source and destination as two cells joined by a mono arrow */
export function Route({
  from,
  to,
  stacked = false,
  className,
}: {
  from: ReactNode;
  to: ReactNode;
  /** always stack vertically (narrow containers like sheets) */
  stacked?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'grid grid-cols-1 gap-px border border-zinc-200 bg-zinc-200 dark:border-zinc-800 dark:bg-zinc-800',
        !stacked && 'md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]',
        className,
      )}
    >
      <div className="min-w-0 bg-white dark:bg-zinc-950">{from}</div>
      <div
        aria-hidden
        className={cn(
          'flex items-center justify-center bg-white px-4 py-1.5 font-mono text-[13px] text-zinc-400 dark:bg-zinc-950 dark:text-zinc-500',
          !stacked && 'md:py-0',
        )}
      >
        <span className={cn(!stacked && 'md:hidden')}>↓</span>
        {!stacked && <span className="hidden md:inline">→</span>}
      </div>
      <div className="min-w-0 bg-white dark:bg-zinc-950">{to}</div>
    </div>
  );
}

/** One side of a Route: eyebrow, chain mark + name, and a mono line beneath. */
export function RouteEnd({
  side,
  l1,
  name,
  detail,
  action,
}: {
  side: string;
  l1?: L1ListItem | null;
  name: ReactNode;
  detail?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex min-w-0 items-start gap-3 px-4 py-3.5">
      {l1 !== undefined && <ChainMark l1={l1 ?? null} />}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className={EYEBROW}>{side}</span>
        <span className="truncate text-[14px] font-semibold text-zinc-900 dark:text-zinc-50">{name}</span>
        {detail && <span className={cn(MONO_MUTED, 'truncate')}>{detail}</span>}
      </div>
      {action}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Chain mark — a square logo plate, initial when there's no logo      */
export function ChainMark({ l1, size = 'md' }: { l1: L1ListItem | null; size?: 'xs' | 'sm' | 'md' }) {
  const box = size === 'xs' ? 'h-4 w-4 text-[8px]' : size === 'sm' ? 'h-6 w-6 text-[10px]' : 'h-9 w-9 text-[11px]';
  const px = size === 'xs' ? 16 : size === 'sm' ? 24 : 36;
  if (!l1?.logoUrl) {
    return (
      <span
        aria-hidden
        className={cn(
          'flex shrink-0 items-center justify-center border border-zinc-200 font-mono font-bold uppercase text-zinc-500 dark:border-zinc-800 dark:text-zinc-400',
          box,
        )}
      >
        {l1?.name?.slice(0, 1) ?? '?'}
      </span>
    );
  }
  return (
    <span
      className={cn(
        'relative flex shrink-0 items-center justify-center overflow-hidden border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950',
        box,
        size === 'md' && 'p-1',
      )}
    >
      <Image src={l1.logoUrl} alt="" width={px} height={px} className="h-full w-full object-contain" unoptimized />
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Status — small circular dots and the mono word beside them         */
export type Tone = 'ok' | 'pending' | 'error' | 'idle' | 'active';

const DOT_TONE: Record<Tone, string> = {
  ok: 'bg-emerald-500 dark:bg-emerald-400',
  pending: 'bg-amber-400',
  error: 'bg-red-500',
  idle: 'bg-zinc-300 dark:bg-zinc-700',
  active: 'bg-[#E6212F]',
};

const WORD_TONE: Record<Tone, string> = {
  ok: 'text-emerald-700 dark:text-emerald-400',
  pending: 'text-amber-700 dark:text-amber-400',
  error: 'text-red-600 dark:text-red-400',
  idle: 'text-zinc-400 dark:text-zinc-500',
  active: 'text-zinc-900 dark:text-zinc-50',
};

export function Dot({ tone, pulse = false, className }: { tone: Tone; pulse?: boolean; className?: string }) {
  return (
    <span aria-hidden className={cn('relative inline-flex h-1.5 w-1.5 shrink-0', className)}>
      {pulse && (
        <span
          className={cn('absolute inline-flex h-full w-full animate-ping rounded-full opacity-60', DOT_TONE[tone])}
        />
      )}
      <span className={cn('relative inline-flex h-1.5 w-1.5 rounded-full', DOT_TONE[tone])} />
    </span>
  );
}

export function StatusTag({ tone, children, pulse }: { tone: Tone; children: ReactNode; pulse?: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em]',
        WORD_TONE[tone],
      )}
    >
      <Dot tone={tone} pulse={pulse} />
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Timeline — mono numbered steps with status dots (transfer progress) */
export type TimelineState = 'idle' | 'active' | 'complete' | 'error';

export function Timeline({ children, label }: { children: ReactNode; label: string }) {
  return (
    <ol aria-label={label} className={cn(FRAME, 'divide-y divide-zinc-200 dark:divide-zinc-800')}>
      {children}
    </ol>
  );
}

export function TimelineStep({
  index,
  state,
  label,
  detail,
  href,
}: {
  index: number;
  state: TimelineState;
  label: ReactNode;
  detail?: ReactNode;
  href?: string | null;
}) {
  const word =
    state === 'complete' ? 'Done' : state === 'active' ? 'Working' : state === 'error' ? 'Failed' : 'Waiting';
  const tone: Tone =
    state === 'complete' ? 'ok' : state === 'active' ? 'pending' : state === 'error' ? 'error' : 'idle';
  return (
    <li aria-current={state === 'active' ? 'step' : undefined} className="flex items-start gap-4 px-4 py-3">
      <span
        className={cn(
          'mt-px w-5 shrink-0 font-mono text-[10.5px] font-bold tabular-nums',
          state === 'complete'
            ? 'text-zinc-900 dark:text-zinc-100'
            : state === 'active'
              ? 'text-[#E6212F]'
              : state === 'error'
                ? 'text-red-600 dark:text-red-400'
                : 'text-zinc-400 dark:text-zinc-600',
        )}
      >
        {state === 'complete' ? <Check className="h-3 w-3" aria-label="Completed" /> : String(index).padStart(2, '0')}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span
          className={cn(
            'text-[13px] font-medium',
            state === 'idle' ? 'text-zinc-500 dark:text-zinc-400' : 'text-zinc-900 dark:text-zinc-50',
          )}
        >
          {label}
        </span>
        {detail && <span className="text-[12px] leading-relaxed text-zinc-500 dark:text-zinc-400">{detail}</span>}
      </div>
      <span className="flex shrink-0 items-center gap-3">
        {href && (
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className="group/act inline-flex items-center gap-1 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-500 underline-offset-4 transition-colors hover:text-zinc-900 hover:underline dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            Explorer
            <HoverArrow />
          </a>
        )}
        <StatusTag tone={tone} pulse={state === 'active'}>
          {word}
        </StatusTag>
      </span>
    </li>
  );
}

/* ------------------------------------------------------------------ */
/* Loading, skeleton and empty states                                  */
export function Loading({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p
      role="status"
      className={cn(
        'flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400',
        className,
      )}
    >
      <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin" />
      {children}
    </p>
  );
}

export function Bone({ className }: { className?: string }) {
  return <span aria-hidden className={cn('block animate-pulse bg-zinc-100 dark:bg-zinc-900', className)} />;
}

export function Empty({
  eyebrow,
  children,
  action,
  className,
}: {
  eyebrow: string;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn(FRAME, 'flex flex-col items-start gap-3 px-5 py-6', className)}>
      <p className={EYEBROW}>{eyebrow}</p>
      <p className="text-[13px] leading-relaxed text-zinc-600 dark:text-zinc-300">{children}</p>
      {action}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Chrome buttons for the step-nav row (Manage bridges, Bridge log)    */
export const ChromeButton = forwardRef<
  HTMLButtonElement,
  {
    icon: LucideIcon;
    label: string;
    badge?: ReactNode;
    /** a status dot on the icon (e.g. an in-flight message) */
    dot?: ReactNode;
  } & ButtonHTMLAttributes<HTMLButtonElement>
>(function ChromeButton({ icon: Icon, label, badge, dot, className, type, ...rest }, ref) {
  return (
    <button
      ref={ref}
      type={type ?? 'button'}
      className={cn(
        'group/act inline-flex h-9 items-center gap-2 border border-zinc-200 bg-white px-3 font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] text-zinc-700 transition-colors hover:border-zinc-900 hover:text-zinc-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:border-zinc-100 dark:hover:text-zinc-50 dark:focus-visible:outline-zinc-100',
        className,
      )}
      {...rest}
    >
      <span className="relative inline-flex">
        <Icon aria-hidden className="h-3.5 w-3.5" />
        {dot && <span className="absolute -right-1 -top-1">{dot}</span>}
      </span>
      <span className="sr-only sm:not-sr-only">{label}</span>
      {badge != null && (
        <span className="border-l border-zinc-200 pl-2 tabular-nums text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
          {badge}
        </span>
      )}
    </button>
  );
});

/* ------------------------------------------------------------------ */
/* Sheets — shadcn Sheet restyled at the usage site: square, hairline  */
export const SHEET_CONTENT =
  'flex w-full max-w-md flex-col gap-0 border-l border-zinc-200 bg-white p-0 shadow-none sm:max-w-md dark:border-zinc-800 dark:bg-zinc-950 [&>button:last-child]:top-5 [&>button:last-child]:rounded-none';

export function SheetHead({ eyebrow, title }: { eyebrow: string; title: ReactNode }) {
  return (
    <SheetHeader className="gap-1 border-b border-zinc-200 px-5 py-4 pr-12 dark:border-zinc-800">
      <p className={EYEBROW}>{eyebrow}</p>
      <SheetTitle className="text-[15px] font-semibold text-zinc-900 dark:text-zinc-50">{title}</SheetTitle>
    </SheetHeader>
  );
}

export function SheetBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('flex-1 overflow-y-auto px-5 py-5', className)}>{children}</div>;
}

export function SheetFoot({ children }: { children: ReactNode }) {
  return (
    <footer className="flex items-center justify-end gap-2 border-t border-zinc-200 px-5 py-4 dark:border-zinc-800">
      {children}
    </footer>
  );
}

/** A hairline list row inside a sheet: no fill on hover, the label underlines and the red arrow slides in. */
export function ListRow({
  selected,
  onClick,
  disabled,
  children,
  trailing,
  ariaLabel,
}: {
  selected?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  children: ReactNode;
  trailing?: ReactNode;
  ariaLabel?: string;
}) {
  return (
    <div
      className={cn(
        'group/act relative flex items-center gap-3 bg-white px-3 py-2.5 dark:bg-zinc-950',
        selected && 'z-10 outline outline-2 -outline-offset-2 outline-zinc-900 dark:outline-zinc-100',
        disabled && 'opacity-60',
      )}
    >
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-pressed={selected}
        aria-label={ariaLabel}
        className="flex min-w-0 flex-1 items-center gap-3 text-left disabled:cursor-not-allowed [&_[data-row-title]]:underline-offset-4 hover:[&_[data-row-title]]:underline"
      >
        {children}
        {!selected && !disabled && <HoverArrow className="ml-auto" />}
      </button>
      {trailing}
    </div>
  );
}

export function ListRows({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'flex flex-col gap-px border border-zinc-200 bg-zinc-200 dark:border-zinc-800 dark:bg-zinc-800',
        className,
      )}
    >
      {children}
    </div>
  );
}
