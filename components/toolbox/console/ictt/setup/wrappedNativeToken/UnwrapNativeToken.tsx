"use client";

import { useWalletStore } from "@/components/toolbox/stores/walletStore";
import { useNativeCurrencyInfo, useSetNativeCurrencyInfo } from "@/components/toolbox/stores/l1ListStore";
import { useViemChainStore } from "@/components/toolbox/stores/toolboxStore";
import { useWrappedNativeToken as useWrappedNativeTokenAddress, useSetWrappedNativeToken } from "@/components/toolbox/stores/l1ListStore";
import { useWrappedNativeToken } from "@/components/toolbox/hooks/useWrappedNativeToken";
import { useState, useEffect } from "react";
import { Button } from "@/components/toolbox/components/Button";
import { Input } from "@/components/toolbox/components/Input";

interface UnwrapNativeTokenProps {
    wrappedNativeTokenAddress: string;
    onError: (error: Error) => void;
}

export default function UnwrapNativeToken({ wrappedNativeTokenAddress, onError }: UnwrapNativeTokenProps) {
    const { walletEVMAddress, walletChainId } = useWalletStore();
    const setNativeCurrencyInfo = useSetNativeCurrencyInfo();
    const viemChain = useViemChainStore();
    const setWrappedNativeToken = useSetWrappedNativeToken();
    const wrappedNativeToken = useWrappedNativeToken();
    
    // Get cached values from wallet store
    const cachedWrappedToken = useWrappedNativeTokenAddress();
    const cachedNativeCurrency = useNativeCurrencyInfo();

    // Unwrap state
    const [unwrapAmount, setUnwrapAmount] = useState('');
    const [isUnwrapping, setIsUnwrapping] = useState(false);
    
    // Get token symbols (use cached value if available)
    const nativeTokenSymbol = cachedNativeCurrency?.symbol || viemChain?.nativeCurrency?.symbol || 'COIN';
    const wrappedTokenSymbol = `W${nativeTokenSymbol}`;

    // Cache currency info and token address on mount
    useEffect(() => {
        if (!viemChain || !walletEVMAddress || !wrappedNativeTokenAddress) return;

        const chainIdStr = walletChainId.toString();
        
        // Cache native currency info if not already cached
        if (!cachedNativeCurrency && viemChain.nativeCurrency) {
            setNativeCurrencyInfo(walletChainId, viemChain.nativeCurrency);
        }
        
        // Cache the token address if we found one
        if (wrappedNativeTokenAddress && !cachedWrappedToken) {
            setWrappedNativeToken(wrappedNativeTokenAddress);
        }
    }, [viemChain, walletEVMAddress, wrappedNativeTokenAddress, walletChainId, cachedWrappedToken, cachedNativeCurrency, setWrappedNativeToken, setNativeCurrencyInfo]);

    async function handleUnwrap() {
        if (!wrappedNativeToken.isReady) {
            onError(new Error('Wrapped native token contract not ready'));
            return;
        }

        setIsUnwrapping(true);
        try {
            const hash = await wrappedNativeToken.withdraw(unwrapAmount);
            await wrappedNativeToken.publicClient.waitForTransactionReceipt({ hash });
            setUnwrapAmount('');
        } catch (error) {
            onError(error instanceof Error ? error : new Error(String(error)));
        } finally {
            setIsUnwrapping(false);
        }
    }

    return (
        <div className="space-y-4">
            <Input
                label="Amount to Unwrap"
                value={unwrapAmount}
                onChange={setUnwrapAmount}
                placeholder="0.0"
                type="number"
                step="0.01"
            />
            <Button
                variant="primary"
                onClick={handleUnwrap}
                loading={isUnwrapping}
                disabled={isUnwrapping || !unwrapAmount || parseFloat(unwrapAmount) <= 0}
            >
                Unwrap {wrappedTokenSymbol}
            </Button>
        </div>
    );
}