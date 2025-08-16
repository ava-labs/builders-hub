import { DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
import { ArrowLeftRight, Plus } from 'lucide-react'

interface NetworkActionsProps {
  isTestnet: boolean
  onTestnetToggle: () => void
  onAddNetwork: () => void
}

export function NetworkActions({ isTestnet, onTestnetToggle, onAddNetwork }: NetworkActionsProps) {
  return (
    <>
      <DropdownMenuSeparator />
      <DropdownMenuItem onClick={onTestnetToggle}>
        <ArrowLeftRight className="mr-2 h-3 w-3" />
        Switch to {isTestnet ? 'Mainnet' : 'Testnet'}
      </DropdownMenuItem>
      <DropdownMenuItem onClick={onAddNetwork}>
        <Plus className="mr-2 h-3 w-3" />
        Add Network
      </DropdownMenuItem>
    </>
  )
}
