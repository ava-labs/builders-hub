"use client"

import * as React from "react"
import { Button } from "../../@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../@/components/ui/dropdown-menu"
import { Badge } from "../../@/components/ui/badge"
import { Wallet, ChevronDown, Copy, ExternalLink, LogOut, RefreshCw, Plus, ArrowLeftRight, Globe, Check } from "lucide-react"
import { useWalletStore } from "../stores/walletStore"
import { useSelectedL1, useL1ListStore } from "../stores/l1ListStore"
import { avalanche, avalancheFuji } from "viem/chains"
import { createCoreWalletClient } from "../coreViem"
import { networkIDs } from "@avalabs/avalanchejs"
import { AddChainModal } from "./ConnectWallet/AddChainModal"

interface HeaderWalletConnectionProps {
  className?: string
  onConnect?: () => void
}

export function HeaderWalletConnection({ className, onConnect }: HeaderWalletConnectionProps) {
  const {
    walletEVMAddress,
    walletChainId,
    isTestnet,
    l1Balance,
    cChainBalance,
    pChainBalance,
    updateL1Balance,
    updateCChainBalance,
    updatePChainBalance,
    pChainAddress,
    setWalletEVMAddress,
    setWalletChainId,
    setPChainAddress,
    setCoreEthAddress,
    setCoreWalletClient,
    setAvalancheNetworkID,
    setIsTestnet,
    setEvmChainName,
    coreWalletClient,
  } = useWalletStore()

  // Removed unused hasWallet state
  const [isClient, setIsClient] = React.useState<boolean>(false)
  const [isAddNetworkModalOpen, setIsAddNetworkModalOpen] = React.useState(false)
  const [copiedEVM, setCopiedEVM] = React.useState<boolean>(false)
  const [copiedPChain, setCopiedPChain] = React.useState<boolean>(false)

  const selectedL1 = useSelectedL1()()
  const l1ListStore = useL1ListStore()
  const l1List = l1ListStore.getState().l1List

  // Set isClient to true once component mounts (client-side only)
  React.useEffect(() => {
    setIsClient(true)
  }, [])

  // Helper function to safely call Core wallet methods - only catch specific WalletConnect errors
  const safelyCallCoreMethod = async (fn: () => Promise<any>) => {
    try {
      return await fn()
    } catch (error: any) {
      // Only skip if it's specifically the WalletConnect error we're trying to avoid
      if (
        error?.message?.includes(
          "Invalid parameters were provided to the RPC method"
        ) ||
        error?.message?.includes(
          "This account does not have its public key imported"
        )
      ) {
        console.debug(
          "Skipping Core wallet method for WalletConnect:",
          error.message
        )
        return
      }
      // Re-throw other errors so they're handled normally
      throw error
    }
  }

  // Update balances when wallet changes
  React.useEffect(() => {
    if (!walletEVMAddress || !walletChainId) return

    // Always update EVM balances
    updateL1Balance()
    updateCChainBalance()

    // Only update P-Chain balance if we have a P-Chain address (Core wallet)
    if (pChainAddress) {
      updatePChainBalance()
    }

    const intervalId = setInterval(() => {
      // Always update EVM balances
      updateL1Balance()
      updateCChainBalance()

      // Only update P-Chain balance if we have a P-Chain address (Core wallet)
      if (pChainAddress) {
        updatePChainBalance()
      }
    }, 30_000)

    return () => clearInterval(intervalId)
  }, [walletEVMAddress, walletChainId, pChainAddress, updateL1Balance, updateCChainBalance, updatePChainBalance])

  // Wallet initialization
  React.useEffect(() => {
    if (!isClient) return

    async function init() {
      try {
        // Check if window.avalanche exists and is an object
        if (
          typeof window.avalanche !== "undefined" &&
          window.avalanche !== null
        ) {
          // Wallet detected
        } else {
          // No wallet detected
          return
        }

        // Safely add event listeners
        if (window.avalanche?.on) {
          window.avalanche.on("accountsChanged", handleAccountsChanged)
          window.avalanche.on("chainChanged", onChainChanged)
        }

        try {
          // Check if request method exists before calling it
          if (window.avalanche?.request) {
            const accounts = await window.avalanche.request<string[]>({
              method: "eth_accounts",
            })
            if (accounts) {
              handleAccountsChanged(accounts)
            }
          }
        } catch (error) {
          // Ignore error, it's expected if the user has not connected their wallet yet
          console.debug("No accounts found:", error)
        }
      } catch (error) {
        console.error("Error initializing wallet:", error)
        // Error initializing wallet
      }
    }

    init()

    // Clean up event listeners
    return () => {
      if (window.avalanche?.removeListener) {
        try {
          window.avalanche.removeListener("accountsChanged", () => {})
          window.avalanche.removeListener("chainChanged", () => {})
        } catch (e) {
          console.warn("Failed to remove event listeners:", e)
        }
      }
    }
  }, [isClient])

  const onChainChanged = (chainId: string | number) => {
    if (typeof chainId === "string") {
      chainId = Number.parseInt(chainId, 16)
    }

    setWalletChainId(chainId)

    // Safely call Core wallet methods only if it's a Core wallet
    if (coreWalletClient) {
      safelyCallCoreMethod(() =>
        coreWalletClient.getPChainAddress().then(setPChainAddress)
      )
      safelyCallCoreMethod(() =>
        coreWalletClient.getCorethAddress().then(setCoreEthAddress)
      )

      safelyCallCoreMethod(() =>
        coreWalletClient
          .getEthereumChain()
          .then(
            (data: {
              isTestnet: boolean
              chainName: string
              rpcUrls: string[]
            }) => {
              const { isTestnet, chainName } = data
              setAvalancheNetworkID(
                isTestnet ? networkIDs.FujiID : networkIDs.MainnetID
              )
              setIsTestnet(isTestnet)
              setEvmChainName(chainName)
            }
          )
      )
    }
  }

  const handleAccountsChanged = (accounts: string[]) => {
    if (accounts.length === 0) {
      setWalletEVMAddress("")
      return
    } else if (accounts.length > 1) {
      console.error("Multiple accounts found, we don't support that yet")
      return
    }

    //re-create wallet with new account
    const newCoreWalletClient = createCoreWalletClient(
      accounts[0] as `0x${string}`
    )
    if (!newCoreWalletClient) {
      // Failed to create wallet client
      return
    }

    setCoreWalletClient(newCoreWalletClient)
    setWalletEVMAddress(accounts[0] as `0x${string}`)

    // Safely call Core wallet methods only if it's a Core wallet
    safelyCallCoreMethod(() =>
      newCoreWalletClient.getPChainAddress().then(setPChainAddress)
    )
    safelyCallCoreMethod(() =>
      newCoreWalletClient.getCorethAddress().then(setCoreEthAddress)
    )

    if (walletChainId === 0) {
      safelyCallCoreMethod(() =>
        newCoreWalletClient.getChainId().then(onChainChanged)
      )
    }
  }

  // Available networks for selection - filtered by current testnet/mainnet mode
  const availableNetworks = React.useMemo(() => {
    const allNetworks = [
      {
        id: "avalanche-cchain",
        name: isTestnet ? "Fuji C-Chain" : "C-Chain Mainnet",
        symbol: "AVAX",
        chainId: isTestnet ? avalancheFuji.id : avalanche.id,
        isTestnet: !!isTestnet,
        color: isTestnet ? "bg-orange-500" : "bg-red-500",
        type: "avalanche" as const,
      },
      {
        id: "p-chain",
        name: isTestnet ? "Fuji P-Chain" : "P-Chain Mainnet",
        symbol: "AVAX",
        chainId: 0, // P-Chain doesn't have an EVM chain ID
        isTestnet,
        color: "bg-purple-500",
        type: "p-chain" as const,
      },
      // Add L1s from the store if available
      ...(l1List || []).map(l1 => ({
        id: `l1-${l1.evmChainId}`,
        name: l1.name,
        symbol: l1.coinName || "L1",
        chainId: l1.evmChainId,
        isTestnet: l1.isTestnet,
        color: "bg-blue-500",
        type: "l1" as const,
        l1Data: l1,
      }))
    ]

    // Filter L1s to only show those matching the current testnet/mainnet mode
    // Also exclude any L1s that are actually C-Chain to avoid duplicates
    return allNetworks.filter(network => {
      if (network.type === "p-chain" || network.type === "avalanche") {
        return true // P-Chain and C-Chain are always available
      }
      if (network.type === "l1") {
        // Exclude C-Chain from L1 list to avoid duplicates
        const isCChain = network.chainId === avalanche.id || network.chainId === avalancheFuji.id
        if (isCChain) return false
        
        return network.isTestnet === isTestnet
      }
      return false // Should not reach here, but satisfies TypeScript
    })
  }, [l1List, isTestnet])

  // Determine current network and balance
  const getCurrentNetwork = () => {
    const isActuallyCChainSelected = 
      walletChainId === avalanche.id || walletChainId === avalancheFuji.id

    if (isActuallyCChainSelected) {
      const currentAvalancheNetwork = availableNetworks.find(net => 
        net.type === "avalanche" && net.chainId === walletChainId
      )
      return {
        ...currentAvalancheNetwork,
        name: isTestnet ? "Fuji C-Chain" : "C-Chain Mainnet",
        symbol: "AVAX",
        logoUrl: "https://images.ctfassets.net/gcj8jwzm6086/5VHupNKwnDYJvqMENeV7iJ/3e4b8ff10b69bfa31e70080a4b142cd0/avalanche-avax-logo.svg",
        balance: cChainBalance, // This balance is now correctly updated when switching networks
        onRefresh: updateCChainBalance,
      }
    }

    if (selectedL1) {
        const currentL1Network = availableNetworks.find(net => 
          net.type === "l1" && net.l1Data?.evmChainId === selectedL1.evmChainId
        )
        return {
          ...currentL1Network,
          name: selectedL1.name,
          symbol: selectedL1.coinName || "L1",
          logoUrl: selectedL1.logoUrl,
          balance: l1Balance,
          onRefresh: updateL1Balance,
        }
      }

    return {
      id: "no-network",
      name: "No Network",
      symbol: "N/A",
      logoUrl: null,
      balance: 0,
      color: "bg-gray-500",
      onRefresh: () => {},
    }
  }

  const handleNetworkChange = async (network: typeof availableNetworks[0]) => {
    try {
      if (network.type === "avalanche") {
        // Update testnet/mainnet state if switching between them
        if (network.isTestnet !== isTestnet) {
          setIsTestnet(network.isTestnet)
          setAvalancheNetworkID(network.isTestnet ? networkIDs.FujiID : networkIDs.MainnetID)
        }
        
        // Switch to Avalanche C-Chain
        if (window.avalanche?.request) {
          await window.avalanche.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: `0x${network.chainId.toString(16)}` }],
          })
          
          // Update balance after switching
          setTimeout(() => {
            updateCChainBalance()
          }, 1000)
        }
      } else if (network.type === "l1" && network.l1Data) {
        // Switch to L1 - no direct setSelectedL1 function, wallet will detect change
        if (window.avalanche?.request && network.chainId) {
          try {
            await window.avalanche.request({
              method: "wallet_switchEthereumChain", 
              params: [{ chainId: `0x${network.chainId.toString(16)}` }],
            })
            
            // Update balance after switching
            setTimeout(() => {
              updateL1Balance()
            }, 1000)
          } catch (error) {
            console.debug("Failed to switch to L1 chain in wallet:", error)
          }
        }
      } else if (network.type === "p-chain") {
        // P-Chain switching would need special handling
        console.log("P-Chain switching not implemented yet")
      }
    } catch (error) {
      console.error("Failed to switch network:", error)
    }
  }

  const handleTestnetToggle = async () => {
    const newIsTestnet = !isTestnet
    setIsTestnet(newIsTestnet)
    setAvalancheNetworkID(newIsTestnet ? networkIDs.FujiID : networkIDs.MainnetID)
    
    // Switch to the appropriate Avalanche network
    const targetChainId = newIsTestnet ? avalancheFuji.id : avalanche.id
    if (window.avalanche?.request) {
      try {
        await window.avalanche.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: `0x${targetChainId.toString(16)}` }],
        })
        
        // After switching, update the C-Chain balance for the new network
        // Small delay to ensure the chain switch is complete
        setTimeout(() => {
          updateCChainBalance()
        }, 1000)
      } catch (error) {
        console.debug("Failed to switch network in wallet:", error)
      }
    } else {
      // If no wallet request available, still update the balance
      updateCChainBalance()
    }
  }

  const formatAddress = (address: string) => {
    if (!address) return ""
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }

  const formatAddressLong = (address: string) => {
    if (!address) return ""
    return `${address.slice(0, 8)}...${address.slice(-8)}`
  }

  const formatBalance = (balance: number | string) => {
    const num = typeof balance === 'string' ? parseFloat(balance) : balance
    if (isNaN(num)) return "0"
    return num.toFixed(4)
  }

  const handleCopyAddress = () => {
    if (walletEVMAddress) {
      navigator.clipboard.writeText(walletEVMAddress)
      setCopiedEVM(true)
      setTimeout(() => setCopiedEVM(false), 2000)
    }
  }

  const handleCopyPChainAddress = () => {
    if (pChainAddress) {
      navigator.clipboard.writeText(pChainAddress)
      setCopiedPChain(true)
      setTimeout(() => setCopiedPChain(false), 2000)
    }
  }

  const handleViewCChainExplorer = () => {
    if (!walletEVMAddress) return
    
    const baseUrl = isTestnet ? "https://subnets-test.avax.network" : "https://subnets.avax.network"
    const explorerUrl = `${baseUrl}/c-chain/address/${walletEVMAddress}`
    window.open(explorerUrl, '_blank')
  }

  const handleViewPChainExplorer = () => {
    if (!pChainAddress) return
    
    const baseUrl = isTestnet ? "https://subnets-test.avax.network" : "https://subnets.avax.network"
    const explorerUrl = `${baseUrl}/p-chain/address/${pChainAddress}`
    window.open(explorerUrl, '_blank')
  }

  // Removed unused handleViewExplorer function

  const handleDisconnect = () => {
    // Clear wallet state
    setWalletEVMAddress("")
    setWalletChainId(0)
    setPChainAddress("")
    setCoreEthAddress("")
    
    // Clear any cached wallet connection
    if (window.avalanche?.request) {
      try {
        // Some wallets support explicit disconnect
        window.avalanche.request({
          method: "wallet_requestPermissions",
          params: [{
            eth_accounts: {}
          }]
        }).catch(() => {
          // Ignore errors, fallback to state clearing
        })
      } catch (error) {
        console.debug("Wallet disconnect method not supported:", error)
      }
    }
  }

  const handleConnect = async () => {
    if (!isClient) return

    console.log("Connecting wallet")
    try {
      if (!window.avalanche?.request) {
        // No wallet request method available
        return
      }

      const accounts = await window.avalanche.request<string[]>({
        method: "eth_requestAccounts",
      })

      if (!accounts) {
        throw new Error("No accounts returned from wallet")
      }

      // Use the same handler function as defined in useEffect
      handleAccountsChanged(accounts)
    } catch (error) {
      console.error("Error connecting wallet:", error)
      alert("Failed to connect wallet. Please try again.")
    }
  }

  const currentNetwork = getCurrentNetwork()

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {walletEVMAddress ? (
        <>
          {/* Network Selection Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="default" className="h-12 px-3 bg-transparent">
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-md overflow-hidden flex items-center justify-center">
                    {currentNetwork.logoUrl ? (
                      <img src={currentNetwork.logoUrl} alt={`${currentNetwork.name} logo`} className="w-full h-full object-cover" />
                    ) : (
                      <Globe className="w-4 h-4 text-zinc-400 dark:text-zinc-500" />
                    )}
                  </div>
                  <div className="flex flex-col items-start">
                    <span className="text-sm font-medium leading-none">
                      {currentNetwork.name}
                    </span>
                    <span className="text-xs text-muted-foreground leading-none mt-1">
                      {formatBalance(currentNetwork.balance)} {currentNetwork.symbol}
                    </span>
                  </div>
                  <ChevronDown className="h-4 w-4 opacity-50" />
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel>Select Network</DropdownMenuLabel>
              <DropdownMenuSeparator />
              
              {availableNetworks.map((network) => {
                const isActive = 
                  (network.type === "avalanche" && network.chainId === walletChainId) ||
                  (network.type === "l1" && selectedL1?.evmChainId === network.chainId) ||
                  (network.type === "p-chain")
                
                let balance = 0
                let logoUrl = null
                if (network.type === "avalanche") {
                  balance = cChainBalance
                  logoUrl = "https://images.ctfassets.net/gcj8jwzm6086/5VHupNKwnDYJvqMENeV7iJ/3e4b8ff10b69bfa31e70080a4b142cd0/avalanche-avax-logo.svg"
                } else if (network.type === "l1") {
                  // Only show L1 balance if this L1 is currently connected, otherwise show 0
                  const isCurrentlyConnectedL1 = selectedL1?.evmChainId === network.chainId && walletChainId === network.chainId
                  balance = isCurrentlyConnectedL1 ? l1Balance : 0
                  logoUrl = network.l1Data?.logoUrl
                } else if (network.type === "p-chain") {
                  balance = pChainBalance
                  logoUrl = "https://images.ctfassets.net/gcj8jwzm6086/42aMwoCLblHOklt6Msi6tm/1e64aa637a8cead39b2db96fe3225c18/pchain-square.svg"
                }
                
                return (
                  <DropdownMenuItem
                    key={network.id}
                    onClick={() => handleNetworkChange(network)}
                    className="flex items-center justify-between p-3 cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex-shrink-0 w-6 h-6 rounded-md overflow-hidden flex items-center justify-center">
                        {logoUrl ? (
                          <img src={logoUrl} alt={`${network.name} logo`} className="w-full h-full object-cover" />
                        ) : (
                          <Globe className="w-4 h-4 text-zinc-400 dark:text-zinc-500" />
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
                      <Badge variant="secondary" className="text-xs">
                        Active
                      </Badge>
                    )}
                  </DropdownMenuItem>
                )
              })}
              
              <DropdownMenuSeparator />
              
              {/* Network Management Actions */}
              <DropdownMenuItem onClick={handleTestnetToggle}>
                <ArrowLeftRight className="mr-2 h-3 w-3" />
                Switch to {isTestnet ? 'Mainnet' : 'Testnet'}
              </DropdownMenuItem>
              
              <DropdownMenuItem onClick={() => setIsAddNetworkModalOpen(true)}>
                <Plus className="mr-2 h-3 w-3" />
                Add Network
              </DropdownMenuItem>
              
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={currentNetwork.onRefresh}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh Balance
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Connected Wallet Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="default" className="h-12 px-3 bg-transparent">
                <div className="flex items-center gap-3">
                  <Wallet className="h-4 w-4" />
                  <span className="text-sm font-medium">
                    {formatAddress(walletEVMAddress)}
                  </span>
                  <ChevronDown className="h-4 w-4 opacity-50" />
                </div>
              </Button>
                          </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80">
                <DropdownMenuLabel>Wallet Connected</DropdownMenuLabel>
              <DropdownMenuSeparator />
              
                                             {/* EVM Address Section */}
                <div className="px-2 py-1">
                  <div className="text-xs font-medium text-muted-foreground mb-1">EVM Address</div>
                  <div className="flex items-center gap-2 bg-muted px-2 py-1 rounded">
                    <div className="font-mono text-xs flex-1 text-center">
                      {formatAddressLong(walletEVMAddress)}
                    </div>
                    <button
                      onClick={handleCopyAddress}
                      className="p-1 hover:bg-background rounded transition-colors"
                      title="Copy EVM Address"
                    >
                      {copiedEVM ? (
                        <Check className="h-3 w-3 text-green-600" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </button>
                  </div>
                </div>
              <DropdownMenuItem onClick={handleViewCChainExplorer}>
                <ExternalLink className="mr-2 h-4 w-4" />
                View on Explorer
              </DropdownMenuItem>
              
              {/* P-Chain Address Section */}
              {pChainAddress ? (
                <>
                  <DropdownMenuSeparator />
                  <div className="px-2 py-1">
                    <div className="text-xs font-medium text-muted-foreground mb-1">P-Chain Address</div>
                    <div className="flex items-center gap-2 bg-muted px-2 py-1 rounded">
                      <div className="font-mono text-xs flex-1 text-center">
                        {formatAddressLong(pChainAddress)}
                      </div>
                      <button
                        onClick={handleCopyPChainAddress}
                        className="p-1 hover:bg-background rounded transition-colors"
                        title="Copy P-Chain Address"
                      >
                        {copiedPChain ? (
                          <Check className="h-3 w-3 text-green-600" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </button>
                    </div>
                  </div>
                  <DropdownMenuItem onClick={handleViewPChainExplorer}>
                    <ExternalLink className="mr-2 h-4 w-4" />
                    View on Explorer
                  </DropdownMenuItem>
                </>
              ) : (
                <>
                  <DropdownMenuSeparator />
                  <div className="px-2 py-1">
                    <div className="text-xs font-medium text-muted-foreground mb-1">P-Chain Address</div>
                    <div className="text-xs text-muted-foreground text-center py-1">
                      Requires Core Wallet
                    </div>
                  </div>
                </>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleDisconnect} className="text-red-600">
                <LogOut className="mr-2 h-4 w-4" />
                Disconnect
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      ) : (
        <Button onClick={onConnect || handleConnect} size="default" className="h-12">
          <Wallet className="mr-2 h-4 w-4" />
          <span className="text-sm">Connect Wallet</span>
        </Button>
      )}
      
      {/* Add Network Modal */}
      {isAddNetworkModalOpen && (
        <AddChainModal
          onClose={() => setIsAddNetworkModalOpen(false)}
          onAddChain={(chain) => {
            // Handle adding the chain - this would add to L1 store
            try {
              // Note: This might need proper typing fixes for l1List store
              console.log("Adding chain:", chain);
            } catch (error) {
              console.log("addL1 error (non-blocking):", error);
            }
            setIsAddNetworkModalOpen(false);
          }}
          allowLookup={true}
        />
      )}
    </div>
  )
} 