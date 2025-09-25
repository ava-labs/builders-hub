import { DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
import { Plus, Edit3, X, RotateCcw } from 'lucide-react'
import { resetAllStores } from '@/components/toolbox/stores/reset'
import { useWallet } from '@/components/toolbox/hooks/useWallet'

interface NetworkActionsProps {
  isEditMode: boolean
  onToggleEditMode: () => void
}

export function NetworkActions({ isEditMode, onToggleEditMode }: NetworkActionsProps) {
  const { addChain } = useWallet()
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
        onSelect={() => addChain()}
        className='cursor-pointer'
      >
        <Plus className="mr-2 h-3 w-3" />
        Add Network
      </DropdownMenuItem>
      <DropdownMenuItem
        onSelect={() => { try { resetAllStores() } catch { throw new Error("Reset failed") } }}
        className='cursor-pointer text-red-600 focus:text-red-700'
      >
        <RotateCcw className="mr-2 h-3 w-3" />
        Reset
      </DropdownMenuItem>
      <DropdownMenuSeparator />
    </>
  )
}
