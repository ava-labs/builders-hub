import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { networkIDs } from '@avalabs/avalanchejs';
import { useChainTokenTracker } from '@/hooks/useChainTokenTracker';
import { useL1List, type L1ListItem } from '@/components/toolbox/stores/l1ListStore';
import { useAccount, useSwitchChain } from 'wagmi';

export function useNetworkActions() {
  const {
    updateL1Balance,
    updateCChainBalance,
    updateAllBalances,
    setAvalancheNetworkID,
    setIsTestnet,
    setSelectedToken,
    setWalletChainId,
    isTestnet,
    walletEVMAddress,
    balances,
  } = useWalletStore();

  const l1List = useL1List();
  const { markChainAsNeeded } = useChainTokenTracker();
  const { switchChainAsync } = useSwitchChain();
  const { connector } = useAccount();

  const handleNetworkChange = async (network: any, tokenAddress?: string | null) => {
    // Set the selected token
    setSelectedToken(tokenAddress !== undefined ? tokenAddress : null);
    try {
      if (network.isTestnet !== isTestnet) {
        setIsTestnet(network.isTestnet);
        setAvalancheNetworkID(network.isTestnet ? networkIDs.FujiID : networkIDs.MainnetID);
      }

      if (network.evmChainId) {
        // EVM wallet path: works for all wallets (Core, MetaMask, Rabby, WalletConnect, etc.)
        // First try wagmi (works for chains in config: C-Chain, Fuji).
        // If that fails, fall back to raw EIP-1193 provider calls so
        // custom L1 networks can be added/switched to dynamically.
        try {
          await switchChainAsync({ chainId: network.evmChainId });
        } catch (switchError) {
          // wagmi failed (chain not in static config) — use raw EIP-1193 provider
          console.debug('wagmi switchChain failed, trying raw provider:', switchError);
          const provider = (await connector?.getProvider?.()) as
            | { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> }
            | undefined;
          if (!provider?.request) {
            console.debug('No EIP-1193 provider available for chain switch');
            return;
          }
          const chainIdHex = `0x${network.evmChainId.toString(16)}`;
          try {
            await provider.request({
              method: 'wallet_switchEthereumChain',
              params: [{ chainId: chainIdHex }],
            });
          } catch (rawSwitchError: any) {
            if (rawSwitchError?.code === 4902 || rawSwitchError?.message?.includes('Unrecognized chain')) {
              try {
                await provider.request({
                  method: 'wallet_addEthereumChain',
                  params: [
                    {
                      chainId: chainIdHex,
                      chainName: network.name,
                      nativeCurrency: {
                        name: network.coinName || network.name,
                        symbol: network.coinName || 'ETH',
                        decimals: 18,
                      },
                      rpcUrls: [network.rpcUrl],
                      blockExplorerUrls: network.explorerUrl ? [network.explorerUrl] : undefined,
                      isTestnet: network.isTestnet,
                    },
                  ],
                });
              } catch (addError) {
                console.error('Failed to add chain to wallet:', addError);
                return;
              }
            } else {
              console.debug('Failed to switch chain in wallet:', rawSwitchError);
              return;
            }
          }
          // Raw provider switch succeeded but wagmi won't see chains
          // outside its static config, so manually sync Zustand store.
          setWalletChainId(network.evmChainId);
        }

        // Determine if this is C-Chain for appropriate balance update
        const isCChain = network.evmChainId === 43114 || network.evmChainId === 43113;

        setTimeout(() => {
          if (isCChain) {
            updateCChainBalance();
          } else {
            updateL1Balance(network.evmChainId.toString());
          }
        }, 800);
      }
    } catch (error) {
      console.error('Failed to switch network:', error);
    }
  };

  const copyAddress = async () => {
    if (walletEVMAddress) await navigator.clipboard.writeText(walletEVMAddress);
  };

  const openExplorer = (explorerUrl: string) => {
    if (explorerUrl && walletEVMAddress) {
      window.open(explorerUrl + '/address/' + walletEVMAddress, '_blank');
    }
  };

  return {
    handleNetworkChange,
    copyAddress,
    openExplorer,
    updateAllBalances,
  };
}
