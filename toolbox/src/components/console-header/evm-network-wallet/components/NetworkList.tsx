import { DropdownMenuLabel, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
import { NetworkMenuItem } from './NetworkMenuItem'

interface NetworkListProps {
  availableNetworks: any[]
  getNetworkBalance: (network: any) => number | string
  isNetworkActive: (network: any) => boolean
  onNetworkSelect: (network: any) => void
  onNetworkRemove?: (network: any) => void
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
