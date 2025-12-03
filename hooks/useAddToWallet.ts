"use client";

import { useState, useCallback } from "react";
import { useWalletStore } from "@/components/toolbox/stores/walletStore";
import { toast } from "@/lib/toast";

interface AddToWalletOptions {
  rpcUrl: string;
  chainName?: string;
  chainId?: number;
  nativeCurrency?: {
    name: string;
    symbol: string;
    decimals: number;
  };
  blockExplorerUrl?: string;
}

interface UseAddToWalletReturn {
  addToWallet: (options: AddToWalletOptions) => Promise<boolean>;
  isAdding: boolean;
  isWalletConnected: boolean;
}

export function useAddToWallet(): UseAddToWalletReturn {
  const [isAdding, setIsAdding] = useState(false);
  const coreWalletClient = useWalletStore((s) => s.coreWalletClient);
  const isWalletConnected = !!coreWalletClient;

  const addToWallet = useCallback(async (options: AddToWalletOptions): Promise<boolean> => {
    const { rpcUrl, chainName, chainId, nativeCurrency, blockExplorerUrl } = options;

    // Check if ethereum provider is available
    if (typeof window === "undefined" || !window.ethereum) {
      toast.error("No wallet detected", "Please install a Web3 wallet like Core or MetaMask");
      return false;
    }

    setIsAdding(true);

    try {
      let chainIdHex: string;

      if (chainId) {
        chainIdHex = `0x${chainId.toString(16)}`;
      } else {
        // Fetch chain info from RPC
        const response = await fetch(rpcUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            method: "eth_chainId",
            params: [],
            id: 1,
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to fetch chain ID from RPC");
        }

        const data = await response.json();
        chainIdHex = data.result;
      }

      // Check if chain is already added by trying to get its info
      try {
        // Try to switch to the chain - if it succeeds, chain is already added
        await window.ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: chainIdHex }],
        });
        // If we get here, the chain was already added - switch back to original chain
        toast.info("Already added", `${chainName || "Chain"} is already in your wallet`);
        return true;
      } catch (switchError: any) {
        // Error 4902 means chain not found - we need to add it
        // Error -32603 is also used by some wallets for chain not found
        if (switchError.code === 4902 || switchError.code === -32603) {
          // Chain not added yet, proceed to add it
          await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [{
              chainId: chainIdHex,
              chainName: chainName || "Unknown Chain",
              rpcUrls: [rpcUrl],
              nativeCurrency: nativeCurrency || {
                name: "AVAX",
                symbol: "AVAX",
                decimals: 18,
              },
              blockExplorerUrls: blockExplorerUrl ? [blockExplorerUrl] : undefined,
            }],
          });
          toast.success("Chain added", `${chainName || "Chain"} has been added to your wallet`);
          return true;
        }
        // User rejected the switch request
        if (switchError.code === 4001) {
          toast.info("Already added", `${chainName || "Chain"} is already in your wallet`);
          return true;
        }
        throw switchError;
      }
    } catch (error: any) {
      console.error("Failed to add chain to wallet:", error);
      
      if (error.code === 4001) {
        toast.error("Request rejected", "You rejected the request");
      } else {
        toast.error("Failed to add chain", error.message || "An error occurred");
      }
      return false;
    } finally {
      setIsAdding(false);
    }
  }, []);

  return {
    addToWallet,
    isAdding,
    isWalletConnected,
  };
}

