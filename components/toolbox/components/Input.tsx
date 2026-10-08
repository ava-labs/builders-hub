'use client';

import type React from 'react';

import { useState, useEffect, type InputHTMLAttributes } from 'react';
import { cn } from '../lib/utils';
import { Check } from 'lucide-react';

interface RawInputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: string | null | React.ReactNode;
  hasSuggestions?: boolean;
}

export function RawInput({ className, error, hasSuggestions, ...props }: RawInputProps) {
  return (
    <input
      className={cn(
        'h-10 w-full rounded-none px-3 text-[13px]',
        'bg-white dark:bg-zinc-950',
        'border',
        error
          ? 'border-red-500 focus:border-red-600 dark:border-red-700'
          : 'border-zinc-200 hover:border-zinc-400 focus:border-zinc-900 dark:border-zinc-800 dark:hover:border-zinc-600 dark:focus:border-zinc-300',
        'text-zinc-900 dark:text-zinc-100',
        'placeholder:text-zinc-400 dark:placeholder:text-zinc-600',
        hasSuggestions && 'border-b-zinc-200 dark:border-b-zinc-800',
        'transition-colors',
        'focus:outline-none',
        '[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none',
        props.disabled
          ? 'cursor-not-allowed bg-zinc-50 text-zinc-500 hover:border-zinc-200 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:border-zinc-800'
          : '',
        className,
      )}
      {...props}
    />
  );
}

export interface Suggestion {
  title: string;
  value: string;
  description: string;
}

interface InputProps extends Omit<RawInputProps, 'onChange'> {
  label: string;
  unit?: string;
  onChange?: (newValue: string) => void;
  helperText?: string | React.ReactNode;
  button?: React.ReactNode;
  error?: string | null | React.ReactNode;
  suggestions?: Suggestion[];
}

export function Input({
  label,
  unit,
  className,
  onChange,
  id,
  helperText,
  button,
  error,
  suggestions,
  ...props
}: InputProps) {
  const [inputValue, setInputValue] = useState(props.value?.toString() || props.defaultValue?.toString() || '');

  // Sync inputValue with props.value when it changes
  useEffect(() => {
    if (props.value !== undefined) {
      setInputValue(props.value.toString());
    }
  }, [props.value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    onChange?.(newValue);
  };

  const handleSuggestionClick = (suggestion: Suggestion) => {
    setInputValue(suggestion.value);
    onChange?.(suggestion.value);
    // Focus the input after selection
    const inputElement = document.getElementById(id as string);
    if (inputElement) {
      inputElement.focus();
    }
  };

  return (
    <div className="mb-6 space-y-2">
      <label
        htmlFor={id}
        className="block font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400"
      >
        {label}
      </label>

      <div className="relative">
        <div className="flex">
          <RawInput
            {...props}
            id={id}
            value={inputValue}
            onChange={handleChange}
            hasSuggestions={(suggestions && suggestions.length > 0) || !!error || !!helperText}
            className={cn('flex-1', unit ? 'pr-12' : '', className)}
            error={error}
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

        {error ? (
          <div
            className={cn(
              'border border-t-0 border-red-200 bg-red-50/60 px-3 py-1.5 dark:border-red-900/60 dark:bg-red-950/20',
              suggestions && suggestions.length > 0 && 'border-b-0',
            )}
          >
            <p className="text-[12px] text-red-700 dark:text-red-400">{error}</p>
          </div>
        ) : helperText ? (
          <div
            className={cn(
              'border border-t-0 border-zinc-200 bg-zinc-50/60 px-3 py-1.5 dark:border-zinc-800 dark:bg-zinc-900/40',
              suggestions && suggestions.length > 0 && 'border-b-0',
            )}
          >
            <p className="text-[12px] text-zinc-500 dark:text-zinc-400">{helperText}</p>
          </div>
        ) : null}

        {suggestions && suggestions.length > 0 && (
          <div
            className={cn(
              'border border-t-0 border-zinc-200 bg-zinc-50/60 p-3 dark:border-zinc-800 dark:bg-zinc-900/40',
              helperText && 'pt-0',
            )}
          >
            <div className="mb-2 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-400">
              Suggestions
            </div>
            <div className="divide-y divide-zinc-200 border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-950">
              {suggestions.map((suggestion, index) => {
                const isSelected = inputValue === suggestion.value;
                return (
                  <div
                    key={index}
                    className={cn(
                      'group/sug relative flex cursor-pointer items-center justify-between gap-2 px-3 py-2 text-left transition-colors',
                      'before:absolute before:inset-y-0 before:left-0 before:w-0.5 before:transition-colors',
                      isSelected
                        ? 'before:bg-zinc-900 dark:before:bg-zinc-100'
                        : 'hover:before:bg-zinc-300 dark:hover:before:bg-zinc-600',
                    )}
                    onClick={() => handleSuggestionClick(suggestion)}
                  >
                    <div className="flex-1">
                      <div className="text-[13px] font-medium text-zinc-900 group-hover/sug:underline group-hover/sug:underline-offset-4 dark:text-zinc-100">
                        {suggestion.title}
                      </div>
                      <div className="text-[12px] text-zinc-500 dark:text-zinc-400">{suggestion.description}</div>
                    </div>
                    {isSelected && <Check className="h-3.5 w-3.5 shrink-0 text-zinc-900 dark:text-zinc-100" />}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
