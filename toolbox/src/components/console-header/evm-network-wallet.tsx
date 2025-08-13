'use client'

import * as React from 'react'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { RefreshCw, Plus, ArrowLeftRight, Globe, Copy, Telescope, Check } from 'lucide-react'
import { useWalletStore } from '@/stores/walletStore'
import { useSelectedL1, useL1ListStore } from '@/stores/l1ListStore'
import { avalanche, avalancheFuji } from 'viem/chains'
import { createPublicClient, http, formatEther } from 'viem'
import { networkIDs } from '@avalabs/avalanchejs'
import { AddChainModal } from '@/components/ConnectWallet/AddChainModal'

export function EvmNetworkWallet({ className }: { className?: string }) {
  const {
    walletChainId,
    isTestnet,
    l1Balance,
    cChainBalance,
    updateL1Balance,
    updateCChainBalance,
    updateAllBalances,
    setAvalancheNetworkID,
    setIsTestnet,
    walletEVMAddress,
  } = useWalletStore()

  const [isAddNetworkModalOpen, setIsAddNetworkModalOpen] = React.useState(false)

  const selectedL1 = useSelectedL1()()
  const l1ListStore = useL1ListStore()
  const l1List = l1ListStore((s) => s.l1List)
  const addL1 = l1ListStore((s) => s.addL1)

  // External per-L1 balances (fetched directly from each L1 RPC)
  const [externalBalances, setExternalBalances] = React.useState<Record<number, string>>({})

  React.useEffect(() => {
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
  const availableNetworks = React.useMemo(() => {
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
  const getCurrentNetwork = () => {
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
        onRefresh: updateCChainBalance,
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
        onRefresh: updateL1Balance,
      }
    }

    return {
      id: 'no-network',
      name: 'No Network',
      symbol: 'N/A',
      logoUrl: null as any,
      balance: 0,
      color: 'bg-gray-500',
      onRefresh: () => {},
    }
  }

  const formatBalance = (balance: number | string) => {
    const num = typeof balance === 'string' ? parseFloat(balance) : balance
    if (isNaN(num)) return '0'
    return num.toFixed(4)
  }

  const handleNetworkChange = async (network: (typeof availableNetworks)[0]) => {
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

  const currentNetwork = getCurrentNetwork()

  const openExplorer = () => {
    const url = (currentNetwork as any)?.explorerUrl
    if (url) window.open(url + '/address/' + walletEVMAddress, '_blank')
  }

  const copyAddress = async () => {
    if (walletEVMAddress) await navigator.clipboard.writeText(walletEVMAddress)
  }

  // Format EVM address for compact, single-line display
  const formatAddressForDisplay = (
    address: string,
    leading: number = 8,
    trailing: number = 8
  ) => {
    if (!address) return ''
    if (address.length <= leading + trailing + 3) return address
    return `${address.slice(0, leading)}...${address.slice(-trailing)}`
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className={`${className || ''}`}>
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 w-5 h-5 rounded-md overflow-hidden flex items-center justify-start">
                {currentNetwork && (currentNetwork as any).logoUrl ? (
                  <img src={(currentNetwork as any).logoUrl} alt={`${currentNetwork.name} logo`} className="w-full h-full object-cover" />
                ) : (
                  <Globe className="w-5 h-5 text-zinc-400 dark:text-zinc-500" />
                )}
              </div>
              <div className="flex gap-2 items-center">
                <span className="text-sm font-medium leading-none">{currentNetwork.name}</span>
                <span className="text-xs text-muted-foreground leading-none">{formatBalance((currentNetwork as any).balance)} {(currentNetwork as any).symbol}</span>
              </div>
            </div>
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuLabel>Select Network</DropdownMenuLabel>
          <DropdownMenuSeparator />

          {availableNetworks.map((network) => {
            const isActive =
              (network.type === 'avalanche' && network.chainId === walletChainId) ||
              (network.type === 'l1' && selectedL1?.evmChainId === network.chainId)

            let balance: number | string = 0
            if (network.type === 'avalanche') {
              balance = cChainBalance
            } else if (network.type === 'l1') {
              // Prefer externally fetched balance for each L1, fallback to current l1Balance if connected
              const ext = externalBalances[network.chainId]
              if (typeof ext !== 'undefined') {
                balance = ext
              } else if (walletChainId === network.chainId) {
                balance = l1Balance
              } else {
                balance = 0
              }
            }

            return (
              <DropdownMenuItem
                key={network.id}
                onClick={() => handleNetworkChange(network)}
                className="flex items-center justify-between p-3 cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0 w-5 h-5 rounded-md overflow-hidden flex items-center justify-start">
                    {network.logoUrl ? (
                      <img src={network.logoUrl} alt={`${network.name} logo`} className="w-full h-full object-cover" />
                    ) : (
                      <Globe className="w-5 h-5 text-zinc-400 dark:text-zinc-500" />
                    )}
                  </div>
                  <div className="flex flex-col">
                    <span className="font-medium">{network.name}</span>
                    <span className="text-xs text-muted-foreground">
                      Balance: {formatBalance(balance)} {network.symbol}
                    </span>
                  </div>
                </div>
                {isActive && (
                  <Check className="text-xs">
                    Active
                  </Check>
                )}
              </DropdownMenuItem>
            )
          })}

          <DropdownMenuSeparator />

          <DropdownMenuItem onClick={handleTestnetToggle}>
            <ArrowLeftRight className="mr-2 h-3 w-3" />
            Switch to {isTestnet ? 'Mainnet' : 'Testnet'}
          </DropdownMenuItem>

          <DropdownMenuItem onClick={() => setIsAddNetworkModalOpen(true)}>
            <Plus className="mr-2 h-3 w-3" />
            Add Network
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuLabel>Wallet</DropdownMenuLabel>
          <div className="px-2 py-1.5">
            <div className="text-xs text-muted-foreground">Address</div>
            <div
              className="text-xs font-mono truncate"
              title={walletEVMAddress || undefined}
            >
              {walletEVMAddress
                ? formatAddressForDisplay(walletEVMAddress)
                : 'Not connected'}
            </div>
          </div>
          <DropdownMenuItem onClick={copyAddress}>
            <Copy className="mr-2 h-3 w-3" />
            Copy Address
          </DropdownMenuItem>
          <DropdownMenuItem onClick={updateAllBalances}>
            <RefreshCw className="mr-2 h-3 w-3" />
            Refresh Balances
          </DropdownMenuItem>
          <DropdownMenuItem onClick={openExplorer}>
            <Telescope className="mr-2 h-3 w-3" />
            View on Explorer
          </DropdownMenuItem>
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

