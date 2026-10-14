'use client';

import { useWalletStore, useL1Balance, useL1Loading } from '@/components/toolbox/stores/walletStore';
import { useNativeCurrencyInfo, useSetNativeCurrencyInfo } from '@/components/toolbox/stores/l1ListStore';
import { useViemChainStore } from '@/components/toolbox/stores/toolboxStore';
import { useEffect } from 'react';

interface DisplayNativeBalanceProps {
  onError: (error: Error) => void;
}

export default function DisplayNativeBalance({ onError: _onError }: DisplayNativeBalanceProps) {
  const { walletChainId } = useWalletStore();
  const setNativeCurrencyInfo = useSetNativeCurrencyInfo();
  const viemChain = useViemChainStore();

  // Get cached values from wallet store
  const cachedNativeCurrency = useNativeCurrencyInfo();

  // Get balance and loading state from wallet store
  const chainIdStr = walletChainId.toString();
  const nativeBalance = useL1Balance(chainIdStr);
  const isLoading = useL1Loading(chainIdStr);

  // Get native token symbol (use cached value if available)
  const nativeTokenSymbol = cachedNativeCurrency?.symbol || viemChain?.nativeCurrency?.symbol || 'COIN';

  // Cache native currency info if not already cached
  useEffect(() => {
    if (!cachedNativeCurrency && viemChain?.nativeCurrency) {
      setNativeCurrencyInfo(walletChainId, viemChain.nativeCurrency);
    }
  }, [cachedNativeCurrency, viemChain?.nativeCurrency, walletChainId]);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-1 bg-white px-4 py-3 dark:bg-zinc-950" aria-busy>
        <p className="font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
          Native balance
        </p>
        <span aria-hidden className="mt-1 block h-5 w-28 animate-pulse bg-zinc-100 dark:bg-zinc-900" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1 bg-white px-4 py-3 dark:bg-zinc-950">
      <p className="font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
        Native balance
      </p>
      <p className="font-mono text-[17px] tabular-nums text-zinc-900 dark:text-zinc-50">
        {nativeBalance === null ? 'Unavailable' : `${nativeBalance.toFixed(4)} ${nativeTokenSymbol}`}
      </p>
    </div>
  );
}
