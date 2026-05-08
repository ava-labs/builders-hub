'use client';

import { cn } from '@/components/toolbox/lib/utils';
import type { L1ListItem } from '@/components/toolbox/stores/l1ListStore';

interface WalletPillProps {
  walletAddress: string;
  walletChainId: number;
  expectedChain?: L1ListItem;
  onSwitchChain?: () => void;
}

/**
 * Top-bar wallet status indicator. Three states:
 *   - disconnected: zinc pill with "Not connected"
 *   - connected to expected chain: emerald pill with "Wallet connected"
 *   - connected to wrong chain: amber pill with "Switch to <chain>" CTA
 *
 * The expected chain is determined by the active phase (e.g., for the
 * "remote" phase the wallet must be on the remote chain). Bridge console
 * passes `expectedChain` based on the inspector's preflight requirement.
 */
export function WalletPill({ walletAddress, walletChainId, expectedChain, onSwitchChain }: WalletPillProps) {
  if (!walletAddress) {
    return (
      <div className="flex items-center gap-2 px-2.5 py-1.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg">
        <span className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
        <span className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400">Not connected</span>
      </div>
    );
  }

  const isOnExpected = !expectedChain || walletChainId === expectedChain.evmChainId;

  if (!isOnExpected) {
    return (
      <button
        type="button"
        onClick={onSwitchChain}
        className={cn(
          'flex items-center gap-2 px-2.5 py-1.5 rounded-lg border cursor-pointer transition-colors',
          'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100',
          'dark:bg-amber-950/40 dark:border-amber-900/60 dark:text-amber-300 dark:hover:bg-amber-950/60',
        )}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
        <span className="text-[11px] font-medium">Switch to {expectedChain.name}</span>
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2 px-2.5 py-1.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 rounded-lg">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
      <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-300">Wallet connected</span>
    </div>
  );
}
