import { DropdownMenuLabel, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
import { NetworkMenuItem } from './NetworkMenuItem'

interface NetworkListProps {
  availableNetworks: any[]
  getNetworkBalance: (network: any) => number | string
  isNetworkActive: (network: any) => boolean
  onNetworkSelect: (network: any) => void
}

export function NetworkList({ 
  availableNetworks, 
  getNetworkBalance, 
  isNetworkActive, 
  onNetworkSelect 
}: NetworkListProps) {
  return (
    <>
      <DropdownMenuLabel>Select Network</DropdownMenuLabel>
      <DropdownMenuSeparator />

      {availableNetworks.map((network) => (
        <NetworkMenuItem
          key={network.id}
          network={network}
          balance={getNetworkBalance(network)}
          isActive={isNetworkActive(network)}
          onSelect={onNetworkSelect}
        />
      ))}
    </>
  )
}
