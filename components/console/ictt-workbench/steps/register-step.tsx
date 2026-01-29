"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { BridgeConnection } from "@/hooks/useICTTWorkbench";
import { L1ListItem } from "@/components/toolbox/stores/l1ListStore";
import { useWalletStore } from "@/components/toolbox/stores/walletStore";
import { useViemChainStore } from "@/components/toolbox/stores/toolboxStore";
import { Button } from "@/components/toolbox/components/Button";
import { EVMAddressInput } from "@/components/toolbox/components/EVMAddressInput";
import { Suggestion } from "@/components/toolbox/components/Input";
import { createPublicClient, http, zeroAddress, PublicClient } from "viem";
import ERC20TokenRemoteABI from "@/contracts/icm-contracts/compiled/ERC20TokenRemote.json";
import ERC20TokenHomeABI from "@/contracts/icm-contracts/compiled/ERC20TokenHome.json";
import { utils } from "@avalabs/avalanchejs";
import useConsoleNotifications from "@/hooks/useConsoleNotifications";
import { CheckCircle2, AlertCircle, Info, RefreshCw, ArrowRightLeft } from "lucide-react";
import { useNetworkActions } from "@/components/toolbox/components/console-header/evm-network-wallet/hooks/useNetworkActions";
import { ErrorRecovery, parseDeploymentError, StepError } from "../error-recovery";

interface RegisterStepProps {
  connection: BridgeConnection;
  onSuccess: () => void;
  disabled?: boolean;
  sourceChain?: L1ListItem;
  targetChain?: L1ListItem;
}

