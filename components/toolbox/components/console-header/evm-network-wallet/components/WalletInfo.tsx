import { useState, useEffect } from "react";
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
import { useWalletStore } from "@/components/toolbox/stores/walletStore";
import { WellKnownERC20 } from "@/components/toolbox/stores/l1ListStore";
import { createPublicClient, http, formatUnits } from "viem";
import { avalancheFuji, avalanche } from "viem/chains";

interface L1ListItem {
  id: string;
  name: string;
  evmChainId: number;
  coinName: string;
  hasBuilderHubFaucet?: boolean;
  externalFaucetUrl?: string;
  wellKnownERC20s?: WellKnownERC20[];
}

interface WalletInfoProps {
  walletAddress: string;
  currentNetworkExplorerUrl?: string;
  currentNetwork?: L1ListItem;
  onCopyAddress: () => void;
  onRefreshBalances: () => void;
  onOpenExplorer: (explorerUrl: string) => void;
}

// ERC20 ABI for balanceOf
const ERC20_BALANCE_ABI = [
  {
    inputs: [{ name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

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
  const { isTestnet, walletChainId } = useWalletStore();
  const [tokenBalances, setTokenBalances] = useState<Record<string, string>>({});

  // Get well-known tokens from the current network
  const wellKnownTokens = currentNetwork?.wellKnownERC20s || [];

  // Fetch ERC20 token balances
  useEffect(() => {
    const fetchTokenBalances = async () => {
      if (!walletAddress || !walletChainId || wellKnownTokens.length === 0) {
        setTokenBalances({});
        return;
      }

      try {
        const chain = walletChainId === 43113 ? avalancheFuji : walletChainId === 43114 ? avalanche : null;
        if (!chain) return;

        const publicClient = createPublicClient({
          chain,
          transport: http(),
        });

        const balances: Record<string, string> = {};

        for (const token of wellKnownTokens) {
          try {
            const balance = await publicClient.readContract({
              address: token.address as `0x${string}`,
              abi: ERC20_BALANCE_ABI,
              functionName: "balanceOf",
              args: [walletAddress as `0x${string}`],
            });
            balances[token.address] = formatUnits(balance, token.decimals);
          } catch (err) {
            console.error(`Error fetching ${token.symbol} balance:`, err);
            balances[token.address] = "0";
          }
        }

        setTokenBalances(balances);
      } catch (err) {
        console.error("Error fetching token balances:", err);
      }
    };

    fetchTokenBalances();
  }, [walletAddress, walletChainId, isRefreshing]);

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
              className={`h-6 w-6 p-0 hover:bg-muted transition-colors ${isCopied ? "text-green-600" : ""
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
              className={`h-6 w-6 p-0 hover:bg-muted transition-colors ${isRefreshing ? "text-blue-600" : ""
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

        {/* ERC20 Token Balances */}
        {wellKnownTokens.length > 0 && (
          <div className="mt-2 pt-2 border-t border-border/50">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium mb-1">
              Tokens
            </div>
            <div className="space-y-1">
              {wellKnownTokens.map((token) => (
                <div key={token.address} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <img 
                      src={token.logoUrl} 
                      alt={token.symbol} 
                      className="w-4 h-4 rounded-full"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                    <span className="text-xs text-foreground">{token.symbol}</span>
                  </div>
                  <span className="text-xs text-muted-foreground font-mono">
                    {tokenBalances[token.address] 
                      ? parseFloat(tokenBalances[token.address]).toFixed(2) 
                      : "0.00"}
                  </span>
                </div>
              ))}
            </div>
            {wellKnownTokens.some(t => t.faucetUrl) && isTestnet && (
              <div className="mt-2">
                {wellKnownTokens.filter(t => t.faucetUrl).map((token) => (
                  <a
                    key={token.address}
                    href={token.faucetUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] text-blue-500 hover:underline flex items-center gap-1"
                  >
                    <Droplets className="h-2.5 w-2.5" />
                    Get {token.symbol} from faucet
                  </a>
                ))}
              </div>
            )}
          </div>
        )}
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
