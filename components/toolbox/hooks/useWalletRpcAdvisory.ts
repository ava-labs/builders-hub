'use client';

import { useEffect, useState } from 'react';
import type { Chain } from 'viem';
import { useWalletStore } from '../stores/walletStore';
import { rpcUrlsEquivalent } from '../lib/rpcUrl';

/**
 * Core-only advisory: the RPC URL the WALLET has stored for the current
 * chain, when it differs from the console's URL. Gas estimation and
 * transaction sending run through the wallet's copy, so a divergence is
 * the invisible cause behind "Unable to calculate gas limit" failures.
 *
 * Returns the wallet's URL on a mismatch, null otherwise. Null on MetaMask
 * (no read primitive exists) and whenever the wallet is not switched to
 * the chain in question. Advisory only: never use this for gating.
 */
export function useWalletRpcAdvisory(viemChain: Chain | null | undefined): string | null {
  const walletType = useWalletStore((s) => s.walletType);
  const walletChainId = useWalletStore((s) => s.walletChainId);
  const [mismatchUrl, setMismatchUrl] = useState<string | null>(null);

  const consoleRpcUrl = viemChain?.rpcUrls.default.http[0];
  const chainId = viemChain?.id;

  useEffect(() => {
    setMismatchUrl(null);
    if (walletType !== 'core' || !consoleRpcUrl || !chainId || walletChainId !== chainId) return;
    const provider = (window as { avalanche?: { request?: (args: { method: string }) => Promise<unknown> } }).avalanche;
    if (!provider?.request) return;

    let cancelled = false;
    void provider
      .request({ method: 'wallet_getEthereumChain' })
      .then((walletChain) => {
        if (cancelled) return;
        // Only trust the read when it describes the chain we asked about.
        const rawId = (walletChain as { chainId?: string | number })?.chainId;
        const returnedChainId =
          typeof rawId === 'string' ? parseInt(rawId, 16) : typeof rawId === 'number' ? rawId : null;
        if (returnedChainId !== chainId) return;
        const walletRpcUrl = (walletChain as { rpcUrls?: string[] })?.rpcUrls?.[0];
        if (typeof walletRpcUrl === 'string' && walletRpcUrl && !rpcUrlsEquivalent(walletRpcUrl, consoleRpcUrl)) {
          setMismatchUrl(walletRpcUrl);
        }
      })
      .catch(() => {
        // Advisory only.
      });
    return () => {
      cancelled = true;
    };
  }, [walletType, walletChainId, chainId, consoleRpcUrl]);

  return mismatchUrl;
}
