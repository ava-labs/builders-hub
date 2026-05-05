'use client';

import React, { useMemo, useState } from 'react';
import { AlertTriangle, ArrowRight, Wallet } from 'lucide-react';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { useCreateChainStore } from '@/components/toolbox/stores/createChainStore';
import { getL1ListStore, type L1ListItem } from '@/components/toolbox/stores/l1ListStore';
import { useWallet } from '@/components/toolbox/hooks/useWallet';
import { Button } from '@/components/toolbox/components/Button';
import type { RequiredChain } from '@/components/console/step-flow';
import { readLiveWalletChainId, useLiveWalletChainId } from '@/components/toolbox/hooks/useLiveWalletChainId';
import { resolveCreateL1RequiredChain } from '@/lib/console/create-l1-chain';

interface ChainGateProps {
  requiredChain?: RequiredChain;
  children: React.ReactNode;
}

const FUJI_CHAIN_ID = 43113;
const MAINNET_CHAIN_ID = 43114;

/**
 * Checks if the wallet is on the correct chain for the current step.
 * If not, shows an inline prompt to switch or add the chain.
 * If requiredChain is 'any' or 'p-chain' or undefined, passes through.
 */
export function ChainGate({ requiredChain, children }: ChainGateProps) {
  const walletChainId = useWalletStore((s) => s.walletChainId);
  const isTestnet = useWalletStore((s) => s.isTestnet);
  const walletEVMAddress = useWalletStore((s) => s.walletEVMAddress);
  const setWalletChainId = useWalletStore((s) => s.setWalletChainId);
  const createChainStore = useCreateChainStore()();
  const testnetL1s = getL1ListStore(true)((state: { l1List: L1ListItem[] }) => state.l1List);
  const mainnetL1s = getL1ListStore(false)((state: { l1List: L1ListItem[] }) => state.l1List);
  const walletL1s = useMemo(() => [...testnetL1s, ...mainnetL1s], [testnetL1s, mainnetL1s]);
  const { addChain, switchChain } = useWallet();
  const liveChainId = useLiveWalletChainId(walletChainId);
  const [isSwitching, setIsSwitching] = useState(false);

  // No requirement or P-Chain (no EVM switch needed) — pass through
  if (!requiredChain || requiredChain === 'any' || requiredChain === 'p-chain') {
    return <>{children}</>;
  }

  // No wallet connected — show children anyway (individual steps handle wallet checks)
  if (!walletEVMAddress) {
    return <>{children}</>;
  }

  // Determine the expected chain ID
  let expectedChainId: number | null = null;
  let chainLabel = '';

  if (requiredChain === 'c-chain') {
    expectedChainId = isTestnet ? FUJI_CHAIN_ID : MAINNET_CHAIN_ID;
    chainLabel = isTestnet ? 'Fuji C-Chain' : 'C-Chain';
  } else if (requiredChain === 'l1') {
    const resolved = resolveCreateL1RequiredChain({
      createChain: createChainStore,
      l1List: walletL1s,
    });
    expectedChainId = resolved.chainId;
    chainLabel = resolved.chainLabel;
  }

  // Can't determine expected chain — pass through
  if (expectedChainId === null) {
    return <>{children}</>;
  }

  // Already on the right chain (store value)
  if (walletChainId === expectedChainId) {
    return <>{children}</>;
  }

  // Self-heal: verify against the live provider before flagging wrong-chain.
  // This catches the split-brain case where the wallet IS on the expected
  // chain but walletChainId in the store got overwritten by wagmi's last
  // registered chain (wagmi ignores custom L1s). Without this, a user who
  // just added/switched to their L1 via AddChainModal can still see the
  // "Switch to X" prompt even though their wallet is already on X.
  if (liveChainId !== null && liveChainId === expectedChainId) {
    // Write it back so other consumers see the correct value
    if (walletChainId !== expectedChainId) setWalletChainId(expectedChainId);
    return <>{children}</>;
  }

  // l1ListStore-based "is the chain in our store?" check. This is a
  // hint, not a hard truth: the user might have added the chain through
  // Core wallet's UI directly (bypassing AddChainModal), in which case
  // it's in their wallet but missing from our list. We use this to pick
  // the *button label* + secondary action; the actual primary handler
  // tries switching regardless and falls back to the add flow only when
  // the wallet rejects the switch. C-Chain is always seeded into
  // l1ListStore, so this defaults true there.
  const isInWallet =
    requiredChain === 'c-chain' ? true : walletL1s.some((w: L1ListItem) => w.evmChainId === expectedChainId);

  const handleAddToWallet = async () => {
    // For the create-l1 flow we already know the chain name + EVM id,
    // so seed the modal with what we have. The user only needs to paste
    // an RPC URL (which the modal prompts for) — the rest is pre-filled.
    const isL1Step = requiredChain === 'l1';
    await addChain({
      allowLookup: !isL1Step,
      chainName: isL1Step ? chainLabel || undefined : undefined,
      genesisData: isL1Step ? createChainStore?.genesisData || undefined : undefined,
      isTestnet: isTestnet ?? undefined,
    });
  };

  // Primary action: try switching first regardless of whether we think
  // the chain is in the wallet. The switch succeeds in two important
  // cases the previous "isInWallet-only" branch missed:
  //   1. User added the chain via Core's UI directly (not via our modal),
  //      so our l1ListStore is unaware but the wallet itself isn't.
  //   2. The chain was added in a previous session and a different
  //      browser context wiped our local store but Core kept the entry.
  // Only when the switch genuinely doesn't move the live chain do we
  // fall back to the add-to-wallet modal.
  const handlePrimary = async () => {
    if (expectedChainId === null) return;
    setIsSwitching(true);
    try {
      await switchChain(expectedChainId, isTestnet ?? false);
      const live = await readLiveWalletChainId();
      if (live === expectedChainId) {
        if (walletChainId !== expectedChainId) setWalletChainId(expectedChainId);
        return;
      }
      // Switch didn't move the chain — chain probably isn't in the wallet
      // at all. Open the add-chain modal so the user can register it.
      await handleAddToWallet();
    } finally {
      setIsSwitching(false);
    }
  };

  // Best-effort label for what the wallet is currently on, so the user
  // can immediately see the mismatch the gate detected.
  const currentChainId = liveChainId ?? walletChainId;
  const currentChainLabel =
    currentChainId === FUJI_CHAIN_ID
      ? 'Fuji C-Chain'
      : currentChainId === MAINNET_CHAIN_ID
        ? 'Mainnet C-Chain'
        : currentChainId && currentChainId > 0
          ? `chain ${currentChainId}`
          : null;

  const primaryLabel = isInWallet ? 'Switch Network' : 'Connect to ' + chainLabel;

  return (
    <div className="space-y-4">
      <div
        className="rounded-2xl border border-zinc-700 bg-zinc-800 p-6"
        style={{
          boxShadow: 'inset 0 1px 0 0 rgba(255,255,255,0.06), 0 2px 8px rgba(0,0,0,0.15), 0 8px 24px rgba(0,0,0,0.1)',
        }}
      >
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10">
            <AlertTriangle className="h-5 w-5 text-amber-400" />
          </div>
          <div className="flex-1 space-y-3">
            <div>
              <h3 className="text-base font-semibold text-white">Connect to {chainLabel}</h3>
              <p className="mt-1 text-sm text-zinc-400">
                This step needs your wallet on <span className="text-zinc-200 font-medium">{chainLabel}</span>
                {requiredChain === 'l1' && ' (Chain ID: ' + expectedChainId + ')'}.
                {currentChainLabel ? (
                  <>
                    {' '}
                    You&apos;re currently on <span className="text-zinc-200 font-medium">{currentChainLabel}</span>.
                  </>
                ) : (
                  <> You&apos;re currently on a different network.</>
                )}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Button
                onClick={handlePrimary}
                loading={isSwitching}
                loadingText="Switching…"
                variant="primary"
                size="sm"
                icon={<ArrowRight className="h-3.5 w-3.5" />}
              >
                {primaryLabel}
              </Button>
              {/* Always offer the explicit add-to-wallet path as a
                  secondary option. This matters when the user knows they
                  need to paste a custom RPC URL (e.g., a managed-nodes
                  endpoint we don't have in scope) — they can skip the
                  optimistic switch attempt and go straight to the modal. */}
              {!isInWallet && (
                <Button
                  onClick={handleAddToWallet}
                  variant="secondary"
                  size="sm"
                  icon={<Wallet className="h-3.5 w-3.5" />}
                >
                  Add manually
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Still render children below — some users may want to read the step while switching */}
      <div className="opacity-40 pointer-events-none">{children}</div>
    </div>
  );
}
