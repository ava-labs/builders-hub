"use client";

import React, { useState, useEffect, useMemo } from "react";
import { BridgeConnection } from "@/hooks/useICTTWorkbench";
import { L1ListItem, useWrappedNativeToken } from "@/components/toolbox/stores/l1ListStore";
import { useWalletStore } from "@/components/toolbox/stores/walletStore";
import { useToolboxStore, useViemChainStore } from "@/components/toolbox/stores/toolboxStore";
import { Button } from "@/components/toolbox/components/Button";
import { EVMAddressInput } from "@/components/toolbox/components/EVMAddressInput";
import TeleporterRegistryAddressInput from "@/components/toolbox/components/TeleporterRegistryAddressInput";
import { Suggestion } from "@/components/toolbox/components/Input";
import { createPublicClient, http } from "viem";
import ERC20TokenHome from "@/contracts/icm-contracts/compiled/ERC20TokenHome.json";
import NativeTokenHome from "@/contracts/icm-contracts/compiled/NativeTokenHome.json";
import ExampleERC20 from "@/contracts/icm-contracts/compiled/ExampleERC20.json";
import useConsoleNotifications from "@/hooks/useConsoleNotifications";
import { CheckCircle2, AlertCircle, ArrowRightLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNetworkActions } from "@/components/toolbox/components/console-header/evm-network-wallet/hooks/useNetworkActions";
import { ErrorRecovery, parseDeploymentError, StepError } from "../error-recovery";

interface DeployHomeStepProps {
  connection: BridgeConnection;
  onSuccess: (homeAddress: string) => void;
  disabled?: boolean;
  sourceChain?: L1ListItem;
}

