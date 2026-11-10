'use client';

import type { TextareaHTMLAttributes } from 'react';
import { cn } from '../lib/utils';

interface TextareaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange'> {
  label: string;
  onChange?: (newValue: string) => void;
  helperText?: string;
  button?: React.ReactNode;
  error?: string | null;
  rows?: number;
}

export function Textarea({
  label,
  className,
  onChange,
  id,
  helperText,
  button,
  error,
  rows = 3,
  ...props
}: TextareaProps) {
  return (
    <div className="space-y-2">
      <label
        htmlFor={id}
        className="block font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400"
      >
        {label}
      </label>

      <div className="relative">
        <div className="flex">
          <textarea
            id={id}
            rows={rows}
            onChange={(e) => onChange?.(e.target.value)}
            className={cn(
              'w-full rounded-none px-3 py-2.5 text-[13px]',
              'bg-white dark:bg-zinc-950',
              'border',
              error
                ? 'border-red-500 focus:border-red-600 dark:border-red-700'
                : 'border-zinc-200 hover:border-zinc-400 focus:border-zinc-900 dark:border-zinc-800 dark:hover:border-zinc-600 dark:focus:border-zinc-300',
              'text-zinc-900 dark:text-zinc-100',
              'placeholder:text-zinc-400 dark:placeholder:text-zinc-600',
              'transition-colors',
              'focus:outline-none',
              'resize-y',
              props.disabled
                ? 'cursor-not-allowed bg-zinc-50 text-zinc-500 hover:border-zinc-200 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:border-zinc-800'
                : '',
              className,
            )}
            {...props}
          />
          {button}
        </div>
      </div>

      {error ? (
        <p className="text-[12px] text-red-700 dark:text-red-400">{error}</p>
      ) : helperText ? (
        <p className="text-[12px] text-zinc-500 dark:text-zinc-400">{helperText}</p>
      ) : null}
    </div>
  );
}
