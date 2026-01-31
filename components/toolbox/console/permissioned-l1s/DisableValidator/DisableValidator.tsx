"use client";

import { useState, useEffect } from "react";
import { Loader2, CheckCircle2, ArrowUpRight, Users, ShieldOff } from "lucide-react";
import { Button } from "../../../components/Button";
import { useWalletStore } from "@/components/toolbox/stores/walletStore";
import SelectSubnetId from "../../../components/SelectSubnetId";
import { WalletRequirementsConfigKey } from "../../../hooks/useWalletRequirements";
import { BaseConsoleToolProps, ConsoleToolMetadata, withConsoleToolMetadata } from "../../../components/WithConsoleToolMetadata";
import { useConnectedWallet } from "@/components/toolbox/contexts/ConnectedWalletContext";
import { generateConsoleToolGitHubUrl } from "@/components/toolbox/utils/github-url";
import { Alert } from "../../../components/Alert";
import { useDisableL1Validator, ValidatorData } from "./DisableL1ValidatorContext";
import ValidatorSelector from "./ValidatorSelector";
import { formatAvaxBalance } from "@/components/toolbox/coreViem/utils/format";
import { SDKCodeViewer, SDKCodeSource } from "@/components/console/sdk-code-viewer";

// TypeScript code showing the P-Chain disable operation
const DISABLE_VALIDATOR_CODE = `// Disable an L1 Validator directly on the P-Chain
// This is an emergency operation that bypasses the Validator Manager

import { createCoreWalletClient } from "@/coreViem";

const walletClient = createCoreWalletClient({
  chain: "fuji", // or "mainnet"
});

// Get the validator's validation ID from the P-Chain API
// This is the CB58-encoded ID returned when the validator was registered
const validationId = selectedValidator.validationId;

// Find your wallet's index in the deactivation owner addresses
// The deactivation owner was set when the validator was registered
const deactivationOwner = selectedValidator.deactivationOwner;
const authIndex = deactivationOwner.addresses.findIndex(
  (addr) => addr.toLowerCase() === myPChainAddress.toLowerCase()
);

// Submit DisableL1ValidatorTx to the P-Chain
// This immediately removes the validator and returns remaining balance
const txHash = await walletClient.disableL1Validator({
  validationId: validationId,  // CB58 validation ID
  disableAuth: [authIndex],    // Index of authorized signer
});

// The remaining balance is sent to the remainingBalanceOwner
// addresses that were configured during registration`;

// Code sources for the SDK viewer
const CODE_SOURCES: SDKCodeSource[] = [
  {
    name: "Disable Validator",
    filename: "disableL1Validator.ts",
    code: DISABLE_VALIDATOR_CODE,
    description: "Direct P-Chain operation to disable a validator (bypasses Validator Manager)",
    githubUrl: "https://github.com/ava-labs/avalanche-sdk",
  },
];

const metadata: ConsoleToolMetadata = {
  title: "Disable L1 Validator",
  description: "Disable an L1 validator directly on the P-Chain. This is an emergency operation that bypasses the Validator Manager Contract and can be used when the L1 is down or unreachable.",
  toolRequirements: [
    WalletRequirementsConfigKey.PChainBalance
  ],
  githubUrl: generateConsoleToolGitHubUrl(import.meta.url)
};

