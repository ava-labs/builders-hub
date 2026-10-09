'use client';

import type { ReactNode } from 'react';
import { ArrowRight, Check } from 'lucide-react';
import { DynamicCodeBlock } from 'fumadocs-ui/components/dynamic-codeblock';
import { cn } from '@/lib/utils';

/*
 * Console primitives shared by the Docker node setup tools (Primary Network and L1) and the helpers they render.
 */

export const EYEBROW = 'font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400';
export const COUNT = 'font-mono text-[10px] uppercase tracking-[0.14em] tabular-nums text-zinc-400 dark:text-zinc-500';
export const NOTE = 'text-[12.5px] leading-relaxed text-zinc-500 dark:text-zinc-400';
export const LINK =
  'text-zinc-700 underline decoration-zinc-300 underline-offset-2 transition-colors hover:text-zinc-900 dark:text-zinc-300 dark:decoration-zinc-600 dark:hover:text-zinc-100';
export const INLINE_CODE =
  'border border-zinc-200 bg-zinc-50 px-1 py-0.5 font-mono text-[11px] text-zinc-800 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200';
/** Cells draw their right and bottom edges; the grid draws the top and left, so neighbours share one hairline. */
export const GRID = 'grid border-l border-t border-zinc-200 dark:border-zinc-800';
export const CELL = 'border-b border-r border-zinc-200 bg-white/80 dark:border-zinc-800 dark:bg-zinc-950/80';
export const INPUT =
  'h-9 w-full border border-zinc-300 bg-white px-3 font-mono text-[12px] text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-100';
export const CHECKBOX = 'h-3.5 w-3.5 shrink-0 cursor-pointer accent-zinc-900 dark:accent-zinc-100';

const BTN =
  'group/btn inline-flex h-9 shrink-0 items-center justify-center gap-2 border px-4 font-mono text-[11px] font-bold uppercase tracking-[0.14em] transition-colors disabled:cursor-not-allowed disabled:opacity-50';
export const PRIMARY_BTN = cn(
  BTN,
  'border-zinc-900 bg-zinc-900 text-white hover:bg-zinc-700 disabled:hover:bg-zinc-900 dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300 dark:disabled:hover:bg-zinc-100',
);
export const SECONDARY_BTN = cn(
  BTN,
  'border-zinc-300 text-zinc-700 hover:border-zinc-900 hover:text-zinc-900 dark:border-zinc-700 dark:text-zinc-200 dark:hover:border-zinc-100 dark:hover:text-zinc-50',
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

/** A shell command or config file: square, hairline, highlighted, with fumadocs' copy button in the corner. */
export function CodeBlock({ code, lang = 'bash' }: { code: string; lang?: string }) {
  return (
    <DynamicCodeBlock
      lang={lang}
      code={code}
      codeblock={{
        className:
          'my-0 rounded-none border-zinc-200 bg-zinc-50 shadow-none dark:border-zinc-800 dark:bg-zinc-900 [&_button]:rounded-none',
      }}
    />
  );
}

/** A labelled group of choices: a hairline grid of cells, the chosen one outlined in ink. */
export function ChoiceGrid({
  label,
  cols,
  children,
  className,
}: {
  label: string;
  cols: 2 | 3 | 5;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <p className={EYEBROW}>{label}</p>
      <div
        role="radiogroup"
        aria-label={label}
        className={cn(
          'grid gap-px border border-zinc-200 bg-zinc-200 dark:border-zinc-800 dark:bg-zinc-800',
          cols === 5 ? 'grid-cols-3 sm:grid-cols-5' : cols === 3 ? 'grid-cols-3' : 'grid-cols-2',
        )}
      >
        {children}
      </div>
    </div>
  );
}

export function Choice({
  selected,
  onSelect,
  title,
  description,
  compact = false,
}: {
  selected: boolean;
  onSelect: () => void;
  title: ReactNode;
  description?: ReactNode;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        'group/opt relative flex flex-col bg-white text-left transition-colors dark:bg-zinc-950',
        compact ? 'items-center justify-center px-2 py-2' : 'gap-1 px-3.5 py-3',
        selected
          ? 'z-10 outline outline-2 -outline-offset-2 outline-zinc-900 dark:outline-zinc-100'
          : 'hover:z-10 hover:outline hover:outline-1 hover:-outline-offset-1 hover:outline-zinc-400 dark:hover:outline-zinc-600',
      )}
    >
      {compact ? (
        <span
          className={cn(
            'font-mono text-[11px] font-bold uppercase tracking-[0.12em]',
            selected
              ? 'text-zinc-900 dark:text-zinc-50'
              : 'text-zinc-500 group-hover/opt:text-zinc-900 dark:text-zinc-400 dark:group-hover/opt:text-zinc-100',
          )}
        >
          {title}
        </span>
      ) : (
        <>
          <span className="flex items-center justify-between gap-2">
            <span className="text-[13.5px] font-semibold text-zinc-900 underline-offset-4 group-hover/opt:underline dark:text-zinc-50">
              {title}
            </span>
            <span
              aria-hidden
              className={cn(
                'flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border',
                selected
                  ? 'border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900'
                  : 'border-zinc-300 dark:border-zinc-700',
              )}
            >
              {selected && <Check className="h-2 w-2" strokeWidth={3.5} />}
            </span>
          </span>
          {description && <span className="text-[12px] text-zinc-500 dark:text-zinc-400">{description}</span>}
        </>
      )}
    </button>
  );
}

