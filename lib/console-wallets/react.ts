'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { getAddress } from 'viem';
import { useActiveWalletProvider } from '@/components/toolbox/hooks/useLiveWalletChainId';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { browserSigner, consoleSigner, type ConsoleSigner } from './signer';
import { accountFor, listWallets, subscribe, type WalletInfo } from './vault';

export function useConsoleWallets() {
  const [wallets, setWallets] = useState<WalletInfo[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const load = () =>
      listWallets()
        .then((list) => {
          if (!alive) return;
          setWallets(list);
          setError(null);
        })
        .catch((e) => alive && setError(e instanceof Error ? e.message : String(e)))
        .finally(() => alive && setReady(true));
    void load();
    const off = subscribe(() => void load());
    return () => {
      alive = false;
      off();
    };
  }, []);

  return { wallets, ready, error };
}

/* Which wallet a tool signs with, saved per scope (Studio uses one per project). */

export type SignerChoice = 'browser' | string;
const choiceKey = (scope: string) => `console-wallets:choice:${scope}`;
const choiceListeners = new Set<() => void>();

export function readChoice(scope: string): SignerChoice | null {
  try {
    return localStorage.getItem(choiceKey(scope));
  } catch {
    return null;
  }
}

export function saveChoice(scope: string, choice: SignerChoice | null) {
  try {
    if (choice) localStorage.setItem(choiceKey(scope), choice);
    else localStorage.removeItem(choiceKey(scope));
  } catch {
    /* storage disabled: the choice lasts until reload */
  }
  for (const fn of choiceListeners) fn();
}

export type SignerNeed = 'choose' | 'connect' | 'unlock' | 'mismatch' | null;

/**
 * The signer for a scope. With `pinnedAddress` (a deployment that already has
 * a signer) the wallet is whichever one owns that address, whatever was chosen.
 */
export function useConsoleSigner(scope: string, options: { pinnedAddress?: string | null } = {}) {
  const { wallets, ready } = useConsoleWallets();
  const [choice, setChoice] = useState<SignerChoice | null>(null);
  const browserAddress = useWalletStore((s) => s.walletEVMAddress) || null;
  const provider = useActiveWalletProvider({ enabled: Boolean(browserAddress), refreshKey: browserAddress ?? '' });

  useEffect(() => {
    const sync = () => setChoice(readChoice(scope));
    sync();
    choiceListeners.add(sync);
    window.addEventListener('storage', sync);
    return () => {
      choiceListeners.delete(sync);
      window.removeEventListener('storage', sync);
    };
  }, [scope]);

  const choose = useCallback((next: SignerChoice | null) => saveChoice(scope, next), [scope]);
  const pinned = options.pinnedAddress ? getAddress(options.pinnedAddress) : null;

  return useMemo(() => {
    const byAddress = pinned ? wallets.find((w) => getAddress(w.address) === pinned) : undefined;
    const effective: SignerChoice | null = pinned
      ? (byAddress?.id ?? 'browser')
      : choice === 'browser' || wallets.some((w) => w.id === choice)
        ? choice
        : null;
    const wallet = effective && effective !== 'browser' ? wallets.find((w) => w.id === effective) : undefined;

    let signer: ConsoleSigner | null = null;
    let needs: SignerNeed = null;
    if (!ready) needs = null;
    else if (!effective) needs = 'choose';
    else if (effective === 'browser') {
      if (!browserAddress || !provider) needs = 'connect';
      else if (pinned && getAddress(browserAddress) !== pinned) needs = 'mismatch';
      else signer = browserSigner(provider, browserAddress);
    } else if (wallet) {
      if (!wallet.unlocked) needs = 'unlock';
      else signer = consoleSigner(wallet.id, wallet.address, () => accountFor(wallet.id));
    }

    return { ready, choice: effective, choose, wallet, wallets, signer, needs, browserAddress, provider, pinned };
  }, [browserAddress, choice, choose, pinned, provider, ready, wallets]);
}

export const NEED_TEXT: Record<Exclude<SignerNeed, null>, string> = {
  choose: 'Choose the wallet that signs, first.',
  connect: 'Connect a wallet from the header. It signs each transaction.',
  unlock: 'Unlock your Console wallet to continue.',
  mismatch:
    'This work is signed by another address. Switch your browser wallet to it, or import its key as a Console wallet.',
};
