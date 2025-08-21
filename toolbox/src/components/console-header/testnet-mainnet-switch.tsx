'use client'

import { useWalletStore } from "@/stores/walletStore";
import { avalanche, avalancheFuji } from "viem/chains";
import { networkIDs } from "@avalabs/avalanchejs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../ui/dropdown-menu";
import { Button } from "@/components/ui/button";

export function TestnetMainnetSwitch() {
  const coreWalletClient = useWalletStore((s) => s.coreWalletClient);
  const isTestnet = useWalletStore((s) => s.isTestnet);
  const walletEVMAddress = useWalletStore((s) => s.walletEVMAddress);
  const setWalletChainId = useWalletStore((s) => s.setWalletChainId);
  const setIsTestnet = useWalletStore((s) => s.setIsTestnet);
  const setAvalancheNetworkID = useWalletStore((s) => s.setAvalancheNetworkID);

  const safelySwitch = async (chainId: number, testnet: boolean) => {
    try {
      await coreWalletClient.switchChain({ id: chainId });
    } catch (e) {
      // Non-fatal in header context; Connect flow handles wallet specifics
      console.debug("switchChain failed in header:", e);
    } finally {
      // Optimistically update store so UI reflects the intent immediately
      setWalletChainId(chainId);
      setIsTestnet(testnet);
      setAvalancheNetworkID(testnet ? networkIDs.FujiID : networkIDs.MainnetID);
    }
  };

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