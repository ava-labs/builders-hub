'use client'

import { useState } from 'react';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { ArrowLeftRight, Copy, RefreshCw, Check } from "lucide-react";
import { useWalletStore } from "@/stores/walletStore";
import { PChainFaucetMenuItem } from "./components/PChainFaucetMenuItem";

export function WalletPChain() {
  const pChainAddress = useWalletStore((s) => s.pChainAddress);
  const pChainBalance = useWalletStore((s) => s.balances.pChain);
  const updatePChainBalance = useWalletStore((s) => s.updatePChainBalance);
  const walletEVMAddress = useWalletStore((s) => s.walletEVMAddress);

  const [isCopied, setIsCopied] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleCopy = async () => {
    if (pChainAddress) {
      await navigator.clipboard.writeText(pChainAddress);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 1000);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await updatePChainBalance();
    setTimeout(() => setIsRefreshing(false), 2000);
  };

  // Format P-Chain address for compact display
  const formatAddressForDisplay = (
    address: string,
    leading: number = 6,
    trailing: number = 4
  ) => {
    if (!address) return ''
    if (address.length <= leading + trailing + 3) return address
    return `${address.slice(0, leading)}...${address.slice(-trailing)}`
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
        {/* Modern minimized wallet info section */}
        <div className="px-3 py-2 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium mb-1">
                P-Chain Address
              </div>
              <div 
                className="text-xs font-mono text-foreground cursor-pointer hover:text-primary transition-colors"
                title={pChainAddress || 'Not connected'}
                onClick={handleCopy}
              >
                {pChainAddress
                  ? formatAddressForDisplay(pChainAddress)
                  : 'Not connected'}
              </div>
            </div>
            
            {/* Compact action buttons */}
            <div className="flex items-center gap-1 ml-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopy}
                className={`h-6 w-6 p-0 hover:bg-muted transition-colors ${
                  isCopied ? 'text-green-600' : ''
                }`}
                title={isCopied ? 'Copied!' : 'Copy address'}
              >
                {isCopied ? (
                  <Check className="h-3 w-3" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
              </Button>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRefresh}
                className={`h-6 w-6 p-0 hover:bg-muted transition-colors ${
                  isRefreshing ? 'text-blue-600' : ''
                }`}
                title={isRefreshing ? 'Refreshing...' : 'Refresh balance'}
                disabled={isRefreshing}
              >
                <RefreshCw className={`h-3 w-3 ${isRefreshing ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </div>
        
        <DropdownMenuSeparator />
        <PChainFaucetMenuItem />
        <DropdownMenuItem onClick={() => window.location.href = '/console/primary-network/c-p-bridge'} className='cursor-pointer'>
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
