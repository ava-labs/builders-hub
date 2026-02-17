"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import {
  Box,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ExternalLink,
  Copy,
  Check,
} from "lucide-react";
import { useWalletStore } from "@/components/toolbox/stores/walletStore";
import { useICTTSetupStore } from "@/components/toolbox/stores/icttSetupStore";
import { useViemChainStore, useToolboxStore } from "@/components/toolbox/stores/toolboxStore";
import { createPublicClient, http } from "viem";
import ERC20TokenHome from "@/contracts/icm-contracts/compiled/ERC20TokenHome.json";
import NativeTokenHome from "@/contracts/icm-contracts/compiled/NativeTokenHome.json";
import TeleporterRegistryAddressInput from "@/components/toolbox/components/TeleporterRegistryAddressInput";
import useConsoleNotifications from "@/hooks/useConsoleNotifications";

interface DeployHomeStepProps {
  onComplete: () => void;
  onProcessing: (processing: boolean) => void;
}

export function DeployHomeStep({ onComplete, onProcessing }: DeployHomeStepProps) {
  const { walletEVMAddress, coreWalletClient, isTestnet } = useWalletStore();
  const store = useICTTSetupStore(isTestnet);
  const { setErc20TokenHomeAddress, setNativeTokenHomeAddress } = useToolboxStore();
  const state = store();
  const viemChain = useViemChainStore();
  const { notify } = useConsoleNotifications();

  const [teleporterRegistry, setTeleporterRegistry] = useState("");
  const [teleporterManager, setTeleporterManager] = useState("");
  const [isDeploying, setIsDeploying] = useState(false);
  const [deployedAddress, setDeployedAddress] = useState(state.tokenHomeAddress || "");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  // Initialize manager to wallet address
  useEffect(() => {
    if (walletEVMAddress && !teleporterManager) {
      setTeleporterManager(walletEVMAddress);
    }
  }, [walletEVMAddress]);

  // Sync with existing deployment
  useEffect(() => {
    if (state.tokenHomeAddress) {
      setDeployedAddress(state.tokenHomeAddress);
    }
  }, [state.tokenHomeAddress]);

  const handleDeploy = async () => {
    if (!coreWalletClient || !viemChain || !teleporterRegistry) {
      setError("Missing required configuration");
      return;
    }

    setIsDeploying(true);
    setError("");
    onProcessing(true);

    try {
      const publicClient = createPublicClient({
        chain: viemChain,
        transport: http(viemChain.rpcUrls.default.http[0]),
      });

      const isERC20 = state.tokenType === "erc20";
      const contract = isERC20 ? ERC20TokenHome : NativeTokenHome;

      const args: any[] = [
        teleporterRegistry as `0x${string}`,
        teleporterManager || walletEVMAddress,
        BigInt(1), // minTeleporterVersion
        state.sourceTokenAddress as `0x${string}`,
      ];

      // ERC20 requires decimals arg
      if (isERC20) {
        args.push(BigInt(state.sourceTokenDecimals));
      }

      const deployPromise = coreWalletClient.deployContract({
        abi: contract.abi as any,
        bytecode: contract.bytecode.object as `0x${string}`,
        args,
        chain: viemChain,
        account: walletEVMAddress as `0x${string}`,
      });

      notify(
        { type: "deploy", name: isERC20 ? "ERC20TokenHome" : "NativeTokenHome" },
        deployPromise,
        viemChain
      );

      const hash = await deployPromise;
      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      if (!receipt.contractAddress) {
        throw new Error("No contract address in receipt");
      }

      // Update both stores
      state.setTokenHomeAddress(receipt.contractAddress);
      if (isERC20) {
        setErc20TokenHomeAddress(receipt.contractAddress);
      } else {
        setNativeTokenHomeAddress(receipt.contractAddress);
      }

      setDeployedAddress(receipt.contractAddress);
      onComplete();
    } catch (err) {
      console.error("Deploy error:", err);
      setError(err instanceof Error ? err.message : "Deployment failed");
    } finally {
      setIsDeploying(false);
      onProcessing(false);
    }
  };

  const handleCopy = async () => {
    if (deployedAddress) {
      await navigator.clipboard.writeText(deployedAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const isReadyToDeploy = teleporterRegistry && state.sourceTokenAddress;

  return (
    <div className="space-y-6">
      {/* Token Summary */}
      <div className="p-4 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-1">
              Source Token
            </div>
            <div className="font-medium text-zinc-900 dark:text-zinc-100">
              {state.sourceTokenSymbol || "Not selected"}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-1">
              Type
            </div>
            <div className="font-medium text-zinc-900 dark:text-zinc-100 capitalize">
              {state.tokenType}
            </div>
          </div>
        </div>
        {state.sourceTokenAddress && (
          <code className="block mt-2 text-xs text-zinc-500 dark:text-zinc-400 truncate">
            {state.sourceTokenAddress}
          </code>
        )}
      </div>

      {/* Teleporter Registry */}
      <TeleporterRegistryAddressInput
        value={teleporterRegistry}
        onChange={setTeleporterRegistry}
        disabled={isDeploying}
      />

      {/* Teleporter Manager */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Teleporter Manager Address
        </label>
        <input
          type="text"
          value={teleporterManager}
          onChange={(e) => setTeleporterManager(e.target.value)}
          disabled={isDeploying}
          placeholder="0x..."
          className="w-full px-4 py-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-mono text-sm disabled:opacity-50"
        />
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Address that can manage Teleporter settings. Defaults to your wallet.
        </p>
      </div>

      {/* Error Display */}
      {error && (
        <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800">
          <p className="text-sm text-red-700 dark:text-red-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            {error}
          </p>
        </div>
      )}

      {/* Deployed Address */}
      {deployedAddress && (
        <div className="p-4 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-green-800 dark:text-green-200 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              Token Home Deployed
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={handleCopy}
                className="p-1.5 rounded hover:bg-green-100 dark:hover:bg-green-900/50 transition-colors"
              >
                {copied ? (
                  <Check className="w-4 h-4 text-green-600" />
                ) : (
                  <Copy className="w-4 h-4 text-green-600" />
                )}
              </button>
              {(viemChain as any)?.blockExplorers?.default && (
                <a
                  href={`${(viemChain as any).blockExplorers.default.url}/address/${deployedAddress}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 rounded hover:bg-green-100 dark:hover:bg-green-900/50 transition-colors"
                >
                  <ExternalLink className="w-4 h-4 text-green-600" />
                </a>
              )}
            </div>
          </div>
          <code className="text-sm text-green-700 dark:text-green-300 font-mono break-all">
            {deployedAddress}
          </code>
        </div>
      )}

      {/* Deploy Button */}
      <button
        onClick={handleDeploy}
        disabled={!isReadyToDeploy || isDeploying}
        className={cn(
          "w-full py-3 px-4 rounded-lg font-medium text-sm transition-colors flex items-center justify-center gap-2",
          isReadyToDeploy && !isDeploying
            ? deployedAddress
              ? "bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600 text-zinc-700 dark:text-zinc-300"
              : "bg-blue-600 hover:bg-blue-700 text-white"
            : "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 cursor-not-allowed"
        )}
      >
        {isDeploying ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Deploying...
          </>
        ) : deployedAddress ? (
          "Re-deploy Token Home"
        ) : (
          "Deploy Token Home"
        )}
      </button>

      {/* Continue Button if already deployed */}
      {deployedAddress && !isDeploying && (
        <button
          onClick={onComplete}
          className="w-full py-3 px-4 rounded-lg font-medium text-sm bg-green-600 hover:bg-green-700 text-white transition-colors"
        >
          Continue to Deploy Remote →
        </button>
      )}
    </div>
  );
}

export default DeployHomeStep;
