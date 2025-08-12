'use client'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { AddChainModal } from "@/components/ConnectWallet/AddChainModal";
import { Globe, Plus } from "lucide-react";
import { useL1ListStore } from "@/stores/l1ListStore";
import { useState } from "react";
import { useWalletStore } from "@/stores/walletStore";

export function SwitchEVMChain({}: { enforceChainId?: number }) {
  const { l1List, addL1 } = useL1ListStore()();
  const coreWalletClient = useWalletStore((s) => s.coreWalletClient);
  const walletEVMAddress = useWalletStore((s) => s.walletEVMAddress);
  const [isAddChainModalOpen, setIsAddChainModalOpen] = useState(false);

  const walletChainId = useWalletStore((s) => s.walletChainId);
  const currentNetwork = l1List.find((l) => l.evmChainId === walletChainId) || {
    name: "EVM Network",
    logoUrl: "",
  } as any;
  if (!walletEVMAddress) return null;

  return (<>
    <DropdownMenu>
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
            </div>
          </div>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56">
        {l1List.map((chain) => (
          <DropdownMenuItem
            key={chain.id}
            onClick={() => coreWalletClient.switchChain({ id: chain.evmChainId })}
          >
            <Globe className="mr-2 h-3 w-3" />
            {chain.name}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => setIsAddChainModalOpen(true)}>
          <Plus className="mr-2 h-3 w-3" />
          Add Network
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>

    {/* Add Chain Modal */}
    {isAddChainModalOpen && <AddChainModal
      onClose={() => setIsAddChainModalOpen(false)}
      onAddChain={addL1}
    />}
  </>
  );
}