import { useState } from "react";
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Copy,
  RefreshCw,
  ExternalLink,
  Check,
  Droplets,
  SquareArrowOutUpRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWalletStore } from "@/stores/walletStore";

interface L1ListItem {
  id: string;
  name: string;
  evmChainId: number;
  coinName: string;
  hasBuilderHubFaucet?: boolean;
  externalFaucetUrl?: string;
}

interface WalletInfoProps {
  walletAddress: string;
  currentNetworkExplorerUrl?: string;
  currentNetwork?: L1ListItem;
  onCopyAddress: () => void;
  onRefreshBalances: () => void;
  onOpenExplorer: (explorerUrl: string) => void;
}

export function WalletInfo({
  walletAddress,
  currentNetworkExplorerUrl,
  currentNetwork,
  onCopyAddress,
  onRefreshBalances,
  onOpenExplorer,
}: WalletInfoProps) {
  const [isCopied, setIsCopied] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { isTestnet } = useWalletStore();

  // Format EVM address for compact display
  const formatAddressForDisplay = (
    address: string,
    leading: number = 6,
    trailing: number = 4
  ) => {
    if (!address) return "";
    if (address.length <= leading + trailing + 3) return address;
    return `${address.slice(0, leading)}...${address.slice(-trailing)}`;
  };

  const handleCopyAddress = async () => {
    await onCopyAddress();
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 1000);
  };

  const handleRefreshBalances = async () => {
    setIsRefreshing(true);
    await onRefreshBalances();
    setTimeout(() => setIsRefreshing(false), 2000);
  };

  const handleBuilderHubFaucet = () => {
    window.location.href = "/console/primary-network/faucet";
  };

  const handleExternalFaucet = () => {
    if (currentNetwork?.externalFaucetUrl) {
      window.location.href = currentNetwork.externalFaucetUrl;
    }
  };

  return (
    <>
      <DropdownMenuSeparator />

      {/* Compact wallet address display with inline actions */}
      <div className="px-3 py-2 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium mb-1">
              Wallet
            </div>
            <div
              className="text-xs font-mono text-foreground cursor-pointer hover:text-primary transition-colors"
              title={walletAddress || "Not connected"}
              onClick={handleCopyAddress}
            >
              {walletAddress
                ? formatAddressForDisplay(walletAddress)
                : "Not connected"}
            </div>
          </div>

          {/* Compact action buttons */}
          <div className="flex items-center gap-1 ml-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopyAddress}
              className={`h-6 w-6 p-0 hover:bg-muted transition-colors ${
                isCopied ? "text-green-600" : ""
              }`}
              title={isCopied ? "Copied!" : "Copy address"}
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
              onClick={handleRefreshBalances}
              className={`h-6 w-6 p-0 hover:bg-muted transition-colors ${
                isRefreshing ? "text-blue-600" : ""
              }`}
              title={isRefreshing ? "Refreshing..." : "Refresh balances"}
              disabled={isRefreshing}
            >
              <RefreshCw
                className={`h-3 w-3 ${isRefreshing ? "animate-spin" : ""}`}
              />
            </Button>

            {currentNetworkExplorerUrl && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onOpenExplorer(currentNetworkExplorerUrl)}
                className="h-6 w-6 p-0 hover:bg-muted"
                title="View on explorer"
              >
                <ExternalLink className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Faucet options */}
      {isTestnet &&
        currentNetwork &&
        (() => {
          const hasBuilderHubFaucet = currentNetwork.hasBuilderHubFaucet;
          const hasExternalFaucet = currentNetwork.externalFaucetUrl;

          if (!hasBuilderHubFaucet && !hasExternalFaucet) return null;

          return (
            <>
              <DropdownMenuSeparator />
              {hasBuilderHubFaucet && (
                <DropdownMenuItem
                  onClick={handleBuilderHubFaucet}
                  className="cursor-pointer"
                >
                  <Droplets className="mr-2 h-3 w-3" />
                  Claim free Testnet {currentNetwork.coinName}
                </DropdownMenuItem>
              )}

              {hasExternalFaucet && (
                <DropdownMenuItem
                  onClick={handleExternalFaucet}
                  className="cursor-pointer"
                >
                  <SquareArrowOutUpRight className="mr-2 h-3 w-3" />
                  Open External Faucet
                </DropdownMenuItem>
              )}
            </>
          );
        })()}
    </>
  );
}
