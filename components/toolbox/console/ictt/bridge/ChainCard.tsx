'use client';

import { useState, type ReactNode } from 'react';
import { Check, ChevronDown, ChevronRight, Copy, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { L1ListItem } from '@/components/toolbox/stores/l1ListStore';
import { buildAddressUrl, truncateAddress } from './utils/explorer-url';
import { ChainMark, Dot, EYEBROW, FRAME, StatusTag, type Tone } from './ui';
import type { Address } from './types';

export type ChainCardRole = 'home' | 'remote';

interface ChainCardProps {
  role: ChainCardRole;
  l1: L1ListItem | null;
  /** Shows a "Connected" tag when the wallet is on this chain. */
  isWalletOnChain: boolean;
  onSwitchChain?: () => void;
  /** Active row label (highlights one row in the body). */
  activeRowKey?: string | null;
  /** Slot for the body — typically a ChainCardRowList. */
  children: ReactNode;
  /** Optional `+ details` body (chainId, registry, balances). */
  details?: ReactNode;
  /** Optional banner above the body for errors / warnings. */
  banner?: ReactNode;
  className?: string;
}

const ROLE_EYEBROW: Record<ChainCardRole, string> = {
  home: 'Home · Origin',
  remote: 'Remote · Destination',
};

export function ChainCard({ role, l1, isWalletOnChain, children, details, banner, className }: ChainCardProps) {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <article className={cn(FRAME, className)}>
      <header className="flex items-start justify-between gap-3 px-4 py-4">
        <div className="flex min-w-0 items-start gap-3">
          <ChainMark l1={l1} />
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className={EYEBROW}>{ROLE_EYEBROW[role]}</span>
            <h2 className="truncate text-[15px] font-semibold text-zinc-900 dark:text-zinc-50">
              {l1?.name ?? 'Select a chain'}
            </h2>
            {l1?.evmChainId !== undefined && (
              <span className="font-mono text-[11px] tabular-nums text-zinc-400 dark:text-zinc-500">
                Chain ID {l1.evmChainId}
              </span>
            )}
          </div>
        </div>
        {isWalletOnChain && <StatusTag tone="ok">Connected</StatusTag>}
      </header>

      {banner && <div className="border-t border-zinc-200 px-4 py-3 dark:border-zinc-800">{banner}</div>}

      <div className="border-t border-zinc-200 dark:border-zinc-800">{children}</div>

      {details && (
        <div className="border-t border-zinc-200 dark:border-zinc-800">
          <button
            type="button"
            onClick={() => setShowDetails((v) => !v)}
            className="flex w-full items-center justify-between px-4 py-2.5 font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] text-zinc-500 underline-offset-4 transition-colors hover:text-zinc-900 hover:underline dark:text-zinc-400 dark:hover:text-zinc-100"
            aria-expanded={showDetails}
          >
            <span>{showDetails ? 'Hide details' : 'Details'}</span>
            {showDetails ? (
              <ChevronDown className="h-3.5 w-3.5" aria-hidden />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" aria-hidden />
            )}
          </button>
          {showDetails && <div className="border-t border-zinc-200 px-4 py-3 dark:border-zinc-800">{details}</div>}
        </div>
      )}
    </article>
  );
}

interface ChainCardRowProps {
  label: string;
  sublabel?: string;
  address?: Address | null;
  status: 'deployed' | 'pending' | 'missing' | 'error';
  l1?: L1ListItem | null;
  isActive?: boolean;
  rightSlot?: ReactNode;
  /** Overrides the default "Not deployed" copy when address is null. */
  statusText?: string;
}

const STATUS: Record<ChainCardRowProps['status'], { tone: Tone; label: string }> = {
  deployed: { tone: 'ok', label: 'deployed' },
  pending: { tone: 'pending', label: 'pending' },
  missing: { tone: 'idle', label: 'not deployed' },
  error: { tone: 'error', label: 'error' },
};

const ICON_BUTTON =
  '-m-1 p-1 text-zinc-400 transition-colors hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-zinc-100';

export function ChainCardRow({
  label,
  sublabel,
  address,
  status,
  l1,
  isActive,
  rightSlot,
  statusText,
}: ChainCardRowProps) {
  const { tone, label: srLabel } = STATUS[status];
  const url = buildAddressUrl(l1, address ?? undefined);

  return (
    <li
      aria-current={isActive ? 'step' : undefined}
      className={cn(
        'relative grid grid-cols-[6px_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3',
        isActive && 'before:absolute before:inset-y-0 before:left-0 before:w-0.5 before:bg-[#E6212F]',
      )}
    >
      <Dot tone={tone} />
      <div className="flex min-w-0 flex-col">
        <span className="truncate text-[13px] font-medium text-zinc-900 dark:text-zinc-50">{label}</span>
        {sublabel && (
          <span className="truncate font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-400 dark:text-zinc-500">
            {sublabel}
          </span>
        )}
        <span className="sr-only">{srLabel}</span>
      </div>
      <div className="flex items-center gap-2.5">
        {address ? (
          <>
            <code className="font-mono text-[12px] text-zinc-700 dark:text-zinc-300" title={address}>
              {truncateAddress(address)}
            </code>
            <CopyButton value={address} />
            {url && (
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className={ICON_BUTTON}
                aria-label="View address on explorer"
              >
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </>
        ) : (
          <StatusTag tone={statusText ? tone : 'idle'}>{statusText ?? 'Not deployed'}</StatusTag>
        )}
        {rightSlot}
      </div>
    </li>
  );
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    if (typeof window === 'undefined') return;
    try {
      void window.navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {}
  };
  return (
    <button type="button" onClick={handleCopy} aria-label={copied ? 'Copied' : 'Copy address'} className={ICON_BUTTON}>
      {copied ? <Check className="h-3 w-3 text-[#E6212F]" /> : <Copy className="h-3 w-3" />}
    </button>
  );
}

export function ChainCardRowList({ children }: { children: ReactNode }) {
  return <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">{children}</ul>;
}
