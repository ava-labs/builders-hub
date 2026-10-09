'use client';

import { Check } from 'lucide-react';
import { cn } from '../lib/utils';

interface ResultFieldProps {
  label: string;
  value: string;
  showCheck?: boolean;
}

export function ResultField({ label, value, showCheck = false }: ResultFieldProps) {
  if (!value) return null;
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <label className="block font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
          {label}
        </label>
        {showCheck && <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />}
      </div>
      <div
        className={cn(
          'w-full whitespace-pre-wrap break-words border px-3 py-2.5 font-mono text-[12px]',
          'text-zinc-900 dark:text-zinc-100',
          showCheck
            ? 'border-emerald-200 bg-emerald-50/60 dark:border-emerald-900/60 dark:bg-emerald-950/20'
            : 'border-red-200 bg-red-50/60 dark:border-red-900/60 dark:bg-red-950/20',
        )}
      >
        {value}
      </div>
    </div>
  );
}
