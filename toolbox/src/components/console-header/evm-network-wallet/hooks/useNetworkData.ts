import { useState, useEffect, useMemo } from 'react'
import { useWalletStore } from '@/stores/walletStore'
import { useL1ListStore } from '@/stores/l1ListStore'
import { avalanche, avalancheFuji } from 'viem/chains'
import { createPublicClient, http, formatEther } from 'viem'

export function useNetworkData() {
  const {
    walletChainId,
    isTestnet,
    l1Balance,
    cChainBalance,
    walletEVMAddress,
  } = useWalletStore()

  const l1ListStore = useL1ListStore()
  const l1List = l1ListStore((s) => s.l1List)

  // External per-L1 balances (fetched directly from each L1 RPC)
  const [externalBalances, setExternalBalances] = useState<Record<number, string>>({})

  useEffect(() => {
    let cancelled = false
    async function fetchBalances() {
      if (!walletEVMAddress) return
      const promises = (l1List || []).map(async (l1) => {
        try {
          const client = createPublicClient({ transport: http(l1.rpcUrl) })
          const balance = await client.getBalance({ address: walletEVMAddress as `0x${string}` })
          if (!cancelled) {
            setExternalBalances((prev) => ({ ...prev, [l1.evmChainId]: formatEther(balance) }))
          }
        } catch {}
      })
      await Promise.allSettled(promises)
    }
    fetchBalances()
    return () => {
      cancelled = true
    }
  }, [walletEVMAddress, l1List])

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
      // Prefer externally fetched balance for each L1, fallback to current l1Balance if connected
      const ext = externalBalances[network.evmChainId]
      if (typeof ext !== 'undefined') {
        return ext
      } else if (walletChainId === network.evmChainId) {
        return l1Balance
      } else {
        return 0
      }
    }
  }

  const isNetworkActive = (network: (typeof l1List)[0]) => {
    return network.evmChainId === walletChainId
  }

  return {
    currentNetwork,
    externalBalances,
    getNetworkBalance,
    isNetworkActive,
    walletChainId,
    isTestnet,
    walletEVMAddress,
  }
}
