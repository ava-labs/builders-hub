"use client";

import { Wallet, Loader2 } from "lucide-react";
import { useAddToWallet } from "@/hooks/useAddToWallet";

interface AddToWalletButtonProps {
  rpcUrl: string;
  chainName?: string;
  chainId?: number;
  tokenSymbol?: string;
  className?: string;
  variant?: "default" | "outline" | "ghost";
}

export function AddToWalletButton({ 
  rpcUrl, 
  chainName, 
  chainId, 
  tokenSymbol = "AVAX",
  className = "",
  variant = "default",
}: AddToWalletButtonProps) {
  const { addToWallet, isAdding } = useAddToWallet();

  const handleAddToWallet = async () => {
    await addToWallet({
      rpcUrl,
      chainName,
      chainId,
      nativeCurrency: {
        name: tokenSymbol,
        symbol: tokenSymbol,
        decimals: 18,
      },
    });
  };

  const variantStyles = {
    default: "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200",
    outline: "border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-700",
    ghost: "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800",
  };

  return (
    <button
      onClick={handleAddToWallet}
      disabled={isAdding}
      className={`inline-flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer ${variantStyles[variant]} ${className}`}
      title="Add chain to wallet"
    >
      {isAdding ? (
        <Loader2 className="w-3 h-3 animate-spin" />
      ) : (
        <Wallet className="w-3 h-3" />
      )}
      <span className="hidden sm:inline">Add to Wallet</span>
    </button>
  );
}

