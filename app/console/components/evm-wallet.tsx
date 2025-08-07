
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Globe, LogOut, Plus, RefreshCw, RotateCcw, Telescope, Wallet } from "lucide-react";

export function EVMWallet() {
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
              <Wallet className="w-5 h-5 text-zinc-400 dark:text-zinc-500" />
          </div>
          <div className="flex gap-2 items-center">
            <span className="text-sm font-medium leading-none">
              0x1234...abcd
            </span>
          </div>
        </div>
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent className="w-56">
      <DropdownMenuItem >
        <Telescope className="mr-2 h-3 w-3" />
        View on Explorer
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem >
        <LogOut className="mr-2 h-3 w-3" />
        Disconnect Wallet
      </DropdownMenuItem>
      <DropdownMenuItem >
        <RotateCcw className="mr-2 h-3 w-3" />
        Reset Console
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>);
}

const formatBalance = (balance: number | string) => {
  const num = typeof balance === 'string' ? parseFloat(balance) : balance
  if (isNaN(num)) return "0"
  return num.toFixed(2)
}