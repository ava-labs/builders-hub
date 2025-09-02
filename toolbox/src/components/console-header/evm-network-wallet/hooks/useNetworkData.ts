import { useEffect, useMemo } from 'react'
import { useWalletAddress, useBalances, useNetworkInfo, useWalletStore } from '@/stores/walletStore'
import { useL1List } from '@/stores/l1ListStore'
import { avalanche, avalancheFuji } from 'viem/chains'
import { balanceService } from '@/services/balanceService'
import { L1ListItem } from '@/stores/l1ListStore'

export function useNetworkData() {
  // Use performance selectors for better performance
  const walletEVMAddress = useWalletAddress()
  const balances = useBalances()
  const { isTestnet, chainId: walletChainId } = useNetworkInfo()
  const l1Balances = useWalletStore((state) => state.balances.l1Chains)
  
  // Extract individual balance values for backward compatibility
  const { cChain: cChainBalance } = balances

  const l1List = useL1List()

  // Update all L1 balances when l1List changes or wallet connects
  useEffect(() => {
    if (walletEVMAddress && l1List && l1List.length > 0) {
      // Update balances for all L1s using the balance service
      balanceService.updateAllBalancesWithAllL1s(l1List)
    }
  }, [l1List, walletEVMAddress])

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
    let currentNet = (l1List || []).find((net: L1ListItem) => net.evmChainId === walletChainId)
    
    // If wallet is connected but we don't have a proper chainId or network found,
    // default to C-Chain to avoid showing "No Network" during account switching
    if (!currentNet || !walletChainId || walletChainId === 0) {
      currentNet = (l1List || []).find((net: L1ListItem) => 
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
    const balance = isCChain ? cChainBalance : (l1Balances[currentNet.evmChainId.toString()] || 0)

    return {
      ...currentNet,
      balance,
    }
  }, [l1List, walletChainId, isTestnet, cChainBalance, l1Balances, walletEVMAddress])

  const getNetworkBalance = (network: (typeof l1List)[0]) => {
    const isCChain = network.evmChainId === avalanche.id || network.evmChainId === avalancheFuji.id
    
    if (isCChain) {
      return cChainBalance
    } else {
      return l1Balances[network.evmChainId.toString()] || 0
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
