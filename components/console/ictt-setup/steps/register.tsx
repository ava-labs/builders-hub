"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import {
  FileCheck,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ExternalLink,
  ArrowRight,
  Radio,
} from "lucide-react";
import { useWalletStore } from "@/components/toolbox/stores/walletStore";
import { useICTTSetupStore } from "@/components/toolbox/stores/icttSetupStore";
import { useViemChainStore } from "@/components/toolbox/stores/toolboxStore";
import { createPublicClient, http, parseAbi } from "viem";
import useConsoleNotifications from "@/hooks/useConsoleNotifications";

interface RegisterStepProps {
  onComplete: () => void;
  onProcessing: (processing: boolean) => void;
}

// ABI for registerWithHome function
const TOKEN_REMOTE_ABI = parseAbi([
  "function registerWithHome((address feeTokenAddress, uint256 amount, uint256 relayerRewardAddress) feeInfo) external",
]);

export function RegisterStep({ onComplete, onProcessing }: RegisterStepProps) {
  const { walletEVMAddress, coreWalletClient, isTestnet } = useWalletStore();
  const store = useICTTSetupStore(isTestnet);
  const state = store();
  const viemChain = useViemChainStore();
  const { notify } = useConsoleNotifications();

  const [isRegistering, setIsRegistering] = useState(false);
  const [isRegistered, setIsRegistered] = useState(state.isRegistered);
  const [txHash, setTxHash] = useState("");
  const [error, setError] = useState("");

  // Fee configuration
  const [feeTokenAddress, setFeeTokenAddress] = useState("0x0000000000000000000000000000000000000000");
  const [feeAmount, setFeeAmount] = useState("0");

  // Sync with store
  useEffect(() => {
    if (state.isRegistered) {
      setIsRegistered(true);
    }
  }, [state.isRegistered]);

  const handleRegister = async () => {
    if (!coreWalletClient || !viemChain || !state.tokenRemoteAddress) {
      setError("Missing required configuration");
      return;
    }

    setIsRegistering(true);
    setError("");
    onProcessing(true);

    try {
      const publicClient = createPublicClient({
        chain: viemChain,
        transport: http(viemChain.rpcUrls.default.http[0]),
      });

      // Build fee info struct
      const feeInfo = {
        feeTokenAddress: feeTokenAddress as `0x${string}`,
        amount: BigInt(feeAmount),
        relayerRewardAddress: BigInt(0),
      };

      const registerPromise = coreWalletClient.writeContract({
        address: state.tokenRemoteAddress as `0x${string}`,
        abi: TOKEN_REMOTE_ABI,
        functionName: "registerWithHome",
        args: [feeInfo],
        chain: viemChain,
        account: walletEVMAddress as `0x${string}`,
      });

      notify(
        { type: "call", name: "registerWithHome" },
        registerPromise,
        viemChain
      );

      const hash = await registerPromise;
      setTxHash(hash);

      // Wait for confirmation
      await publicClient.waitForTransactionReceipt({ hash });

      // Update store
      state.setRegistered(true);
      setIsRegistered(true);
      onComplete();
    } catch (err) {
      console.error("Registration error:", err);
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setIsRegistering(false);
      onProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Contract Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50">
          <div className="text-xs text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-1">
            Token Home
          </div>
          <code className="text-xs text-zinc-700 dark:text-zinc-300 font-mono break-all">
            {state.tokenHomeAddress?.slice(0, 20)}...
          </code>
          <div className="mt-2 flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
            <CheckCircle2 className="w-3 h-3" />
            <span>Deployed</span>
          </div>
        </div>
        <div className="p-4 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50">
          <div className="text-xs text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-1">
            Token Remote
          </div>
          <code className="text-xs text-zinc-700 dark:text-zinc-300 font-mono break-all">
            {state.tokenRemoteAddress?.slice(0, 20)}...
          </code>
          <div className="mt-2 flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
            <CheckCircle2 className="w-3 h-3" />
            <span>Deployed</span>
          </div>
        </div>
      </div>

      {/* Registration Flow Diagram */}
      <div className="p-4 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/20">
        <div className="flex items-center justify-center gap-4">
          <div className="text-center">
            <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center mx-auto mb-2">
              <Radio className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <span className="text-xs text-blue-700 dark:text-blue-300 font-medium">Remote</span>
          </div>
          <div className="flex-1 flex items-center justify-center">
            <div className="flex items-center gap-2">
              <div className={cn(
                "h-0.5 w-8 rounded",
                isRegistered ? "bg-green-500" : "bg-blue-300 dark:bg-blue-700"
              )} />
              <ArrowRight className={cn(
                "w-4 h-4",
                isRegistered ? "text-green-500" : "text-blue-400"
              )} />
              <div className={cn(
                "h-0.5 w-8 rounded",
                isRegistered ? "bg-green-500" : "bg-blue-300 dark:bg-blue-700"
              )} />
            </div>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center mx-auto mb-2">
              <Radio className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <span className="text-xs text-blue-700 dark:text-blue-300 font-medium">Home</span>
          </div>
        </div>
        <p className="text-center text-xs text-blue-600 dark:text-blue-400 mt-3">
          {isRegistered
            ? "✓ ICM link established between Remote and Home"
            : "Registration sends an ICM message to link contracts"}
        </p>
      </div>

      {/* Fee Configuration (Optional) */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Teleporter Fee Token
        </label>
        <input
          type="text"
          value={feeTokenAddress}
          onChange={(e) => setFeeTokenAddress(e.target.value)}
          disabled={isRegistering || isRegistered}
          placeholder="0x0000...0000 (none)"
          className="w-full px-4 py-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-mono text-sm disabled:opacity-50"
        />
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Optional fee token for relayers. Use zero address for no fee.
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

      {/* Success State */}
      {isRegistered && (
        <div className="p-4 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
            <span className="text-sm font-medium text-green-800 dark:text-green-200">
              Registration Complete
            </span>
          </div>
          <p className="text-sm text-green-700 dark:text-green-300">
            Your Token Remote is now linked to the Token Home via Avalanche ICM.
            The Home contract will accept transfer requests from this Remote.
          </p>
          {txHash && (viemChain as any)?.blockExplorers?.default && (
            <a
              href={`${(viemChain as any).blockExplorers.default.url}/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 mt-2 text-xs text-green-600 hover:underline"
            >
              <ExternalLink className="w-3 h-3" />
              View Transaction
            </a>
          )}
        </div>
      )}

      {/* Register Button */}
      {!isRegistered && (
        <button
          onClick={handleRegister}
          disabled={!state.tokenRemoteAddress || isRegistering}
          className={cn(
            "w-full py-3 px-4 rounded-lg font-medium text-sm transition-colors flex items-center justify-center gap-2",
            state.tokenRemoteAddress && !isRegistering
              ? "bg-blue-600 hover:bg-blue-700 text-white"
              : "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 cursor-not-allowed"
          )}
        >
          {isRegistering ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Registering via ICM...
            </>
          ) : (
            <>
              <FileCheck className="w-4 h-4" />
              Register with Home
            </>
          )}
        </button>
      )}

      {/* Continue Button */}
      {isRegistered && (
        <button
          onClick={onComplete}
          className="w-full py-3 px-4 rounded-lg font-medium text-sm bg-green-600 hover:bg-green-700 text-white transition-colors"
        >
          Continue to Add Collateral →
        </button>
      )}
    </div>
  );
}

export default RegisterStep;
