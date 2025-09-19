"use client";

import { useWalletStore, useNativeCurrencyInfo } from "@/components/toolbox/stores/walletStore";
import { useViemChainStore } from "@/components/toolbox/stores/toolboxStore";
import { useState, useEffect } from "react";
import { balanceService } from "@/components/toolbox/services/balanceService";
import { http, createPublicClient } from "viem";

interface DisplayNativeBalanceProps {
    onError: (error: Error) => void;
}

export default function DisplayNativeBalance({ onError }: DisplayNativeBalanceProps) {
    const { walletEVMAddress, walletChainId, setNativeCurrencyInfo } = useWalletStore();
    const viemChain = useViemChainStore();
    
    // Get cached values from wallet store
    const cachedNativeCurrency = useNativeCurrencyInfo();

    // Balance state
    const [nativeBalance, setNativeBalance] = useState('0');
    const [isLoading, setIsLoading] = useState(false);
    
    // Get native token symbol (use cached value if available)
    const nativeTokenSymbol = cachedNativeCurrency?.symbol || viemChain?.nativeCurrency?.symbol || 'COIN';

    // Fetch native balance
    const fetchNativeBalance = async () => {
        if (!viemChain || !walletEVMAddress) return;

        setIsLoading(true);
        try {
            const chainIdStr = walletChainId.toString();
            
            // Cache native currency info if not already cached
            if (!cachedNativeCurrency && viemChain.nativeCurrency) {
                setNativeCurrencyInfo(chainIdStr, viemChain.nativeCurrency);
            }

            // Use existing balance service for native balance
            const publicClient = createPublicClient({
                transport: http(viemChain.rpcUrls.default.http[0] || "")
            });

            const balance = await balanceService.fetchL1Balance(
                walletChainId,
                walletEVMAddress,
                publicClient
            );
            
            setNativeBalance(balance.toString());
        } catch (error) {
            console.error('Error fetching native balance:', error);
            onError(error instanceof Error ? error : new Error(String(error)));
        } finally {
            setIsLoading(false);
        }
    };

    // Fetch balance on mount and when dependencies change
    useEffect(() => {
        fetchNativeBalance();
    }, [viemChain, walletEVMAddress, walletChainId, cachedNativeCurrency, setNativeCurrencyInfo]);

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
            <p className="text-xl font-semibold">{parseFloat(nativeBalance).toFixed(4)} {nativeTokenSymbol}</p>
        </div>
    );
}