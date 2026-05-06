'use client';

import { useEffect, useState } from 'react';
import { useAccount } from 'wagmi';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import {
  type Eip1193Provider,
  parseProviderChainId,
  readWalletProviderChainId,
  resolveActiveWalletProvider,
} from '@/components/toolbox/lib/walletProvider';

export type { Eip1193Provider };

type UseActiveWalletProviderOptions = {
  enabled?: boolean;
  refreshKey?: unknown;
};

type UseLiveWalletChainIdOptions = {
  provider?: Eip1193Provider | null;
  enabled?: boolean;
  refreshKey?: unknown;
};

export function useActiveWalletProvider({
  enabled = true,
  refreshKey,
}: UseActiveWalletProviderOptions = {}): Eip1193Provider | null {
  const { connector, isConnected } = useAccount();
  const walletType = useWalletStore((s) => s.walletType);
  const [provider, setProvider] = useState<Eip1193Provider | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (!enabled || !isConnected) {
      setProvider(null);
      return () => {
        cancelled = true;
      };
    }

    resolveActiveWalletProvider({ connector, walletType }).then((resolvedProvider) => {
      if (!cancelled) setProvider(resolvedProvider);
    });

    return () => {
      cancelled = true;
    };
  }, [connector, enabled, isConnected, walletType, refreshKey]);

  return provider;
}

export const readLiveWalletChainId = readWalletProviderChainId;

export function useLiveWalletChainId({ provider, enabled = true, refreshKey }: UseLiveWalletChainIdOptions = {}):
  | number
  | null {
  const [liveChainId, setLiveChainId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (!enabled || !provider?.request) {
      setLiveChainId(null);
      return () => {
        cancelled = true;
      };
    }

    const refresh = () => {
      readLiveWalletChainId(provider).then((chainId) => {
        if (!cancelled) setLiveChainId(chainId);
      });
    };

    const handleChainChanged = (chainId: unknown) => {
      const parsed = parseProviderChainId(chainId);
      if (!cancelled) setLiveChainId(parsed);
    };

    refresh();

    provider.on?.('chainChanged', handleChainChanged);

    return () => {
      cancelled = true;
      provider.removeListener?.('chainChanged', handleChainChanged);
    };
  }, [provider, enabled, refreshKey]);

  return liveChainId;
}
