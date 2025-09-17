import { useWalletStore } from '../stores/walletStore';
import { useWalletSwitch } from './useWalletSwitch';
import type { AddChainOptions, AddChainResult } from '@/types/wallet';
import { useModalTrigger } from './useModal';
import { toast } from '@/lib/toast';

export function useWallet() {
    const walletStore = useWalletStore();
    const { safelySwitch } = useWalletSwitch();
    const { openModal } = useModalTrigger<AddChainResult>();

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
        // Client exported for convenience and standardization
        client: walletStore.coreWalletClient,
        // TODO: avalanche-sdk
    };
}