export function RegisterStep({
  connection,
  onSuccess,
  disabled,
  sourceChain,
  targetChain,
}: RegisterStepProps) {
  const { coreWalletClient, walletChainId } = useWalletStore();
  const { notify } = useConsoleNotifications();
  const viemChain = useViemChainStore();

  const [isRegistering, setIsRegistering] = useState(false);
  const [remoteAddress, setRemoteAddress] = useState(connection.contracts.remoteAddress || "");
  const [error, setError] = useState("");
  const [stepError, setStepError] = useState<StepError | null>(null);
  const [isRegistered, setIsRegistered] = useState(false);
  const [isCheckingRegistration, setIsCheckingRegistration] = useState(false);

  // Pre-fill remote address from connection
  useEffect(() => {
    if (connection.contracts.remoteAddress) {
      setRemoteAddress(connection.contracts.remoteAddress);
    }
  }, [connection.contracts.remoteAddress]);

  const { handleNetworkChange } = useNetworkActions();

  // Check if wallet is on the correct chain (target chain for registration)
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

  // Check registration status
  const checkRegistration = useCallback(async () => {
    if (!remoteAddress || !sourceChain?.rpcUrl || !targetChain?.id || !viemChain) return;

    setIsCheckingRegistration(true);
    setError("");

    try {
      const remotePublicClient = createPublicClient({
        chain: viemChain,
        transport: http(viemChain.rpcUrls.default.http[0]),
      });

      const homePublicClient = createPublicClient({
        transport: http(sourceChain.rpcUrl),
      });

      // Get token home address from remote
      const tokenHomeAddress = await remotePublicClient.readContract({
        address: remoteAddress as `0x${string}`,
        abi: ERC20TokenRemoteABI.abi,
        functionName: "getTokenHomeAddress",
      });

      // Convert target chain ID to hex (this is where the remote is deployed)
      const remoteBlockchainIDHex = utils.bufferToHex(
        utils.base58check.decode(targetChain.id)
      );

      // Check registration status on home contract
      const remoteSettings = (await homePublicClient.readContract({
        address: tokenHomeAddress as `0x${string}`,
        abi: ERC20TokenHomeABI.abi,
        functionName: "getRemoteTokenTransferrerSettings",
        args: [remoteBlockchainIDHex, remoteAddress],
      })) as {
        registered: boolean;
        collateralNeeded: bigint;
        tokenMultiplier: bigint;
        multiplyOnRemote: boolean;
      };

      setIsRegistered(remoteSettings.registered);

      if (remoteSettings.registered) {
        onSuccess();
      }
    } catch (err: any) {
      console.error("Error checking registration:", err);
      setError("Failed to check registration status");
    } finally {
      setIsCheckingRegistration(false);
    }
  }, [remoteAddress, sourceChain?.rpcUrl, targetChain?.id, viemChain, onSuccess]);

  // Initial check
  useEffect(() => {
    checkRegistration();
  }, [checkRegistration]);

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

  async function handleRegister() {
    if (!coreWalletClient?.account || !viemChain) {
      setError("Wallet not connected");
      return;
    }

    if (!isWalletOnTargetChain) {
      setError(`Please switch to ${targetChain?.name} to register`);
      return;
    }

    if (!remoteAddress) {
      setError("Remote contract address is required");
      return;
    }

    setError("");
    setStepError(null);
    setIsRegistering(true);

    try {
      const publicClient = createPublicClient({
        chain: viemChain,
        transport: http(viemChain.rpcUrls.default.http[0]),
      });

      const feeInfo: readonly [`0x${string}`, bigint] = [zeroAddress, 0n];

      // Simulate first
      const { request } = await publicClient.simulateContract({
        address: remoteAddress as `0x${string}`,
        abi: ERC20TokenRemoteABI.abi,
        functionName: "registerWithHome",
        args: [feeInfo],
        chain: viemChain,
        account: coreWalletClient.account,
      });

      const writePromise = coreWalletClient.writeContract(request);
      notify(
        { type: "call", name: "Register With Home" },
        writePromise,
        viemChain
      );

      const hash = await writePromise;
      await publicClient.waitForTransactionReceipt({ hash });

      // Wait a moment for ICM to process, then check
      setTimeout(() => {
        checkRegistration();
      }, 3000);
    } catch (err: unknown) {
      const parsedError = parseDeploymentError(err, "register", {
        sourceChainName: sourceChain?.name,
        sourceChainId: sourceChain?.evmChainId?.toString(),
        targetChainName: targetChain?.name,
        targetChainId: targetChain?.evmChainId?.toString(),
        explorerUrl: targetChain?.explorerUrl,
      });
      setStepError(parsedError);
      console.error("Registration failed:", err);
    } finally {
      setIsRegistering(false);
    }
  }

  const handleRetry = () => {
    setStepError(null);
    handleRegister();
  };

  const handleSwitchChainRecovery = async () => {
    if (targetChain) {
      await handleSwitchChain();
    }
  };

  // If already registered, show success state
  if (isRegistered && disabled) {
    return (
      <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
        <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
        <div className="text-sm font-medium text-green-700 dark:text-green-400">
          Remote contract is registered with Home
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
            You need to be connected to <strong>{targetChain.name}</strong> to register the remote contract.
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
      <EVMAddressInput
        label={`Remote Contract Address (on ${targetChain?.name})`}
        value={remoteAddress}
        onChange={setRemoteAddress}
        disabled={isRegistering}
        suggestions={remoteAddressSuggestions}
      />

      {/* Registration status */}
      {isCheckingRegistration ? (
        <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
          <RefreshCw className="w-3 h-3 animate-spin" />
          Checking registration status...
        </div>
      ) : isRegistered ? (
        <div className="flex items-center gap-2 p-2 bg-green-50 dark:bg-green-900/20 rounded text-sm text-green-600 dark:text-green-400">
          <CheckCircle2 className="w-4 h-4" />
          Remote is registered with Home
        </div>
      ) : remoteAddress && sourceChain ? (
        <div className="flex items-center gap-2 text-xs text-yellow-600 dark:text-yellow-400">
          <AlertCircle className="w-3 h-3" />
          Not yet registered. ICM messages may take a few seconds to process.
          <button
            onClick={checkRegistration}
            className="underline hover:no-underline"
            disabled={isCheckingRegistration}
          >
            Refresh
          </button>
        </div>
      ) : null}

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
          isRetrying={isRegistering}
          isSwitching={isSwitching}
        />
      )}

      <Button
        variant="primary"
        onClick={handleRegister}
        loading={isRegistering}
        disabled={
          isRegistering ||
          !isWalletOnTargetChain ||
          !remoteAddress ||
          isRegistered ||
          isCheckingRegistration
        }
        className="w-full"
      >
        Register Remote with Home
      </Button>
    </div>
  );
}

export default RegisterStep;
