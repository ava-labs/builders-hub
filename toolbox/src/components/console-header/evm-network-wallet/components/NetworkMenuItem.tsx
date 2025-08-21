import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { Globe, Check } from 'lucide-react'

interface NetworkMenuItemProps {
  network: {
    id: string
    name: string
    coinName: string
    logoUrl?: string
  }
  isActive: boolean
  onSelect: (network: any) => void
}

export function NetworkMenuItem({ network, isActive, onSelect }: NetworkMenuItemProps) {
 

  return (
    <DropdownMenuItem
      onClick={() => onSelect(network)}
      className="flex items-center justify-between p-3 cursor-pointer"
    >
      <div className="flex items-center gap-3">
        <div className="flex-shrink-0 w-5 h-5 rounded-md overflow-hidden flex items-center justify-start">
          {network.logoUrl ? (
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
          <span className="font-medium">{network.name}</span>
        </div>
      </div>
      {isActive && (
        <Check className="text-xs">
          Active
        </Check>
      )}
    </DropdownMenuItem>
  )
}