function DisableValidator({ onSuccess }: BaseConsoleToolProps) {
  const { pChainAddress, isTestnet } = useWalletStore();
  const { coreWalletClient } = useConnectedWallet();

  const {
    subnetId,
    setSubnetId,
    selectedValidator,
    setSelectedValidator,
    isProcessing,
    setIsProcessing,
    txHash,
    setTxHash,
    error,
    setError,
    reset,
  } = useDisableL1Validator();

  const [operationSuccessful, setOperationSuccessful] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [authIndex, setAuthIndex] = useState<number>(-1);

  // Normalize P-Chain address by removing the "P-" prefix for comparison
  // SDK returns addresses like "fuji1abc..." while wallet returns "P-fuji1abc..."
  const normalizePChainAddress = (addr: string): string => {
    return addr.replace(/^P-/i, "").toLowerCase();
  };

  // Check if current wallet is authorized to disable the selected validator
  useEffect(() => {
    if (!selectedValidator || !pChainAddress) {
      setIsAuthorized(null);
      setAuthIndex(-1);
      return;
    }

    const deactivationOwner = selectedValidator.deactivationOwner;
    if (!deactivationOwner) {
      setIsAuthorized(false);
      setAuthIndex(-1);
      return;
    }

    // Normalize wallet address for comparison (remove P- prefix)
    const normalizedWalletAddr = normalizePChainAddress(pChainAddress);

    // Find if the current P-Chain address is in the deactivation owners list
    const index = deactivationOwner.addresses.findIndex(
      (addr) => normalizePChainAddress(addr) === normalizedWalletAddr
    );

    if (index >= 0) {
      setIsAuthorized(true);
      setAuthIndex(index);
    } else {
      setIsAuthorized(false);
      setAuthIndex(-1);
    }
  }, [selectedValidator, pChainAddress]);

  const handleDisableValidator = async () => {
    if (!selectedValidator || !coreWalletClient || authIndex < 0) {
      setError("Missing required information or not authorized");
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      // Pass validation ID as-is - the SDK expects CB58 format from the P-Chain
      const hash = await coreWalletClient.disableL1Validator({
        validationId: selectedValidator.validationId,
        disableAuth: [authIndex],
      });

      setTxHash(hash);
      setOperationSuccessful(true);
      onSuccess?.();
    } catch (err) {
      console.error("Error disabling validator:", err);
      setError(err instanceof Error ? err.message : "An unknown error occurred");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    reset();
    setOperationSuccessful(false);
    setIsAuthorized(null);
    setAuthIndex(-1);
  };

  if (operationSuccessful && txHash) {
    return (
      <div className="space-y-6 w-full">
        <div className="p-6 space-y-6 animate-fadeIn max-w-md mx-auto">
          <div className="flex items-center justify-center">
            <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
              <CheckCircle2 className="w-10 h-10 text-green-600 dark:text-green-400" />
            </div>
          </div>
          <div className="text-center space-y-2">
            <h4 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">Validator Disabled</h4>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              The validator has been successfully disabled on the P-Chain. Any remaining balance will be returned to the remaining balance owner.
            </p>
          </div>
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-blue-700 dark:text-blue-300">Subnet ID</span>
              <span className="text-sm font-mono text-blue-700 dark:text-blue-300 truncate max-w-[200px]" title={subnetId}>
                {subnetId.substring(0, 12)}...
              </span>
            </div>
            {selectedValidator && (
              <>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-blue-700 dark:text-blue-300">Node ID</span>
                  <span className="text-sm font-mono text-blue-700 dark:text-blue-300 truncate max-w-[200px]" title={selectedValidator.nodeId}>
                    {selectedValidator.nodeId.substring(0, 16)}...
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-blue-700 dark:text-blue-300">Validation ID</span>
                  <span className="text-sm font-mono text-blue-700 dark:text-blue-300 truncate max-w-[200px]" title={selectedValidator.validationId}>
                    {selectedValidator.validationId.substring(0, 12)}...
                  </span>
                </div>
              </>
            )}
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-blue-700 dark:text-blue-300">Transaction</span>
              <a
                href={`https://${isTestnet ? "subnets-test" : "subnets"}.avax.network/p-chain/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-semibold text-red-500 hover:text-red-400 dark:text-red-400 dark:hover:text-red-300 flex items-center gap-1"
              >
                View in Explorer
                <ArrowUpRight className="w-4 h-4" />
              </a>
            </div>
          </div>
          <Button
            variant="secondary"
            onClick={handleReset}
            className="w-full py-2 px-4 text-sm font-medium"
          >
            Disable Another Validator
          </Button>
        </div>
      </div>
    );
  }

  return (
    <SDKCodeViewer sources={CODE_SOURCES} height="auto">
      <div className="space-y-4 w-full">
        {/* Warning Banner */}
        <Alert variant="warning">
          <span><strong>Emergency Operation:</strong> This operation disables a validator directly on the P-Chain, bypassing the Validator Manager Contract. Use this only when the L1 is down or unreachable.</span>
        </Alert>

        {/* Step 1: Select Subnet */}
        <SelectSubnetId
          value={subnetId}
          onChange={(id) => {
            setSubnetId(id);
            setSelectedValidator(null);
            setError(null);
          }}
          hidePrimaryNetwork={true}
        />

        {/* Step 2: Select Validator */}
        {subnetId && (
          <ValidatorSelector
            subnetId={subnetId}
            onSelect={setSelectedValidator}
            selectedValidator={selectedValidator}
          />
        )}

        {/* Step 3: Authorization Check */}
        {selectedValidator && (
          <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-lg p-4 space-y-3 border border-zinc-200 dark:border-zinc-700">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-zinc-500" />
              <h4 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Deactivation Owner</h4>
            </div>

            {selectedValidator.deactivationOwner ? (
              <div className="space-y-2">
                <div className="text-xs text-zinc-600 dark:text-zinc-400">
                  <span className="font-medium">Threshold:</span> {selectedValidator.deactivationOwner.threshold} of {selectedValidator.deactivationOwner.addresses.length}
                </div>
                <div className="space-y-1">
                  {selectedValidator.deactivationOwner.addresses.map((addr, idx) => {
                    const isCurrentWallet = pChainAddress &&
                      normalizePChainAddress(addr) === normalizePChainAddress(pChainAddress);
                    return (
                      <div
                        key={idx}
                        className={`text-xs font-mono p-2 rounded ${
                          isCurrentWallet
                            ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800"
                            : "bg-zinc-100 dark:bg-zinc-700/50 text-zinc-600 dark:text-zinc-400"
                        }`}
                      >
                        {addr}
                        {isCurrentWallet && (
                          <span className="ml-2 text-green-600 dark:text-green-400">(Your wallet)</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="text-sm text-zinc-500 dark:text-zinc-400">
                No deactivation owner configured for this validator.
              </div>
            )}

            {isAuthorized === false && (
              <Alert variant="error" className="mt-2">
                Your connected P-Chain address ({pChainAddress?.substring(0, 16)}...) is not authorized to disable this validator.
              </Alert>
            )}

            {isAuthorized === true && (
              <Alert variant="success" className="mt-2">
                Your wallet is authorized to disable this validator.
              </Alert>
            )}
          </div>
        )}

        {/* Remaining Balance Owner Info */}
        {selectedValidator?.remainingBalanceOwner && (
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 space-y-2 border border-blue-200 dark:border-blue-800">
            <div className="flex items-center gap-2">
              <ShieldOff className="w-4 h-4 text-blue-500" />
              <h4 className="text-sm font-medium text-blue-700 dark:text-blue-300">Remaining Balance Owner</h4>
            </div>
            <p className="text-xs text-blue-600 dark:text-blue-400">
              When disabled, the validator's remaining balance ({formatAvaxBalance(parseFloat(selectedValidator.remainingBalance))}) will be returned to:
            </p>
            <div className="space-y-1">
              {selectedValidator.remainingBalanceOwner.addresses.map((addr, idx) => (
                <div
                  key={idx}
                  className="text-xs font-mono p-2 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"
                >
                  {addr}
                </div>
              ))}
            </div>
          </div>
        )}

        {error && (
          <Alert variant="error">{error}</Alert>
        )}

        {/* Submit Button */}
        <Button
          variant="primary"
          onClick={handleDisableValidator}
          disabled={
            isProcessing ||
            !selectedValidator ||
            !isAuthorized ||
            !coreWalletClient
          }
          className="w-full py-2 px-4 text-sm font-medium"
        >
          {isProcessing ? (
            <span className="flex items-center justify-center">
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Disabling Validator...
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              <ShieldOff className="w-4 h-4" />
              Disable Validator
            </span>
          )}
        </Button>
      </div>
    </SDKCodeViewer>
  );
}

export default withConsoleToolMetadata(DisableValidator, metadata);
