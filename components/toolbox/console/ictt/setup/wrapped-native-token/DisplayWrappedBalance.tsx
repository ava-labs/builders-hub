'use client';

import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { useNativeCurrencyInfo, useSetNativeCurrencyInfo } from '@/components/toolbox/stores/l1ListStore';
import { useViemChainStore } from '@/components/toolbox/stores/toolboxStore';
import {
  useWrappedNativeToken as useWrappedNativeTokenAddress,
  useSetWrappedNativeToken,
} from '@/components/toolbox/stores/l1ListStore';
import { useWrappedNativeToken } from '@/components/toolbox/hooks/useWrappedNativeToken';
import { useState, useEffect } from 'react';

interface DisplayWrappedBalanceProps {
  wrappedNativeTokenAddress: string;
  onError: (error: Error) => void;
}

export default function DisplayWrappedBalance({
  wrappedNativeTokenAddress,
  onError: _onError,
}: DisplayWrappedBalanceProps) {
  const { walletEVMAddress, walletChainId } = useWalletStore();
  const setNativeCurrencyInfo = useSetNativeCurrencyInfo();
  const viemChain = useViemChainStore();
  const setWrappedNativeToken = useSetWrappedNativeToken();
  const wrappedNativeToken = useWrappedNativeToken();

  // Get cached values from wallet store
  const cachedWrappedToken = useWrappedNativeTokenAddress();
  const cachedNativeCurrency = useNativeCurrencyInfo();

  // Balance state
  const [wrappedBalance, setWrappedBalance] = useState('0');
  const [isLoading, setIsLoading] = useState(false);

  // Get token symbols (use cached value if available)
  const nativeTokenSymbol = cachedNativeCurrency?.symbol || viemChain?.nativeCurrency?.symbol || 'COIN';
  const wrappedTokenSymbol = `W${nativeTokenSymbol}`;

  // Fetch balance on mount and when dependencies change
  useEffect(() => {
    async function fetchWrappedBalance() {
      if (!wrappedNativeToken.isReady || !walletEVMAddress) return;

      setIsLoading(true);
      try {
        // Cache native currency info if not already cached
        if (!cachedNativeCurrency && viemChain?.nativeCurrency) {
          setNativeCurrencyInfo(walletChainId, viemChain.nativeCurrency);
        }

        // Cache the token address if we found one
        if (wrappedNativeTokenAddress && !cachedWrappedToken) {
          setWrappedNativeToken(wrappedNativeTokenAddress);
        }

        // Use the wrapped native token hook to fetch balance
        const balance = await wrappedNativeToken.balanceOf(walletEVMAddress);
        setWrappedBalance(balance);
      } catch (error) {
        console.error('Error fetching wrapped balance:', error);
        // Don't propagate error to parent - just show 0 balance
        // This handles cases where the contract doesn't exist or is invalid
        setWrappedBalance('0');
      } finally {
        setIsLoading(false);
      }
    }

    fetchWrappedBalance();
  }, [wrappedNativeToken.isReady, walletEVMAddress, viemChain, wrappedNativeTokenAddress, walletChainId]);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-1 bg-white px-4 py-3 dark:bg-zinc-950" aria-busy>
        <p className="font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
          Wrapped balance
        </p>
        <span aria-hidden className="mt-1 block h-5 w-28 animate-pulse bg-zinc-100 dark:bg-zinc-900" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1 bg-white px-4 py-3 dark:bg-zinc-950">
      <p className="font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
        Wrapped balance
      </p>
      <p className="font-mono text-[17px] tabular-nums text-zinc-900 dark:text-zinc-50">
        {parseFloat(wrappedBalance).toFixed(4)} {wrappedTokenSymbol}
      </p>
    </div>
  );
}
