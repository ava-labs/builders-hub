"use client";

import { useState, useEffect, useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  Coins,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Search,
} from "lucide-react";
import { useWalletStore } from "@/components/toolbox/stores/walletStore";
import { useICTTSetupStore } from "@/components/toolbox/stores/icttSetupStore";
import { useSelectedL1, useWrappedNativeToken, type WellKnownERC20 } from "@/components/toolbox/stores/l1ListStore";
import { useViemChainStore } from "@/components/toolbox/stores/toolboxStore";
import { createPublicClient, http, formatUnits } from "viem";
import { erc20Abi } from "viem";

interface SelectTokenStepProps {
  onComplete: () => void;
  onProcessing: (processing: boolean) => void;
}

export function SelectTokenStep({ onComplete, onProcessing }: SelectTokenStepProps) {
  const { walletEVMAddress, isTestnet } = useWalletStore();
  const store = useICTTSetupStore(isTestnet);
  const state = store();
  const selectedL1 = useSelectedL1()();
  const viemChain = useViemChainStore();
  const wrappedNativeAddress = useWrappedNativeToken();

  const [customAddress, setCustomAddress] = useState("");
  const [isValidating, setIsValidating] = useState(false);
  const [tokenInfo, setTokenInfo] = useState<{
    name: string;
    symbol: string;
    decimals: number;
    balance: string;
  } | null>(null);
  const [error, setError] = useState("");

  // Build token suggestions
  const suggestions = useMemo(() => {
    const items: { address: string; symbol: string; name: string; description: string }[] = [];

    // Add wrapped native if available
    if (wrappedNativeAddress) {
      items.push({
        address: wrappedNativeAddress,
        symbol: `W${selectedL1?.coinName || "NATIVE"}`,
        name: `Wrapped ${selectedL1?.coinName || "Native Token"}`,
        description: "Your chain's wrapped native token",
      });
    }

    // Add well-known ERC20s
    if (selectedL1?.wellKnownERC20s) {
      selectedL1.wellKnownERC20s.forEach((token: WellKnownERC20) => {
        items.push({
          address: token.address,
          symbol: token.symbol,
          name: token.name,
          description: token.faucetInfo || "Well-known token",
        });
      });
    }

    return items;
  }, [selectedL1, wrappedNativeAddress]);

  // Validate token address
  const validateToken = async (address: string) => {
    if (!address || !viemChain) return;

    setIsValidating(true);
    setError("");
    onProcessing(true);

    try {
      const publicClient = createPublicClient({
        chain: viemChain,
        transport: http(viemChain.rpcUrls.default.http[0]),
      });

      const [name, symbol, decimals, balance] = await Promise.all([
        publicClient.readContract({
          address: address as `0x${string}`,
          abi: erc20Abi,
          functionName: "name",
        }),
        publicClient.readContract({
          address: address as `0x${string}`,
          abi: erc20Abi,
          functionName: "symbol",
        }),
        publicClient.readContract({
          address: address as `0x${string}`,
          abi: erc20Abi,
          functionName: "decimals",
        }),
        walletEVMAddress
          ? publicClient.readContract({
              address: address as `0x${string}`,
              abi: erc20Abi,
              functionName: "balanceOf",
              args: [walletEVMAddress as `0x${string}`],
            })
          : BigInt(0),
      ]);

      setTokenInfo({
        name: name as string,
        symbol: symbol as string,
        decimals: decimals as number,
        balance: formatUnits(balance as bigint, decimals as number),
      });
    } catch (err) {
      setError("Invalid token address or not an ERC20 contract");
      setTokenInfo(null);
    } finally {
      setIsValidating(false);
      onProcessing(false);
    }
  };

  // Auto-validate when address changes
  useEffect(() => {
    if (customAddress.length === 42 && customAddress.startsWith("0x")) {
      validateToken(customAddress);
    } else {
      setTokenInfo(null);
    }
  }, [customAddress, viemChain?.id]);

  // Handle token selection
  const handleSelectToken = () => {
    if (!tokenInfo) return;

    state.setSourceToken(customAddress, tokenInfo.symbol, tokenInfo.decimals);
    onComplete();
  };

  // Handle suggestion click
  const handleSuggestionClick = (address: string) => {
    setCustomAddress(address);
  };

  const isSelected = state.sourceTokenAddress === customAddress && customAddress.length === 42;

  return (
    <div className="space-y-6">
      {/* Token Input */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Token Contract Address
        </label>
        <div className="relative">
          <input
            type="text"
            value={customAddress}
            onChange={(e) => setCustomAddress(e.target.value)}
            placeholder="0x..."
            className={cn(
              "w-full px-4 py-3 rounded-lg border bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-mono text-sm",
              error
                ? "border-red-500 focus:ring-red-500"
                : tokenInfo
                ? "border-green-500 focus:ring-green-500"
                : "border-zinc-200 dark:border-zinc-700 focus:ring-blue-500"
            )}
          />
          {isValidating && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <Loader2 className="w-5 h-5 text-zinc-400 animate-spin" />
            </div>
          )}
          {tokenInfo && !isValidating && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <CheckCircle2 className="w-5 h-5 text-green-500" />
            </div>
          )}
        </div>
        {error && (
          <p className="text-sm text-red-600 dark:text-red-400 flex items-center gap-1">
            <AlertCircle className="w-4 h-4" />
            {error}
          </p>
        )}
      </div>

      {/* Token Info Card */}
      {tokenInfo && (
        <div className="p-4 rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/20">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/50 flex items-center justify-center">
                <Coins className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <div className="font-medium text-zinc-900 dark:text-zinc-100">
                  {tokenInfo.name}
                </div>
                <div className="text-sm text-zinc-500 dark:text-zinc-400">
                  {tokenInfo.symbol} • {tokenInfo.decimals} decimals
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-500 dark:text-zinc-400">Your Balance</span>
            <span className="font-mono text-zinc-900 dark:text-zinc-100">
              {parseFloat(tokenInfo.balance).toLocaleString()} {tokenInfo.symbol}
            </span>
          </div>
        </div>
      )}

      {/* Suggestions */}
      {suggestions.length > 0 && !tokenInfo && (
        <div className="space-y-2">
          <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
            Available Tokens
          </label>
          <div className="grid gap-2">
            {suggestions.map((token) => (
              <button
                key={token.address}
                onClick={() => handleSuggestionClick(token.address)}
                className="w-full p-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:border-blue-300 dark:hover:border-blue-700 transition-colors text-left"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-zinc-900 dark:text-zinc-100">
                      {token.symbol}
                    </div>
                    <div className="text-xs text-zinc-500 dark:text-zinc-400">
                      {token.description}
                    </div>
                  </div>
                  <code className="text-xs text-zinc-400 font-mono">
                    {token.address.slice(0, 6)}...{token.address.slice(-4)}
                  </code>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Action Button */}
      <button
        onClick={handleSelectToken}
        disabled={!tokenInfo || isValidating}
        className={cn(
          "w-full py-3 px-4 rounded-lg font-medium text-sm transition-colors",
          tokenInfo && !isValidating
            ? "bg-blue-600 hover:bg-blue-700 text-white"
            : "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 cursor-not-allowed"
        )}
      >
        {isSelected ? "Token Selected ✓" : "Continue with this Token"}
      </button>
    </div>
  );
}

export default SelectTokenStep;
