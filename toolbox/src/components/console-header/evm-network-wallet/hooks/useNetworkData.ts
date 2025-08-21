import { useState, useEffect, useMemo } from 'react'
import { useWalletStore } from '@/stores/walletStore'
import { useSelectedL1, useL1ListStore } from '@/stores/l1ListStore'
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

  const selectedL1 = useSelectedL1()()
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

  // Available networks for selection - filtered by current testnet/mainnet mode
  const availableNetworks = useMemo(() => {
    const allNetworks = [
      {
        id: 'avalanche-cchain',
        name: 'C-Chain',
        symbol: 'AVAX',
        chainId: isTestnet ? avalancheFuji.id : avalanche.id,
        isTestnet: !!isTestnet,
        color: 'bg-red-500',
        type: 'avalanche' as const,
        explorerUrl: isTestnet
          ? 'https://subnets-test.avax.network/c-chain'
          : 'https://subnets.avax.network/c-chain',
        logoUrl:
          'https://images.ctfassets.net/gcj8jwzm6086/5VHupNKwnDYJvqMENeV7iJ/3e4b8ff10b69bfa31e70080a4b142cd0/avalanche-avax-logo.svg',
      },
      // Add L1s from the store if available
      ...(l1List || []).map((l1) => ({
        id: `l1-${l1.evmChainId}`,
        name: l1.name,
        symbol: l1.coinName || 'L1',
        chainId: l1.evmChainId,
        isTestnet: l1.isTestnet,
        color: 'bg-blue-500',
        type: 'l1' as const,
        l1Data: l1,
        logoUrl: l1.logoUrl,
        explorerUrl: l1.explorerUrl,
      })),
    ]

    // Filter L1s to match current mode and avoid duplicating C-Chain
    return allNetworks.filter((network) => {
      if (network.type === 'avalanche') return true
      if (network.type === 'l1') {
        const isCChain =
          network.chainId === avalanche.id || network.chainId === avalancheFuji.id
        if (isCChain) return false
        return network.isTestnet === isTestnet
      }
      return false
    })
  }, [l1List, isTestnet])

  // Determine current network and balance
  const currentNetwork = useMemo(() => {
    // If wallet is connected but chainId is not set yet (during account switching), default to C-Chain
    const isActuallyCChainSelected =
      walletChainId === avalanche.id || walletChainId === avalancheFuji.id

    if (isActuallyCChainSelected) {
      const currentAvalancheNetwork = availableNetworks.find(
        (net) => net.type === 'avalanche' && net.chainId === (isTestnet ? avalancheFuji.id : avalanche.id)
      )
      return {
        ...currentAvalancheNetwork,
        name: 'C-Chain',
        symbol: 'AVAX',
        balance: cChainBalance,
      }
    }

    if (selectedL1) {
      const currentL1Network = availableNetworks.find(
        (net) => net.type === 'l1' && net.l1Data?.evmChainId === selectedL1.evmChainId
      )
      return {
        ...currentL1Network,
        name: selectedL1.name,
        symbol: selectedL1.coinName || 'L1',
        balance: l1Balance,
      }
    }

    // If wallet is connected but we don't have a proper chainId or network selected yet,
    // default to C-Chain to avoid showing "No Network" during account switching
    if (walletEVMAddress && (!walletChainId || walletChainId === 0)) {
      const defaultCChainNetwork = availableNetworks.find(
        (net) => net.type === 'avalanche' && net.chainId === (isTestnet ? avalancheFuji.id : avalanche.id)
      )
      return {
        ...defaultCChainNetwork,
        name: 'C-Chain',
        symbol: 'AVAX',
        balance: cChainBalance,
      }
    }

    // Only show "No Network" if no wallet is connected
    if (!walletEVMAddress) {
      return {
        id: 'no-network',
        name: 'No Network',
        symbol: 'N/A',
        logoUrl: null as any,
        balance: 0,
        color: 'bg-gray-500',
      }
    }

    // For any other case where wallet is connected, default to C-Chain
    const fallbackCChainNetwork = availableNetworks.find(
      (net) => net.type === 'avalanche' && net.chainId === (isTestnet ? avalancheFuji.id : avalanche.id)
    )
    return {
      ...fallbackCChainNetwork,
      name: 'C-Chain',
      symbol: 'AVAX',
      balance: cChainBalance,
    }
  }, [availableNetworks, walletChainId, isTestnet, cChainBalance, selectedL1, l1Balance, walletEVMAddress])

  const getNetworkBalance = (network: (typeof availableNetworks)[0]) => {
    if (network.type === 'avalanche') {
      return cChainBalance
    } else if (network.type === 'l1') {
      // Prefer externally fetched balance for each L1, fallback to current l1Balance if connected
      const ext = externalBalances[network.chainId]
      if (typeof ext !== 'undefined') {
        return ext
      } else if (walletChainId === network.chainId) {
        return l1Balance
      } else {
        return 0
      }
    }
    return 0
  }

  const isNetworkActive = (network: (typeof availableNetworks)[0]) => {
    return (
      (network.type === 'avalanche' && network.chainId === walletChainId) ||
      (network.type === 'l1' && selectedL1?.evmChainId === network.chainId)
    )
  }

  return {
    availableNetworks,
    currentNetwork,
    externalBalances,
    getNetworkBalance,
    isNetworkActive,
    walletChainId,
    selectedL1,
    isTestnet,
    walletEVMAddress,
  }
}
