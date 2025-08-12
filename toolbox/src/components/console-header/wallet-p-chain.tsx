'use client'

import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { ArrowLeftRight, Copy, Droplet, RefreshCw } from "lucide-react";
import { useWalletStore } from "@/stores/walletStore";

export function WalletPChain() {
  const pChainAddress = useWalletStore((s) => s.pChainAddress);
  const pChainBalance = useWalletStore((s) => s.pChainBalance);
  const updatePChainBalance = useWalletStore((s) => s.updatePChainBalance);
  const walletEVMAddress = useWalletStore((s) => s.walletEVMAddress);

  const copy = async () => {
    if (pChainAddress) await navigator.clipboard.writeText(pChainAddress);
  };

  if (!walletEVMAddress) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-5 h-5 rounded-md overflow-hidden flex items-center justify-start">
              <img src="https://images.ctfassets.net/gcj8jwzm6086/42aMwoCLblHOklt6Msi6tm/1e64aa637a8cead39b2db96fe3225c18/pchain-square.svg" alt="P-Chain Logo" className="w-full h-full object-cover" />
            </div>
            <div className="flex gap-2 items-center">
              <span className="text-sm font-medium leading-none">P-Chain</span>
              <span className="text-xs text-muted-foreground leading-none">
                {formatBalance(pChainBalance)} AVAX
              </span>
            </div>
          </div>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-60">
        {pChainAddress && (
          <DropdownMenuItem>
            <span className="text-xs font-mono truncate max-w-[14rem] block">{pChainAddress}</span>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={updatePChainBalance}>
          <RefreshCw className="mr-2 h-3 w-3" />
          Refresh Balance
        </DropdownMenuItem>
        <DropdownMenuItem onClick={copy}>
          <Copy className="mr-2 h-3 w-3" />
          Copy Address
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem>
          <Droplet className="mr-2 h-3 w-3" />
          Get AVAX from Faucet
        </DropdownMenuItem>
        <DropdownMenuItem>
          <ArrowLeftRight className="mr-2 h-3 w-3" />
          Bridge AVAX from C-Chain
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const formatBalance = (balance: number | string) => {
  const num = typeof balance === 'string' ? parseFloat(balance) : balance
  if (isNaN(num)) return "0"
  return num.toFixed(2)
}