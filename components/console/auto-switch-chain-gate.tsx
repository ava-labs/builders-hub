'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowRight, Loader2 } from 'lucide-react';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import type { L1ListItem } from '@/components/toolbox/stores/l1ListStore';
import { useWallet } from '@/components/toolbox/hooks/useWallet';
import { Note } from '@/components/toolbox/components/Note';

interface AutoSwitchChainGateProps {
  /**
   * Resolved L1 the step runs on. Preferred over `requiredChainId` because
   * it lets the gate fall back to `wallet_addEthereumChain` when the wallet
   * doesn't have the L1 yet (e.g. fresh user-created L1s).
   */
  requiredL1?: L1ListItem | null;
  /** EVM chainId required for this step. `null`/`undefined` means no requirement. */
  requiredChainId?: number | null;
  /** Display name for the required chain (used in banner copy). */
  requiredChainName?: string | null;
  children: ReactNode;
}

/**
 * Per-step chain enforcement. On mount (or when the required chain changes),
 * attempts one programmatic switch so the user lands on the right chain
 * automatically. If the wallet rejects or fails, renders a clear "Switch to X"
 * banner instead of the form — physically preventing the user from signing
 * transactions on the wrong chain.
 *
 * When `requiredL1` is provided, uses `switchChainOrAdd` so missing chains are
 * added to the wallet on the first attempt rather than silently failing.
 */
export function AutoSwitchChainGate({
  requiredL1,
  requiredChainId,
  requiredChainName,
  children,
}: AutoSwitchChainGateProps) {
  const walletChainId = useWalletStore((s) => s.walletChainId);
  const isTestnet = useWalletStore((s) => s.isTestnet);
  const walletEVMAddress = useWalletStore((s) => s.walletEVMAddress);
  const { switchChain, switchChainOrAdd } = useWallet();
  const [isSwitching, setIsSwitching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const attemptedRef = useRef<number | null>(null);

  // Derive the effective chain ID + name. If an L1 is supplied it takes
  // precedence; otherwise we fall back to the explicit chainId/name props.
  const effectiveChainId = requiredL1?.evmChainId ?? requiredChainId ?? null;
  const effectiveChainName = requiredL1?.name ?? requiredChainName ?? null;

  const isMismatched =
    effectiveChainId != null && walletChainId != null && walletChainId !== 0 && walletChainId !== effectiveChainId;

  const handleSwitch = useCallback(
    async (auto: boolean) => {
      if (!effectiveChainId) return;
      setIsSwitching(true);
      setError(null);
      try {
        if (requiredL1) {
          // switch-or-add: handles "chain not in wallet" without silent failure.
          await switchChainOrAdd(requiredL1);
        } else {
          await switchChain(effectiveChainId, isTestnet);
        }
      } catch (err) {
        // Auto-attempts swallow errors silently so the banner takes over.
        if (!auto) setError(err instanceof Error ? err.message : 'Could not switch chain.');
      } finally {
        setIsSwitching(false);
      }
    },
    [effectiveChainId, requiredL1, switchChain, switchChainOrAdd, isTestnet],
  );

  // Attempt a single auto-switch per (requiredChainId, walletChainId) transition
  // to avoid fighting the user if they manually switch back.
  useEffect(() => {
    if (!effectiveChainId) return;
    if (!walletEVMAddress) return;
    if (!isMismatched) return;
    if (attemptedRef.current === effectiveChainId) return;
    attemptedRef.current = effectiveChainId;
    void handleSwitch(true);
  }, [effectiveChainId, isMismatched, walletEVMAddress, handleSwitch]);

  // Reset the attempt marker when the required chain changes so a fresh
  // navigation triggers a fresh auto-switch.
  useEffect(() => {
    return () => {
      attemptedRef.current = null;
    };
  }, [effectiveChainId]);

  if (!isMismatched || !effectiveChainId) {
    return <>{children}</>;
  }

  return (
    <div className="flex flex-col gap-3">
      <Note variant="warning">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs">
            This step runs on {effectiveChainName ?? `chain ${effectiveChainId}`}. Switch your wallet to continue.
          </span>
          <button
            type="button"
            onClick={() => handleSwitch(false)}
            disabled={isSwitching}
            className="inline-flex items-center gap-1 rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
          >
            {isSwitching ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            )}
            {isSwitching ? 'Switching…' : `Switch to ${effectiveChainName ?? 'required chain'}`}
          </button>
        </div>
      </Note>
      {error && (
        <Note variant="destructive">
          <span className="text-xs">{error}</span>
        </Note>
      )}
    </div>
  );
}
