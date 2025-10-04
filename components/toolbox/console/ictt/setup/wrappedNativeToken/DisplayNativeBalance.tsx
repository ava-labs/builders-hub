"use client";

import { useWalletStore, useL1Balance, useL1Loading } from "@/components/toolbox/stores/walletStore";
import { useNativeCurrencyInfo, useSetNativeCurrencyInfo } from "@/components/toolbox/stores/l1ListStore";
import { useViemChainStore } from "@/components/toolbox/stores/toolboxStore";
import { useEffect } from "react";

interface DisplayNativeBalanceProps {
    onError: (error: Error) => void;
}

export default function DisplayNativeBalance({ onError }: DisplayNativeBalanceProps) {
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
    }, [cachedNativeCurrency, viemChain?.nativeCurrency, walletChainId, setNativeCurrencyInfo]);

    if (isLoading) {
        return (
            <div className="bg-zinc-50 dark:bg-zinc-900 p-4 rounded-lg">
                <p className="text-sm text-zinc-600 dark:text-zinc-400">Native Balance</p>
                <p className="text-xl font-semibold">Loading...</p>
            </div>
        );
    }

    return (
        <div className="bg-zinc-50 dark:bg-zinc-900 p-4 rounded-lg">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">Native Balance</p>
            <p className="text-xl font-semibold">{nativeBalance.toFixed(4)} {nativeTokenSymbol}</p>
        </div>
    );
}