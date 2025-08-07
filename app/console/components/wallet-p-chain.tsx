
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Copy } from "lucide-react";

export function WalletPChain() {
  return (<DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button variant="outline" size="sm">
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0 w-5 h-5 rounded-md overflow-hidden flex items-center justify-start">
              <img src="https://images.ctfassets.net/gcj8jwzm6086/42aMwoCLblHOklt6Msi6tm/1e64aa637a8cead39b2db96fe3225c18/pchain-square.svg" alt="P-Chain Logo" className="w-full h-full object-cover" />
          </div>
          <div className="flex gap-2 items-center">
            <span className="text-sm font-medium leading-none">
              P-Chain
            </span>
            <span className="text-xs text-muted-foreground leading-none">
              23.45 AVAX
            </span>
          </div>
        </div>
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent className="w-56">
      <DropdownMenuItem >
        <Copy className="mr-2 h-3 w-3" />
        Copy Address
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem >Claim P-Chain AVAX from Faucet</DropdownMenuItem>
      <DropdownMenuItem >Bridge AVAX from C-Chain to P-Chain</DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>);
}