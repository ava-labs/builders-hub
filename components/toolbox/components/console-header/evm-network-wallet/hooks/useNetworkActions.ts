import { useWalletStore } from '@/components/toolbox/stores/walletStore'
import { networkIDs } from '@avalabs/avalanchejs'
import { useChainTokenTracker } from '@/hooks/useChainTokenTracker'
import { useL1List, type L1ListItem } from '@/components/toolbox/stores/l1ListStore'

export function useNetworkActions() {
  const {
    updateL1Balance,
    updateCChainBalance,
    updateAllBalances,
    setAvalancheNetworkID,
    setIsTestnet,
    setSelectedToken,
    isTestnet,
    walletEVMAddress,
    balances,
  } = useWalletStore()
  
  const l1List = useL1List()
  const { markChainAsNeeded } = useChainTokenTracker()

  const handleNetworkChange = async (network: any, tokenAddress?: string | null) => {
    // Set the selected token
    setSelectedToken(tokenAddress !== undefined ? tokenAddress : null);
    try {
      if (network.isTestnet !== isTestnet) {
        setIsTestnet(network.isTestnet)
        setAvalancheNetworkID(
          network.isTestnet ? networkIDs.FujiID : networkIDs.MainnetID
        )
      }

      if (window.avalanche?.request && network.evmChainId) {
        const chainIdHex = `0x${network.evmChainId.toString(16)}`

        try {
          await window.avalanche.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: chainIdHex }],
          })
        } catch (switchError: any) {
          // Error code 4902 means the chain hasn't been added to the wallet yet
          if (switchError?.code === 4902 || switchError?.message?.includes('Unrecognized chain')) {
            try {
              // Add the chain to the wallet first
              await window.avalanche.request({
                method: 'wallet_addEthereumChain',
                params: [{
                  chainId: chainIdHex,
                  chainName: network.name,
                  nativeCurrency: {
                    name: network.coinName || network.name,
                    symbol: network.coinName || 'ETH',
                    decimals: 18,
                  },
                  rpcUrls: [network.rpcUrl],
                  blockExplorerUrls: network.explorerUrl ? [network.explorerUrl] : undefined,
                }],
              })
            } catch (addError) {
              console.error('Failed to add chain to wallet:', addError)
              return // Exit early if we can't add the chain
            }
          } else {
            console.debug('Failed to switch chain in wallet:', switchError)
            return // Exit early on other errors
          }
        }

        // Determine if this is C-Chain for appropriate balance update
        const isCChain = network.evmChainId === 43114 || network.evmChainId === 43113

        setTimeout(() => {
          if (isCChain) {
            updateCChainBalance()
          } else {
            updateL1Balance(network.evmChainId.toString())
          }
        }, 800)
      }
    } catch (error) {
      console.error('Failed to switch network:', error)
    }
  }

  const copyAddress = async () => {
    if (walletEVMAddress) await navigator.clipboard.writeText(walletEVMAddress)
  }

  const openExplorer = (explorerUrl: string) => {
    if (explorerUrl && walletEVMAddress) {
      window.open(explorerUrl + '/address/' + walletEVMAddress, '_blank')
    }
  }

  return {
    handleNetworkChange,
    copyAddress,
    openExplorer,
    updateAllBalances,
  }
}
