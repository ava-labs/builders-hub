"use client";

import React, { useState, useEffect, useMemo } from "react";
import { BridgeConnection } from "@/hooks/useICTTWorkbench";
import { L1ListItem } from "@/components/toolbox/stores/l1ListStore";
import { useWalletStore } from "@/components/toolbox/stores/walletStore";
import { useViemChainStore, getToolboxStore } from "@/components/toolbox/stores/toolboxStore";
import { Button } from "@/components/toolbox/components/Button";
import { EVMAddressInput } from "@/components/toolbox/components/EVMAddressInput";
import { Input, Suggestion } from "@/components/toolbox/components/Input";
import TeleporterRegistryAddressInput from "@/components/toolbox/components/TeleporterRegistryAddressInput";
import { createPublicClient, http } from "viem";
import ERC20TokenRemote from "@/contracts/icm-contracts/compiled/ERC20TokenRemote.json";
import NativeTokenRemote from "@/contracts/icm-contracts/compiled/NativeTokenRemote.json";
import ERC20TokenHomeABI from "@/contracts/icm-contracts/compiled/ERC20TokenHome.json";
import ExampleERC20 from "@/contracts/icm-contracts/compiled/ExampleERC20.json";
import { utils } from "@avalabs/avalanchejs";
import useConsoleNotifications from "@/hooks/useConsoleNotifications";
import { CheckCircle2, AlertCircle, Info, ArrowRightLeft } from "lucide-react";
import { useNetworkActions } from "@/components/toolbox/components/console-header/evm-network-wallet/hooks/useNetworkActions";

interface DeployRemoteStepProps {
  connection: BridgeConnection;
  onSuccess: (remoteAddress: string) => void;
  disabled?: boolean;
  sourceChain?: L1ListItem;
  targetChain?: L1ListItem;
}

