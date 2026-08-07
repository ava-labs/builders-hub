"use client";

import { useState, useCallback } from "react";
import { useWalletStore } from "@/components/toolbox/stores/walletStore";
import { useWalletType } from "@/components/toolbox/stores/walletStore";
import { toast } from "@/lib/toast";
import { rpcUrlsEquivalent } from "@/components/toolbox/lib/rpcUrl";

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
  isTestnet?: boolean;
}

export interface AddToWalletResult {
  ok: boolean;
  alreadyAdded: boolean;
  /** Core only: the chain exists in the wallet with a DIFFERENT RPC URL
   *  than the one we tried to register. Wallets dedupe
   *  wallet_addEthereumChain, so the correction was NOT applied — the user
   *  must update it manually in the wallet's network settings. */
  rpcUrlMismatch?: boolean;
  walletRpcUrl?: string;
}

interface UseAddToWalletReturn {
  addToWallet: (options: AddToWalletOptions) => Promise<AddToWalletResult>;
  isAdding: boolean;
  isWalletConnected: boolean;
}

export function useAddToWallet(): UseAddToWalletReturn {
  const [isAdding, setIsAdding] = useState(false);
  const coreWalletClient = useWalletStore((s) => s.coreWalletClient);
  const walletType = useWalletType();
  const isWalletConnected = !!coreWalletClient;

  const addToWallet = useCallback(async (options: AddToWalletOptions): Promise<AddToWalletResult> => {
    const { rpcUrl, chainName, chainId, nativeCurrency, blockExplorerUrl, isTestnet } = options;

    // Check if ethereum provider is available
    if (typeof window === "undefined" || !window.ethereum) {
      toast.error("No wallet detected", "Please install a Web3 wallet like Core or MetaMask");
      return { ok: false, alreadyAdded: false };
    }

    setIsAdding(true);

    try {
      // Request account access first — required before any wallet_ method.
      // Some wallets (MetaMask) return 4100 "not authorized" if this is
      // skipped and the site hasn't been connected in this session yet.
      try {
        await window.ethereum.request({ method: "eth_requestAccounts" });
      } catch (authError: any) {
        if (authError.code === 4001) {
          toast.error("Request rejected", "Please connect your wallet first");
          return { ok: false, alreadyAdded: false };
        }
        // Non-4001 errors (e.g. already connected) are safe to ignore.
      }

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

        // The chain was already added. Wallets dedupe wallet_addEthereumChain,
        // so if it was registered with a stale RPC URL (e.g. localhost for a
        // node that actually runs remotely, issue #4450) the corrected URL we
        // were called with is silently discarded. Core exposes a read for the
        // active chain, so detect the mismatch and instruct instead of
        // toasting an unqualified success.
        let rpcUrlMismatch: boolean | undefined;
        let walletRpcUrl: string | undefined;
        if (walletType === "core" && (window as any).avalanche?.request) {
          try {
            const walletChain: any = await (window as any).avalanche.request({
              method: "wallet_getEthereumChain",
            });
            // The switch above may have run in a different provider
            // (window.ethereum) than the one being read here: only compare
            // when the returned chain IS the chain we just switched to.
            const returnedChainId =
              typeof walletChain?.chainId === "string"
                ? parseInt(walletChain.chainId, 16)
                : typeof walletChain?.chainId === "number"
                  ? walletChain.chainId
                  : null;
            if (returnedChainId === parseInt(chainIdHex, 16)) {
              walletRpcUrl = walletChain?.rpcUrls?.[0];
              if (typeof walletRpcUrl === "string" && walletRpcUrl) {
                rpcUrlMismatch = !rpcUrlsEquivalent(walletRpcUrl, rpcUrl);
              }
            }
          } catch {
            // Advisory only — never fail the flow over the read.
          }
        }

        if (rpcUrlMismatch) {
          toast.warning(
            "Already in your wallet — with a different RPC URL",
            "Wallets don't let sites update it. Open your wallet's network settings (Core: Settings > Networks) and update the RPC URL manually.",
          );
        } else {
          toast.info("Already added", `${chainName || "Chain"} is already in your wallet`);
        }
        return { ok: true, alreadyAdded: true, rpcUrlMismatch, walletRpcUrl };
      } catch (switchError: any) {
        // Error 4902 means chain not found - we need to add it
        // Error -32603 is also used by some wallets for chain not found
        if (switchError.code === 4902 || switchError.code === -32603 || switchError.code === 4100) {
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
              ...(walletType === 'core' && isTestnet !== undefined ? { isTestnet } : {}),
            }],
          });
          toast.success("Chain added", `${chainName || "Chain"} has been added to your wallet`);
          return { ok: true, alreadyAdded: false };
        }
        // User rejected the switch request
        if (switchError.code === 4001) {
          toast.info("Already added", `${chainName || "Chain"} is already in your wallet`);
          return { ok: true, alreadyAdded: true };
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
      return { ok: false, alreadyAdded: false };
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

