import { useWalletStore } from '@/stores/walletStore'
import { avalanche, avalancheFuji } from 'viem/chains'
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
      if (network.type === 'avalanche') {
        if (network.isTestnet !== isTestnet) {
          setIsTestnet(network.isTestnet)
          setAvalancheNetworkID(
            network.isTestnet ? networkIDs.FujiID : networkIDs.MainnetID
          )
        }

        if (window.avalanche?.request) {
          await window.avalanche.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: `0x${network.chainId.toString(16)}` }],
          })
          setTimeout(() => updateCChainBalance(), 800)
        }
      } else if (network.type === 'l1' && network.l1Data) {
        if (window.avalanche?.request && network.chainId) {
          try {
            await window.avalanche.request({
              method: 'wallet_switchEthereumChain',
              params: [{ chainId: `0x${network.chainId.toString(16)}` }],
            })
            setTimeout(() => updateL1Balance(), 800)
          } catch (error) {
            console.debug('Failed to switch to L1 chain in wallet:', error)
          }
        }
      }
    } catch (error) {
      console.error('Failed to switch network:', error)
    }
  }

  const handleTestnetToggle = async () => {
    const newIsTestnet = !isTestnet
    setIsTestnet(newIsTestnet)
    setAvalancheNetworkID(newIsTestnet ? networkIDs.FujiID : networkIDs.MainnetID)

    const targetChainId = newIsTestnet ? avalancheFuji.id : avalanche.id
    if (window.avalanche?.request) {
      try {
        await window.avalanche.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: `0x${targetChainId.toString(16)}` }],
        })
        setTimeout(() => updateCChainBalance(), 800)
      } catch (error) {
        console.debug('Failed to switch network in wallet:', error)
      }
    } else {
      updateAllBalances()
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
    handleTestnetToggle,
    copyAddress,
    openExplorer,
    updateAllBalances,
  }
}
