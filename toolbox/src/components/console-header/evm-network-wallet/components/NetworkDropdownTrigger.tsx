import { forwardRef } from 'react'
import { Globe } from 'lucide-react'

interface NetworkDropdownTriggerProps {
  currentNetwork: {
    name: string
    coinName: string
    balance: number | string
    logoUrl?: string
  }
  className?: string
}

export const NetworkDropdownTrigger = forwardRef<
  HTMLButtonElement,
  NetworkDropdownTriggerProps
>(({ currentNetwork, className }, ref) => {
  console.log('NetworkDropdownTrigger render:', { currentNetwork, className })
  
  const formatBalance = (balance: number | string) => {
    const num = typeof balance === 'string' ? parseFloat(balance) : balance
    if (isNaN(num)) return '0'
    return num.toFixed(4)
  }

  return (
    <button 
      ref={ref} 
      onClick={() => console.log('Button clicked!')}
      className={`inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-3 ${className || ''}`}
    >
      <div className="flex items-center gap-3">
        <div className="flex-shrink-0 w-5 h-5 rounded-md overflow-hidden flex items-center justify-start">
          {currentNetwork && currentNetwork.logoUrl ? (
            <img 
              src={currentNetwork.logoUrl} 
              alt={`${currentNetwork.name} logo`} 
              className="w-full h-full object-cover" 
            />
          ) : (
            <Globe className="w-5 h-5 text-zinc-400 dark:text-zinc-500" />
          )}
        </div>
        <div className="flex gap-2 items-center">
          <span className="text-sm font-medium leading-none">{currentNetwork.name}</span>
          <span className="text-xs text-muted-foreground leading-none">
            {formatBalance(currentNetwork.balance)} {currentNetwork.coinName}
          </span>
        </div>
      </div>
    </button>
  )
})

NetworkDropdownTrigger.displayName = "NetworkDropdownTrigger"
