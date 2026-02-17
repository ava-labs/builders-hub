'use client'

import { useEffect, useRef } from 'react'
import { useAccount, useChainId } from 'wagmi'
import { useWalletStore } from '@/components/toolbox/stores/walletStore'
import { createCoreWalletClient } from '@/components/toolbox/coreViem'
import { networkIDs } from '@avalabs/avalanchejs'

/**
 * Invisible component that bridges wagmi/RainbowKit state into the
 * existing Zustand walletStore. All 145+ downstream consumers read
 * from the store and remain completely unchanged.
 *
 * Core detection: if the connected wagmi connector is Core Wallet
 * (EIP-6963 rdns = "app.core"), we instantiate the full
 * CoreWalletClient for P-Chain operations. Otherwise we set
 * walletType = 'generic-evm' and null out the Core client.
 */
export function WalletSync() {
  const { address, connector, isConnected } = useAccount()
  const chainId = useChainId()

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
  const setWalletType = useWalletStore((s) => s.setWalletType)

  // Track previous address to detect actual changes
  const prevAddressRef = useRef<string | undefined>(undefined)
  const prevChainIdRef = useRef<number | undefined>(undefined)

  /**
   * Determine if the connected wallet is Core.
   * EIP-6963 connectors expose `connector.id` matching the wallet's rdns.
   * Core Wallet uses "app.core". We also check for window.avalanche as fallback
   * for the injected connector case (no EIP-6963).
   */
  const isCoreConnector = (
    connector?.id === 'app.core' ||
    (connector?.type === 'injected' && typeof window !== 'undefined' && !!window.avalanche)
  )

  // Sync connection state → Zustand store
  useEffect(() => {
    if (!isConnected || !address) {
      // Disconnected — clear all wallet state
      if (prevAddressRef.current) {
        setWalletEVMAddress('')
        setPChainAddress('')
        setCoreEthAddress('')
        setWalletChainId(0)
        setCoreWalletClient(null)
        setWalletType(null)
        setBootstrapped(false)
        prevAddressRef.current = undefined
        prevChainIdRef.current = undefined
      }
      return
    }

    const addressChanged = address !== prevAddressRef.current
    prevAddressRef.current = address

    const hexAddress = address as `0x${string}`

    setBootstrapped(true)
    setWalletEVMAddress(hexAddress)

    if (isCoreConnector) {
      // --- Core Wallet path ---
      setWalletType('core')

      if (addressChanged) {
        // Full Core bootstrap: create client, fetch P-Chain address, chain info
        ;(async () => {
          try {
            const client = await createCoreWalletClient(hexAddress)
            if (!client) return

            setCoreWalletClient(client)

            const [pAddr, cAddr, chainInfo, coreChainId] = await Promise.all([
              client.getPChainAddress().catch(() => ''),
              client.getCorethAddress().catch(() => ''),
              client.getEthereumChain().catch(() => ({ isTestnet: undefined as any, chainName: '' } as any)),
              client.getChainId().catch(() => 0),
            ])

            if (pAddr) setPChainAddress(pAddr)
            if (cAddr) setCoreEthAddress(cAddr)
            if (coreChainId) {
              const numId = typeof coreChainId === 'string' ? parseInt(coreChainId as any, 16) : coreChainId
              setWalletChainId(numId)
            }
            if (typeof chainInfo?.isTestnet === 'boolean') {
              setIsTestnet(chainInfo.isTestnet)
              setAvalancheNetworkID(chainInfo.isTestnet ? networkIDs.FujiID : networkIDs.MainnetID)
              setEvmChainName(chainInfo.chainName)
            }
          } catch { /* Core bootstrap failed silently */ }

          try { updateAllBalances() } catch { }
        })()
      }
    } else {
      // --- Generic EVM wallet path (MetaMask, Rabby, WalletConnect, etc.) ---
      setWalletType('generic-evm')
      setCoreWalletClient(null)
      setPChainAddress('')
      setCoreEthAddress('')

      if (addressChanged) {
        try { updateAllBalances() } catch { }
      }
    }
  }, [isConnected, address, isCoreConnector])

  // Sync chain changes → Zustand store
  useEffect(() => {
    if (!isConnected || !chainId) return
    if (chainId === prevChainIdRef.current) return
    prevChainIdRef.current = chainId

    setWalletChainId(chainId)

    if (isCoreConnector) {
      // Re-fetch chain info from Core for accurate testnet/chainName
      ;(async () => {
        try {
          const client = await createCoreWalletClient(
            useWalletStore.getState().walletEVMAddress as `0x${string}`
          )
          if (client) {
            const data = await client.getEthereumChain()
            setIsTestnet(data.isTestnet)
            setAvalancheNetworkID(data.isTestnet ? networkIDs.FujiID : networkIDs.MainnetID)
            setEvmChainName(data.chainName)
          }
        } catch { }

        try { updateAllBalances() } catch { }
      })()
    } else {
      // Derive testnet from well-known Avalanche chain IDs
      const isTestnet = chainId === 43113
      setIsTestnet(isTestnet)
      setAvalancheNetworkID(isTestnet ? networkIDs.FujiID : networkIDs.MainnetID)

      try { updateAllBalances() } catch { }
    }
  }, [chainId, isConnected, isCoreConnector])

  return null
}
