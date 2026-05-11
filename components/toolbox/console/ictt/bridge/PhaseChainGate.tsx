'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowRight, Loader2 } from 'lucide-react';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { useWallet } from '@/components/toolbox/hooks/useWallet';
import { Note } from '@/components/toolbox/components/Note';

interface PhaseChainGateProps {
  /** EVM chainId required for this phase. `null`/`undefined` means no requirement. */
  requiredChainId?: number | null;
  /** Display name for the required chain (used in banner copy). */
  requiredChainName?: string | null;
  children: ReactNode;
}

/**
 * Per-phase chain enforcement. On mount (or when the required chain changes),
 * attempts one programmatic `switchChain` so the user lands on the right chain
 * automatically. If the wallet rejects or fails, renders a clear "Switch to X"
 * banner instead of the form — physically preventing the user from signing
 * transactions on the wrong chain.
 */
export function PhaseChainGate({ requiredChainId, requiredChainName, children }: PhaseChainGateProps) {
  const walletChainId = useWalletStore((s) => s.walletChainId);
  const isTestnet = useWalletStore((s) => s.isTestnet);
  const walletEVMAddress = useWalletStore((s) => s.walletEVMAddress);
  const { switchChain } = useWallet();
  const [isSwitching, setIsSwitching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const attemptedRef = useRef<number | null>(null);

  const isMismatched =
    requiredChainId != null && walletChainId != null && walletChainId !== 0 && walletChainId !== requiredChainId;

  const handleSwitch = useCallback(
    async (auto: boolean) => {
      if (!requiredChainId) return;
      setIsSwitching(true);
      setError(null);
      try {
        await switchChain(requiredChainId, isTestnet);
      } catch (err) {
        // Auto-attempts swallow errors silently so the banner takes over.
        if (!auto) setError(err instanceof Error ? err.message : 'Could not switch chain.');
      } finally {
        setIsSwitching(false);
      }
    },
    [requiredChainId, switchChain, isTestnet],
  );

  // Attempt a single auto-switch per (requiredChainId, walletChainId) transition
  // to avoid fighting the user if they manually switch back.
  useEffect(() => {
    if (!requiredChainId) return;
    if (!walletEVMAddress) return;
    if (!isMismatched) return;
    if (attemptedRef.current === requiredChainId) return;
    attemptedRef.current = requiredChainId;
    void handleSwitch(true);
  }, [requiredChainId, isMismatched, walletEVMAddress, handleSwitch]);

  // Reset the attempt marker when the required chain changes so a fresh
  // navigation triggers a fresh auto-switch.
  useEffect(() => {
    return () => {
      attemptedRef.current = null;
    };
  }, [requiredChainId]);

  if (!isMismatched || !requiredChainId) {
    return <>{children}</>;
  }

  return (
    <div className="flex flex-col gap-3">
      <Note variant="warning">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs">
            This phase runs on {requiredChainName ?? `chain ${requiredChainId}`}. Switch your wallet to continue.
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
            {isSwitching ? 'Switching…' : `Switch to ${requiredChainName ?? 'required chain'}`}
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
