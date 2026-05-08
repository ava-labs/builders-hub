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
    <div className={cn('inline-flex p-0.5 bg-muted rounded-lg', className)}>
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
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
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
