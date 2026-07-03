'use client';

import { useCallback } from 'react';
import { toast } from '@/lib/toast';
import { useWalletSwitch } from './useWalletSwitch';
import type { L1ListItem } from '../stores/l1ListStore';

interface UseChainSwitchResult {
  /**
   * Switch the wallet to the given L1. Falls back to
   * `wallet_addEthereumChain` if the chain isn't already in the wallet.
   * Returns true on success.
   *
   * On terminal failure, a single toast is shown (deduped at the
   * underlying `safelySwitchOrAdd` layer). Caller can ignore the bool
   * and just await — the error UX is handled here.
   */
  switchTo: (l1: L1ListItem) => Promise<boolean>;
  /**
   * Lower-level: switch by chainId only when you don't have the full
   * L1ListItem in scope. Used by the wallet-only paths (header network
   * picker, balance refresh on chain change). Doesn't add unknown chains.
   */
  switchById: (chainId: number, testnet: boolean) => Promise<void>;
}

/**
 * Single entry point for wallet chain switches. Consolidates what was
 * previously split across three helpers:
 *
 *   - `useWalletSwitch.safelySwitch`           — chainId-only, no add fallback
 *   - `useWalletSwitch.safelySwitchOrAdd`      — full L1, add fallback
 *   - `useWallet.switchChain` / `switchChainOrAdd` — thin re-exports
 *
 * New code should use `useChainSwitch().switchTo(l1)` for any path where
 * the L1 may not be in the wallet yet (ICTT phase gates, dashboard "Add
 * to Wallet" actions). Legacy chainId-only paths get `switchById`.
 */
export function useChainSwitch(): UseChainSwitchResult {
  const { safelySwitch, safelySwitchOrAdd } = useWalletSwitch();

  const switchTo = useCallback(
    async (l1: L1ListItem): Promise<boolean> => {
      try {
        return await safelySwitchOrAdd(l1);
      } catch (err) {
        // safelySwitchOrAdd toasts internally; this is the absolute
        // fallback for unexpected exceptions outside its try/catch.
        toast.error(`Couldn't switch to ${l1.name}`, err instanceof Error ? err.message : 'Unknown wallet error');
        return false;
      }
    },
    [safelySwitchOrAdd],
  );

  const switchById = useCallback(
    async (chainId: number, testnet: boolean) => {
      await safelySwitch(chainId, testnet);
    },
    [safelySwitch],
  );

  return { switchTo, switchById };
}
