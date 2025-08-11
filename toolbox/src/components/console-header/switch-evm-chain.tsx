
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { AddChainModal } from "@/components/ConnectWallet/AddChainModal";
import { Globe, Plus, RefreshCw } from "lucide-react";
import { useL1ListStore } from "@/stores/l1ListStore";
import { useWalletStore } from "@/stores/walletStore";
import { useState, useCallback } from "react";
import { useErrorBoundary } from "react-error-boundary";

export function SwitchEVMChain({ enforceChainId }: { enforceChainId?: number }) {

  const { walletChainId } = useWalletStore();
  const { l1List, addL1, removeL1 } = useL1ListStore()();
  const { coreWalletClient } = useWalletStore();
  const { showBoundary } = useErrorBoundary();
  
  const [isAddChainModalOpen, setIsAddChainModalOpen] = useState(false);

  const handleSwitchChain = useCallback((chainId: number) => {
    coreWalletClient.switchChain({
      id: `0x${chainId.toString(16)}`,
    }).catch(showBoundary);
  }, [coreWalletClient, showBoundary]);

  const currentNetwork = {
    name: "C-Chain",
    symbol: "AVAX",
    balance: 136.78,
    logoUrl: "https://images.ctfassets.net/gcj8jwzm6086/5VHupNKwnDYJvqMENeV7iJ/3e4b8ff10b69bfa31e70080a4b142cd0/avalanche-avax-logo.svg",
  };
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
        {l1List.map((chain) =>
          <DropdownMenuItem >
            <Globe className="mr-2 h-3 w-3" />
            {chain.name}
          </DropdownMenuItem>
        )}
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