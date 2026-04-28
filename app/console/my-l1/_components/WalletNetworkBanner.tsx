'use client';

import { useState } from 'react';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { useL1List, type L1ListItem } from '@/components/toolbox/stores/l1ListStore';
import { useWalletSwitch } from '@/components/toolbox/hooks/useWalletSwitch';
import { useModalTrigger } from '@/components/toolbox/hooks/useModal';
import { toast } from '@/lib/toast';
import type { CombinedL1 } from '../_lib/types';

// Renders a one-line nudge when the wallet isn't pointed at this L1.
// Two paths:
//   - L1 IS in the wallet's l1List but on a different chainId → Switch
//   - L1 is NOT in the wallet's l1List at all → Add to Wallet (prefills
//     AddChainModal with rpcUrl + chainName so the user can confirm)
// Hidden when the wallet is on the right chain or has no chainId yet.
export function WalletNetworkBanner({ l1 }: { l1: CombinedL1 }) {
  const walletChainId = useWalletStore((s) => s.walletChainId);
  const walletL1s = useL1List();
  const { safelySwitch } = useWalletSwitch();
  const { openModal: openAddChainModal } = useModalTrigger<{ success: boolean }>();
  const [isSwitching, setIsSwitching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Skip when we don't know the chainId yet, the wallet is already on it,
  // or the wallet is still hydrating (chainId === 0).
  if (l1.evmChainId === null || walletChainId === 0 || walletChainId === l1.evmChainId) {
    return null;
  }

  const isInWallet = walletL1s.some((w: L1ListItem) => w.evmChainId === l1.evmChainId);

  const handleSwitch = async () => {
    if (l1.evmChainId === null) return;
    setIsSwitching(true);
    setError(null);
    try {
      await safelySwitch(l1.evmChainId, l1.isTestnet);
      toast.success(`Switched to ${l1.chainName}`, `Wallet now on chain ${l1.evmChainId}.`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to switch network';
      setError(msg);
      toast.error('Network switch failed', msg);
    } finally {
      setIsSwitching(false);
    }
  };

  const handleAddToWallet = async () => {
    setError(null);
    try {
      await openAddChainModal({
        rpcUrl: l1.rpcUrl,
        chainName: l1.chainName,
        coinName: l1.coinName ?? '',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to open Add Chain dialog');
    }
  };

  // Neutral inline strip — a wallet on the wrong network is informational,
  // not blocking. Reading the dashboard works fine; the user only needs to
  // switch when they want to sign a tx. So we render this as a thin advisory
  // line instead of a colored card competing with the actual primary content.
  const action = isInWallet
    ? { label: isSwitching ? 'Switching…' : 'Switch network', onClick: handleSwitch }
    : { label: 'Add to wallet', onClick: handleAddToWallet };

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-l-2 border-zinc-300 dark:border-zinc-700 pl-3 py-1 text-sm text-muted-foreground">
      <span>
        {isInWallet ? (
          <>
            Wallet on a different chain.{' '}
            <span className="text-foreground/70">
              Switch to {l1.chainName} ({l1.evmChainId}) to sign here.
            </span>
          </>
        ) : (
          <>
            Not in your wallet yet.{' '}
            <span className="text-foreground/70">
              Add {l1.chainName} ({l1.evmChainId}) to sign on this L1.
            </span>
          </>
        )}
      </span>
      <button
        type="button"
        onClick={action.onClick}
        disabled={isSwitching}
        className="font-medium text-foreground underline underline-offset-2 hover:no-underline disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {action.label}
      </button>
      {error && (
        <span className="basis-full text-xs text-red-600 dark:text-red-400">{error}</span>
      )}
    </div>
  );
}
