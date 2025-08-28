import { DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
import { Plus, Edit3, X } from 'lucide-react'

interface NetworkActionsProps {
  onAddNetwork: () => void
  isEditMode: boolean
  onToggleEditMode: () => void
}

export function NetworkActions({ onAddNetwork, isEditMode, onToggleEditMode }: NetworkActionsProps) {
  return (
    <>
      <DropdownMenuSeparator />
      <DropdownMenuItem
        onSelect={(e) => { e.preventDefault(); onToggleEditMode() }}
        className='cursor-pointer'
      >
        {isEditMode ? (
          <X className="mr-2 h-3 w-3" />
        ) : (
          <Edit3 className="mr-2 h-3 w-3" />
        )}
        {isEditMode ? 'Done Editing' : 'Edit Network List'}
      </DropdownMenuItem>
      <DropdownMenuItem
        onSelect={(e) => { e.preventDefault(); onAddNetwork() }}
        className='cursor-pointer'
      >
        <Plus className="mr-2 h-3 w-3" />
        Add Network
      </DropdownMenuItem>
    </>
  )
}