export function DeployHomeStep({
  connection,
  onSuccess,
  disabled,
  sourceChain,
}: DeployHomeStepProps) {
  const { exampleErc20Address } = useToolboxStore();
  const wrappedNativeTokenAddress = useWrappedNativeToken();
  const { coreWalletClient, walletEVMAddress, walletChainId } = useWalletStore();
  const { notify } = useConsoleNotifications();
  const viemChain = useViemChainStore();
  const { handleNetworkChange } = useNetworkActions();

  // Check if we're on the correct chain (source chain for TokenHome)
  const isOnCorrectChain = walletChainId === sourceChain?.evmChainId;
  const [isSwitching, setIsSwitching] = useState(false);

  const handleSwitchChain = async () => {
    if (!sourceChain) return;
    setIsSwitching(true);
    try {
      await handleNetworkChange(sourceChain);
    } catch (err) {
      console.error("Failed to switch chain:", err);
    } finally {
      setIsSwitching(false);
    }
  };

  const [isDeploying, setIsDeploying] = useState(false);
  const [teleporterRegistryAddress, setTeleporterRegistryAddress] = useState("");
  const [tokenAddress, setTokenAddress] = useState(connection.token.address || "");
  const [tokenDecimals, setTokenDecimals] = useState("0");
  const [error, setError] = useState("");
  const [stepError, setStepError] = useState<StepError | null>(null);

  const isNativeType = connection.tokenType.includes("native");

  // Pre-fill token address from connection
  useEffect(() => {
    if (connection.token.address) {
      setTokenAddress(connection.token.address);
    } else if (isNativeType && wrappedNativeTokenAddress) {
      setTokenAddress(wrappedNativeTokenAddress);
    } else if (!isNativeType && exampleErc20Address) {
      setTokenAddress(exampleErc20Address);
    }
  }, [connection.token.address, isNativeType, wrappedNativeTokenAddress, exampleErc20Address]);

  // Fetch token decimals when token address changes
  useEffect(() => {
    if (!tokenAddress || !viemChain) return;

    setError("");
    const publicClient = createPublicClient({
      chain: viemChain,
      transport: http(viemChain.rpcUrls.default.http[0]),
    });

    publicClient
      .readContract({
        address: tokenAddress as `0x${string}`,
        abi: ExampleERC20.abi,
        functionName: "decimals",
      })
      .then((res) => {
        setTokenDecimals((res as bigint).toString());
      })
      .catch((err) => {
        setError("Failed to fetch token decimals");
        console.error(err);
      });
  }, [tokenAddress, viemChain?.id]);

  // Token suggestions
  const tokenSuggestions: Suggestion[] = useMemo(() => {
    const suggestions: Suggestion[] = [];

    if (connection.token.address) {
      suggestions.push({
        title: connection.token.address,
        value: connection.token.address,
        description: `${connection.token.symbol} (from connection)`,
      });
    }

    if (!isNativeType && exampleErc20Address && exampleErc20Address !== connection.token.address) {
      suggestions.push({
        title: exampleErc20Address,
        value: exampleErc20Address,
        description: "Your deployed Example ERC20",
      });
    }

    if (isNativeType && wrappedNativeTokenAddress) {
      suggestions.push({
        title: wrappedNativeTokenAddress,
        value: wrappedNativeTokenAddress,
        description: "Wrapped Native Token",
      });
    }

    return suggestions;
  }, [connection.token, isNativeType, exampleErc20Address, wrappedNativeTokenAddress]);

  async function handleDeploy() {
    if (!coreWalletClient || !viemChain) {
      setError("Wallet not connected");
      return;
    }

    if (!teleporterRegistryAddress) {
      setError("Teleporter Registry address is required");
      return;
    }

    if (!tokenAddress) {
      setError("Token address is required");
      return;
    }

    setError("");
    setStepError(null);
    setIsDeploying(true);

    try {
      const publicClient = createPublicClient({
        chain: viemChain,
        transport: http(viemChain.rpcUrls.default.http[0]),
      });

      const args = [
        teleporterRegistryAddress as `0x${string}`,
        walletEVMAddress, // teleporterManager
        BigInt(1), // minTeleporterVersion
        tokenAddress as `0x${string}`,
      ];

      // ERC20 TokenHome needs decimals as additional arg
      if (!isNativeType) {
        args.push(BigInt(tokenDecimals));
      }

      const contractData = isNativeType ? NativeTokenHome : ERC20TokenHome;

      const deployPromise = coreWalletClient.deployContract({
        abi: contractData.abi as any,
        bytecode: contractData.bytecode.object as `0x${string}`,
        args,
        chain: viemChain,
        account: walletEVMAddress as `0x${string}`,
      });

      notify(
        { type: "deploy", name: "TokenHome" },
        deployPromise,
        viemChain
      );

      const receipt = await publicClient.waitForTransactionReceipt({
        hash: await deployPromise,
      });

      if (!receipt.contractAddress) {
        throw new Error("No contract address in receipt");
      }

      onSuccess(receipt.contractAddress);
    } catch (err: unknown) {
      const parsedError = parseDeploymentError(err, "deploy-home", {
        sourceChainName: sourceChain?.name,
        sourceChainId: sourceChain?.evmChainId?.toString(),
        explorerUrl: sourceChain?.explorerUrl,
      });
      setStepError(parsedError);
      console.error("Deployment failed:", err);
    } finally {
      setIsDeploying(false);
    }
  }

  const handleRetry = () => {
    setStepError(null);
    handleDeploy();
  };

  const handleSwitchChainRecovery = async (chainId: string) => {
    if (sourceChain) {
      await handleSwitchChain();
    }
  };

  // If already deployed, show success state
  if (connection.contracts.homeAddress && disabled) {
    return (
      <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
        <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-green-700 dark:text-green-400">
            Token Home Deployed
          </div>
          <code className="text-xs text-green-600 dark:text-green-500 truncate block">
            {connection.contracts.homeAddress}
          </code>
        </div>
      </div>
    );
  }

  // Show switch chain button if on wrong chain
  if (!isOnCorrectChain && sourceChain) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
          <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0" />
          <div className="text-sm text-yellow-200">
            You need to be connected to <strong>{sourceChain.name}</strong> to deploy Token Home.
          </div>
        </div>
        <Button
          variant="secondary"
          onClick={handleSwitchChain}
          loading={isSwitching}
          className="w-full"
        >
          <ArrowRightLeft className="w-4 h-4 mr-2" />
          Switch to {sourceChain.name}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <TeleporterRegistryAddressInput
        value={teleporterRegistryAddress}
        onChange={setTeleporterRegistryAddress}
        disabled={isDeploying}
      />

      <EVMAddressInput
        label={isNativeType ? "Wrapped Token Address" : "Token Address"}
        value={tokenAddress}
        onChange={setTokenAddress}
        disabled={isDeploying}
        suggestions={tokenSuggestions}
      />

      {tokenDecimals !== "0" && (
        <div className="text-xs text-zinc-500 dark:text-zinc-400">
          Token Decimals: {tokenDecimals}
        </div>
      )}

      {error && !stepError && (
        <div className="flex items-center gap-2 p-2 bg-red-50 dark:bg-red-900/20 rounded text-sm text-red-600 dark:text-red-400">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {stepError && (
        <ErrorRecovery
          error={stepError}
          onRetry={handleRetry}
          onSwitchChain={handleSwitchChainRecovery}
          isRetrying={isDeploying}
          isSwitching={isSwitching}
        />
      )}

      <Button
        variant="primary"
        onClick={handleDeploy}
        loading={isDeploying}
        disabled={
          isDeploying ||
          !teleporterRegistryAddress ||
          !tokenAddress ||
          tokenDecimals === "0"
        }
        className="w-full"
      >
        Deploy Token Home
      </Button>
    </div>
  );
}

export default DeployHomeStep;
