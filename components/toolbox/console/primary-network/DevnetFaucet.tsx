"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { Copy, Check, AlertTriangle, Droplets, ExternalLink, RefreshCw, Wallet } from "lucide-react";
import {
  BaseConsoleToolProps,
  ConsoleToolMetadata,
  withConsoleToolMetadata,
} from "../../components/WithConsoleToolMetadata";
import { generateConsoleToolGitHubUrl } from "@/components/toolbox/utils/github-url";
import { AccountRequirementsConfigKey } from "../../hooks/useAccountRequirements";
import { useWalletStore } from "@/components/toolbox/stores/walletStore";

const DEVNET_RPC_URL = "https://api.avax-dev.network/ext/bc/C/rpc";
const DEVNET_CHAIN_ID = 43117;
const DEVNET_CHAIN_ID_HEX = "0xa86d";

const metadata: ConsoleToolMetadata = {
  title: "Devnet Faucet",
  description: "Request free devnet AVAX on the C-Chain (Ava Labs internal)",
  toolRequirements: [
    AccountRequirementsConfigKey.UserLoggedIn,
  ],
  githubUrl: generateConsoleToolGitHubUrl(import.meta.url),
};

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors"
      title={`Copy ${label || text}`}
    >
      {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? "Copied" : (label || "Copy")}
    </button>
  );
}

