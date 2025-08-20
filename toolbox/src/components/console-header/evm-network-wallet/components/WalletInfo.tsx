import { DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
import { Copy, RefreshCw, Telescope } from 'lucide-react'

interface WalletInfoProps {
  walletAddress: string
  currentNetworkExplorerUrl?: string
  onCopyAddress: () => void
  onRefreshBalances: () => void
  onOpenExplorer: (explorerUrl: string) => void
}

export function WalletInfo({ 
  walletAddress, 
  currentNetworkExplorerUrl,
  onCopyAddress, 
  onRefreshBalances, 
  onOpenExplorer 
}: WalletInfoProps) {
  // Format EVM address for compact, single-line display
  const formatAddressForDisplay = (
    address: string,
    leading: number = 8,
    trailing: number = 8
  ) => {
    if (!address) return ''
    if (address.length <= leading + trailing + 3) return address
    return `${address.slice(0, leading)}...${address.slice(-trailing)}`
  }

  return (
    <>
      <DropdownMenuSeparator />
      <DropdownMenuLabel>Wallet</DropdownMenuLabel>
      <div className="px-2 py-1.5">
        <div className="text-xs text-muted-foreground">Address</div>
        <div
          className="text-xs font-mono truncate"
          title={walletAddress || undefined}
        >
          {walletAddress
            ? formatAddressForDisplay(walletAddress)
            : 'Not connected'}
        </div>
      </div>
      <DropdownMenuItem onClick={onCopyAddress}>
        <Copy className="mr-2 h-3 w-3" />
        Copy Address
      </DropdownMenuItem>
      <DropdownMenuItem onClick={onRefreshBalances}>
        <RefreshCw className="mr-2 h-3 w-3" />
        Refresh Balances
      </DropdownMenuItem>
      {currentNetworkExplorerUrl && (
        <DropdownMenuItem onClick={() => onOpenExplorer(currentNetworkExplorerUrl)}>
          <Telescope className="mr-2 h-3 w-3" />
          View on Explorer
        </DropdownMenuItem>
      )}
    </>
  )
}
