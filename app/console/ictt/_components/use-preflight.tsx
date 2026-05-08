'use client';

import { useMemo } from 'react';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import type { L1ListItem } from '@/components/toolbox/stores/l1ListStore';
import { ChainMismatchBanner } from './inspectors/preflight-banner';

interface PreflightArgs {
  /**
   * The chain the active inspector requires the wallet to be on. When
   * not provided (e.g., during bootstrap before any chain is selected),
   * preflight is suppressed entirely.
   */
  expectedChain: L1ListItem | undefined;
  /**
   * Switch-chain callback. When the wallet is on a different chain, the
   * banner renders a button that calls this. The bridge console wires
   * `useWalletSwitch().safelySwitch` here.
   */
  switchChain: (chainId: number, isTestnet: boolean) => Promise<void>;
}

interface PreflightResult {
  /** Banner JSX to drop into the inspector's `preflight` slot, or null
   *  when the wallet is already on the expected chain. */
  banner: React.ReactNode;
  /** True when the wallet is on the expected chain (or no expectation). */
  isReady: boolean;
}

/**
 * Centralizes the chain-mismatch preflight check that every inspector
 * needs. Each inspector previously rolled its own `onSwitchToX` callback
 * and rendered the banner conditionally; this hook reduces that to one
 * line: `const { banner } = usePreflight(expectedChain, switchChain);`.
 */
export function usePreflight({ expectedChain, switchChain }: PreflightArgs): PreflightResult {
  const walletChainId = useWalletStore((s) => s.walletChainId);

  return useMemo(() => {
    if (!expectedChain) return { banner: null, isReady: true };
    const isReady = walletChainId === expectedChain.evmChainId;
    if (isReady) return { banner: null, isReady: true };

    const onSwitch = () => switchChain(expectedChain.evmChainId, !!expectedChain.isTestnet);
    return {
      banner: (
        <ChainMismatchBanner expectedChain={expectedChain} walletChainId={walletChainId} onSwitch={onSwitch} />
      ),
      isReady: false,
    };
  }, [expectedChain, walletChainId, switchChain]);
}
