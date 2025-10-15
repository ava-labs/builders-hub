"use client";

import { useWalletStore } from "@/components/toolbox/stores/walletStore";
import { useNativeCurrencyInfo, useSetNativeCurrencyInfo } from "@/components/toolbox/stores/l1ListStore";
import { useViemChainStore } from "@/components/toolbox/stores/toolboxStore";
import { useWrappedNativeToken as useWrappedNativeTokenAddress, useSetWrappedNativeToken } from "@/components/toolbox/stores/l1ListStore";
import { useWrappedNativeToken } from "@/components/toolbox/hooks/useWrappedNativeToken";
import { useState, useEffect } from "react";

interface DisplayWrappedBalanceProps {
    wrappedNativeTokenAddress: string;
    onError: (error: Error) => void;
}

export default function DisplayWrappedBalance({ wrappedNativeTokenAddress, onError }: DisplayWrappedBalanceProps) {
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

    // Fetch wrapped token balance
    const fetchWrappedBalance = async () => {
        if (!wrappedNativeToken.isReady || !walletEVMAddress) return;

        setIsLoading(true);
        try {
            const chainIdStr = walletChainId.toString();
            
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
            onError(error instanceof Error ? error : new Error(String(error)));
        } finally {
            setIsLoading(false);
        }
    };

    // Fetch balance on mount and when dependencies change
    useEffect(() => {
        fetchWrappedBalance();
    }, [viemChain, walletEVMAddress, wrappedNativeTokenAddress, walletChainId, cachedWrappedToken, cachedNativeCurrency]);

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