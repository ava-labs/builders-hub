"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { BridgeConnection } from "@/hooks/useICTTWorkbench";
import { L1ListItem, useL1List } from "@/components/toolbox/stores/l1ListStore";
import { useWalletStore } from "@/components/toolbox/stores/walletStore";
import { useViemChainStore } from "@/components/toolbox/stores/toolboxStore";
import { Button } from "@/components/toolbox/components/Button";
import { EVMAddressInput } from "@/components/toolbox/components/EVMAddressInput";
import { AmountInput } from "@/components/toolbox/components/AmountInput";
import { Suggestion } from "@/components/toolbox/components/Input";
import { createPublicClient, http, formatUnits, parseUnits, Address, Chain } from "viem";
import ExampleERC20ABI from "@/contracts/icm-contracts/compiled/ExampleERC20.json";
import ERC20TokenHomeABI from "@/contracts/icm-contracts/compiled/ERC20TokenHome.json";
import NativeTokenHomeABI from "@/contracts/icm-contracts/compiled/NativeTokenHome.json";
import ERC20TokenRemoteABI from "@/contracts/icm-contracts/compiled/ERC20TokenRemote.json";
import NativeTokenRemoteABI from "@/contracts/icm-contracts/compiled/NativeTokenRemote.json";
import { utils } from "@avalabs/avalanchejs";
import useConsoleNotifications from "@/hooks/useConsoleNotifications";
import { CheckCircle2, AlertCircle, Info, RefreshCw, ArrowRightLeft } from "lucide-react";
import { useNetworkActions } from "@/components/toolbox/components/console-header/evm-network-wallet/hooks/useNetworkActions";

interface CollateralStepProps {
  connection: BridgeConnection;
  onSuccess: () => void;
  disabled?: boolean;
  sourceChain?: L1ListItem;
  targetChain?: L1ListItem;
}