export function DeployRemoteStep({
  connection,
  onSuccess,
  disabled,
  sourceChain,
  targetChain,
}: DeployRemoteStepProps) {
  const { coreWalletClient, walletEVMAddress, walletChainId } = useWalletStore();
  const { notify } = useConsoleNotifications();
  const viemChain = useViemChainStore();

  const [isDeploying, setIsDeploying] = useState(false);
  const [teleporterRegistryAddress, setTeleporterRegistryAddress] = useState("");
  const [tokenHomeAddress, setTokenHomeAddress] = useState(connection.contracts.homeAddress || "");
  const [tokenName, setTokenName] = useState("");
  const [tokenSymbol, setTokenSymbol] = useState("");
  const [tokenDecimals, setTokenDecimals] = useState("0");
  const [error, setError] = useState("");
  const [isFetchingDetails, setIsFetchingDetails] = useState(false);

  const isNativeType = connection.tokenType.includes("native");

  // Get source chain toolbox store for suggestions
  const sourceToolboxStore = getToolboxStore(sourceChain?.evmChainId?.toString() || "")();

  // Convert source chain ID to hex
  const tokenHomeBlockchainIDHex = useMemo(() => {
    if (!sourceChain?.id) return undefined;
    try {
      return utils.bufferToHex(utils.base58check.decode(sourceChain.id));
    } catch (e) {
      console.error("Error decoding source chain ID:", e);
      return undefined;
    }
  }, [sourceChain?.id]);

  // Pre-fill home address from connection
  useEffect(() => {
    if (connection.contracts.homeAddress) {
      setTokenHomeAddress(connection.contracts.homeAddress);
    }
  }, [connection.contracts.homeAddress]);

  // Fetch token details from home contract
  useEffect(() => {
    if (!tokenHomeAddress || !sourceChain?.rpcUrl) return;

    setIsFetchingDetails(true);
    setError("");

    const publicClient = createPublicClient({
      transport: http(sourceChain.rpcUrl),
    });

    const fetchDetails = async () => {
      try {
        // Get token address from home contract
        const tokenAddress = await publicClient.readContract({
          address: tokenHomeAddress as `0x${string}`,
          abi: ERC20TokenHomeABI.abi,
          functionName: "getTokenAddress",
        });

        // Get token details
        const [decimals, name, symbol] = await Promise.all([
          publicClient.readContract({
            address: tokenAddress as `0x${string}`,
            abi: ExampleERC20.abi,
            functionName: "decimals",
          }),
          publicClient.readContract({
            address: tokenAddress as `0x${string}`,
            abi: ExampleERC20.abi,
            functionName: "name",
          }),
          publicClient.readContract({
            address: tokenAddress as `0x${string}`,
            abi: ExampleERC20.abi,
            functionName: "symbol",
          }),
        ]);

        setTokenDecimals(String(decimals));
        setTokenName(name as string);
        setTokenSymbol(symbol as string);
      } catch (err: any) {
        console.error("Error fetching token details:", err);
        setError("Failed to fetch token details from home contract");
      } finally {
        setIsFetchingDetails(false);
      }
    };

    fetchDetails();
  }, [tokenHomeAddress, sourceChain?.rpcUrl]);

  // Home contract suggestions
  const homeContractSuggestions: Suggestion[] = useMemo(() => {
    const suggestions: Suggestion[] = [];

    if (connection.contracts.homeAddress) {
      suggestions.push({
        title: connection.contracts.homeAddress,
        value: connection.contracts.homeAddress,
        description: "Home contract from this connection",
      });
    }

    if (sourceToolboxStore?.erc20TokenHomeAddress && !isNativeType) {
      suggestions.push({
        title: sourceToolboxStore.erc20TokenHomeAddress,
        value: sourceToolboxStore.erc20TokenHomeAddress,
        description: `ERC20 Token Home on ${sourceChain?.name}`,
      });
    }

    if (sourceToolboxStore?.nativeTokenHomeAddress && isNativeType) {
      suggestions.push({
        title: sourceToolboxStore.nativeTokenHomeAddress,
        value: sourceToolboxStore.nativeTokenHomeAddress,
        description: `Native Token Home on ${sourceChain?.name}`,
      });
    }

    return suggestions;
  }, [connection.contracts.homeAddress, sourceToolboxStore, sourceChain?.name, isNativeType]);

  const { handleNetworkChange } = useNetworkActions();

  // Check if wallet is on the correct chain
  const isWalletOnTargetChain = walletChainId === targetChain?.evmChainId;
  const [isSwitching, setIsSwitching] = useState(false);

  const handleSwitchChain = async () => {
    if (!targetChain) return;
    setIsSwitching(true);
    try {
      await handleNetworkChange(targetChain);
    } catch (err) {
      console.error("Failed to switch chain:", err);
    } finally {
      setIsSwitching(false);
    }
  };

  async function handleDeploy() {
    if (!coreWalletClient || !viemChain) {
      setError("Wallet not connected");
      return;
    }

    if (!isWalletOnTargetChain) {
      setError(`Please switch to ${targetChain?.name} to deploy the remote contract`);
      return;
    }

    if (!teleporterRegistryAddress) {
      setError("Teleporter Registry address is required");
      return;
    }

    if (!tokenHomeAddress || !tokenHomeBlockchainIDHex) {
      setError("Token Home address is required");
      return;
    }

    if (tokenDecimals === "0" || !tokenName || !tokenSymbol) {
      setError("Could not fetch token details from home contract");
      return;
    }

    setError("");
    setIsDeploying(true);

    try {
      const publicClient = createPublicClient({
        chain: viemChain,
        transport: http(viemChain.rpcUrls.default.http[0]),
      });

      const constructorArgs = [
        {
          teleporterRegistryAddress: teleporterRegistryAddress as `0x${string}`,
          teleporterManager: walletEVMAddress,
          minTeleporterVersion: BigInt(1),
          tokenHomeBlockchainID: tokenHomeBlockchainIDHex as `0x${string}`,
          tokenHomeAddress: tokenHomeAddress as `0x${string}`,
          tokenHomeDecimals: parseInt(tokenDecimals),
        },
        tokenName,
        tokenSymbol,
        parseInt(tokenDecimals),
      ];

      const contractData = isNativeType ? NativeTokenRemote : ERC20TokenRemote;

      const deployPromise = coreWalletClient.deployContract({
        abi: contractData.abi as any,
        bytecode: contractData.bytecode.object as `0x${string}`,
        args: constructorArgs,
        account: walletEVMAddress as `0x${string}`,
        chain: viemChain,
      });

      notify(
        { type: "deploy", name: isNativeType ? "NativeTokenRemote" : "ERC20TokenRemote" },
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
    } catch (err: any) {
      setError(err.shortMessage || err.message || "Deployment failed");
      console.error("Deployment failed:", err);
    } finally {
      setIsDeploying(false);
    }
  }

  // If already deployed, show success state
  if (connection.contracts.remoteAddress && disabled) {
    return (
      <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
        <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-green-700 dark:text-green-400">
            Token Remote Deployed
          </div>
          <code className="text-xs text-green-600 dark:text-green-500 truncate block">
            {connection.contracts.remoteAddress}
          </code>
        </div>
      </div>
    );
  }

  // Show switch chain button if on wrong chain
  if (!isWalletOnTargetChain && targetChain) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
          <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0" />
          <div className="text-sm text-yellow-200">
            You need to be connected to <strong>{targetChain.name}</strong> to deploy Token Remote.
          </div>
        </div>
        <Button
          variant="secondary"
          onClick={handleSwitchChain}
          loading={isSwitching}
          className="w-full"
        >
          <ArrowRightLeft className="w-4 h-4 mr-2" />
          Switch to {targetChain.name}
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
        label={`Token Home Address (on ${sourceChain?.name})`}
        value={tokenHomeAddress}
        onChange={setTokenHomeAddress}
        disabled={isDeploying}
        suggestions={homeContractSuggestions}
      />

      {tokenHomeBlockchainIDHex && (
        <Input
          label="Token Home Blockchain ID"
          value={tokenHomeBlockchainIDHex}
          disabled
        />
      )}

      {isFetchingDetails ? (
        <div className="text-xs text-zinc-500 dark:text-zinc-400">
          Loading token details...
        </div>
      ) : tokenName && tokenSymbol ? (
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="bg-zinc-100 dark:bg-zinc-800 rounded p-2">
            <div className="text-zinc-500 dark:text-zinc-400">Name</div>
            <div className="font-medium text-zinc-700 dark:text-zinc-300 truncate">{tokenName}</div>
          </div>
          <div className="bg-zinc-100 dark:bg-zinc-800 rounded p-2">
            <div className="text-zinc-500 dark:text-zinc-400">Symbol</div>
            <div className="font-medium text-zinc-700 dark:text-zinc-300">{tokenSymbol}</div>
          </div>
          <div className="bg-zinc-100 dark:bg-zinc-800 rounded p-2">
            <div className="text-zinc-500 dark:text-zinc-400">Decimals</div>
            <div className="font-medium text-zinc-700 dark:text-zinc-300">{tokenDecimals}</div>
          </div>
        </div>
      ) : null}

      {error && (
        <div className="flex items-center gap-2 p-2 bg-red-50 dark:bg-red-900/20 rounded text-sm text-red-600 dark:text-red-400">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      <Button
        variant="primary"
        onClick={handleDeploy}
        loading={isDeploying}
        disabled={
          isDeploying ||
          !isWalletOnTargetChain ||
          !teleporterRegistryAddress ||
          !tokenHomeAddress ||
          !tokenHomeBlockchainIDHex ||
          tokenDecimals === "0" ||
          !tokenName ||
          !tokenSymbol
        }
        className="w-full"
      >
        Deploy Token Remote
      </Button>
    </div>
  );
}

export default DeployRemoteStep;
