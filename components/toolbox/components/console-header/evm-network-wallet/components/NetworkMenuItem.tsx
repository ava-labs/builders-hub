import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { Check, Trash2, ChevronRight, ChevronDown } from 'lucide-react'
import { L1ListItem } from '@/components/toolbox/stores/l1ListStore'
import { ChainLogo } from './ChainLogo'
import { useState } from 'react'
import { useWalletStore } from '@/components/toolbox/stores/walletStore'

interface NetworkMenuItemProps {
  network: L1ListItem
  isActive: boolean
  onSelect: (network: L1ListItem, tokenAddress?: string | null) => void
  isEditMode?: boolean
  onRemove?: (network: L1ListItem) => void
  balance?: number | string
}

const isCChain = (evmChainId: number | undefined) => {
  return evmChainId === 43113 || evmChainId === 43114
}

export function NetworkMenuItem({
  network,
  isActive,
  onSelect,
  isEditMode = false,
  onRemove,
  balance = 0
}: NetworkMenuItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { selectedToken } = useWalletStore();
  const hasTokens = network.wellKnownERC20s && network.wellKnownERC20s.length > 0;
  const isTokenSelected = isActive && selectedToken !== null;

  const formatBalance = (balance: number | string) => {
    const num = typeof balance === 'string' ? parseFloat(balance) : balance
    if (isNaN(num)) return '0'
    return num.toFixed(4)
  }

  const handleSelect: React.ComponentProps<typeof DropdownMenuItem>["onSelect"] = (e) => {
    // Prevent the dropdown from auto-closing; parent decides when to close
    e.preventDefault()
    if (isEditMode && onRemove && !isCChain(network.evmChainId)) {
      onRemove(network)
    } else if (!isEditMode) {
      if (hasTokens) {
        // If network has tokens, toggle expansion
        setIsExpanded(!isExpanded);
      } else {
        // Select network with native token (null)
        onSelect(network, null)
    }
    }
  }
  
  const handleTokenSelect = (tokenAddress: string) => (e: Event) => {
    e.preventDefault();
    onSelect(network, tokenAddress);
    setIsExpanded(false); // Collapse after selection
  }
  
  const handleNativeSelect = (e: Event) => {
    e.preventDefault();
    onSelect(network, null); // null means native token
    setIsExpanded(false);
  }

  const canRemove = isEditMode && !isCChain(network.evmChainId)

  return (
    <>
    <DropdownMenuItem
      onSelect={handleSelect}
      className={`flex items-center justify-between p-3 ${canRemove ? 'cursor-pointer hover:bg-red-50 dark:hover:bg-red-950/20' :
          isEditMode && isCChain(network.evmChainId) ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
        }`}
    >
      <div className="flex items-center gap-3">
        <div className="flex-shrink-0 w-5 h-5 flex items-center justify-center">
          {isEditMode && !isCChain(network.evmChainId) ? (
            <Trash2 className="w-4 h-4 text-red-500" />
          ) : (
            <ChainLogo logoUrl={network.logoUrl} chainName={network.name} />
          )}
        </div>
        <div className="flex flex-col">
          <span className={`font-medium ${canRemove ? 'text-red-600 dark:text-red-400' : ''
            }`}>
            {network.name}
          </span>
          <span className="text-xs text-muted-foreground">
            {isEditMode && !isCChain(network.evmChainId) ? 'Click to remove' :
              isEditMode && isCChain(network.evmChainId) ? 'Cannot be removed' :
                `Balance: ${formatBalance(balance)} ${network.coinName}`}
          </span>
        </div>
      </div>
        <div className="flex items-center gap-2">
          {!isEditMode && hasTokens && (
            isExpanded ? 
              <ChevronDown className="w-4 h-4 text-muted-foreground" /> : 
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
          )}
          {!isEditMode && isActive && !isTokenSelected && !hasTokens && (
            <Check className="w-4 h-4 text-green-600" />
          )}
        </div>
      </DropdownMenuItem>
      
      {/* Show native token + ERC20 tokens when expanded */}
      {!isEditMode && hasTokens && isExpanded && (
        <>
          {/* Native token option */}
          <DropdownMenuItem
            onSelect={handleNativeSelect}
            className="pl-12 pr-3 py-2 cursor-pointer"
          >
            <div className="flex items-center gap-2 flex-1">
              <ChainLogo logoUrl={network.logoUrl} chainName={network.name} className="w-4 h-4" />
              <div className="flex flex-col flex-1">
                <span className="text-sm font-medium">{network.coinName}</span>
                <span className="text-xs text-muted-foreground">Native Token</span>
              </div>
              {isActive && selectedToken === null && (
                <Check className="w-4 h-4 text-green-600" />
      )}
            </div>
    </DropdownMenuItem>
          
          {/* ERC20 tokens */}
          {network.wellKnownERC20s?.map((token) => (
            <DropdownMenuItem
              key={token.address}
              onSelect={handleTokenSelect(token.address)}
              className="pl-12 pr-3 py-2 cursor-pointer"
            >
              <div className="flex items-center gap-2 flex-1">
                <img 
                  src={token.logoUrl} 
                  alt={token.symbol} 
                  className="w-4 h-4 rounded-full"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
                <div className="flex flex-col flex-1">
                  <span className="text-sm font-medium">{token.symbol}</span>
                  <span className="text-xs text-muted-foreground">{token.name}</span>
                </div>
                {isActive && selectedToken === token.address && (
                  <Check className="w-4 h-4 text-green-600" />
                )}
              </div>
            </DropdownMenuItem>
          ))}
        </>
      )}
    </>
  )
}
