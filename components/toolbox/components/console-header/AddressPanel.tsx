'use client';

import { useState } from 'react';
import { Check, Copy, ExternalLink, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

const short = (address: string) => (address.length > 16 ? `${address.slice(0, 8)}…${address.slice(-6)}` : address);

function IconButton({
  title,
  onClick,
  disabled,
  children,
}: {
  title: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      disabled={disabled}
      className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-60"
    >
      {children}
    </button>
  );
}

/** The connected address in a header dropdown: copy, refresh balances, open in the explorer. */
export function AddressPanel({
  label,
  address,
  onRefresh,
  explorerUrl,
}: {
  label: string;
  address: string;
  onRefresh: () => unknown;
  explorerUrl?: string | null;
}) {
  const [copied, setCopied] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  const refresh = async () => {
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setTimeout(() => setRefreshing(false), 1200);
    }
  };

  return (
    <div className="flex items-center gap-2 px-2 py-2">
      <div className="min-w-0 flex-1">
        <p className="text-[11px] text-muted-foreground">{label}</p>
        <button
          type="button"
          onClick={copy}
          title={address}
          className="block truncate font-mono text-xs text-foreground hover:text-primary"
        >
          {short(address)}
        </button>
      </div>
      <IconButton title={copied ? 'Copied' : 'Copy address'} onClick={copy}>
        {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
      </IconButton>
      <IconButton title="Refresh balances" onClick={refresh} disabled={refreshing}>
        <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
      </IconButton>
      {explorerUrl && (
        <IconButton title="View in explorer" onClick={() => window.open(explorerUrl, '_blank', 'noopener')}>
          <ExternalLink className="h-3.5 w-3.5" />
        </IconButton>
      )}
    </div>
  );
}
