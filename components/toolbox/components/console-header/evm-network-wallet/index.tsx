'use client'

import { useEffect, useState } from 'react'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent } from '@/components/ui/dropdown-menu'
import { useL1ListStore } from '@/components/toolbox/stores/l1ListStore'
import { Button } from '@/components/ui/button'
import { useWalletConnect } from '@/components/toolbox/hooks/useWalletConnect'

import { useNetworkData } from './hooks/useNetworkData'
import { useNetworkActions } from './hooks/useNetworkActions'
import { NetworkList } from './components/NetworkList'
import { NetworkActions } from './components/NetworkActions'
import { WalletInfo } from './components/WalletInfo'
import { ChainLogo } from './components/ChainLogo'

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

  const { connectWallet } = useWalletConnect()

  useEffect(() => {
    const isCoreWalletInjected = (): boolean => (
      typeof window !== 'undefined' && !!window.avalanche?.request
    )

    setIsCoreWalletAvailable(isCoreWalletInjected())
  }, [])

  const handlePrimaryButtonClick = (): void => {
    if (isCoreWalletAvailable) {
      void connectWallet()
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
        <img src="/core-logo-dark.svg" alt="Core logo" className="mr-2 h-4 w-4 object-contain dark:hidden" />
        <img src="/core-logo.svg" alt="Core logo" className="mr-2 h-4 w-4 object-contain hidden dark:block" />
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
              <div className="flex-shrink-0 w-5 h-5 flex items-center justify-start">
                <ChainLogo
                  logoUrl={(currentNetwork as any)?.logoUrl}
                  chainName={currentNetwork.name}
                />
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
