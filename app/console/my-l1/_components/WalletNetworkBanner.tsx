'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
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

  return (
    <div className="rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-900/10 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div className="text-sm">
        {isInWallet ? (
          <>
            <span className="font-medium text-amber-900 dark:text-amber-200">
              Wallet on a different chain.
            </span>{' '}
            <span className="text-amber-800/80 dark:text-amber-200/70">
              Switch to <strong>{l1.chainName}</strong> ({l1.evmChainId}) to interact with this
              L1.
            </span>
          </>
        ) : (
          <>
            <span className="font-medium text-amber-900 dark:text-amber-200">
              Not in your wallet yet.
            </span>{' '}
            <span className="text-amber-800/80 dark:text-amber-200/70">
              Add <strong>{l1.chainName}</strong> ({l1.evmChainId}) to your wallet so you can sign
              transactions on it.
            </span>
          </>
        )}
        {error && (
          <span className="block mt-1 text-xs text-red-600 dark:text-red-400">{error}</span>
        )}
      </div>
      {isInWallet ? (
        <Button onClick={handleSwitch} disabled={isSwitching} size="sm">
          {isSwitching ? 'Switching…' : 'Switch network'}
        </Button>
      ) : (
        <Button onClick={handleAddToWallet} size="sm">
          Add to wallet
        </Button>
      )}
    </div>
  );
}
