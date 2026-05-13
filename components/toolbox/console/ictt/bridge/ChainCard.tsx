'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import { ChevronDown, ChevronRight, Copy, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { L1ListItem } from '@/components/toolbox/stores/l1ListStore';
import { buildAddressUrl, truncateAddress } from './utils/explorer-url';
import type { Address } from './types';

export type ChainCardRole = 'home' | 'remote';

interface ChainCardProps {
  role: ChainCardRole;
  l1: L1ListItem | null;
  /** Pill in the upper-right showing wallet connection. */
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

const ROLE_TOP_ACCENT: Record<ChainCardRole, string> = {
  home: 'bg-red-300 dark:bg-red-500/60',
  remote: 'bg-emerald-300 dark:bg-emerald-500/60',
};

const ROLE_EYEBROW: Record<ChainCardRole, { text: string; tone: string }> = {
  home: {
    text: 'Home · Origin',
    tone: 'text-red-600 dark:text-red-400',
  },
  remote: {
    text: 'Remote · Destination',
    tone: 'text-emerald-600 dark:text-emerald-400',
  },
};

export function ChainCard({
  role,
  l1,
  isWalletOnChain,
  onSwitchChain,
  children,
  details,
  banner,
  className,
}: ChainCardProps) {
  const [showDetails, setShowDetails] = useState(false);
  const eyebrow = ROLE_EYEBROW[role];

  return (
    <article
      className={cn(
        'relative overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900',
        className,
      )}
    >
      <span aria-hidden className={cn('absolute inset-x-0 top-0 h-1', ROLE_TOP_ACCENT[role])} />
      <header className="flex items-start justify-between gap-3 px-4 pb-3 pt-4">
        <div className="flex items-start gap-3">
          <ChainAvatar l1={l1} />
          <div className="flex flex-col gap-0.5">
            <span className={cn('text-[10px] font-semibold uppercase tracking-[0.14em]', eyebrow.tone)}>
              {eyebrow.text}
            </span>
            <h2 className="text-base font-semibold leading-tight text-zinc-900 dark:text-zinc-100">
              {l1?.name ?? 'Select a chain'}
            </h2>
            {l1?.description && (
              <p className="line-clamp-1 max-w-[28ch] text-xs text-zinc-500 dark:text-zinc-400">{l1.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ConnectionPill isWalletOnChain={isWalletOnChain} onSwitchChain={onSwitchChain} disabled={!l1} />
        </div>
      </header>

      {banner && <div className="px-4 pb-3">{banner}</div>}

      <div className="border-t border-zinc-100 dark:border-zinc-800/80">
        <div className="px-2 py-2">{children}</div>
      </div>

      {details && (
        <div className="border-t border-zinc-100 dark:border-zinc-800/80">
          <button
            type="button"
            onClick={() => setShowDetails((v) => !v)}
            className="flex w-full items-center justify-between px-4 py-2 text-xs text-zinc-500 transition-colors hover:bg-zinc-50 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800/40 dark:hover:text-zinc-200"
            aria-expanded={showDetails}
          >
            <span>{showDetails ? 'Hide details' : '+ details'}</span>
            {showDetails ? (
              <ChevronDown className="h-3.5 w-3.5" aria-hidden />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" aria-hidden />
            )}
          </button>
          {showDetails && <div className="border-t border-zinc-100 px-4 py-3 dark:border-zinc-800/80">{details}</div>}
        </div>
      )}
    </article>
  );
}

function ChainAvatar({ l1 }: { l1: L1ListItem | null }) {
  if (!l1?.logoUrl) {
    return (
      <div
        aria-hidden
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-xs font-semibold uppercase text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
      >
        {l1?.name?.slice(0, 1) ?? '?'}
      </div>
    );
  }
  return (
    <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-lg bg-white ring-1 ring-zinc-200/80 dark:bg-zinc-900 dark:ring-zinc-700/80">
      <Image src={l1.logoUrl} alt="" width={32} height={32} className="h-8 w-8 object-contain" unoptimized />
    </div>
  );
}

interface ConnectionPillProps {
  isWalletOnChain: boolean;
  onSwitchChain?: () => void;
  disabled?: boolean;
}

function ConnectionPill({ isWalletOnChain }: ConnectionPillProps) {
  if (isWalletOnChain) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
        <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        connected
      </span>
    );
  }
  // Per-step chain enforcement lives in AutoSwitchChainGate now — the inline button
  // was always disabled (no consumer ever passed `onSwitchChain`) and read as
  // a dead control. Render nothing when off-chain instead.
  return null;
}

interface ChainCardRowProps {
  label: string;
  sublabel?: string;
  address?: Address | null;
  status: 'deployed' | 'pending' | 'missing' | 'error';
  l1?: L1ListItem | null;
  isActive?: boolean;
  rightSlot?: ReactNode;
  /** Overrides the default "— not deployed —" copy when address is null. */
  statusText?: string;
}

const STATUS_DOT: Record<ChainCardRowProps['status'], { color: string; label: string }> = {
  deployed: { color: 'bg-emerald-500', label: 'deployed' },
  pending: { color: 'bg-amber-400', label: 'pending' },
  missing: { color: 'bg-zinc-300 dark:bg-zinc-700', label: 'not deployed' },
  error: { color: 'bg-red-500', label: 'error' },
};

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
  const dot = STATUS_DOT[status];
  const url = buildAddressUrl(l1, address ?? undefined);
  const STATUS_TONE: Record<ChainCardRowProps['status'], string> = {
    deployed: 'text-emerald-700 dark:text-emerald-400',
    pending: 'text-amber-700 dark:text-amber-400',
    missing: 'text-zinc-500 dark:text-zinc-400',
    error: 'text-red-600 dark:text-red-400',
  };

  return (
    <div
      className={cn(
        'grid grid-cols-[14px_1fr_auto] items-center gap-3 rounded-lg px-3 py-2 transition-colors',
        isActive
          ? 'bg-zinc-900/5 ring-1 ring-inset ring-zinc-900/10 dark:bg-zinc-100/5 dark:ring-zinc-100/10'
          : 'hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40',
      )}
    >
      <span aria-hidden className={cn('h-2.5 w-2.5 rounded-full', dot.color)} />
      <div className="flex min-w-0 flex-col">
        <span className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">{label}</span>
        {sublabel && <span className="text-[10px] uppercase tracking-wider text-zinc-500">{sublabel}</span>}
        <span className="sr-only">{dot.label}</span>
      </div>
      <div className="flex items-center gap-1.5">
        {address ? (
          <>
            <code className="font-mono text-[12px] text-zinc-700 dark:text-zinc-300">{truncateAddress(address)}</code>
            <CopyButton value={address} />
            {url && (
              <Link
                href={url}
                target="_blank"
                rel="noreferrer"
                className="rounded p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                aria-label="View address on explorer"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            )}
          </>
        ) : statusText ? (
          <span className={cn('text-xs font-medium', STATUS_TONE[status])}>{statusText}</span>
        ) : (
          <span className="text-xs italic text-zinc-400">— not deployed —</span>
        )}
        {rightSlot}
      </div>
    </div>
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
    <button
      type="button"
      onClick={handleCopy}
      aria-label={copied ? 'Copied' : 'Copy address'}
      className="rounded p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
    >
      <Copy className="h-3.5 w-3.5" />
    </button>
  );
}

export function ChainCardRowList({ children }: { children: ReactNode }) {
  return <ul className="flex flex-col gap-0.5">{children}</ul>;
}
