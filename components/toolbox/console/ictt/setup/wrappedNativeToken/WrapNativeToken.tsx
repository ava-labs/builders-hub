"use client";

import WrappedNativeToken from "@/contracts/icm-contracts/compiled/WrappedNativeToken.json";
import { useWalletStore, useWrappedNativeToken, useNativeCurrencyInfo } from "@/components/toolbox/stores/walletStore";
import { useViemChainStore } from "@/components/toolbox/stores/toolboxStore";
import { useState, useEffect } from "react";
import { Button } from "@/components/toolbox/components/Button";
import { http, createPublicClient, parseEther } from "viem";
import { Input } from "@/components/toolbox/components/Input";

interface WrapNativeTokenProps {
    wrappedNativeTokenAddress: string;
    onError: (error: Error) => void;
}

export default function WrapNativeToken({ wrappedNativeTokenAddress, onError }: WrapNativeTokenProps) {
    const { coreWalletClient, walletEVMAddress, walletChainId, setWrappedNativeToken, setNativeCurrencyInfo } = useWalletStore();
    const viemChain = useViemChainStore();
    
    // Get cached values from wallet store
    const cachedWrappedToken = useWrappedNativeToken();
    const cachedNativeCurrency = useNativeCurrencyInfo();

    // Wrap state
    const [wrapAmount, setWrapAmount] = useState('');
    const [isWrapping, setIsWrapping] = useState(false);
    
    // Get native token symbol (use cached value if available)
    const nativeTokenSymbol = cachedNativeCurrency?.symbol || viemChain?.nativeCurrency?.symbol || 'COIN';

    // Cache currency info and token address on mount
    useEffect(() => {
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
    }, [viemChain, walletEVMAddress, wrappedNativeTokenAddress, walletChainId, cachedWrappedToken, cachedNativeCurrency, setWrappedNativeToken, setNativeCurrencyInfo]);

    async function handleWrap() {
        if (!coreWalletClient || !wrappedNativeTokenAddress) {
            onError(new Error('Core wallet or wrapped token not found'));
            return;
        }

        setIsWrapping(true);
        try {
            if (!viemChain) throw new Error("No chain selected");

            const publicClient = createPublicClient({
                transport: http(viemChain.rpcUrls.default.http[0] || "")
            });

            const hash = await coreWalletClient.writeContract({
                address: wrappedNativeTokenAddress as `0x${string}`,
                abi: WrappedNativeToken.abi,
                functionName: 'deposit',
                value: parseEther(wrapAmount),
                chain: viemChain,
                account: walletEVMAddress as `0x${string}`
            });

            await publicClient.waitForTransactionReceipt({ hash });

            setWrapAmount('');
        } catch (error) {
            onError(error instanceof Error ? error : new Error(String(error)));
        } finally {
            setIsWrapping(false);
        }
    }

    return (
        <div className="space-y-4">
            <Input
                label="Amount to Wrap"
                value={wrapAmount}
                onChange={setWrapAmount}
                placeholder="0.0"
                type="number"
                step="0.01"
            />
            <Button
                variant="primary"
                onClick={handleWrap}
                loading={isWrapping}
                disabled={isWrapping || !wrapAmount || parseFloat(wrapAmount) <= 0}
            >
                Wrap {nativeTokenSymbol}
            </Button>
        </div>
    );
}
