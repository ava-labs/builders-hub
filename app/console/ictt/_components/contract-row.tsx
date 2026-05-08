'use client';

import { Copy, Check, ExternalLink } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/components/toolbox/lib/utils';
import type { ContractStatus } from './types';

interface ContractRowProps {
  label: string;
  address: string | null;
  status: ContractStatus;
  /**
   * Block-explorer base URL for the chain this contract lives on.
   * When provided, the address becomes a deep link to /address/<addr>.
   */
  explorerUrl?: string;
}

function truncate(address: string): string {
  if (address.length <= 14) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function buildExplorerLink(explorerUrl: string, address: string): string {
  // Strip any trailing slash, then append /address/<addr>. Most Avalanche
  // explorers (subnets.avax.network, snowtrace, etc.) follow this layout.
  const base = explorerUrl.replace(/\/+$/, '');
  return `${base}/address/${address}`;
}

export function ContractRow({ label, address, status, explorerUrl }: ContractRowProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
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
    <div className="flex items-center justify-between gap-3 py-2.5 border-b border-border/60 last:border-0 group">
      <div className="flex items-center gap-2.5 min-w-0">
        <span
          className={cn(
            'w-1.5 h-1.5 rounded-full flex-shrink-0',
            status === 'deployed' && 'bg-emerald-500',
            status === 'pending' && 'bg-amber-500 animate-pulse',
            status === 'idle' && 'bg-muted-foreground/40',
          )}
        />
        <span className="text-xs text-muted-foreground font-medium truncate">{label}</span>
      </div>
      {address ? (
        <div className="flex items-center gap-1.5 text-[11px] font-mono text-foreground/80">
          {explorerUrl ? (
            <a
              href={buildExplorerLink(explorerUrl, address)}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground flex items-center gap-1"
              title={`Open ${address} on block explorer`}
            >
              <span>{truncate(address)}</span>
              <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100" />
            </a>
          ) : (
            <span title={address}>{truncate(address)}</span>
          )}
          <button
            type="button"
            onClick={handleCopy}
            title={`Copy ${address}`}
            className="hover:text-foreground cursor-pointer"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3 opacity-0 group-hover:opacity-100" />}
          </button>
        </div>
      ) : (
        <span className="text-[11px] text-muted-foreground/70 italic">— not deployed —</span>
      )}
    </div>
  );
}
