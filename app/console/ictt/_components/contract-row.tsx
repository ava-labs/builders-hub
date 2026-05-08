'use client';

import { Copy, Check } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/components/toolbox/lib/utils';
import type { ContractStatus } from './types';

interface ContractRowProps {
  label: string;
  address: string | null;
  status: ContractStatus;
}

function truncate(address: string): string {
  if (address.length <= 14) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function ContractRow({ label, address, status }: ContractRowProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard API unavailable — silent */
    }
  };

  return (
    <div className="flex items-center justify-between gap-3 py-2.5 border-b border-zinc-100 dark:border-zinc-800/60 last:border-0">
      <div className="flex items-center gap-2.5 min-w-0">
        <span
          className={cn(
            'w-1.5 h-1.5 rounded-full flex-shrink-0',
            status === 'deployed' && 'bg-emerald-500',
            status === 'pending' && 'bg-amber-500 animate-pulse',
            status === 'idle' && 'bg-zinc-300 dark:bg-zinc-700',
          )}
        />
        <span className="text-xs text-zinc-500 dark:text-zinc-400 font-medium truncate">{label}</span>
      </div>
      {address ? (
        <button
          type="button"
          onClick={handleCopy}
          title={`Copy ${address}`}
          className="flex items-center gap-1.5 text-[11px] font-mono text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors cursor-pointer"
        >
          <span>{truncate(address)}</span>
          {copied ? (
            <Check className="w-3 h-3 text-emerald-500" />
          ) : (
            <Copy className="w-3 h-3 opacity-0 group-hover:opacity-100" />
          )}
        </button>
      ) : (
        <span className="text-[11px] text-zinc-300 dark:text-zinc-600 italic">— not deployed —</span>
      )}
    </div>
  );
}
