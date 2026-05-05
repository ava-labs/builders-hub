'use client';

import { useState } from 'react';
import { ArrowLeftRight, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { useL1List, type L1ListItem } from '@/components/toolbox/stores/l1ListStore';
import { useWalletSwitch } from '@/components/toolbox/hooks/useWalletSwitch';
import { useModalTrigger } from '@/components/toolbox/hooks/useModal';
import { toast } from '@/lib/toast';
import type { CombinedL1 } from '@/lib/console/my-l1/types';

// Inline header action that replaces the old full-width "Wallet on a different
// chain…" banner. Lives next to Open Explorer in DetailHeader so the user
// can switch networks without losing a vertical row to a banner that just
// states the obvious.
//
// Three states:
//   - wallet IS on this L1     → returns null (no UI)
//   - wallet is on another chain AND L1 is in wallet → "Switch Wallet"
//   - wallet has NOT added the L1 yet                 → "Add to Wallet"
export function WalletNetworkAction({ l1 }: { l1: CombinedL1 }) {
  const walletChainId = useWalletStore((s) => s.walletChainId);
  const walletL1s = useL1List();
  const { safelySwitch } = useWalletSwitch();
  const { openModal: openAddChainModal } = useModalTrigger<{ success: boolean }>();
  const [isSwitching, setIsSwitching] = useState(false);

  // Skip when we don't know the chainId yet, the wallet is already on it,
  // or the wallet is still hydrating (chainId === 0).
  if (l1.evmChainId === null || walletChainId === 0 || walletChainId === l1.evmChainId) {
    return null;
  }

  const isInWallet = walletL1s.some((w: L1ListItem) => w.evmChainId === l1.evmChainId);

  const handleSwitch = async () => {
    if (l1.evmChainId === null) return;
    setIsSwitching(true);
    try {
      await safelySwitch(l1.evmChainId, l1.isTestnet);
      toast.success(`Wallet on ${l1.chainName}`, undefined, {
        id: `wallet-switch:${l1.evmChainId}`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to switch network';
      toast.error('Network switch failed', msg, {
        id: `wallet-switch:${l1.evmChainId}`,
        action: { label: 'Retry', onClick: () => void handleSwitch() },
      });
    } finally {
      setIsSwitching(false);
    }
  };

  const handleAddToWallet = async () => {
    try {
      await openAddChainModal({
        rpcUrl: l1.rpcUrl,
        chainName: l1.chainName,
        coinName: l1.coinName ?? '',
      });
    } catch (err) {
      toast.error(
        'Could not add chain',
        err instanceof Error ? err.message : 'Failed to open Add Chain dialog',
        {
          id: `wallet-add:${l1.evmChainId}`,
          action: { label: 'Retry', onClick: () => void handleAddToWallet() },
        },
      );
    }
  };

  if (isInWallet) {
    const switchLabel = `Switch wallet to ${l1.chainName} (chain ${l1.evmChainId}) so you can sign here.`;
    return (
      <Button
        onClick={handleSwitch}
        disabled={isSwitching}
        size="sm"
        title={switchLabel}
        aria-label={switchLabel}
      >
        <ArrowLeftRight className="w-4 h-4 mr-2" />
        {isSwitching ? 'Switching…' : 'Switch Wallet'}
      </Button>
    );
  }

  const addLabel = `Add ${l1.chainName} (chain ${l1.evmChainId}) to your wallet.`;
  return (
    <Button
      onClick={handleAddToWallet}
      size="sm"
      title={addLabel}
      aria-label={addLabel}
    >
      <Wallet className="w-4 h-4 mr-2" />
      Add to Wallet
    </Button>
  );
}
