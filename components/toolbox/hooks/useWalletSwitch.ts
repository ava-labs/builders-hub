import { useWalletStore } from '../stores/walletStore';
import { useSwitchChain } from 'wagmi';
import { networkIDs } from '@avalabs/avalanchejs';

export function useWalletSwitch() {
  const { coreWalletClient, setWalletChainId, setIsTestnet, setAvalancheNetworkID } = useWalletStore();
  const { switchChainAsync } = useSwitchChain();

  const safelySwitch = async (chainId: number, testnet: boolean) => {
    if (coreWalletClient) {
      try {
        await coreWalletClient.switchChain({ id: chainId });
        setWalletChainId(chainId);
        setIsTestnet(testnet);
        setAvalancheNetworkID(testnet ? networkIDs.FujiID : networkIDs.MainnetID);
      } catch (e) {
        console.debug('switchChain (Core) failed:', e);
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
      console.debug('switchChain (wagmi) failed:', e);
    }
  };

  return {
    safelySwitch,
  };
}
