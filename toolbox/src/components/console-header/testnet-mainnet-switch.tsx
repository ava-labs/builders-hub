'use client'

import { useWalletStore } from "@/stores/walletStore";
import { avalanche, avalancheFuji } from "viem/chains";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useWalletSwitch } from "../../hooks/useWalletSwitch";

export function TestnetMainnetSwitch() {
  const isTestnet = useWalletStore((s) => s.isTestnet);
  const walletEVMAddress = useWalletStore((s) => s.walletEVMAddress);
  const { safelySwitch } = useWalletSwitch();

  if (!walletEVMAddress) return null;

  return (<DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button variant="outline" size="sm">
        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full ${isTestnet ? "bg-yellow-500" : "bg-green-500"}`} />
          {isTestnet ? "Testnet" : "Mainnet"}
        </div>
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent className="w-30">
      <DropdownMenuItem onClick={() => safelySwitch(avalancheFuji.id, true)} >
        Testnet
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => safelySwitch(avalanche.id, false)} >
        Mainnet
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>

  );
}