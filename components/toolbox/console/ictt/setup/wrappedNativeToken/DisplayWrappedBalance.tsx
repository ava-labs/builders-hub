"use client";

import { useWalletStore, useWrappedNativeToken, useNativeCurrencyInfo } from "@/components/toolbox/stores/walletStore";
import { useViemChainStore } from "@/components/toolbox/stores/toolboxStore";
import { useState, useEffect } from "react";
import { wrappedTokenBalanceService, WrappedTokenBalanceState } from "@/components/toolbox/services/wrappedTokenBalanceService";

interface DisplayWrappedBalanceProps {
    wrappedNativeTokenAddress: string;
    onError: (error: Error) => void;
}

export default function DisplayWrappedBalance({ wrappedNativeTokenAddress, onError }: DisplayWrappedBalanceProps) {
    const { walletEVMAddress, walletChainId, setWrappedNativeToken, setNativeCurrencyInfo } = useWalletStore();
    const viemChain = useViemChainStore();
    
    // Get cached values from wallet store
    const cachedWrappedToken = useWrappedNativeToken();
    const cachedNativeCurrency = useNativeCurrencyInfo();

    // Balance state
    const [wrappedBalance, setWrappedBalance] = useState('0');
    const [isLoading, setIsLoading] = useState(false);
    
    // Get token symbols (use cached value if available)
    const nativeTokenSymbol = cachedNativeCurrency?.symbol || viemChain?.nativeCurrency?.symbol || 'COIN';
    const wrappedTokenSymbol = `W${nativeTokenSymbol}`;

    // Set up balance service callbacks
    useEffect(() => {
        wrappedTokenBalanceService.setCallbacks({
            setWrappedBalance,
            setLoading: setIsLoading,
            onError
        });
    }, [onError]);

    // Fetch wrapped token balance
    const fetchWrappedBalance = async () => {
        if (!viemChain || !walletEVMAddress || !wrappedNativeTokenAddress) return;

        const chainIdStr = walletChainId.toString();
        
        // Cache native currency info if not already cached
        if (!cachedNativeCurrency && viemChain.nativeCurrency) {
            setNativeCurrencyInfo(chainIdStr, viemChain.nativeCurrency);
        }
        
        // Cache the token address if we found one
        if (wrappedNativeTokenAddress && !cachedWrappedToken) {
            setWrappedNativeToken(chainIdStr, wrappedNativeTokenAddress);
        }

        const state: WrappedTokenBalanceState = {
            walletEVMAddress,
            wrappedNativeTokenAddress,
            viemChain,
            walletChainId
        };

        await wrappedTokenBalanceService.fetchWrappedBalance(state);
    };

    // Fetch balance on mount and when dependencies change
    useEffect(() => {
        fetchWrappedBalance();
    }, [viemChain, walletEVMAddress, wrappedNativeTokenAddress, walletChainId, cachedWrappedToken, cachedNativeCurrency, setWrappedNativeToken, setNativeCurrencyInfo]);

    if (isLoading) {
        return (
            <div className="bg-zinc-50 dark:bg-zinc-900 p-4 rounded-lg">
                <p className="text-sm text-zinc-600 dark:text-zinc-400">Wrapped Balance</p>
                <p className="text-xl font-semibold">Loading...</p>
            </div>
        );
    }

    return (
        <div className="bg-zinc-50 dark:bg-zinc-900 p-4 rounded-lg">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">Wrapped Balance</p>
            <p className="text-xl font-semibold">{parseFloat(wrappedBalance).toFixed(4)} {wrappedTokenSymbol}</p>
        </div>
    );
}