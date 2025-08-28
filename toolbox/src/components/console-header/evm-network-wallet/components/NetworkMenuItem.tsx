import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { Globe, Check, Trash2 } from 'lucide-react'

interface NetworkMenuItemProps {
  network: {
    id: string
    name: string
    coinName: string
    logoUrl?: string
    evmChainId?: number
  }
  isActive: boolean
  onSelect: (network: any) => void
  isEditMode?: boolean
  onRemove?: (network: any) => void
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

  const formatBalance = (balance: number | string) => {
    const num = typeof balance === 'string' ? parseFloat(balance) : balance
    if (isNaN(num)) return '0'
    return num.toFixed(4)
  }

  const handleClick = () => {
    if (isEditMode && onRemove && !isCChain(network.evmChainId)) {
      onRemove(network)
    } else if (!isEditMode) {
      onSelect(network)
    }
  }

  const canRemove = isEditMode && !isCChain(network.evmChainId)

  return (
    <DropdownMenuItem
      onClick={handleClick}
      className={`flex items-center justify-between p-3 ${
        canRemove ? 'cursor-pointer hover:bg-red-50 dark:hover:bg-red-950/20' : 
        isEditMode && isCChain(network.evmChainId) ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
      }`}
    >
      <div className="flex items-center gap-3">
        <div className="flex-shrink-0 w-5 h-5 rounded-md overflow-hidden flex items-center justify-center">
          {isEditMode && !isCChain(network.evmChainId) ? (
            <Trash2 className="w-4 h-4 text-red-500" />
          ) : network.logoUrl ? (
            <img 
              src={network.logoUrl} 
              alt={`${network.name} logo`} 
              className="w-full h-full object-cover" 
            />
          ) : (
            <Globe className="w-5 h-5 text-zinc-400 dark:text-zinc-500" />
          )}
        </div>
        <div className="flex flex-col">
          <span className={`font-medium ${
            canRemove ? 'text-red-600 dark:text-red-400' : ''
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
      {!isEditMode && isActive && (
        <Check className="w-4 h-4 text-green-600">
        </Check>
      )}
    </DropdownMenuItem>
  )
}
