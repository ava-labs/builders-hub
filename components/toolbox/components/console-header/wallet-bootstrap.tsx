'use client'

import { useEffect } from 'react'
import { useWalletStore } from '@/components/toolbox/stores/walletStore'
import { createCoreWalletClient } from '@/components/toolbox/coreViem'
import { networkIDs } from '@avalabs/avalanchejs'

export function WalletBootstrap() {
  const setCoreWalletClient = useWalletStore((s) => s.setCoreWalletClient)
  const setWalletEVMAddress = useWalletStore((s) => s.setWalletEVMAddress)
  const setWalletChainId = useWalletStore((s) => s.setWalletChainId)
  const setPChainAddress = useWalletStore((s) => s.setPChainAddress)
  const setCoreEthAddress = useWalletStore((s) => s.setCoreEthAddress)
  const setIsTestnet = useWalletStore((s) => s.setIsTestnet)
  const setAvalancheNetworkID = useWalletStore((s) => s.setAvalancheNetworkID)
  const setEvmChainName = useWalletStore((s) => s.setEvmChainName)
  const updateAllBalances = useWalletStore((s) => s.updateAllBalances)
  const setBootstrapped = useWalletStore((s) => s.setBootstrapped)

  useEffect(() => {
    if (typeof window === 'undefined' || !window.avalanche) return

    const onChainChanged = (chainId: string | number) => {
      const numericId = typeof chainId === 'string' ? Number.parseInt(chainId, 16) : chainId
      setWalletChainId(numericId)

      // Update network metadata
      try {
        // @ts-ignore
        const client = createCoreWalletClient(useWalletStore.getState().walletEVMAddress as any)
        if (client) {
          client.getEthereumChain().then((data: { isTestnet: boolean; chainName: string }) => {
            const { isTestnet, chainName } = data
            setAvalancheNetworkID(isTestnet ? networkIDs.FujiID : networkIDs.MainnetID)
            setIsTestnet(isTestnet)
            setEvmChainName(chainName)
          }).catch(() => { })
        }
      } catch { }

      // Refresh balances after chain switches
      try { updateAllBalances() } catch { }
    }

    const handleAccountsChanged = async (accounts: string[]) => {
      if (!accounts || accounts.length === 0) {
        // Wallet is locked or disconnected - clear all wallet state
        setWalletEVMAddress('')
        setPChainAddress('')
        setCoreEthAddress('')
        setWalletChainId(0)
        // Keep network settings (isTestnet, avalancheNetworkID) as they are user preferences
        return
      }
      if (accounts.length > 1) {
        // Not supported; pick first for now
        accounts = [accounts[0]]
      }

      const account = accounts[0] as `0x${string}`
      const client = createCoreWalletClient(account)
      if (!client) return

      setCoreWalletClient(client)
      setWalletEVMAddress(account)

      try {
        const [pAddr, cAddr, chainInfo, chainId] = await Promise.all([
          client.getPChainAddress().catch(() => ''),
          client.getCorethAddress().catch(() => ''),
          client.getEthereumChain().catch(() => ({ isTestnet: undefined as any, chainName: '' } as any)),
          client.getChainId().catch(() => 0),
        ])
        if (pAddr) setPChainAddress(pAddr)
        if (cAddr) setCoreEthAddress(cAddr)
        if (chainId) {
          const numericId = typeof chainId === 'string' ? parseInt(chainId as any, 16) : chainId
          setWalletChainId(numericId)
        }
        if (typeof chainInfo?.isTestnet === 'boolean') {
          setIsTestnet(chainInfo.isTestnet)
          setAvalancheNetworkID(chainInfo.isTestnet ? networkIDs.FujiID : networkIDs.MainnetID)
          setEvmChainName(chainInfo.chainName)
        }
      } catch { }

      // Initial balance refresh after restoring the session
      try { updateAllBalances() } catch { }
    }

    try {
      setBootstrapped(true)

      if (window.avalanche.on) {
        window.avalanche.on('accountsChanged', handleAccountsChanged)
        window.avalanche.on('chainChanged', onChainChanged)
      }

      if (window.avalanche.request) {
        window.avalanche.request<string[]>({ method: 'eth_accounts' })
          .then(handleAccountsChanged)
          .catch(() => { })
      }
    } catch { }

    return () => {
      try {
        if (window.avalanche?.removeListener) {
          window.avalanche.removeListener('accountsChanged', handleAccountsChanged as any)
          window.avalanche.removeListener('chainChanged', onChainChanged as any)
        }
      } catch { }
    }
  }, [setCoreWalletClient, setWalletEVMAddress, setWalletChainId, setPChainAddress, setCoreEthAddress, setIsTestnet, setAvalancheNetworkID, setEvmChainName, updateAllBalances])

  return null
}

