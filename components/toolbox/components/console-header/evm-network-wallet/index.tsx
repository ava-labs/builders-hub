'use client'

import { useEffect, useState } from 'react'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent } from '@/components/ui/dropdown-menu'
import { useL1ListStore } from '@/components/toolbox/stores/l1ListStore'
import { Button } from '@/components/ui/button'
import { useWalletStore } from '@/components/toolbox/stores/walletStore'
import { createCoreWalletClient } from '@/components/toolbox/coreViem'
import { networkIDs } from '@avalabs/avalanchejs'

import { useNetworkData } from './hooks/useNetworkData'
import { useNetworkActions } from './hooks/useNetworkActions'
import { NetworkList } from './components/NetworkList'
import { NetworkActions } from './components/NetworkActions'
import { WalletInfo } from './components/WalletInfo'

export function EvmNetworkWallet() {
  const [isEditMode, setIsEditMode] = useState(false)
  const [isCoreWalletAvailable, setIsCoreWalletAvailable] = useState(false)

  const l1ListStore = useL1ListStore()
  const removeL1 = l1ListStore((s: any) => s.removeL1)

  const {
    currentNetwork,
    getNetworkBalance,
    isNetworkActive,
    walletEVMAddress,
  } = useNetworkData()

  const l1List = l1ListStore((s: any) => s.l1List)

  const {
    handleNetworkChange,
    copyAddress,
    openExplorer,
    updateAllBalances,
  } = useNetworkActions()

  // Wallet connection functions
  const {
    setWalletEVMAddress,
    setWalletChainId,
    setPChainAddress,
    setCoreEthAddress,
    setCoreWalletClient,
    setAvalancheNetworkID,
    setIsTestnet,
    setEvmChainName,
  } = useWalletStore()

  const handleConnect = async () => {
    if (typeof window === 'undefined') return

    try {
      if (!window.avalanche?.request) {
        return
      }

      const accounts = await window.avalanche.request<string[]>({
        method: 'eth_requestAccounts',
      })

      if (!accounts || accounts.length === 0) {
        throw new Error('No accounts returned from wallet')
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

      // Initial balance refresh after connecting
      try { updateAllBalances() } catch { }
    } catch (error) {
      console.error('Error connecting wallet:', error)
    }
  }

  useEffect(() => {
    const isCoreWalletInjected = (): boolean => (
      typeof window !== 'undefined' && !!window.avalanche?.request
    )

    setIsCoreWalletAvailable(isCoreWalletInjected())
  }, [])

  const handlePrimaryButtonClick = (): void => {
    if (isCoreWalletAvailable) {
      void handleConnect()
      return
    }
    if (typeof window !== 'undefined') {
      window.open('https://core.app/download', '_blank', 'noopener,noreferrer')
    }
  }

  const handleRemoveNetwork = (network: any) => {
    removeL1(network.id)
  }

  // Show connect wallet button if no wallet is connected
  if (!walletEVMAddress) {
    const buttonLabel = isCoreWalletAvailable ? 'Connect Core Wallet' : 'Download Core Wallet'
    return (
      <Button
        onClick={handlePrimaryButtonClick}
        size="sm"
      >
        <img src="/core-logo-dark.svg" alt="Core logo" className="mr-2 h-4 w-4 object-contain" />
        <span className="text-sm">{buttonLabel}</span>
      </Button>
    )
  }
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 w-5 h-5 rounded-md overflow-hidden flex items-center justify-start">
                {currentNetwork && (currentNetwork as any).logoUrl ? (
                  <img
                    src={(currentNetwork as any).logoUrl}
                    alt={`${currentNetwork.name} logo`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-5 h-5 rounded bg-gray-200" />
                )}
              </div>
              <div className="flex gap-2 items-center">
                <span className="text-sm font-medium leading-none">{currentNetwork.name}</span>
                <span className="text-xs text-muted-foreground leading-none">
                  {typeof currentNetwork.balance === 'string' ? parseFloat(currentNetwork.balance).toFixed(4) : (currentNetwork.balance || 0).toFixed(4)} {(currentNetwork as any).coinName}
                </span>
              </div>
            </div>
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-60">
          <NetworkList
            availableNetworks={l1List || []}
            getNetworkBalance={getNetworkBalance}
            isNetworkActive={isNetworkActive}
            onNetworkSelect={handleNetworkChange}
            onNetworkRemove={handleRemoveNetwork}
            isEditMode={isEditMode}
          />

          <NetworkActions
            isEditMode={isEditMode}
            onToggleEditMode={() => setIsEditMode((v) => !v)}
          />

          <WalletInfo
            walletAddress={walletEVMAddress || ''}
            currentNetworkExplorerUrl={(currentNetwork as any)?.explorerUrl}
            currentNetwork={currentNetwork as any}
            onCopyAddress={copyAddress}
            onRefreshBalances={updateAllBalances}
            onOpenExplorer={openExplorer}
          />
        </DropdownMenuContent>
      </DropdownMenu>

    </>
  )
}

export default EvmNetworkWallet
