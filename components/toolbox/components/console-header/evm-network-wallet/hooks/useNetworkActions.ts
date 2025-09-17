import { useWalletStore } from '@/components/toolbox/stores/walletStore'
import { networkIDs } from '@avalabs/avalanchejs'

export function useNetworkActions() {
  const {
    updateL1Balance,
    updateCChainBalance,
    updateAllBalances,
    setAvalancheNetworkID,
    setIsTestnet,
    isTestnet,
    walletEVMAddress,
  } = useWalletStore()

  const handleNetworkChange = async (network: any) => {
    try {
      if (network.isTestnet !== isTestnet) {
        setIsTestnet(network.isTestnet)
        setAvalancheNetworkID(
          network.isTestnet ? networkIDs.FujiID : networkIDs.MainnetID
        )
      }

      if (window.avalanche?.request && network.evmChainId) {
        try {
          await window.avalanche.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: `0x${network.evmChainId.toString(16)}` }],
          })

          // Determine if this is C-Chain for appropriate balance update
          const isCChain = network.evmChainId === 43114 || network.evmChainId === 43113
          setTimeout(() => {
            if (isCChain) {
              updateCChainBalance()
            } else {
              updateL1Balance(network.evmChainId.toString())
            }
          }, 800)
        } catch (error) {
          console.debug('Failed to switch chain in wallet:', error)
        }
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
