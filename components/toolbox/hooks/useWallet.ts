import { useWalletStore } from '../stores/walletStore';
import { useWalletSwitch } from './useWalletSwitch';
import type { AddChainOptions, AddChainResult } from '@/types/wallet';
import { useModalTrigger } from './useModal';
import { toast } from '@/lib/toast';
import { useCallback, useMemo } from 'react';
import { createAvalancheWalletClient } from '@avalanche-sdk/client';
import { avalanche, avalancheFuji } from '@avalanche-sdk/client/chains';
import { useWalletClient } from 'wagmi';
import type { L1ListItem } from '../stores/l1ListStore';

export function useWallet() {
  // Granular selectors keep this hook from re-rendering (and handing out
  // unstable function identities) whenever some unrelated wallet field
  // changes. The previous `const walletStore = useWalletStore()` destructure
  // was the root cause of `useEffect` deps thrash in `RemoteInspector` and
  // similar inspectors that include `switchChainOrAdd` in their dep arrays.
  const isTestnet = useWalletStore((s) => s.isTestnet);
  const walletEVMAddress = useWalletStore((s) => s.walletEVMAddress);
  const { safelySwitch, safelySwitchOrAdd } = useWalletSwitch();
  const { openModal } = useModalTrigger<AddChainResult>();
  const { data: walletClient } = useWalletClient();

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

  const addChain = useCallback(
    async (options?: AddChainOptions): Promise<AddChainResult> => {
      if (!walletClient) {
        toast.error('Wallet not connected', 'Please connect your wallet first');
        return { success: false };
      }

      return openModal(options);
    },
    [walletClient, openModal],
  );

  const switchChain = useCallback(
    async (chainId: number, testnet?: boolean) => {
      if (testnet !== undefined) {
        return safelySwitch(chainId, testnet);
      }

      // If testnet not specified, try to determine from wallet store
      const isTestnetChain = isTestnet ?? false;
      return safelySwitch(chainId, isTestnetChain);
    },
    [safelySwitch, isTestnet],
  );

  /**
   * Switch to an L1, adding it to the wallet via `wallet_addEthereumChain`
   * when the cheap switch fails. Use whenever the target L1 may not already
   * be in the user's wallet (e.g. ICTT bridge pickers, phase gate).
   */
  const switchChainOrAdd = useCallback(
    async (l1: L1ListItem): Promise<boolean> => {
      return safelySwitchOrAdd(l1);
    },
    [safelySwitchOrAdd],
  );

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
