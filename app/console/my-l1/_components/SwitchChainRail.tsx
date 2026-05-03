'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Clock } from 'lucide-react';
import { boardContainer, boardItem } from '@/components/console/motion';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { cn } from '@/lib/utils';
import type { CombinedL1 } from '../_lib/types';

// Single horizontal scrollable row of L1 pills. Replaces the old two-section
// SwitcherBar (managed vs wallet) — the source distinction is folded into a
// pill chip rather than a section header so the row stays compact and the
// user can pan a long fleet without juggling two grids.
export function SwitchChainRail({
  l1s,
  selected,
  onSelect,
}: {
  l1s: CombinedL1[];
  selected: CombinedL1 | null;
  onSelect: (l1: CombinedL1) => void;
}) {
  const walletChainId = useWalletStore((s) => s.walletChainId);
  const activeRef = useRef<HTMLButtonElement>(null);
  const didMountRef = useRef(false);

  // Auto-scroll the active pill into view when selection changes — keeps
  // the highlighted pill visible after picking from a long list. The first
  // mount is skipped so the rail doesn't yank itself into a "smooth" scroll
  // before the user has done anything.
  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }
    activeRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'nearest',
    });
  }, [selected?.subnetId, selected?.evmChainId]);

  if (l1s.length === 0) return null;

  return (
    <div className="space-y-2">
      <h2 className="text-[10px] uppercase tracking-[0.18em] font-semibold text-muted-foreground px-1">
        Switch Chain
      </h2>
      <motion.div
        variants={boardContainer}
        initial="hidden"
        animate="visible"
        className="flex gap-2 overflow-x-auto py-1 -mx-1 px-1 [scrollbar-width:thin]"
      >
        {l1s.map((l1) => {
          const key =
            l1.evmChainId !== null ? `chain:${l1.evmChainId}` : `subnet:${l1.subnetId}`;
          const isActive =
            selected !== null &&
            (l1.evmChainId !== null
              ? selected.evmChainId === l1.evmChainId
              : selected.subnetId === l1.subnetId);
          const walletIsHere =
            l1.evmChainId !== null && walletChainId === l1.evmChainId;
          return (
            <motion.button
              key={key}
              ref={isActive ? activeRef : undefined}
              variants={boardItem}
              type="button"
              onClick={() => onSelect(l1)}
              aria-pressed={isActive}
              aria-label={`${l1.chainName} (chain ${l1.evmChainId ?? 'unknown'})${
                isActive ? ' — selected' : ''
              }${walletIsHere ? ' — wallet on this chain' : ''}`}
              className={cn(
                'group relative flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-2 text-sm transition-all duration-150',
                isActive
                  ? 'border-emerald-500/60 bg-emerald-500/5 text-foreground shadow-[0_0_0_1px_rgba(16,185,129,0.15)]'
                  : 'border-border bg-card hover:border-foreground/30 hover:-translate-y-px text-muted-foreground hover:text-foreground',
              )}
            >
              {/* The pulsing dot is reserved for "your wallet is on this
                  chain" — the active selection is communicated by the
                  emerald ring + foreground text alone. Showing the dot on
                  both states made it ambiguous which chain the wallet was
                  actually on when the user clicked through the rail. */}
              {walletIsHere && (
                <span
                  className="relative flex w-1.5 h-1.5 shrink-0"
                  title="Your wallet is currently on this L1"
                  aria-hidden="true"
                >
                  <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-40 animate-ping [animation-duration:2.4s]" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                </span>
              )}
              <span className="font-medium whitespace-nowrap">{l1.chainName}</span>
              <span className="text-[11px] font-mono tabular-nums text-muted-foreground/70 group-hover:text-muted-foreground">
                {l1.evmChainId ?? l1.subnetId.slice(0, 6)}
              </span>
              {l1.source === 'managed' && l1.expiresAt && (
                <ExpiryPip expiresAt={l1.expiresAt} />
              )}
            </motion.button>
          );
        })}
      </motion.div>
    </div>
  );
}

// Small expiry chip rendered inside managed pills. Counts down a minute at
// a time so the user catches expirations approaching without us spamming
// re-renders. Switches to amber when ≤6h remain, red when already expired.
function ExpiryPip({ expiresAt }: { expiresAt: string }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const ms = new Date(expiresAt).getTime() - now;
  if (ms <= 0) {
    return (
      <span
        className="ml-1 inline-flex items-center gap-1 rounded-full bg-red-500/10 px-1.5 py-0.5 text-[10px] text-red-700 dark:text-red-400"
        aria-label="Managed nodes expired"
      >
        <Clock className="w-2.5 h-2.5" aria-hidden="true" />
        expired
      </span>
    );
  }
  const totalHours = Math.floor(ms / 3_600_000);
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  const label = days > 0 ? `${days}d ${hours}h` : `${hours}h`;
  const tone =
    totalHours < 6
      ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400'
      : 'bg-muted text-muted-foreground';
  return (
    <span
      className={cn(
        'ml-1 inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px]',
        tone,
      )}
      aria-label={`Expires in ${label}`}
    >
      <Clock className="w-2.5 h-2.5" aria-hidden="true" />
      {label}
    </span>
  );
}
