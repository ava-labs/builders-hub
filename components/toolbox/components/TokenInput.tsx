'use client';

import type React from 'react';

import { useEffect, useState } from 'react';
import { cn } from '../lib/utils';
import { RefreshCcw } from 'lucide-react';
import { formatEther } from 'viem';
import { RawInput } from './Input';

type RawInputProps = Omit<React.ComponentProps<typeof RawInput>, 'hasSuggestions'>;

export interface Suggestion {
  title: string;
  value: string;
  description: string;
  token?: {
    name: string;
    symbol: string;
    decimals: number;
    balance?: bigint;
    chain?: {
      name?: string;
      id?: string;
      logoUrl?: string;
    };
  };
}

interface TokenInputProps extends Omit<RawInputProps, 'onChange'> {
  label: string;
  unit?: string;
  onChange?: (newValue: string) => void;
  helperText?: string | React.ReactNode;
  button?: React.ReactNode;
  error?: string | null | React.ReactNode;
  suggestions?: Suggestion[];
  selected?: any;
}

function TokenAvatar({ symbol, chain }: { symbol: string; chain?: { name?: string; logoUrl?: string } }) {
  return (
    <div className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-zinc-200 bg-zinc-100 font-mono text-[12px] font-bold text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100">
      {symbol[0]}
      {chain?.logoUrl && (
        <div className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center overflow-hidden rounded-full border border-white bg-white dark:border-zinc-950 dark:bg-zinc-950">
          <img
            src={chain.logoUrl}
            alt={chain.name || 'Chain logo'}
            className="block h-full w-full rounded-full object-contain p-0.5"
          />
        </div>
      )}
    </div>
  );
}

export function TokenInput({
  label,
  unit,
  className,
  onChange,
  id,
  helperText,
  button,
  error,
  suggestions,
  selected,
  ...props
}: TokenInputProps) {
  const [inputValue, setInputValue] = useState(props.value?.toString() || props.defaultValue?.toString() || '');
  const [showSuggestions, setShowSuggestions] = useState(true);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    onChange?.(newValue);
  };

  const handleSuggestionClick = (suggestion: Suggestion) => {
    setInputValue(suggestion.value);
    onChange?.(suggestion.value);
    setShowSuggestions(false);
    // Focus the input after selection
    const inputElement = document.getElementById(id as string);
    if (inputElement) {
      inputElement.focus();
    }
  };

  useEffect(() => {
    setShowSuggestions(!selected);
  }, [selected]);

  return (
    <div className="mb-6 space-y-2">
      <div className="flex items-center justify-between gap-1">
        <label
          htmlFor={id}
          className="block font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400"
        >
          {label}
        </label>
        {selected && (
          <div className="flex items-center gap-1 font-mono text-[11px] tabular-nums text-zinc-500 dark:text-zinc-400">
            Balance: {Number(formatEther(selected?.balance || 0n)).toFixed(2)}
            <button
              type="button"
              className="cursor-pointer p-1 text-zinc-400 transition-colors hover:text-zinc-900 dark:hover:text-zinc-100"
              aria-label="Refresh balance"
              onClick={() => {
                /* your refresh logic here */
              }}
            >
              <RefreshCcw className="h-3 w-3" />
            </button>
          </div>
        )}
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

          {selected && (
            <div className="flex h-10 items-center gap-2 border border-l-0 border-zinc-200 bg-zinc-50/60 px-3 dark:border-zinc-800 dark:bg-zinc-900/40">
              {selected.symbol && <TokenAvatar symbol={selected.symbol} chain={selected.chain} />}
              <div className="text-[13px] font-medium text-zinc-900 dark:text-zinc-100">{selected.name}</div>
            </div>
          )}
        </div>
        {unit && (
          <div className="absolute inset-y-0 right-0 flex items-center pr-3">
            <span className="pointer-events-none font-mono text-[11px] uppercase tracking-[0.1em] text-zinc-400">
              {unit}
            </span>
          </div>
        )}

        {suggestions && suggestions.length > 0 && showSuggestions && (
          <div className="border border-t-0 border-zinc-200 bg-zinc-50/60 p-3 dark:border-zinc-800 dark:bg-zinc-900/40">
            <div className="mb-2 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-400">
              Suggestions
            </div>
            <div className="max-h-60 divide-y divide-zinc-200 overflow-auto border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-950">
              {suggestions.map((suggestion, index) => (
                <div
                  key={index}
                  className="group/sug relative cursor-pointer px-3 py-2 text-left transition-colors before:absolute before:inset-y-0 before:left-0 before:w-0.5 before:transition-colors hover:before:bg-zinc-300 dark:hover:before:bg-zinc-600"
                  onClick={() => handleSuggestionClick(suggestion)}
                >
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-2">
                      {suggestion.token?.symbol && (
                        <TokenAvatar symbol={suggestion.token.symbol} chain={suggestion.token.chain} />
                      )}
                      <div className="text-[13px] font-medium text-zinc-900 underline-offset-4 group-hover/sug:underline dark:text-zinc-100">
                        {suggestion.token?.name}
                      </div>
                      <div className="border border-zinc-200 px-1.5 py-0.5 font-mono text-[10.5px] font-bold uppercase tracking-[0.1em] text-zinc-700 dark:border-zinc-700 dark:text-zinc-300">
                        {suggestion.token?.symbol}
                      </div>
                    </div>
                    <div className="text-[12px] text-zinc-500 dark:text-zinc-400">{suggestion.description}</div>
                  </div>
                </div>
              ))}
            </div>
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
