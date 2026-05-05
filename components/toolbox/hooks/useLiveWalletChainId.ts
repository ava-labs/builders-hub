'use client';

import { useEffect, useState } from 'react';

type Eip1193Provider = {
  request?: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, listener: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, listener: (...args: unknown[]) => void) => void;
};

function parseChainId(value: unknown): number | null {
  const parsed = typeof value === 'string' ? Number.parseInt(value, 16) : Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function getWalletProviders(): Eip1193Provider[] {
  if (typeof window === 'undefined') return [];

  const providers: Eip1193Provider[] = [];
  const avalanche = (window as any).avalanche as Eip1193Provider | undefined;
  const ethereum = (window as any).ethereum as Eip1193Provider | undefined;

  if (avalanche) providers.push(avalanche);
  if (ethereum && ethereum !== avalanche) providers.push(ethereum);

  return providers;
}

export async function readLiveWalletChainId(): Promise<number | null> {
  const provider = getWalletProviders().find((p) => typeof p.request === 'function');
  if (!provider?.request) return null;

  try {
    return parseChainId(await provider.request({ method: 'eth_chainId' }));
  } catch {
    return null;
  }
}

export function useLiveWalletChainId(refreshKey?: unknown): number | null {
  const [liveChainId, setLiveChainId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    const refresh = () => {
      readLiveWalletChainId().then((chainId) => {
        if (!cancelled) setLiveChainId(chainId);
      });
    };

    refresh();

    const providers = getWalletProviders();
    providers.forEach((provider) => provider.on?.('chainChanged', refresh));

    return () => {
      cancelled = true;
      providers.forEach((provider) => provider.removeListener?.('chainChanged', refresh));
    };
  }, [refreshKey]);

  return liveChainId;
}
