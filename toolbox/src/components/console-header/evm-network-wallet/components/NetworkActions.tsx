import { DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
import { Plus } from 'lucide-react'

interface NetworkActionsProps {
  onAddNetwork: () => void
}

export function NetworkActions({ onAddNetwork }: NetworkActionsProps) {
  return (
    <>
      <DropdownMenuSeparator />
      <DropdownMenuItem onClick={onAddNetwork}>
        <Plus className="mr-2 h-3 w-3" />
        Add Network
      </DropdownMenuItem>
    </>
  )
}
