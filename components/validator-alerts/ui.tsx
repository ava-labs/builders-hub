'use client';

import * as SliderPrimitive from '@radix-ui/react-slider';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

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

const ICON_BTN =
  'inline-flex h-8 w-8 shrink-0 items-center justify-center border transition-colors disabled:cursor-not-allowed disabled:opacity-50';
export const ICON_SECONDARY = cn(
  ICON_BTN,
  'border-zinc-200 text-zinc-500 hover:border-zinc-900 hover:text-zinc-900 dark:border-zinc-800 dark:text-zinc-400 dark:hover:border-zinc-100 dark:hover:text-zinc-50',
);
export const ICON_DANGER = cn(
  ICON_BTN,
  'border-red-200 bg-red-50/60 text-red-700 hover:border-red-500 hover:bg-red-50 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300 dark:hover:border-red-500',
);

/** A square text field with a hairline border. */
export const FIELD =
  'h-9 w-full min-w-0 border border-zinc-300 bg-white/80 px-3 text-[13.5px] text-zinc-900 transition-colors placeholder:text-zinc-400 hover:border-zinc-400 focus:border-zinc-900 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950/80 dark:text-zinc-50 dark:placeholder:text-zinc-500 dark:hover:border-zinc-600 dark:focus:border-zinc-100';
export const FIELD_LABEL =
  'font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400';

/** The red arrow that slides in on a button's hover. */
export function HoverArrow() {
  return (
    <ArrowRight
      aria-hidden
      className="h-3.5 w-3.5 -translate-x-1 text-[#E6212F] opacity-0 transition-all group-hover/btn:translate-x-0 group-hover/btn:opacity-100 group-disabled/btn:hidden"
    />
  );
}

export type Tone = 'healthy' | 'warning' | 'alerting' | 'idle';

const DOT_TONE: Record<Tone, string> = {
  healthy: 'bg-emerald-500 dark:bg-emerald-400',
  warning: 'bg-amber-400',
  alerting: 'bg-red-500 dark:bg-red-400',
  idle: 'bg-zinc-300 dark:bg-zinc-600',
};

export const TEXT_TONE: Record<Tone, string> = {
  healthy: 'text-emerald-700 dark:text-emerald-400',
  warning: 'text-amber-700 dark:text-amber-400',
  alerting: 'text-red-700 dark:text-red-400',
  idle: 'text-zinc-500 dark:text-zinc-400',
};

export function StatusDot({ tone, label }: { tone: Tone; label: string }) {
  return (
    <span className="flex h-3 w-3 shrink-0 items-center justify-center" title={label}>
      <span className={cn('h-1.5 w-1.5 rounded-full', DOT_TONE[tone])} aria-hidden />
      <span className="sr-only">{label}</span>
    </span>
  );
}

/** A square on/off switch. Same contract as the Radix one: checked + onCheckedChange. */
export function SquareSwitch({
  checked,
  onCheckedChange,
  disabled,
  ...aria
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  'aria-label'?: string;
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      {...aria}
      className={cn(
        'relative inline-flex h-5 w-9 shrink-0 items-center border p-0.5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 disabled:cursor-not-allowed disabled:opacity-50 dark:focus-visible:outline-zinc-100',
        checked
          ? 'border-zinc-900 bg-zinc-900 dark:border-zinc-100 dark:bg-zinc-100'
          : 'border-zinc-300 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'block h-3.5 w-3.5 transition-transform',
          checked ? 'translate-x-4 bg-white dark:bg-zinc-900' : 'translate-x-0 bg-zinc-400 dark:bg-zinc-500',
        )}
      />
    </button>
  );
}

/** A square single-thumb slider on the Radix primitive. */
export function SquareSlider({
  value,
  onValueChange,
  min,
  max,
  step,
  'aria-label': ariaLabel,
}: {
  value: number;
  onValueChange: (value: number) => void;
  min: number;
  max: number;
  step: number;
  'aria-label': string;
}) {
  return (
    <SliderPrimitive.Root
      value={[value]}
      onValueChange={([v]) => onValueChange(v)}
      min={min}
      max={max}
      step={step}
      className="relative flex h-4 w-full touch-none select-none items-center"
    >
      <SliderPrimitive.Track className="relative h-1 grow bg-zinc-200 dark:bg-zinc-800">
        <SliderPrimitive.Range className="absolute h-full bg-zinc-900 dark:bg-zinc-100" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb
        aria-label={ariaLabel}
        className="block h-3.5 w-3.5 border border-zinc-900 bg-white transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 dark:border-zinc-100 dark:bg-zinc-950 dark:focus-visible:outline-zinc-100"
      />
    </SliderPrimitive.Root>
  );
}

/** An alert type as a cell: the head toggles it, its threshold sits below while it is on. */
export function AlertOption({
  id,
  icon,
  title,
  description,
  checked,
  onCheckedChange,
  children,
}: {
  id: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        'relative flex flex-col bg-white transition-colors dark:bg-zinc-950',
        checked && 'z-10 outline outline-2 -outline-offset-2 outline-zinc-900 dark:outline-zinc-100',
      )}
    >
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-desc`}
        onClick={() => onCheckedChange(!checked)}
        className={cn(
          'group/opt flex flex-1 flex-col gap-3 p-5 text-left transition-colors',
          checked
            ? 'focus-visible:outline-none'
            : 'hover:outline hover:outline-1 hover:-outline-offset-1 hover:outline-zinc-400 focus-visible:outline focus-visible:outline-1 focus-visible:-outline-offset-1 focus-visible:outline-zinc-900 dark:hover:outline-zinc-600 dark:focus-visible:outline-zinc-100',
        )}
      >
        <span className="flex items-start justify-between gap-3">
          <span
            className={cn(
              'flex h-8 w-8 items-center justify-center border transition-colors',
              checked
                ? 'border-zinc-900 text-zinc-900 dark:border-zinc-100 dark:text-zinc-50'
                : 'border-zinc-200 text-zinc-500 group-hover/opt:text-zinc-900 dark:border-zinc-800 dark:text-zinc-400 dark:group-hover/opt:text-zinc-100',
            )}
          >
            {icon}
          </span>
          <span
            aria-hidden
            className={cn(
              'font-mono text-[10px] font-bold uppercase tracking-[0.14em]',
              checked ? 'text-zinc-900 dark:text-zinc-50' : 'text-zinc-400 dark:text-zinc-500',
            )}
          >
            {checked ? 'On' : 'Off'}
          </span>
        </span>
        <span id={`${id}-title`} className="text-[14px] font-semibold text-zinc-900 dark:text-zinc-50">
          {title}
        </span>
        <span id={`${id}-desc`} className="text-[12.5px] leading-relaxed text-zinc-500 dark:text-zinc-400">
          {description}
        </span>
      </button>
      {checked && children && <div className="border-t border-zinc-200 px-5 py-4 dark:border-zinc-800">{children}</div>}
    </div>
  );
}

/** Option cells share hairlines: the grid's gap shows its background as the rule. */
export const OPTION_GRID =
  'grid grid-cols-1 gap-px border border-zinc-200 bg-zinc-200 sm:grid-cols-2 dark:border-zinc-800 dark:bg-zinc-800';
