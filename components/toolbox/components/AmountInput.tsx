'use client';

import type React from 'react';

import { useState } from 'react';
import { cn } from '../lib/utils';
import { RawInput } from './Input';

type RawInputProps = Omit<React.ComponentProps<typeof RawInput>, 'hasSuggestions'>;

interface AmountInputProps extends Omit<RawInputProps, 'onChange'> {
  label: string;
  unit?: string;
  onChange?: (newValue: string) => void;
  helperText?: string | React.ReactNode;
  button?: React.ReactNode;
  error?: string | null | React.ReactNode;
}

export function AmountInput({
  label,
  unit,
  className,
  onChange,
  id,
  helperText,
  button,
  error,
  ...props
}: AmountInputProps) {
  const [inputValue, setInputValue] = useState(props.value?.toString() || props.defaultValue?.toString() || '');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    onChange?.(newValue);
  };

  return (
    <div className="mb-6 space-y-2">
      <div className="flex items-center justify-between gap-1">
        <label
          htmlFor={id}
          className="block font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400"
        >
          {label}
        </label>
        <div className="font-mono text-[11px] tabular-nums text-zinc-500 dark:text-zinc-400">Max: {props.max}</div>
      </div>

      <div className="relative">
        <div className="flex">
          <RawInput
            id={id}
            value={inputValue}
            onChange={handleChange}
            className={cn('flex-1', unit ? 'pr-12' : '', className)}
            error={error}
            {...props}
          />
          {button}
        </div>
        {unit && (
          <div className="absolute inset-y-0 right-0 flex items-center pr-3">
            <span className="pointer-events-none font-mono text-[11px] uppercase tracking-[0.1em] text-zinc-400">
              {unit}
            </span>
          </div>
        )}
      </div>

      {error ? (
        <p className="text-[12px] text-red-700 dark:text-red-400">{error}</p>
      ) : helperText ? (
        <p className="text-[12px] text-zinc-500 dark:text-zinc-400">{helperText}</p>
      ) : null}
    </div>
  );
}
