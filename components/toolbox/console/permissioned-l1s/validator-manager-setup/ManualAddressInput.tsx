'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { isAddress } from 'viem';

interface ManualAddressInputProps {
  value: string;
  onChange: (address: string) => void;
  label: string;
}

export function ManualAddressInput({ value, onChange, label }: ManualAddressInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [localValue, setLocalValue] = useState(value);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (input: string) => {
    setLocalValue(input);
    if (input === '' || isAddress(input)) {
      setError(null);
      onChange(input);
    } else {
      setError('Invalid Ethereum address');
    }
  };

  return (
    <div>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        className="flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
      >
        {isOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        {label}
      </button>
      {isOpen && (
        <>
          <input
            type="text"
            value={localValue}
            onChange={(e) => handleChange(e.target.value)}
            placeholder="0x..."
            aria-label={label}
            className="mt-2 w-full px-3 py-2 text-xs font-mono rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/50 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-500/20"
          />
          {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
        </>
      )}
    </div>
  );
}
