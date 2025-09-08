'use client'

import { useState } from 'react'
import { Button } from './button'
import { Card } from './card'
import { Check, Wallet, AlertCircle } from 'lucide-react'

interface NetworkConfig {
  chainId: string
  chainName: string
  nativeCurrency: {
    name: string
    symbol: string
    decimals: number
  }
  rpcUrls: string[]
  blockExplorerUrls: string[]
  iconUrls?: string[]
}

interface AddToWalletProps {
  network: NetworkConfig
  variant?: 'default' | 'compact'
  className?: string
}

export function AddToWallet({ network, variant = 'default', className = '' }: AddToWalletProps) {
  const [isAdding, setIsAdding] = useState(false)
  const [isAdded, setIsAdded] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const addToWallet = async () => {
    if (!window.ethereum) {
      setError('No wallet extension detected. Please install MetaMask or another compatible wallet.')
      return
    }

    setIsAdding(true)
    setError(null)

    try {
      // Check if the network is already added
      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: network.chainId }],
        })
        setIsAdded(true)
        return
      } catch (switchError: any) {
        // Network not added yet, continue to add it
        if (switchError.code !== 4902) {
          throw switchError
        }
      }

      // Add the network
      await window.ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [
          {
            chainId: network.chainId,
            chainName: network.chainName,
            nativeCurrency: network.nativeCurrency,
            rpcUrls: network.rpcUrls,
            blockExplorerUrls: network.blockExplorerUrls,
            iconUrls: network.iconUrls,
          },
        ],
      })

      setIsAdded(true)
    } catch (err: any) {
      console.error('Failed to add network:', err)
      if (err.code === 4001) {
        setError('User rejected the request.')
      } else {
        setError('Failed to add network. Please try again.')
      }
    } finally {
      setIsAdding(false)
    }
  }

  if (variant === 'compact') {
    return (
      <Button
        onClick={addToWallet}
        disabled={isAdding || isAdded}
        variant={isAdded ? 'secondary' : 'default'}
        size="sm"
        className={className}
      >
        {isAdding ? (
          <>
            <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-current mr-2" />
            Adding...
          </>
        ) : isAdded ? (
          <>
            <Check className="h-3 w-3 mr-2" />
            Added
          </>
        ) : (
          <>
            <Wallet className="h-3 w-3 mr-2" />
            Add to Wallet
          </>
        )}
      </Button>
    )
  }

  return (
    <Card className={`p-4 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="flex-shrink-0">
            <Wallet className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <h3 className="text-sm font-medium">{network.chainName}</h3>
            <p className="text-xs text-muted-foreground">
              Chain ID: {parseInt(network.chainId, 16)}
            </p>
          </div>
        </div>
        
        <Button
          onClick={addToWallet}
          disabled={isAdding || isAdded}
          variant={isAdded ? 'secondary' : 'default'}
          size="sm"
        >
          {isAdding ? (
            <>
              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-current mr-2" />
              Adding...
            </>
          ) : isAdded ? (
            <>
              <Check className="h-3 w-3 mr-2" />
              Added
            </>
          ) : (
            'Add to Wallet'
          )}
        </Button>
      </div>
      
      {error && (
        <div className="mt-3 flex items-center text-sm text-red-600">
          <AlertCircle className="h-4 w-4 mr-2 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </Card>
  )
}

// Pre-configured network configurations
export const AVALANCHE_MAINNET: NetworkConfig = {
  chainId: '0xa86a', // 43114 in hex
  chainName: 'Avalanche C-Chain',
  nativeCurrency: {
    name: 'Avalanche',
    symbol: 'AVAX',
    decimals: 18,
  },
  rpcUrls: ['https://api.avax.network/ext/bc/C/rpc'],
  blockExplorerUrls: ['https://subnets.avax.network/c-chain'],
  iconUrls: ['https://cryptologos.cc/logos/avalanche-avax-logo.png'],
}

export const AVALANCHE_FUJI: NetworkConfig = {
  chainId: '0xa869', // 43113 in hex
  chainName: 'Avalanche Fuji Testnet',
  nativeCurrency: {
    name: 'Avalanche',
    symbol: 'AVAX',
    decimals: 18,
  },
  rpcUrls: ['https://api.avax-test.network/ext/bc/C/rpc'],
  blockExplorerUrls: ['https://subnets-test.avax.network/c-chain'],
  iconUrls: ['https://cryptologos.cc/logos/avalanche-avax-logo.png'],
}
