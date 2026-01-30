"use client";

import React from "react";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  RefreshCw,
  ArrowRightLeft,
  Fuel,
  LifeBuoy,
  ExternalLink,
  RotateCcw,
  Copy,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/toolbox/components/Button";

export type RecoveryActionType =
  | "retry"
  | "switch-chain"
  | "increase-gas"
  | "reset"
  | "contact-support";

export interface RecoveryAction {
  type: RecoveryActionType;
  label?: string;
  chainName?: string;
  chainId?: string;
}

export interface StepError {
  step: "deploy-home" | "deploy-remote" | "register" | "collateral";
  error: string;
  shortMessage?: string;
  txHash?: string;
  explorerUrl?: string;
  recoveryActions: RecoveryAction[];
  possibleCauses?: string[];
}

interface ErrorRecoveryProps {
  error: StepError;
  onRetry: () => void;
  onSwitchChain?: (chainId: string) => void;
  onIncreaseGas?: () => void;
  onReset?: () => void;
  isRetrying?: boolean;
  isSwitching?: boolean;
}

const actionIcons: Record<RecoveryActionType, React.ReactNode> = {
  retry: <RefreshCw className="w-4 h-4" />,
  "switch-chain": <ArrowRightLeft className="w-4 h-4" />,
  "increase-gas": <Fuel className="w-4 h-4" />,
  reset: <RotateCcw className="w-4 h-4" />,
  "contact-support": <LifeBuoy className="w-4 h-4" />,
};

const defaultActionLabels: Record<RecoveryActionType, string> = {
  retry: "Retry",
  "switch-chain": "Switch Chain",
  "increase-gas": "Increase Gas & Retry",
  reset: "Reset Connection",
  "contact-support": "Get Help",
};

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text);
}

