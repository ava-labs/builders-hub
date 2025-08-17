'use client'

import * as React from 'react'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent } from '@/components/ui/dropdown-menu'
import { useL1ListStore } from '@/stores/l1ListStore'
import { AddChainModal } from '@/components/ConnectWallet/AddChainModal'
import { Button } from '@/components/ui/button'
import { Wallet } from 'lucide-react'
import { useWalletStore } from '@/stores/walletStore'
import { createCoreWalletClient } from '@/coreViem'
import { networkIDs } from '@avalabs/avalanchejs'

import { useNetworkData } from './hooks/useNetworkData'
import { useNetworkActions } from './hooks/useNetworkActions'
import { NetworkList } from './components/NetworkList'
import { NetworkActions } from './components/NetworkActions'
import { WalletInfo } from './components/WalletInfo'

export function EvmNetworkWallet() {
  const [isAddNetworkModalOpen, setIsAddNetworkModalOpen] = React.useState(false)

  const l1ListStore = useL1ListStore()
  const addL1 = l1ListStore((s) => s.addL1)

  const {
    availableNetworks,
    currentNetwork,
    getNetworkBalance,
    isNetworkActive,
    walletEVMAddress,
  } = useNetworkData()

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
      } catch {}

      // Initial balance refresh after connecting
      try { updateAllBalances() } catch {}
    } catch (error) {
      console.error('Error connecting wallet:', error)
    }
  }

  const handleAddNetwork = () => {
    setIsAddNetworkModalOpen(true)
  }

  // Show connect wallet button if no wallet is connected
  if (!walletEVMAddress) {
    return (
      <Button 
        onClick={handleConnect} 
        size="sm"
      >
        <Wallet className="mr-2 h-4 w-4" />
        <span className="text-sm">Connect Wallet</span>
      </Button>
    )
  }
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className={`inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-3`}>
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
                  {typeof currentNetwork.balance === 'string' ? parseFloat(currentNetwork.balance).toFixed(4) : (currentNetwork.balance || 0).toFixed(4)} {currentNetwork.symbol}
                </span>
              </div>
            </div>
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-60">
          <NetworkList
            availableNetworks={availableNetworks}
            getNetworkBalance={getNetworkBalance}
            isNetworkActive={isNetworkActive}
            onNetworkSelect={handleNetworkChange}
          />

          <NetworkActions
            onAddNetwork={handleAddNetwork}
          />

          <WalletInfo
            walletAddress={walletEVMAddress || ''}
            currentNetworkExplorerUrl={(currentNetwork as any)?.explorerUrl}
            onCopyAddress={copyAddress}
            onRefreshBalances={updateAllBalances}
            onOpenExplorer={openExplorer}
          />
        </DropdownMenuContent>
      </DropdownMenu>

      {isAddNetworkModalOpen && (
        <AddChainModal
          onClose={() => setIsAddNetworkModalOpen(false)}
          onAddChain={(chain) => {
            try {
              addL1(chain as any)
            } catch (error) {
              console.log('addL1 error (non-blocking):', error)
            }
            setIsAddNetworkModalOpen(false)
          }}
          allowLookup={true}
        />
      )}
    </>
  )
}

export default EvmNetworkWallet