export const FIELD_LABEL = 'text-[12px] font-medium text-zinc-700 dark:text-zinc-300';
export const FIELD_HINT = 'text-[11.5px] leading-relaxed text-zinc-500 dark:text-zinc-400';
export const SUB_HEADING =
  'flex flex-wrap items-center gap-2 text-[13.5px] font-medium text-zinc-900 dark:text-zinc-50';
export const ACCORDIONS =
  'rounded-none border-zinc-200 bg-white/80 divide-zinc-200 dark:border-zinc-800 dark:bg-zinc-950/80 dark:divide-zinc-800 [&_h3]:text-[13px] [&_h3]:font-medium [&_h3]:text-zinc-900 dark:[&_h3]:text-zinc-100';
export const ACCORDION_BODY =
  'flex flex-col gap-3 pb-2 text-[13px] leading-relaxed text-zinc-600 dark:text-zinc-400 [&_figure]:my-0';

/** A bordered settings group: a mono title bar over hairline-divided rows. */
export function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="border border-zinc-200 bg-white/80 dark:border-zinc-800 dark:bg-zinc-950/80">
      <div className="flex min-h-9 items-center border-b border-zinc-200 bg-zinc-50/80 px-4 py-2 dark:border-zinc-800 dark:bg-zinc-900/40">
        <p className={EYEBROW}>{label}</p>
      </div>
      <div className="divide-y divide-zinc-200 dark:divide-zinc-800">{children}</div>
    </div>
  );
}

/** A hardware or environment reading in a GRID cell. */
export function Spec({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className={cn(CELL, 'flex flex-col gap-2 p-4')}>
      <span className={cn(EYEBROW, 'flex items-center gap-1.5')}>
        <span className="text-zinc-400">{icon}</span>
        {label}
      </span>
      <span className="font-mono text-[15px] tabular-nums text-zinc-900 dark:text-zinc-50">{value}</span>
    </div>
  );
}

export function Port({
  port,
  status,
  title,
  detail,
  dimmed = false,
}: {
  port: string;
  status: string;
  title: string;
  detail: string;
  dimmed?: boolean;
}) {
  const required = status === 'Required';
  return (
    <div className={cn(CELL, 'flex flex-col gap-1.5 p-4', dimmed && 'opacity-50')}>
      <div className="flex items-center justify-between gap-3">
        <span className="font-mono text-lg tabular-nums text-zinc-900 dark:text-zinc-50">{port}</span>
        <span
          className={cn(
            'inline-flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em]',
            required ? 'text-emerald-700 dark:text-emerald-400' : 'text-zinc-500 dark:text-zinc-400',
          )}
        >
          <span aria-hidden className={cn('h-1.5 w-1.5 rounded-full', required ? 'bg-emerald-500' : 'bg-zinc-400')} />
          {status}
        </span>
      </div>
      <span className="text-[13px] text-zinc-700 dark:text-zinc-300">{title}</span>
      <span className="text-[11.5px] text-zinc-500 dark:text-zinc-400">{detail}</span>
    </div>
  );
}

export function KeyFile({
  icon,
  label,
  file,
  secret = false,
  children,
}: {
  icon: ReactNode;
  label: string;
  file: string;
  secret?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={cn(CELL, 'flex flex-col gap-1.5 p-4')}>
      <div className="flex items-center justify-between gap-2">
        <span className={cn(EYEBROW, 'flex items-center gap-1.5')}>
          <span className={secret ? 'text-[#E6212F]' : 'text-zinc-400'}>{icon}</span>
          {label}
        </span>
        {secret && (
          <span className="inline-flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-red-700 dark:text-red-400">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-red-500" />
            Secret
          </span>
        )}
      </div>
      <span className="font-mono text-[14px] text-zinc-900 dark:text-zinc-50">{file}</span>
      <span className="text-[11.5px] text-zinc-500 dark:text-zinc-400">{children}</span>
    </div>
  );
}

/** A mono doc link; the red arrow slides in on hover. */
export function DocLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      className="group/doc inline-flex items-center gap-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-zinc-700 underline-offset-4 transition-colors hover:text-zinc-900 hover:underline dark:text-zinc-300 dark:hover:text-zinc-100"
    >
      {children}
      <ArrowRight className="h-3 w-3 -translate-x-1 text-[#E6212F] opacity-0 transition-all group-hover/doc:translate-x-0 group-hover/doc:opacity-100" />
    </a>
  );
}

export function Notice({
  tone = 'warn',
  icon,
  children,
  className,
}: {
  tone?: 'warn' | 'info';
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex items-start gap-3 border px-4 py-3 text-[12.5px] leading-relaxed',
        tone === 'warn'
          ? 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800/70 dark:bg-amber-950/20 dark:text-amber-200'
          : 'border-zinc-200 bg-white/80 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950/80 dark:text-zinc-300',
        className,
      )}
    >
      {icon}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
