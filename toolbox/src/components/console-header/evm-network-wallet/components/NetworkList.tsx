import { DropdownMenuLabel, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
import { NetworkMenuItem } from './NetworkMenuItem'
import { L1ListItem } from '@/stores/l1ListStore'

interface NetworkListProps {
  availableNetworks: L1ListItem[]
  getNetworkBalance: (network: L1ListItem) => number | string
  isNetworkActive: (network: L1ListItem) => boolean
  onNetworkSelect: (network: L1ListItem) => void
  onNetworkRemove?: (network: L1ListItem) => void
  isEditMode: boolean
}

export function NetworkList({ 
  availableNetworks, 
  getNetworkBalance,
  isNetworkActive, 
  onNetworkSelect,
  onNetworkRemove,
  isEditMode
}: NetworkListProps) {
  return (
    <>
      <div className="flex items-center justify-between px-2 py-1.5">
        <DropdownMenuLabel className="px-0">Select Network</DropdownMenuLabel>
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