export function ErrorRecovery({
  error,
  onRetry,
  onSwitchChain,
  onIncreaseGas,
  onReset,
  isRetrying = false,
  isSwitching = false,
}: ErrorRecoveryProps) {
  const [showDetails, setShowDetails] = React.useState(false);

  const handleAction = (action: RecoveryAction) => {
    switch (action.type) {
      case "retry":
        onRetry();
        break;
      case "switch-chain":
        if (onSwitchChain && action.chainId) {
          onSwitchChain(action.chainId);
        }
        break;
      case "increase-gas":
        if (onIncreaseGas) {
          onIncreaseGas();
        }
        break;
      case "reset":
        if (onReset) {
          onReset();
        }
        break;
      case "contact-support":
        window.open("https://github.com/ava-labs/avalanche-interchain-token-transfer/issues", "_blank");
        break;
    }
  };

  return (
    <div className="rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium text-red-700 dark:text-red-400">
            {error.shortMessage || "Operation Failed"}
          </h4>
          <p className="mt-1 text-sm text-red-600 dark:text-red-400/80 break-words">
            {error.error}
          </p>
        </div>
      </div>

      {/* Possible causes */}
      {error.possibleCauses && error.possibleCauses.length > 0 && (
        <div className="px-4 pb-3">
          <p className="text-xs font-medium text-red-600 dark:text-red-400 mb-1.5">
            Possible causes:
          </p>
          <ul className="text-xs text-red-600/80 dark:text-red-400/70 space-y-0.5">
            {error.possibleCauses.map((cause, idx) => (
              <li key={idx} className="flex items-start gap-1.5">
                <span className="text-red-400">•</span>
                {cause}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Transaction hash */}
      {error.txHash && (
        <div className="px-4 pb-3">
          <div className="flex items-center gap-2 p-2 rounded bg-red-100 dark:bg-red-900/30">
            <span className="text-xs text-red-600 dark:text-red-400 font-medium">Tx:</span>
            <code className="text-xs text-red-700 dark:text-red-300 truncate flex-1 font-mono">
              {error.txHash}
            </code>
            <button
              onClick={() => copyToClipboard(error.txHash!)}
              className="p-1 hover:bg-red-200 dark:hover:bg-red-800 rounded transition-colors"
              title="Copy transaction hash"
            >
              <Copy className="w-3.5 h-3.5 text-red-500" />
            </button>
            {error.explorerUrl && (
              <a
                href={`${error.explorerUrl}/tx/${error.txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1 hover:bg-red-200 dark:hover:bg-red-800 rounded transition-colors"
                title="View on explorer"
              >
                <ExternalLink className="w-3.5 h-3.5 text-red-500" />
              </a>
            )}
          </div>
        </div>
      )}

      {/* Recovery Actions */}
      <div className="px-4 pb-4 flex flex-wrap gap-2">
        {error.recoveryActions.map((action, idx) => {
          const isLoading =
            (action.type === "retry" && isRetrying) ||
            (action.type === "switch-chain" && isSwitching);

          return (
            <Button
              key={idx}
              variant={action.type === "retry" ? "primary" : "secondary"}
              onClick={() => handleAction(action)}
              loading={isLoading}
              disabled={isLoading}
              className={cn(
                "text-sm",
                action.type === "reset" && "text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30"
              )}
            >
              {actionIcons[action.type]}
              <span className="ml-1.5">
                {action.label ||
                  (action.type === "switch-chain" && action.chainName
                    ? `Switch to ${action.chainName}`
                    : defaultActionLabels[action.type])}
              </span>
            </Button>
          );
        })}
      </div>

      {/* Expandable details */}
      {error.error.length > 100 && (
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="w-full px-4 py-2 flex items-center justify-center gap-1 text-xs text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 border-t border-red-200 dark:border-red-900/50 transition-colors"
        >
          {showDetails ? (
            <>
              <ChevronUp className="w-3.5 h-3.5" />
              Hide details
            </>
          ) : (
            <>
              <ChevronDown className="w-3.5 h-3.5" />
              Show full error
            </>
          )}
        </button>
      )}

      {showDetails && (
        <div className="px-4 pb-4 border-t border-red-200 dark:border-red-900/50">
          <pre className="mt-3 p-3 rounded bg-red-100 dark:bg-red-900/30 text-xs text-red-700 dark:text-red-300 overflow-x-auto whitespace-pre-wrap font-mono">
            {error.error}
          </pre>
        </div>
      )}
    </div>
  );
}

// Helper function to parse common errors and suggest recovery actions
export function parseDeploymentError(
  error: unknown,
  step: StepError["step"],
  context: {
    sourceChainName?: string;
    sourceChainId?: string;
    targetChainName?: string;
    targetChainId?: string;
    explorerUrl?: string;
  }
): StepError {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const shortMessage = (error as { shortMessage?: string })?.shortMessage;

  const baseError: StepError = {
    step,
    error: errorMessage,
    shortMessage,
    explorerUrl: context.explorerUrl,
    recoveryActions: [{ type: "retry" }],
    possibleCauses: [],
  };

  // Insufficient funds
  if (
    errorMessage.toLowerCase().includes("insufficient funds") ||
    errorMessage.toLowerCase().includes("insufficient balance")
  ) {
    return {
      ...baseError,
      shortMessage: "Insufficient Funds",
      possibleCauses: [
        "Your wallet doesn't have enough native tokens for gas",
        "The transaction requires more gas than available",
      ],
      recoveryActions: [
        { type: "retry", label: "Retry after adding funds" },
      ],
    };
  }

  // User rejected
  if (
    errorMessage.toLowerCase().includes("user rejected") ||
    errorMessage.toLowerCase().includes("user denied")
  ) {
    return {
      ...baseError,
      shortMessage: "Transaction Rejected",
      possibleCauses: ["You rejected the transaction in your wallet"],
      recoveryActions: [{ type: "retry", label: "Try Again" }],
    };
  }

  // Wrong chain
  if (
    errorMessage.toLowerCase().includes("chain mismatch") ||
    errorMessage.toLowerCase().includes("wrong network")
  ) {
    const targetChain =
      step === "deploy-home" || step === "register"
        ? { name: context.sourceChainName, id: context.sourceChainId }
        : { name: context.targetChainName, id: context.targetChainId };

    return {
      ...baseError,
      shortMessage: "Wrong Network",
      possibleCauses: [
        `Your wallet is connected to the wrong chain`,
        `This operation requires ${targetChain.name || "a different chain"}`,
      ],
      recoveryActions: [
        {
          type: "switch-chain",
          chainName: targetChain.name,
          chainId: targetChain.id,
        },
        { type: "retry" },
      ],
    };
  }

  // Gas estimation failed
  if (
    errorMessage.toLowerCase().includes("gas") &&
    (errorMessage.toLowerCase().includes("estimation") ||
      errorMessage.toLowerCase().includes("limit"))
  ) {
    return {
      ...baseError,
      shortMessage: "Gas Estimation Failed",
      possibleCauses: [
        "The transaction may revert",
        "Contract parameters may be invalid",
        "The contract may already be deployed",
      ],
      recoveryActions: [
        { type: "increase-gas" },
        { type: "retry" },
        { type: "reset" },
      ],
    };
  }

  // Transaction reverted
  if (
    errorMessage.toLowerCase().includes("reverted") ||
    errorMessage.toLowerCase().includes("execution reverted")
  ) {
    return {
      ...baseError,
      shortMessage: "Transaction Reverted",
      possibleCauses: [
        "Contract call failed validation",
        "Invalid parameters provided",
        "Contract state doesn't allow this operation",
      ],
      recoveryActions: [
        { type: "retry" },
        { type: "reset" },
        { type: "contact-support" },
      ],
    };
  }

  // Contract already exists
  if (
    errorMessage.toLowerCase().includes("already deployed") ||
    errorMessage.toLowerCase().includes("contract exists")
  ) {
    return {
      ...baseError,
      shortMessage: "Contract Already Exists",
      possibleCauses: [
        "A contract was already deployed at this address",
        "This connection may have been partially set up",
      ],
      recoveryActions: [{ type: "reset" }, { type: "contact-support" }],
    };
  }

  // Network error
  if (
    errorMessage.toLowerCase().includes("network") ||
    errorMessage.toLowerCase().includes("timeout") ||
    errorMessage.toLowerCase().includes("connection")
  ) {
    return {
      ...baseError,
      shortMessage: "Network Error",
      possibleCauses: [
        "RPC node may be unresponsive",
        "Network connectivity issue",
        "Chain may be experiencing issues",
      ],
      recoveryActions: [{ type: "retry" }, { type: "contact-support" }],
    };
  }

  // Default fallback
  return {
    ...baseError,
    possibleCauses: [
      "An unexpected error occurred",
      "Check the console for more details",
    ],
    recoveryActions: [
      { type: "retry" },
      { type: "reset" },
      { type: "contact-support" },
    ],
  };
}

// Connection reset confirmation dialog
interface ResetConfirmationProps {
  onConfirm: () => void;
  onCancel: () => void;
  connectionName: string;
}

export function ResetConfirmation({
  onConfirm,
  onCancel,
  connectionName,
}: ResetConfirmationProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-xl max-w-md w-full p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-red-500" />
          </div>
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Reset Connection?
          </h3>
        </div>

        <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-6">
          This will clear all contract addresses and reset the connection status
          for <strong>{connectionName}</strong>. You'll need to redeploy all
          contracts from the beginning.
        </p>

        <div className="flex gap-3 justify-end">
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={onConfirm}
            className="bg-red-500 hover:bg-red-600"
          >
            Reset Connection
          </Button>
        </div>
      </div>
    </div>
  );
}

export default ErrorRecovery;
