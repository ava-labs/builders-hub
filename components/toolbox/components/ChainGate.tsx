'use client';

import React, { useMemo, useState } from 'react';
import { AlertTriangle, ArrowRight, Wallet } from 'lucide-react';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { useCreateChainStore } from '@/components/toolbox/stores/createChainStore';
import { getL1ListStore, type L1ListItem } from '@/components/toolbox/stores/l1ListStore';
import { useWallet } from '@/components/toolbox/hooks/useWallet';
import type { RequiredChain } from '@/components/console/step-flow';
import {
  readLiveWalletChainId,
  useActiveWalletProvider,
  useLiveWalletChainId,
} from '@/components/toolbox/hooks/useLiveWalletChainId';
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
  const activeProvider = useActiveWalletProvider({
    enabled: Boolean(walletEVMAddress),
    refreshKey: walletChainId,
  });
  const liveChainId = useLiveWalletChainId({
    provider: activeProvider,
    enabled: Boolean(walletEVMAddress),
    refreshKey: walletChainId,
  });
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

      // useWalletSwitch writes walletChainId after a confirmed switch. Check
      // the store before reading the async provider hook so a fast click while
      // activeProvider is still resolving does not fall through to Add Chain.
      if (useWalletStore.getState().walletChainId === expectedChainId) {
        return;
      }

      const live = await readLiveWalletChainId(activeProvider);
      if (live === expectedChainId) {
        if (useWalletStore.getState().walletChainId !== expectedChainId) {
          setWalletChainId(expectedChainId);
        }
        return;
      }

      if (useWalletStore.getState().walletChainId === expectedChainId) {
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

  const BTN =
    'inline-flex h-9 items-center gap-2 border px-4 font-mono text-[11px] font-bold uppercase tracking-[0.14em] transition-colors disabled:opacity-60';

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4 border border-amber-300 bg-amber-50 p-5 dark:border-amber-800/70 dark:bg-amber-950/20">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div>
            <p className="font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-amber-900 dark:text-amber-200">
              Switch to {chainLabel}
            </p>
            <p className="mt-1.5 text-[13px] leading-relaxed text-zinc-700 dark:text-zinc-300">
              This step runs on <span className="font-medium text-zinc-900 dark:text-zinc-50">{chainLabel}</span>
              {requiredChain === 'l1' && ' (chain ID ' + expectedChainId + ')'}.
              {currentChainLabel ? (
                <>
                  {' '}
                  Your wallet is on{' '}
                  <span className="font-medium text-zinc-900 dark:text-zinc-50">{currentChainLabel}</span>.
                </>
              ) : (
                <> Your wallet is on a different network.</>
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handlePrimary}
              disabled={isSwitching}
              className={`${BTN} border-zinc-900 bg-zinc-900 text-white hover:bg-zinc-700 dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300`}
            >
              {isSwitching ? 'Switching…' : primaryLabel}
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
            {/* Always offer the explicit add-to-wallet path as a secondary option: it matters when the user needs
                to paste a custom RPC URL (a managed-nodes endpoint we don't have in scope, say). */}
            {!isInWallet && (
              <button
                type="button"
                onClick={handleAddToWallet}
                className={`${BTN} border-zinc-300 text-zinc-700 hover:border-zinc-900 hover:text-zinc-900 dark:border-zinc-700 dark:text-zinc-200 dark:hover:border-zinc-100 dark:hover:text-zinc-50`}
              >
                <Wallet className="h-3.5 w-3.5" /> Add manually
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Still render children below — some users may want to read the step while switching */}
      <div className="opacity-40 pointer-events-none">{children}</div>
    </div>
  );
}
