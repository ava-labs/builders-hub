"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import {
  Link2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ExternalLink,
  Copy,
  Check,
  ChevronDown,
} from "lucide-react";
import { useWalletStore } from "@/components/toolbox/stores/walletStore";
import { useICTTSetupStore } from "@/components/toolbox/stores/icttSetupStore";
import { useViemChainStore, useToolboxStore } from "@/components/toolbox/stores/toolboxStore";
import { createPublicClient, http } from "viem";
import ERC20TokenRemote from "@/contracts/icm-contracts/compiled/ERC20TokenRemote.json";
import NativeTokenRemote from "@/contracts/icm-contracts/compiled/NativeTokenRemote.json";
import TeleporterRegistryAddressInput from "@/components/toolbox/components/TeleporterRegistryAddressInput";
import useConsoleNotifications from "@/hooks/useConsoleNotifications";
import { useL1ByChainId } from "@/components/toolbox/stores/l1ListStore";

interface DeployRemoteStepProps {
  onComplete: () => void;
  onProcessing: (processing: boolean) => void;
}

export function DeployRemoteStep({ onComplete, onProcessing }: DeployRemoteStepProps) {
  const { walletEVMAddress, coreWalletClient, isTestnet } = useWalletStore();
  const store = useICTTSetupStore(isTestnet);
  const { setErc20TokenRemoteAddress, setNativeTokenRemoteAddress } = useToolboxStore();
  const state = store();
  const viemChain = useViemChainStore();
  const { notify } = useConsoleNotifications();

  // Get remote chain info
  const remoteL1 = useL1ByChainId(state.remoteChain?.chainId || "");

  const [teleporterRegistry, setTeleporterRegistry] = useState("");
  const [teleporterManager, setTeleporterManager] = useState("");
  const [tokenName, setTokenName] = useState("");
  const [tokenSymbol, setTokenSymbol] = useState("");
  const [tokenDecimals, setTokenDecimals] = useState(18);
  const [initialReserveImbalance, setInitialReserveImbalance] = useState("0");
  const [isDeploying, setIsDeploying] = useState(false);
  const [deployedAddress, setDeployedAddress] = useState(state.tokenRemoteAddress || "");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Initialize defaults
  useEffect(() => {
    if (walletEVMAddress && !teleporterManager) {
      setTeleporterManager(walletEVMAddress);
    }
  }, [walletEVMAddress]);

  // Pre-fill token info from source token
  useEffect(() => {
    if (state.sourceTokenSymbol) {
      setTokenSymbol(state.sourceTokenSymbol);
      setTokenName(`${state.sourceTokenSymbol} (Bridged)`);
    }
    if (state.sourceTokenDecimals) {
      setTokenDecimals(state.sourceTokenDecimals);
    }
  }, [state.sourceTokenSymbol, state.sourceTokenDecimals]);

  // Sync with existing deployment
  useEffect(() => {
    if (state.tokenRemoteAddress) {
      setDeployedAddress(state.tokenRemoteAddress);
    }
  }, [state.tokenRemoteAddress]);

  const handleDeploy = async () => {
    if (!coreWalletClient || !viemChain || !teleporterRegistry || !state.tokenHomeAddress) {
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
      const contract = isERC20 ? ERC20TokenRemote : NativeTokenRemote;

      // Build constructor args based on token type
      // ERC20TokenRemote(registry, manager, minVersion, homeBlockchainID, homeAddress, homeDecimals, name, symbol, decimals)
      // NativeTokenRemote(registry, manager, minVersion, homeBlockchainID, homeAddress, homeDecimals, initialReserveImbalance, burnedFeesReportingRewardPercentage)

      const homeBlockchainID = state.homeChain?.blockchainId || state.homeChain?.chainId; // This should be the blockchain ID (bytes32)

      const baseArgs: any[] = [
        teleporterRegistry as `0x${string}`,
        teleporterManager || walletEVMAddress,
        BigInt(1), // minTeleporterVersion
        homeBlockchainID as `0x${string}`, // source blockchain ID
        state.tokenHomeAddress as `0x${string}`,
        BigInt(state.sourceTokenDecimals),
      ];

      let args: any[];
      if (isERC20) {
        args = [
          ...baseArgs,
          tokenName,
          tokenSymbol,
          BigInt(tokenDecimals),
        ];
      } else {
        args = [
          ...baseArgs,
          BigInt(initialReserveImbalance),
          BigInt(0), // burnedFeesReportingRewardPercentage
        ];
      }

      const deployPromise = coreWalletClient.deployContract({
        abi: contract.abi as any,
        bytecode: contract.bytecode.object as `0x${string}`,
        args,
        chain: viemChain,
        account: walletEVMAddress as `0x${string}`,
      });

      notify(
        { type: "deploy", name: isERC20 ? "ERC20TokenRemote" : "NativeTokenRemote" },
        deployPromise,
        viemChain
      );

      const hash = await deployPromise;
      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      if (!receipt.contractAddress) {
        throw new Error("No contract address in receipt");
      }

      // Update both stores
      state.setTokenRemoteAddress(receipt.contractAddress);
      if (isERC20) {
        setErc20TokenRemoteAddress(receipt.contractAddress);
      } else {
        setNativeTokenRemoteAddress(receipt.contractAddress);
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

  const isReadyToDeploy = teleporterRegistry && state.tokenHomeAddress && tokenName && tokenSymbol;

  return (
    <div className="space-y-6">
      {/* Home Contract Reference */}
      <div className="p-4 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50">
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
            Token Home Contract
          </div>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
            Deployed
          </span>
        </div>
        <code className="text-sm text-zinc-700 dark:text-zinc-300 font-mono break-all">
          {state.tokenHomeAddress}
        </code>
      </div>

      {/* Token Configuration */}
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Token Name
            </label>
            <input
              type="text"
              value={tokenName}
              onChange={(e) => setTokenName(e.target.value)}
              disabled={isDeploying}
              placeholder="My Bridged Token"
              className="w-full px-4 py-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm disabled:opacity-50"
            />
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Token Symbol
            </label>
            <input
              type="text"
              value={tokenSymbol}
              onChange={(e) => setTokenSymbol(e.target.value)}
              disabled={isDeploying}
              placeholder="MTK"
              className="w-full px-4 py-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm disabled:opacity-50"
            />
          </div>
        </div>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          The bridged token representation on the destination chain.
        </p>
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

      {/* Advanced Options */}
      <div className="border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden">
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="w-full px-4 py-3 flex items-center justify-between text-sm font-medium text-zinc-700 dark:text-zinc-300 bg-zinc-50 dark:bg-zinc-800/50 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
        >
          <span>Advanced Options</span>
          <ChevronDown className={cn("w-4 h-4 transition-transform", showAdvanced && "rotate-180")} />
        </button>
        {showAdvanced && (
          <div className="p-4 space-y-4 border-t border-zinc-200 dark:border-zinc-700">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Token Decimals
              </label>
              <input
                type="number"
                value={tokenDecimals}
                onChange={(e) => setTokenDecimals(parseInt(e.target.value) || 18)}
                disabled={isDeploying}
                min={0}
                max={18}
                className="w-full px-4 py-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm disabled:opacity-50"
              />
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Usually matches the source token decimals ({state.sourceTokenDecimals}).
              </p>
            </div>

            {state.tokenType === "native" && (
              <div className="space-y-2">
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Initial Reserve Imbalance
                </label>
                <input
                  type="text"
                  value={initialReserveImbalance}
                  onChange={(e) => setInitialReserveImbalance(e.target.value)}
                  disabled={isDeploying}
                  placeholder="0"
                  className="w-full px-4 py-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-mono text-sm disabled:opacity-50"
                />
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Set if there are pre-allocated native tokens on the remote chain.
                </p>
              </div>
            )}
          </div>
        )}
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
              Token Remote Deployed
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
          "Re-deploy Token Remote"
        ) : (
          "Deploy Token Remote"
        )}
      </button>

      {/* Continue Button if already deployed */}
      {deployedAddress && !isDeploying && (
        <button
          onClick={onComplete}
          className="w-full py-3 px-4 rounded-lg font-medium text-sm bg-green-600 hover:bg-green-700 text-white transition-colors"
        >
          Continue to Register →
        </button>
      )}
    </div>
  );
}

export default DeployRemoteStep;
