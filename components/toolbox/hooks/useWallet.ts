import { useWalletStore } from '../stores/walletStore';
import { useWalletSwitch } from './useWalletSwitch';
import type { AddChainOptions, AddChainResult } from '@/types/wallet';
import { useModalTrigger } from './useModal';
import { toast } from '@/lib/toast';
import { useMemo } from 'react';
import { createAvalancheWalletClient } from '@avalanche-sdk/client';
import { avalanche, avalancheFuji } from '@avalanche-sdk/client/chains';
import { useWalletClient } from 'wagmi';
import type { L1ListItem } from '../stores/l1ListStore';

export function useWallet() {
  const walletStore = useWalletStore();
  const { safelySwitch, safelySwitchOrAdd } = useWalletSwitch();
  const { openModal } = useModalTrigger<AddChainResult>();
  const { data: walletClient } = useWalletClient();

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
        type: 'custom',
        provider: window.avalanche!,
      },
      account: walletEVMAddress as `0x${string}`,
    });
  }, [isTestnet, walletEVMAddress]);

  const addChain = async (options?: AddChainOptions): Promise<AddChainResult> => {
    if (!walletClient) {
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

  /**
   * Switch to an L1, adding it to the wallet via `wallet_addEthereumChain`
   * when the cheap switch fails. Use whenever the target L1 may not already
   * be in the user's wallet (e.g. ICTT bridge pickers, phase gate).
   */
  const switchChainOrAdd = async (l1: L1ListItem): Promise<boolean> => {
    return safelySwitchOrAdd(l1);
  };

  return {
    // Actions
    addChain,
    switchChain,
    switchChainOrAdd,
    // Clients exported for convenience and standardization
    client: walletClient ?? null,
    avalancheWalletClient,
  };
}