function DevnetFaucet({ onSuccess }: BaseConsoleToolProps) {
  const { data: session } = useSession();
  const { walletEVMAddress } = useWalletStore();
  const [isDripping, setIsDripping] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string; txHash?: string } | null>(null);

  const [faucetBalance, setFaucetBalance] = useState<string | null>(null);
  const [faucetAddress, setFaucetAddress] = useState<string | null>(null);
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);

  const userEmail = session?.user?.email || "";
  const isAvaLabs = userEmail.endsWith("@avalabs.org");

  const fetchBalance = useCallback(async () => {
    setIsLoadingBalance(true);
    try {
      const res = await fetch("/api/devnet-faucet/balance");
      const data = await res.json();
      if (data.success) {
        setFaucetBalance(data.balance);
        setFaucetAddress(data.address);
      }
    } catch {
      // silently fail
    } finally {
      setIsLoadingBalance(false);
    }
  }, []);

  useEffect(() => {
    if (isAvaLabs) {
      fetchBalance();
    }
  }, [isAvaLabs, fetchBalance]);

  const handleAddNetwork = async () => {
    if (!window.ethereum) return;
    try {
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: DEVNET_CHAIN_ID_HEX,
            chainName: "Avalanche Devnet C-Chain",
            nativeCurrency: { name: "AVAX", symbol: "AVAX", decimals: 18 },
            rpcUrls: [DEVNET_RPC_URL],
          },
        ],
      });
    } catch (err) {
      console.error("Failed to add network:", err);
    }
  };

  const handleSwitchNetwork = async () => {
    if (!window.ethereum) return;
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: DEVNET_CHAIN_ID_HEX }],
      });
    } catch (err: any) {
      // 4902 = chain not added yet
      if (err?.code === 4902) {
        await handleAddNetwork();
      } else {
        console.error("Failed to switch network:", err);
      }
    }
  };

  const handleDrip = async () => {
    if (!walletEVMAddress || isDripping) return;

    setIsDripping(true);
    setResult(null);

    try {
      const response = await fetch(
        `/api/devnet-faucet?address=${walletEVMAddress}`
      );
      const data = await response.json();

      if (!response.ok) {
        setResult({ success: false, message: data.message || "Failed to drip tokens" });
        return;
      }

      setResult({
        success: true,
        message: `Sent ${data.amount} AVAX`,
        txHash: data.txHash,
      });
      // Refresh balance after drip
      setTimeout(() => fetchBalance(), 2000);
    } catch (err) {
      setResult({ success: false, message: "Network error. Please try again." });
    } finally {
      setIsDripping(false);
    }
  };

  // Gate: must be @avalabs.org
  if (!isAvaLabs) {
    return (
      <div className="max-w-4xl mx-auto not-prose">
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-6 text-center">
          <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-3" />
          <h3 className="font-medium text-zinc-900 dark:text-white mb-2">
            Ava Labs Access Only
          </h3>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-1">
            The Devnet Faucet is restricted to Ava Labs team members.
          </p>
          <p className="text-sm text-zinc-500">
            Please log in with your <span className="font-mono font-medium">@avalabs.org</span> email to access this tool.
          </p>
          {userEmail && (
            <p className="text-xs text-zinc-400 mt-3">
              Logged in as: <span className="font-mono">{userEmail}</span>
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto not-prose">
      {/* Network Info */}
      <div className="mb-6">
        <h2 className="text-xs font-mono uppercase tracking-wider text-zinc-500 mb-2">
          Devnet Network
        </h2>

        <div className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-zinc-600 dark:text-zinc-400">RPC Endpoint</span>
            <div className="flex items-center gap-2">
              <code className="text-sm font-mono text-zinc-900 dark:text-white bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded">
                {DEVNET_RPC_URL}
              </code>
              <CopyButton text={DEVNET_RPC_URL} label="RPC" />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-zinc-600 dark:text-zinc-400">Chain ID</span>
            <div className="flex items-center gap-2">
              <code className="text-sm font-mono text-zinc-900 dark:text-white bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded">
                {DEVNET_CHAIN_ID}
              </code>
              <CopyButton text={DEVNET_CHAIN_ID.toString()} label="Chain ID" />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-zinc-600 dark:text-zinc-400">Network</span>
            <span className="text-sm font-medium text-zinc-900 dark:text-white">Avalanche Devnet C-Chain</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-zinc-600 dark:text-zinc-400 flex items-center gap-1.5">
              <Wallet className="w-3.5 h-3.5" />
              Faucet Balance
            </span>
            <div className="flex items-center gap-2">
              {isLoadingBalance ? (
                <span className="text-sm text-zinc-400 animate-pulse">Loading...</span>
              ) : faucetBalance !== null ? (
                <span className="text-sm font-mono font-semibold text-zinc-900 dark:text-white">
                  {parseFloat(faucetBalance).toLocaleString(undefined, { maximumFractionDigits: 4 })} AVAX
                </span>
              ) : (
                <span className="text-sm text-zinc-400">Unavailable</span>
              )}
              <button
                onClick={fetchBalance}
                disabled={isLoadingBalance}
                className="text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors disabled:opacity-50"
                title="Refresh balance"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingBalance ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>
          {faucetAddress && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-zinc-600 dark:text-zinc-400">Faucet Address</span>
              <div className="flex items-center gap-2">
                <code className="text-xs font-mono text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded truncate max-w-[200px]">
                  {faucetAddress}
                </code>
                <CopyButton text={faucetAddress} label="Address" />
              </div>
            </div>
          )}

          <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800">
            <button
              onClick={handleSwitchNetwork}
              className="w-full px-4 py-2 text-sm font-medium bg-zinc-800 dark:bg-zinc-700 text-white hover:bg-zinc-900 dark:hover:bg-zinc-600 transition-colors rounded flex items-center justify-center gap-2"
            >
              <ExternalLink className="w-4 h-4" />
              Add / Switch to Devnet in Wallet
            </button>
          </div>
        </div>
      </div>

      {/* C-Chain Faucet */}
      <div className="mb-6">
        <h2 className="text-xs font-mono uppercase tracking-wider text-zinc-500 mb-2">
          Contract Chain (Devnet)
        </h2>

        <div className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-4 py-8">
          <div className="flex items-center gap-3 mb-8">
            <img
              src="https://images.ctfassets.net/gcj8jwzm6086/5VHupNKwnDYJvqMENeV7iJ/3e4b8ff10b69bfa31e70080a4b142cd0/avalanche-avax-logo.svg"
              alt="C-Chain"
              className="w-10 h-10 shrink-0"
            />
            <div className="flex-1 min-w-0 space-y-0.5">
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="font-medium text-zinc-900 dark:text-white leading-tight">
                  C-Chain
                </h3>
                <span className="shrink-0">
                  <span className="font-mono font-semibold text-zinc-900 dark:text-white">
                    2
                  </span>
                  <span className="text-sm text-zinc-500 ml-1">AVAX</span>
                </span>
              </div>
              <p className="text-xs text-zinc-500 leading-tight">
                Devnet smart contracts & testing
              </p>
            </div>
          </div>

          {!walletEVMAddress ? (
            <p className="text-sm text-zinc-500 text-center py-2">
              Connect your wallet to drip devnet AVAX
            </p>
          ) : (
            <button
              onClick={handleDrip}
              disabled={isDripping}
              className="w-full px-4 py-2 text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:bg-zinc-400 disabled:cursor-not-allowed rounded flex items-center justify-center gap-2"
            >
              <Droplets className="w-4 h-4" />
              {isDripping ? "Dripping..." : "Drip 2 AVAX"}
            </button>
          )}

          {result && (
            <div
              className={`mt-4 p-3 rounded text-sm ${
                result.success
                  ? "bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-300"
                  : "bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300"
              }`}
            >
              <p>{result.message}</p>
              {result.txHash && (
                <p className="mt-1 text-xs font-mono break-all text-zinc-500">
                  tx: {result.txHash}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-center gap-4 text-xs text-zinc-400 dark:text-zinc-600">
        <span>Ava Labs internal</span>
        <span>&middot;</span>
        <span>Devnet tokens only</span>
        <span>&middot;</span>
        <span className="font-mono">{userEmail}</span>
      </div>
    </div>
  );
}

export default withConsoleToolMetadata(DevnetFaucet, metadata);
