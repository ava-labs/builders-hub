"use client";

import { useWalletStore, useNativeCurrencyInfo } from "@/components/toolbox/stores/walletStore";
import { useViemChainStore, useWrappedNativeToken as useWrappedNativeTokenAddress, useSetWrappedNativeToken } from "@/components/toolbox/stores/toolboxStore";
import { useWrappedNativeToken } from "@/components/toolbox/hooks/useWrappedNativeToken";
import { useState, useEffect } from "react";
import { Button } from "@/components/toolbox/components/Button";
import { Input } from "@/components/toolbox/components/Input";

interface WrapNativeTokenProps {
    wrappedNativeTokenAddress: string;
    onError: (error: Error) => void;
}

export default function WrapNativeToken({ wrappedNativeTokenAddress, onError }: WrapNativeTokenProps) {
    const { walletEVMAddress, walletChainId, setNativeCurrencyInfo } = useWalletStore();
    const viemChain = useViemChainStore();
    const setWrappedNativeToken = useSetWrappedNativeToken();
    const wrappedNativeToken = useWrappedNativeToken();
    
    // Get cached values from wallet store
    const cachedWrappedToken = useWrappedNativeTokenAddress();
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
            setWrappedNativeToken(wrappedNativeTokenAddress);
        }
    }, [viemChain, walletEVMAddress, wrappedNativeTokenAddress, walletChainId, cachedWrappedToken, cachedNativeCurrency, setWrappedNativeToken, setNativeCurrencyInfo]);

    async function handleWrap() {
        if (!wrappedNativeToken.isReady) {
            onError(new Error('Wrapped native token contract not ready'));
            return;
        }

        setIsWrapping(true);
        try {
            const hash = await wrappedNativeToken.deposit(wrapAmount);
            await wrappedNativeToken.publicClient.waitForTransactionReceipt({ hash });
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