export function CollateralStep({
  connection,
  onSuccess,
  disabled,
  sourceChain,
  targetChain,
}: CollateralStepProps) {
  const { coreWalletClient, walletEVMAddress, walletChainId } = useWalletStore();
  const { notify } = useConsoleNotifications();
  const viemChain = useViemChainStore();
  const l1List = useL1List();

  const [remoteAddress, setRemoteAddress] = useState(connection.contracts.remoteAddress || "");
  const [amount, setAmount] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [error, setError] = useState("");

  // Token/collateral info
  const [tokenHomeAddress, setTokenHomeAddress] = useState<Address | null>(null);
  const [tokenAddress, setTokenAddress] = useState<Address | null>(null);
  const [tokenDecimals, setTokenDecimals] = useState<number | null>(null);
  const [tokenSymbol, setTokenSymbol] = useState<string | null>(null);
  const [tokenBalance, setTokenBalance] = useState<bigint | null>(null);
  const [allowance, setAllowance] = useState<bigint | null>(null);
  const [collateralNeeded, setCollateralNeeded] = useState<bigint | null>(null);
  const [isCollateralized, setIsCollateralized] = useState<boolean | null>(null);

  const isNativeType = connection.tokenType.includes("native");

  // Pre-fill remote address
  useEffect(() => {
    if (connection.contracts.remoteAddress) {
      setRemoteAddress(connection.contracts.remoteAddress);
    }
  }, [connection.contracts.remoteAddress]);

  const { handleNetworkChange } = useNetworkActions();

  // Check if wallet is on source chain (collateral is added on source chain)
  const isWalletOnSourceChain = walletChainId === sourceChain?.evmChainId;
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

  // Source chain viem configuration
  const sourceL1ViemChain: Chain | null = useMemo(() => {
    if (!sourceChain) return null;
    return {
      id: sourceChain.evmChainId,
      name: sourceChain.name,
      rpcUrls: {
        default: { http: [sourceChain.rpcUrl] },
      },
      nativeCurrency: {
        name: sourceChain.coinName,
        symbol: sourceChain.coinName,
        decimals: 18,
      },
    } as Chain;
  }, [sourceChain]);

  // Fetch collateral status
  const fetchStatus = useCallback(async () => {
    if (!remoteAddress || !targetChain?.rpcUrl || !sourceChain?.rpcUrl || !walletEVMAddress || !targetChain?.id) {
      return;
    }

    setIsCheckingStatus(true);
    setError("");

    try {
      const targetPublicClient = createPublicClient({
        transport: http(targetChain.rpcUrl),
      });

      const sourcePublicClient = createPublicClient({
        transport: http(sourceChain.rpcUrl),
      });

      // Get token home address from remote
      const homeAddr = await targetPublicClient.readContract({
        address: remoteAddress as `0x${string}`,
        abi: ERC20TokenRemoteABI.abi,
        functionName: "getTokenHomeAddress",
      });
      setTokenHomeAddress(homeAddr as Address);

      // Check collateralization status
      const collateralized = await targetPublicClient.readContract({
        address: remoteAddress as `0x${string}`,
        abi: ERC20TokenRemoteABI.abi,
        functionName: "getIsCollateralized",
      });
      setIsCollateralized(collateralized as boolean);

      if (collateralized) {
        onSuccess();
      }

      // Get token address from home
      const tokenAddr = await sourcePublicClient.readContract({
        address: homeAddr as `0x${string}`,
        abi: ERC20TokenHomeABI.abi,
        functionName: "getTokenAddress",
      });
      setTokenAddress(tokenAddr as Address);

      // Get token details
      const [decimals, symbol, balance, currentAllowance] = await Promise.all([
        sourcePublicClient.readContract({
          address: tokenAddr as `0x${string}`,
          abi: ExampleERC20ABI.abi,
          functionName: "decimals",
        }),
        sourcePublicClient.readContract({
          address: tokenAddr as `0x${string}`,
          abi: ExampleERC20ABI.abi,
          functionName: "symbol",
        }),
        isNativeType
          ? sourcePublicClient.getBalance({ address: walletEVMAddress as Address })
          : sourcePublicClient.readContract({
              address: tokenAddr as `0x${string}`,
              abi: ExampleERC20ABI.abi,
              functionName: "balanceOf",
              args: [walletEVMAddress as Address],
            }),
        sourcePublicClient.readContract({
          address: tokenAddr as `0x${string}`,
          abi: ExampleERC20ABI.abi,
          functionName: "allowance",
          args: [walletEVMAddress as Address, homeAddr as Address],
        }),
      ]);

      setTokenDecimals(Number(decimals));
      setTokenSymbol(symbol as string);
      setTokenBalance(balance as bigint);
      setAllowance(currentAllowance as bigint);

      // Get collateral needed from home contract
      const remoteBlockchainIDHex = utils.bufferToHex(utils.base58check.decode(targetChain.id));
      const settings = await sourcePublicClient.readContract({
        address: homeAddr as `0x${string}`,
        abi: ERC20TokenHomeABI.abi,
        functionName: "getRemoteTokenTransferrerSettings",
        args: [remoteBlockchainIDHex as `0x${string}`, remoteAddress],
      }) as { collateralNeeded: bigint };

      setCollateralNeeded(settings.collateralNeeded);

      // Auto-fill amount if needed
      if (settings.collateralNeeded > 0n && !amount) {
        setAmount(formatUnits(settings.collateralNeeded, Number(decimals)));
      }
    } catch (err: any) {
      console.error("Error fetching status:", err);
      setError("Failed to fetch collateral status");
    } finally {
      setIsCheckingStatus(false);
    }
  }, [remoteAddress, targetChain, sourceChain, walletEVMAddress, isNativeType, amount, onSuccess]);

  // Initial fetch
  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Parse amount
  const amountParsed = useMemo(() => {
    if (!amount || tokenDecimals === null) return 0n;
    try {
      return parseUnits(amount, tokenDecimals);
    } catch {
      return 0n;
    }
  }, [amount, tokenDecimals]);

  const hasSufficientAllowance = allowance !== null && amountParsed > 0n && allowance >= amountParsed;
  const hasSufficientBalance = tokenBalance !== null && amountParsed > 0n && tokenBalance >= amountParsed;

  // Approve tokens
  async function handleApprove() {
    if (!coreWalletClient?.account || !sourceL1ViemChain || !tokenAddress || !tokenHomeAddress || tokenDecimals === null) {
      setError("Missing required information for approval");
      return;
    }

    setError("");
    setIsProcessing(true);

    try {
      const publicClient = createPublicClient({
        transport: http(sourceChain!.rpcUrl),
      });

      const { request } = await publicClient.simulateContract({
        address: tokenAddress,
        abi: ExampleERC20ABI.abi,
        functionName: "approve",
        args: [tokenHomeAddress, amountParsed],
        account: coreWalletClient.account,
        chain: sourceL1ViemChain,
      });

      const writePromise = coreWalletClient.writeContract(request);
      notify({ type: "call", name: "Approve Tokens" }, writePromise, sourceL1ViemChain);

      const hash = await writePromise;
      await publicClient.waitForTransactionReceipt({ hash });
      await fetchStatus();
    } catch (err: any) {
      console.error("Approval failed:", err);
      setError(err.shortMessage || err.message || "Approval failed");
    } finally {
      setIsProcessing(false);
    }
  }

  // Add collateral
  async function handleAddCollateral() {
    if (!coreWalletClient?.account || !sourceL1ViemChain || !tokenHomeAddress || tokenDecimals === null || !targetChain?.id) {
      setError("Missing required information to add collateral");
      return;
    }

    setError("");
    setIsProcessing(true);

    try {
      const publicClient = createPublicClient({
        transport: http(sourceChain!.rpcUrl),
      });

      const remoteBlockchainIDHex = utils.bufferToHex(utils.base58check.decode(targetChain.id));
      const tokenHomeABI = isNativeType ? NativeTokenHomeABI.abi : ERC20TokenHomeABI.abi;

      const simulateParams: any = {
        address: tokenHomeAddress,
        abi: tokenHomeABI,
        functionName: "addCollateral",
        chain: sourceL1ViemChain,
        account: coreWalletClient.account,
      };

      if (isNativeType) {
        simulateParams.args = [remoteBlockchainIDHex as `0x${string}`, remoteAddress as Address];
        simulateParams.value = amountParsed;
      } else {
        simulateParams.args = [remoteBlockchainIDHex as `0x${string}`, remoteAddress as Address, amountParsed];
      }

      const { request } = await publicClient.simulateContract(simulateParams);

      const writePromise = coreWalletClient.writeContract({
        ...request,
        account: walletEVMAddress as `0x${string}`,
      });
      notify({ type: "call", name: "Add Collateral" }, writePromise, sourceL1ViemChain);

      const hash = await writePromise;
      await publicClient.waitForTransactionReceipt({ hash });

      // Wait for ICM to process
      setTimeout(() => {
        fetchStatus();
      }, 3000);
    } catch (err: any) {
      console.error("Add Collateral failed:", err);
      setError(err.shortMessage || err.message || "Add Collateral failed");
    } finally {
      setIsProcessing(false);
    }
  }

  // Remote address suggestions
  const remoteAddressSuggestions: Suggestion[] = useMemo(() => {
    const suggestions: Suggestion[] = [];
    if (connection.contracts.remoteAddress) {
      suggestions.push({
        title: connection.contracts.remoteAddress,
        value: connection.contracts.remoteAddress,
        description: "Remote contract from this connection",
      });
    }
    return suggestions;
  }, [connection.contracts.remoteAddress]);

  // If already collateralized and disabled, show success state
  if (isCollateralized && disabled) {
    return (
      <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
        <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
        <div className="text-sm font-medium text-green-700 dark:text-green-400">
          Bridge is fully collateralized and live!
        </div>
      </div>
    );
  }

  // Show switch chain button if on wrong chain
  if (!isWalletOnSourceChain && sourceChain) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
          <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0" />
          <div className="text-sm text-yellow-200">
            You need to be connected to <strong>{sourceChain.name}</strong> to add collateral.
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
      <EVMAddressInput
        label={`Remote Contract Address (on ${targetChain?.name})`}
        value={remoteAddress}
        onChange={setRemoteAddress}
        disabled={isProcessing}
        suggestions={remoteAddressSuggestions}
      />

      {/* Collateral info */}
      {tokenSymbol && tokenDecimals !== null && (
        <div className="grid grid-cols-2 gap-2 text-xs bg-zinc-100 dark:bg-zinc-800 rounded-lg p-3">
          <div>
            <div className="text-zinc-500 dark:text-zinc-400">Token</div>
            <div className="font-medium text-zinc-700 dark:text-zinc-300">{tokenSymbol}</div>
          </div>
          <div>
            <div className="text-zinc-500 dark:text-zinc-400">Your Balance</div>
            <div className="font-medium text-zinc-700 dark:text-zinc-300">
              {tokenBalance !== null ? formatUnits(tokenBalance, tokenDecimals) : "..."} {tokenSymbol}
            </div>
          </div>
          <div>
            <div className="text-zinc-500 dark:text-zinc-400">Collateral Needed</div>
            <div className="font-medium text-zinc-700 dark:text-zinc-300">
              {collateralNeeded !== null ? formatUnits(collateralNeeded, tokenDecimals) : "..."} {tokenSymbol}
            </div>
          </div>
          <div>
            <div className="text-zinc-500 dark:text-zinc-400">Status</div>
            <div className={`font-medium ${isCollateralized ? "text-green-600" : "text-yellow-600"}`}>
              {isCheckingStatus ? "Checking..." : isCollateralized ? "Collateralized" : "Not Collateralized"}
            </div>
          </div>
        </div>
      )}

      <AmountInput
        label={`Amount of ${tokenSymbol || "Tokens"} to Add`}
        value={amount}
        onChange={setAmount}
        type="number"
        min="0"
        max={tokenBalance !== null && tokenDecimals !== null ? formatUnits(tokenBalance, tokenDecimals) : "0"}
        disabled={!tokenAddress || isCheckingStatus}
        error={
          amount && !hasSufficientBalance
            ? "Insufficient balance"
            : undefined
        }
        button={
          tokenBalance !== null && tokenDecimals !== null ? (
            <Button
              onClick={() => setAmount(formatUnits(tokenBalance, tokenDecimals))}
              stickLeft
              disabled={!tokenAddress || isCheckingStatus}
            >
              MAX
            </Button>
          ) : undefined
        }
      />

      {error && (
        <div className="flex items-center gap-2 p-2 bg-red-50 dark:bg-red-900/20 rounded text-sm text-red-600 dark:text-red-400">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      <div className="flex gap-2">
        {!isNativeType && (
          <Button
            onClick={handleApprove}
            loading={isProcessing}
            disabled={
              isProcessing ||
              !isWalletOnSourceChain ||
              !amount ||
              amountParsed === 0n ||
              !hasSufficientBalance ||
              hasSufficientAllowance ||
              isCheckingStatus
            }
            variant={hasSufficientAllowance ? "secondary" : "primary"}
            className="flex-1"
          >
            {hasSufficientAllowance ? "Approved" : "Approve"}
          </Button>
        )}
        <Button
          onClick={handleAddCollateral}
          loading={isProcessing}
          disabled={
            isProcessing ||
            !isWalletOnSourceChain ||
            !amount ||
            amountParsed === 0n ||
            !hasSufficientBalance ||
            (!isNativeType && !hasSufficientAllowance) ||
            isCheckingStatus
          }
          variant={isCollateralized ? "secondary" : "primary"}
          className="flex-1"
        >
          {isCollateralized ? "Add More" : "Add Collateral"}
        </Button>
        <Button
          onClick={fetchStatus}
          disabled={isCheckingStatus || !remoteAddress}
          variant="outline"
          loading={isCheckingStatus}
        >
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

export default CollateralStep;
