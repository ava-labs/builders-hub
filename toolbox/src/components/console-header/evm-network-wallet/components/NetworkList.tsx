import { useState } from 'react'
import { DropdownMenuLabel, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Edit3, X } from 'lucide-react'
import { NetworkMenuItem } from './NetworkMenuItem'

interface NetworkListProps {
  availableNetworks: any[]
  getNetworkBalance: (network: any) => number | string
  isNetworkActive: (network: any) => boolean
  onNetworkSelect: (network: any) => void
  onNetworkRemove?: (network: any) => void
}

export function NetworkList({ 
  availableNetworks, 
  getNetworkBalance,
  isNetworkActive, 
  onNetworkSelect,
  onNetworkRemove
}: NetworkListProps) {
  const [isEditMode, setIsEditMode] = useState(false)

  return (
    <>
      <div className="flex items-center justify-between px-2 py-1.5">
        <DropdownMenuLabel className="px-0">Select Network</DropdownMenuLabel>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsEditMode(!isEditMode)}
          className="h-6 px-2 text-xs"
        >
          {isEditMode ? (
            <X className="w-2 h-2" />
          ) : (
            <Edit3 className="w-2 h-2" />
          )}
        </Button>
      </div>
      <DropdownMenuSeparator />

      {availableNetworks.map((network) => (
        <NetworkMenuItem
          key={network.id}
          network={network}
          isActive={isNetworkActive(network)}
          onSelect={onNetworkSelect}
          isEditMode={isEditMode}
          onRemove={onNetworkRemove}
          balance={getNetworkBalance(network)}
        />
      ))}
    </>
  )
}
