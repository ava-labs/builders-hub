import { useCallback } from 'react';
import { useWalletStore } from '../stores/walletStore';
import { useSwitchChain } from 'wagmi';
import { networkIDs } from '@avalabs/avalanchejs';
import { toast } from '@/lib/toast';
import type { L1ListItem } from '../stores/l1ListStore';

export function useWalletSwitch() {
  // Granular selectors so this hook only re-renders when fields it actually
  // reads change. A full-store destructure (`const { ... } = useWalletStore()`)
  // tore down the memoization below on every unrelated wallet field update,
  // which then handed unstable function references to consumers — e.g. the
  // ICTT RemoteInspector's auto-switch useEffect kept re-firing because
  // `switchChainOrAdd` was a new reference each render.
  const coreWalletClient = useWalletStore((s) => s.coreWalletClient);
  const setWalletChainId = useWalletStore((s) => s.setWalletChainId);
  const setIsTestnet = useWalletStore((s) => s.setIsTestnet);
  const setAvalancheNetworkID = useWalletStore((s) => s.setAvalancheNetworkID);
  const { switchChainAsync } = useSwitchChain();

  const safelySwitch = useCallback(
    async (chainId: number, testnet: boolean) => {
      if (coreWalletClient) {
        try {
          await coreWalletClient.switchChain({ id: chainId });
          setWalletChainId(chainId);
          setIsTestnet(testnet);
          setAvalancheNetworkID(testnet ? networkIDs.FujiID : networkIDs.MainnetID);
        } catch (e) {
          console.warn('switchChain (Core) failed:', e);
        }
        return;
      }

      // Fallback for generic EVM wallets via wagmi
      try {
        await switchChainAsync({ chainId });
        setWalletChainId(chainId);
        setIsTestnet(testnet);
        setAvalancheNetworkID(testnet ? networkIDs.FujiID : networkIDs.MainnetID);
      } catch (e) {
        console.warn('switchChain (wagmi) failed:', e);
      }
    },
    [coreWalletClient, setWalletChainId, setIsTestnet, setAvalancheNetworkID, switchChainAsync],
  );

  /**
   * Switch to an L1, falling back to `wallet_addEthereumChain` when the wallet
   * rejects the switch (most commonly because it hasn't been added yet).
   *
   * Use this from any UI that hands the user a button to "switch to <L1>"
   * where the L1 may or may not already be in the wallet — e.g. the ICTT
   * bridge's chain pickers and phase gate. The plain `safelySwitch` above
   * only switches; it silently fails for unknown chains.
   *
   * Surfaces a `toast.error` if both attempts fail so the user isn't left
   * staring at an unresponsive button.
   */
  const safelySwitchOrAdd = useCallback(
    async (l1: L1ListItem): Promise<boolean> => {
      const sync = () => {
        setWalletChainId(l1.evmChainId);
        setIsTestnet(Boolean(l1.isTestnet));
        setAvalancheNetworkID(l1.isTestnet ? networkIDs.FujiID : networkIDs.MainnetID);
      };

      // Cheap path first: works when the chain is already in the wallet.
      if (coreWalletClient) {
        try {
          await coreWalletClient.switchChain({ id: l1.evmChainId });
          sync();
          return true;
        } catch (switchErr) {
          // Most wallets throw a "chain not added" error here. Try to add it
          // using the L1 metadata, which both adds AND switches in one prompt.
          try {
            await coreWalletClient.request({
              method: 'wallet_addEthereumChain',
              params: [
                {
                  chainId: `0x${l1.evmChainId.toString(16)}`,
                  chainName: l1.name,
                  nativeCurrency: { name: l1.coinName, symbol: l1.coinName, decimals: 18 },
                  rpcUrls: [l1.rpcUrl],
                  // Core's proprietary flag — ignored by other wallets.
                  isTestnet: Boolean(l1.isTestnet),
                },
              ] as never,
            });
            // Some wallets auto-switch on add; call switchChain again to be sure.
            try {
              await coreWalletClient.switchChain({ id: l1.evmChainId });
            } catch {
              // Ignore — wallet may have already switched during the add.
            }
            sync();
            return true;
          } catch (addErr) {
            const msg =
              (addErr instanceof Error && addErr.message) ||
              (switchErr instanceof Error && switchErr.message) ||
              'Unknown wallet error';
            toast.error(`Couldn't switch to ${l1.name}`, msg);
            return false;
          }
        }
      }

      // Generic EVM wallet via wagmi — switchChainAsync handles add-on-demand
      // for chains that are registered in wagmiConfig.
      try {
        await switchChainAsync({ chainId: l1.evmChainId });
        sync();
        return true;
      } catch (e) {
        const msg = (e instanceof Error && e.message) || 'Unknown wallet error';
        toast.error(`Couldn't switch to ${l1.name}`, msg);
        return false;
      }
    },
    [coreWalletClient, setWalletChainId, setIsTestnet, setAvalancheNetworkID, switchChainAsync],
  );

  return {
    safelySwitch,
    safelySwitchOrAdd,
  };
}
