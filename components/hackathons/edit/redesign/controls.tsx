'use client';

import React from 'react';
import { Check } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';

/**
 * Shared, theme-consistent building blocks for the redesigned event editor.
 * Colors deliberately mirror the existing editor (zinc neutrals + the
 * `#D66666` / red accent already used for the active step) so the redesign
 * introduces no new palette.
 */

const ACCENT = '#D66666';

/** A titled card section. Replaces the old ad-hoc `bg-white dark:bg-zinc-900/60` blocks. */
export function SectionShell({
  icon,
  title,
  description,
  right,
  children,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}): React.JSX.Element {
  return (
    <section
      className={cn(
        'rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/60',
        className,
      )}
    >
      <header className="flex items-start gap-3 border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
        {icon && (
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
            {icon}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">{title}</h3>
          {description && <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{description}</p>}
        </div>
        {right && <div className="shrink-0">{right}</div>}
      </header>
      <div className="flex flex-col gap-5 p-5">{children}</div>
    </section>
  );
}

/** A small uppercase mono eyebrow label, matching the design's section kickers. */
export function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }): React.JSX.Element {
  return (
    <span
      className={cn(
        'font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-zinc-500 dark:text-zinc-400',
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Label + optional required/optional markers + hint/error helper text. */
export function Field({
  label,
  hint,
  error,
  required,
  optional,
  htmlFor,
  children,
  className,
}: {
  label?: string;
  hint?: React.ReactNode;
  error?: string | null;
  required?: boolean;
  optional?: boolean;
  htmlFor?: string;
  children: React.ReactNode;
  className?: string;
}): React.JSX.Element {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label && (
        <label htmlFor={htmlFor} className="flex items-center gap-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300">
          {label}
          {required && <span style={{ color: ACCENT }}>*</span>}
          {optional && <span className="text-[11px] font-normal text-zinc-400 dark:text-zinc-500">optional</span>}
        </label>
      )}
      {children}
      {(error || hint) && (
        <p className={cn('text-xs leading-relaxed', error ? 'text-red-500' : 'text-zinc-500 dark:text-zinc-400')}>
          {error || hint}
        </p>
      )}
    </div>
  );
}

type PickCard = { value: string; title: string; description: string; meta?: string };

/** Generic spaced-out pick-card grid (used for event type and registration mode). */
export function PickCards({
  options,
  value,
  onChange,
  columns = 3,
}: {
  options: PickCard[];
  value: string;
  onChange: (value: string) => void;
  columns?: 2 | 3;
}): React.JSX.Element {
  return (
    <div
      className={cn(
        'grid gap-3 sm:gap-4',
        columns === 3 ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2',
      )}
    >
      {options.map((o) => {
        const selected = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            aria-pressed={selected}
            className={cn(
              'relative flex flex-col gap-1 rounded-xl border p-4 text-left transition-colors',
              selected
                ? 'border-[#D66666] bg-[#D66666]/5 dark:bg-[#D66666]/10'
                : 'border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-zinc-600 dark:hover:bg-zinc-800/60',
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{o.title}</span>
              {o.meta && <Eyebrow>{o.meta}</Eyebrow>}
            </div>
            <span className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">{o.description}</span>
            <span
              className={cn(
                'absolute right-3 top-3 flex size-4 items-center justify-center rounded-full border transition-colors',
                selected ? 'border-[#D66666] bg-[#D66666] text-white' : 'border-zinc-300 dark:border-zinc-600',
              )}
            >
              {selected && <Check className="size-2.5" strokeWidth={3.5} />}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * Dual-thumb range for team size. Keeps the slider and the two numeric chips in
 * sync, clamps `min <= max`, and always emits concrete numbers so the value
 * propagates consistently to the preview and submission payload.
 */
export function RangeDual({
  valueMin,
  valueMax,
  onChange,
  floor = 1,
  cap = 10,
}: {
  valueMin: number | undefined;
  valueMax: number | undefined;
  onChange: (min: number, max: number) => void;
  floor?: number;
  cap?: number;
}): React.JSX.Element {
  const a = Number.isFinite(valueMin) ? (valueMin as number) : floor;
  const b = Number.isFinite(valueMax) ? (valueMax as number) : Math.min(4, cap);
  // Allow the scale to grow past `cap` if a legacy value exceeds it.
  const hi = Math.max(cap, a, b);
  const lo = Math.min(floor, a);

  const clamp = (n: number) => Math.min(hi, Math.max(lo, Math.round(n)));
  const emit = (na: number, nb: number) => {
    const lows = clamp(Math.min(na, nb));
    const highs = clamp(Math.max(na, nb));
    onChange(lows, highs);
  };

  const word = a === b ? (a === 1 ? 'Solo only' : `Exactly ${a} per team`) : `${a}–${b} per team`;
  const ticks = Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <NumberChip value={a} onChange={(n) => emit(n, b)} min={lo} max={hi} label="min" />
          <span className="text-xs text-zinc-400">to</span>
          <NumberChip value={b} onChange={(n) => emit(a, n)} min={lo} max={hi} label="max" />
        </div>
        <Eyebrow>{word}</Eyebrow>
      </div>
      <Slider
        value={[a, b]}
        min={lo}
        max={hi}
        step={1}
        minStepsBetweenThumbs={0}
        onValueChange={(vals) => {
          if (Array.isArray(vals) && vals.length === 2) emit(vals[0], vals[1]);
        }}
        className="py-1 [&_[data-slot=slider-range]]:bg-[#D66666] [&_[data-slot=slider-thumb]]:border-[#D66666]"
      />
      <div className="flex justify-between px-0.5">
        {ticks.map((n) => (
          <span
            key={n}
            className={cn(
              'font-mono text-[10px]',
              n >= a && n <= b ? 'text-[#D66666]' : 'text-zinc-400 dark:text-zinc-600',
            )}
          >
            {n}
          </span>
        ))}
      </div>
    </div>
  );
}

function NumberChip({
  value,
  onChange,
  min,
  max,
  label,
}: {
  value: number;
  onChange: (n: number) => void;
  min: number;
  max: number;
  label: string;
}): React.JSX.Element {
  return (
    <label className="flex items-center gap-1 rounded-md border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-600 dark:bg-zinc-950">
      <span className="font-mono text-[9px] uppercase tracking-wide text-zinc-400">{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (Number.isFinite(n)) onChange(n);
        }}
        className="w-10 bg-transparent text-center text-sm font-semibold text-zinc-900 outline-none dark:text-zinc-100"
      />
    </label>
  );
}
