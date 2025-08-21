import { useMemo } from 'react'
import { useWalletAddress, useBalances, useNetworkInfo } from '@/stores/walletStore'
import { useL1ListStore } from '@/stores/l1ListStore'
import { avalanche, avalancheFuji } from 'viem/chains'


export function useNetworkData() {
  // Use performance selectors for better performance
  const walletEVMAddress = useWalletAddress()
  const balances = useBalances()
  const { isTestnet, chainId: walletChainId } = useNetworkInfo()
  
  // Extract individual balance values for backward compatibility
  const { l1: l1Balance, cChain: cChainBalance } = balances

  const l1ListStore = useL1ListStore()
  const l1List = l1ListStore((s) => s.l1List)

  // Determine current network and balance
  const currentNetwork = useMemo(() => {
    // Only show "No Network" if no wallet is connected
    if (!walletEVMAddress) {
      return {
        id: 'no-network',
        name: 'No Network',
        coinName: 'N/A',
        logoUrl: null as any,
        balance: 0,
      }
    }

    // Find the current network based on wallet chain ID
    let currentNet = (l1List || []).find((net) => net.evmChainId === walletChainId)
    
    // If wallet is connected but we don't have a proper chainId or network found,
    // default to C-Chain to avoid showing "No Network" during account switching
    if (!currentNet || !walletChainId || walletChainId === 0) {
      currentNet = (l1List || []).find((net) => 
        net.evmChainId === (isTestnet ? avalancheFuji.id : avalanche.id)
      )
    }

    if (!currentNet) {
      return {
        id: 'no-network',
        name: 'No Network',
        coinName: 'N/A',
        logoUrl: null as any,
        balance: 0,
      }
    }

    // Determine the appropriate balance based on network type
    const isCChain = currentNet.evmChainId === avalanche.id || currentNet.evmChainId === avalancheFuji.id
    const balance = isCChain ? cChainBalance : l1Balance

    return {
      ...currentNet,
      balance,
    }
  }, [l1List, walletChainId, isTestnet, cChainBalance, l1Balance, walletEVMAddress])

  const getNetworkBalance = (network: (typeof l1List)[0]) => {
    const isCChain = network.evmChainId === avalanche.id || network.evmChainId === avalancheFuji.id
    
    if (isCChain) {
      return cChainBalance
    } else {

        return l1Balance
    }
  }

  const isNetworkActive = (network: (typeof l1List)[0]) => {
    return network.evmChainId === walletChainId
  }

  return {
    currentNetwork,
    getNetworkBalance,
    isNetworkActive,
    walletChainId,
    isTestnet,
    walletEVMAddress,
  }
}
