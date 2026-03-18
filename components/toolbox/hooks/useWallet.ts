import { useWalletStore } from '../stores/walletStore';
import { useWalletSwitch } from './useWalletSwitch';
import type { AddChainOptions, AddChainResult } from '@/types/wallet';
import { useModalTrigger } from './useModal';
import { toast } from '@/lib/toast';
import { useMemo } from 'react';
import { createAvalancheWalletClient } from "@avalanche-sdk/client";
import { avalanche, avalancheFuji } from "@avalanche-sdk/client/chains";

export function useWallet() {
    const walletStore = useWalletStore();
    const { safelySwitch } = useWalletSwitch();
    const { openModal } = useModalTrigger<AddChainResult>();

    const isTestnet = useWalletStore((s) => s.isTestnet);
    const walletEVMAddress = useWalletStore((s) => s.walletEVMAddress);

    // Create avalanche wallet client based on network and wallet connection
    const avalancheWalletClient = useMemo(() => {
        if (typeof window === 'undefined' || !window?.avalanche || !walletEVMAddress || isTestnet === undefined) {
            return null;
        }
        return createAvalancheWalletClient({
            chain: isTestnet ? avalancheFuji : avalanche,
            transport: {
                type: "custom",
                provider: window.avalanche!,
            },
            account: walletEVMAddress as `0x${string}`
        });
    }, [isTestnet, walletEVMAddress]);

    const addChain = async (options?: AddChainOptions): Promise<AddChainResult> => {
        if (!walletStore.coreWalletClient) {
            toast.error('Wallet not connected', 'Please connect your wallet first');
            return { success: false };
        }

        return openModal(options);
    };


    const switchChain = async (chainId: number, testnet?: boolean) => {
        if (testnet !== undefined) {
            return safelySwitch(chainId, testnet);
        }
        
        // If testnet not specified, try to determine from wallet store
        const isTestnetChain = walletStore.isTestnet ?? false;
        return safelySwitch(chainId, isTestnetChain);
    };

    return {
        // Actions
        addChain,
        switchChain,
        // Clients exported for convenience and standardization
        client: walletStore.coreWalletClient,
        avalancheWalletClient,
    };
}
