"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import {
  Wallet,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ExternalLink,
  Coins,
  ArrowDown,
  PartyPopper,
} from "lucide-react";
import { useWalletStore } from "@/components/toolbox/stores/walletStore";
import { useICTTSetupStore } from "@/components/toolbox/stores/icttSetupStore";
import { useViemChainStore } from "@/components/toolbox/stores/toolboxStore";
import { createPublicClient, http, parseUnits, formatUnits, erc20Abi, parseAbi } from "viem";
import useConsoleNotifications from "@/hooks/useConsoleNotifications";

interface CollateralStepProps {
  onComplete: () => void;
  onProcessing: (processing: boolean) => void;
}

// ABI for addCollateral function
const TOKEN_HOME_ABI = parseAbi([
  "function addCollateral(bytes32 remoteBlockchainID, address remoteTokenTransferrerAddress, uint256 amount) external",
]);

export function CollateralStep({ onComplete, onProcessing }: CollateralStepProps) {
  const { walletEVMAddress, coreWalletClient, isTestnet } = useWalletStore();
  const store = useICTTSetupStore(isTestnet);
  const state = store();
  const viemChain = useViemChainStore();
  const { notify } = useConsoleNotifications();

  const [collateralAmount, setCollateralAmount] = useState("");
  const [isApproving, setIsApproving] = useState(false);
  const [isAddingCollateral, setIsAddingCollateral] = useState(false);
  const [isApproved, setIsApproved] = useState(false);
  const [isCollateralized, setIsCollateralized] = useState(state.isCollateralized);
  const [txHash, setTxHash] = useState("");
  const [error, setError] = useState("");
  const [tokenBalance, setTokenBalance] = useState("0");
  const [allowance, setAllowance] = useState("0");

  // Fetch token balance and allowance
  useEffect(() => {
    const fetchData = async () => {
      if (!viemChain || !walletEVMAddress || !state.sourceTokenAddress || !state.tokenHomeAddress) {
        return;
      }

      try {
        const publicClient = createPublicClient({
          chain: viemChain,
          transport: http(viemChain.rpcUrls.default.http[0]),
        });

        const [balance, currentAllowance] = await Promise.all([
          publicClient.readContract({
            address: state.sourceTokenAddress as `0x${string}`,
            abi: erc20Abi,
            functionName: "balanceOf",
            args: [walletEVMAddress as `0x${string}`],
          }),
          publicClient.readContract({
            address: state.sourceTokenAddress as `0x${string}`,
            abi: erc20Abi,
            functionName: "allowance",
            args: [walletEVMAddress as `0x${string}`, state.tokenHomeAddress as `0x${string}`],
          }),
        ]);

        setTokenBalance(formatUnits(balance as bigint, state.sourceTokenDecimals));
        setAllowance(formatUnits(currentAllowance as bigint, state.sourceTokenDecimals));
      } catch (err) {
        console.error("Error fetching token data:", err);
      }
    };

    fetchData();
  }, [viemChain?.id, walletEVMAddress, state.sourceTokenAddress, state.tokenHomeAddress]);

  // Check if approval is needed
  useEffect(() => {
    if (collateralAmount && parseFloat(allowance) >= parseFloat(collateralAmount)) {
      setIsApproved(true);
    } else {
      setIsApproved(false);
    }
  }, [collateralAmount, allowance]);

  // Sync with store
  useEffect(() => {
    if (state.isCollateralized) {
      setIsCollateralized(true);
    }
  }, [state.isCollateralized]);

  const handleApprove = async () => {
    if (!coreWalletClient || !viemChain || !state.sourceTokenAddress || !state.tokenHomeAddress) {
      setError("Missing required configuration");
      return;
    }

    setIsApproving(true);
    setError("");
    onProcessing(true);

    try {
      const publicClient = createPublicClient({
        chain: viemChain,
        transport: http(viemChain.rpcUrls.default.http[0]),
      });

      const amount = parseUnits(collateralAmount, state.sourceTokenDecimals);

      const approvePromise = coreWalletClient.writeContract({
        address: state.sourceTokenAddress as `0x${string}`,
        abi: erc20Abi,
        functionName: "approve",
        args: [state.tokenHomeAddress as `0x${string}`, amount],
        chain: viemChain,
        account: walletEVMAddress as `0x${string}`,
      });

      notify(
        { type: "call", name: "approve" },
        approvePromise,
        viemChain
      );

      const hash = await approvePromise;
      await publicClient.waitForTransactionReceipt({ hash });

      setAllowance(collateralAmount);
      setIsApproved(true);
    } catch (err) {
      console.error("Approval error:", err);
      setError(err instanceof Error ? err.message : "Approval failed");
    } finally {
      setIsApproving(false);
      onProcessing(false);
    }
  };

  const handleAddCollateral = async () => {
    if (!coreWalletClient || !viemChain || !state.tokenHomeAddress || !state.tokenRemoteAddress) {
      setError("Missing required configuration");
      return;
    }

    setIsAddingCollateral(true);
    setError("");
    onProcessing(true);

    try {
      const publicClient = createPublicClient({
        chain: viemChain,
        transport: http(viemChain.rpcUrls.default.http[0]),
      });

      const amount = parseUnits(collateralAmount, state.sourceTokenDecimals);

      // The remote blockchain ID (bytes32) - this should be the destination chain's blockchain ID
      const remoteBlockchainID = state.remoteChain?.blockchainId || state.remoteChain?.chainId;

      const collateralPromise = coreWalletClient.writeContract({
        address: state.tokenHomeAddress as `0x${string}`,
        abi: TOKEN_HOME_ABI,
        functionName: "addCollateral",
        args: [
          remoteBlockchainID as `0x${string}`,
          state.tokenRemoteAddress as `0x${string}`,
          amount,
        ],
        chain: viemChain,
        account: walletEVMAddress as `0x${string}`,
      });

      notify(
        { type: "call", name: "addCollateral" },
        collateralPromise,
        viemChain
      );

      const hash = await collateralPromise;
      setTxHash(hash);
      await publicClient.waitForTransactionReceipt({ hash });

      // Update store
      state.setCollateralized(true);
      setIsCollateralized(true);
      onComplete();
    } catch (err) {
      console.error("Collateral error:", err);
      setError(err instanceof Error ? err.message : "Failed to add collateral");
    } finally {
      setIsAddingCollateral(false);
      onProcessing(false);
    }
  };

  const isProcessing = isApproving || isAddingCollateral;
  const hasValidAmount = collateralAmount && parseFloat(collateralAmount) > 0;
  const hasEnoughBalance = parseFloat(tokenBalance) >= parseFloat(collateralAmount || "0");

  return (
    <div className="space-y-6">
      {/* Completion State */}
      {isCollateralized && (
        <div className="p-6 rounded-xl bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 border border-green-200 dark:border-green-800">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/50 flex items-center justify-center">
              <PartyPopper className="w-8 h-8 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-green-900 dark:text-green-100">
                Bridge Setup Complete! 🎉
              </h3>
              <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                Your ICTT bridge is fully configured and ready for cross-chain transfers.
              </p>
            </div>
          </div>
          {txHash && (viemChain as any)?.blockExplorers?.default && (
            <a
              href={`${(viemChain as any).blockExplorers.default.url}/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 mt-4 text-sm text-green-600 hover:underline"
            >
              <ExternalLink className="w-4 h-4" />
              View Collateral Transaction
            </a>
          )}
        </div>
      )}

      {!isCollateralized && (
        <>
          {/* Token Balance Card */}
          <div className="p-4 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
                  <Coins className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {state.sourceTokenSymbol}
                  </div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400">
                    Available Balance
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 font-mono">
                  {parseFloat(tokenBalance).toLocaleString()}
                </div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400">
                  {state.sourceTokenSymbol}
                </div>
              </div>
            </div>
          </div>

          {/* Collateral Flow Diagram */}
          <div className="p-4 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20">
            <div className="flex items-center justify-center gap-4">
              <div className="text-center">
                <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center mx-auto mb-1">
                  <Wallet className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                </div>
                <span className="text-xs text-amber-700 dark:text-amber-300">Your Wallet</span>
              </div>
              <ArrowDown className="w-4 h-4 text-amber-400 rotate-[-90deg]" />
              <div className="text-center">
                <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center mx-auto mb-1">
                  <Coins className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                </div>
                <span className="text-xs text-amber-700 dark:text-amber-300">Token Home</span>
              </div>
            </div>
            <p className="text-center text-xs text-amber-600 dark:text-amber-400 mt-3">
              Collateral backs tokens minted on the remote chain
            </p>
          </div>

          {/* Amount Input */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Collateral Amount
              </label>
              <button
                onClick={() => setCollateralAmount(tokenBalance)}
                className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
              >
                Max
              </button>
            </div>
            <div className="relative">
              <input
                type="text"
                value={collateralAmount}
                onChange={(e) => setCollateralAmount(e.target.value)}
                disabled={isProcessing}
                placeholder="0.0"
                className={cn(
                  "w-full px-4 py-3 pr-16 rounded-lg border bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-mono text-lg disabled:opacity-50",
                  !hasEnoughBalance && hasValidAmount
                    ? "border-red-500 focus:ring-red-500"
                    : "border-zinc-200 dark:border-zinc-700 focus:ring-blue-500"
                )}
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-zinc-500 dark:text-zinc-400">
                {state.sourceTokenSymbol}
              </span>
            </div>
            {!hasEnoughBalance && hasValidAmount && (
              <p className="text-sm text-red-600 dark:text-red-400 flex items-center gap-1">
                <AlertCircle className="w-4 h-4" />
                Insufficient balance
              </p>
            )}
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              This amount will be locked in the Token Home contract to back bridged tokens.
            </p>
          </div>

          {/* Approval Status */}
          {hasValidAmount && hasEnoughBalance && (
            <div className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700">
              <div className="flex items-center gap-2">
                <div className={cn(
                  "w-5 h-5 rounded-full flex items-center justify-center",
                  isApproved
                    ? "bg-green-100 dark:bg-green-900/50"
                    : "bg-zinc-200 dark:bg-zinc-700"
                )}>
                  {isApproved ? (
                    <CheckCircle2 className="w-3 h-3 text-green-600" />
                  ) : (
                    <span className="text-xs text-zinc-500">1</span>
                  )}
                </div>
                <span className={cn(
                  "text-sm",
                  isApproved
                    ? "text-green-700 dark:text-green-300"
                    : "text-zinc-700 dark:text-zinc-300"
                )}>
                  {isApproved ? "Token Approved" : "Approve Token"}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <div className={cn(
                  "w-5 h-5 rounded-full flex items-center justify-center",
                  isCollateralized
                    ? "bg-green-100 dark:bg-green-900/50"
                    : "bg-zinc-200 dark:bg-zinc-700"
                )}>
                  {isCollateralized ? (
                    <CheckCircle2 className="w-3 h-3 text-green-600" />
                  ) : (
                    <span className="text-xs text-zinc-500">2</span>
                  )}
                </div>
                <span className="text-sm text-zinc-700 dark:text-zinc-300">
                  Add Collateral
                </span>
              </div>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800">
              <p className="text-sm text-red-700 dark:text-red-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                {error}
              </p>
            </div>
          )}

          {/* Action Buttons */}
          {!isApproved && hasValidAmount && hasEnoughBalance && (
            <button
              onClick={handleApprove}
              disabled={isApproving}
              className={cn(
                "w-full py-3 px-4 rounded-lg font-medium text-sm transition-colors flex items-center justify-center gap-2",
                !isApproving
                  ? "bg-blue-600 hover:bg-blue-700 text-white"
                  : "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 cursor-not-allowed"
              )}
            >
              {isApproving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Approving...
                </>
              ) : (
                <>
                  Approve {state.sourceTokenSymbol}
                </>
              )}
            </button>
          )}

          {isApproved && hasValidAmount && hasEnoughBalance && (
            <button
              onClick={handleAddCollateral}
              disabled={isAddingCollateral}
              className={cn(
                "w-full py-3 px-4 rounded-lg font-medium text-sm transition-colors flex items-center justify-center gap-2",
                !isAddingCollateral
                  ? "bg-green-600 hover:bg-green-700 text-white"
                  : "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 cursor-not-allowed"
              )}
            >
              {isAddingCollateral ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Adding Collateral...
                </>
              ) : (
                <>
                  <Wallet className="w-4 h-4" />
                  Add Collateral
                </>
              )}
            </button>
          )}

          {/* Skip Option */}
          <button
            onClick={onComplete}
            disabled={isProcessing}
            className="w-full py-2 px-4 text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
          >
            Skip for now (no initial allocations)
          </button>
        </>
      )}

      {/* Summary when complete */}
      {isCollateralized && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Deployment Summary
          </h4>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/50">
              <div className="text-zinc-500 dark:text-zinc-400 mb-1">Token Home</div>
              <code className="text-zinc-700 dark:text-zinc-300 font-mono">
                {state.tokenHomeAddress?.slice(0, 10)}...{state.tokenHomeAddress?.slice(-8)}
              </code>
            </div>
            <div className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/50">
              <div className="text-zinc-500 dark:text-zinc-400 mb-1">Token Remote</div>
              <code className="text-zinc-700 dark:text-zinc-300 font-mono">
                {state.tokenRemoteAddress?.slice(0, 10)}...{state.tokenRemoteAddress?.slice(-8)}
              </code>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CollateralStep;
