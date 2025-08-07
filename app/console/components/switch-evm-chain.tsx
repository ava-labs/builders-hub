
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Globe, Plus, RefreshCw } from "lucide-react";

export function SwitchEVMChain() {
  const currentNetwork = {
    name: "C-Chain",
    symbol: "AVAX",
    balance: 136.78,
    logoUrl: "https://images.ctfassets.net/gcj8jwzm6086/5VHupNKwnDYJvqMENeV7iJ/3e4b8ff10b69bfa31e70080a4b142cd0/avalanche-avax-logo.svg",
  };
  return (<DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button variant="outline" size="sm">
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0 w-5 h-5 rounded-md overflow-hidden flex items-center justify-start">
            {currentNetwork.logoUrl ? (
              <img src={currentNetwork.logoUrl} alt={`${currentNetwork.name} logo`} className="w-full h-full object-cover" />
            ) : (
              <Globe className="w-5 h-5 text-zinc-400 dark:text-zinc-500" />
            )}
          </div>
          <div className="flex gap-2 items-center">
            <span className="text-sm font-medium leading-none">
              {currentNetwork.name}
            </span>
            <span className="text-xs text-muted-foreground leading-none">
              {formatBalance(currentNetwork.balance)} {currentNetwork.symbol}
            </span>
          </div>
        </div>
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent className="w-56">
      <DropdownMenuItem >Other L1s</DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem >
        <Plus className="mr-2 h-3 w-3" />
        Add Network
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem >
        <RefreshCw className="mr-2 h-3 w-3" />
        Refresh Balances
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>);
}

const formatBalance = (balance: number | string) => {
  const num = typeof balance === 'string' ? parseFloat(balance) : balance
  if (isNaN(num)) return "0"
  return num.toFixed(2)
}