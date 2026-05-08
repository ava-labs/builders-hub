'use client';

import { cn } from '@/components/toolbox/lib/utils';

interface SegmentOption<T extends string> {
  value: T;
  label: string;
  disabled?: boolean;
  tooltip?: string;
}

interface SegmentControlProps<T extends string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

/**
 * Inline segmented switcher used by the inspectors instead of stacked
 * RadioGroup or "or"-separated branch options. Used for token type
 * (existing/test/wrapped), home/remote kind (erc20/native), and transfer
 * direction (home→remote / remote→home).
 */
export function SegmentControl<T extends string>({ options, value, onChange, className }: SegmentControlProps<T>) {
  return (
    <div className={cn('inline-flex p-0.5 bg-zinc-100 dark:bg-zinc-900 rounded-lg', className)}>
      {options.map((opt) => {
        const isActive = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            disabled={opt.disabled}
            title={opt.tooltip ?? opt.label}
            onClick={() => !opt.disabled && onChange(opt.value)}
            className={cn(
              'px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors',
              isActive
                ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-sm'
                : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200',
              opt.disabled && 'opacity-40 cursor-not-allowed',
              !opt.disabled && 'cursor-pointer',
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
