/**
 * Smart Error Parser for Blockchain Operations
 *
 * Parses common blockchain errors and provides user-friendly messages
 * with actionable suggestions and relevant documentation links.
 */

export interface ParsedError {
  title: string;
  description: string;
  suggestion?: string;
  link?: string;
  severity: "error" | "warning" | "info";
  originalError?: string;
}

// Error pattern mappings for common blockchain errors
const errorMappings: Record<string, Omit<ParsedError, "originalError" | "severity"> & { severity?: ParsedError["severity"] }> = {
  // Gas and funds errors
  "insufficient funds for gas": {
    title: "Not Enough AVAX for Gas",
    description: "Your wallet needs more AVAX to pay for transaction fees.",
    suggestion: "Get testnet AVAX from the faucet or transfer AVAX to your wallet.",
    link: "/console/primary-network/faucet",
  },
  "insufficient funds": {
    title: "Insufficient Funds",
    description: "Your wallet balance is too low to complete this transaction.",
    suggestion: "Add more funds to your wallet or reduce the transaction amount.",
    link: "/console/primary-network/faucet",
  },
  "gas required exceeds allowance": {
    title: "Gas Limit Too Low",
    description: "The transaction requires more gas than the limit allows.",
    suggestion: "Try increasing the gas limit or simplifying the transaction.",
  },
  "max fee per gas less than block base fee": {
    title: "Gas Price Too Low",
    description: "The network is congested and your gas price is below the minimum.",
    suggestion: "Wait for network congestion to decrease or increase your gas price.",
  },
  "intrinsic gas too low": {
    title: "Gas Limit Too Low",
    description: "The gas limit is below the minimum required for this transaction type.",
    suggestion: "Increase the gas limit to at least 21,000 for simple transfers.",
  },

  // Transaction errors
  "execution reverted": {
    title: "Transaction Failed",
    description: "The smart contract rejected this transaction.",
    suggestion: "Check your input values, ensure you have the required permissions, and try again.",
  },
  "nonce too low": {
    title: "Transaction Nonce Error",
    description: "A transaction with this nonce has already been processed.",
    suggestion: "Wait for pending transactions to complete or reset your nonce in your wallet.",
  },
  "nonce too high": {
    title: "Transaction Nonce Gap",
    description: "There are pending transactions that need to be processed first.",
    suggestion: "Wait for pending transactions to complete or check for stuck transactions.",
  },
  "replacement transaction underpriced": {
    title: "Transaction Underpriced",
    description: "A transaction with the same nonce exists with a higher gas price.",
    suggestion: "Increase the gas price to replace the pending transaction or wait for it to complete.",
  },
  "transaction underpriced": {
    title: "Gas Price Too Low",
    description: "The transaction gas price is below the network minimum.",
    suggestion: "Increase the gas price and try again.",
  },

  // Network and connection errors
  "network error": {
    title: "Network Connection Error",
    description: "Unable to connect to the blockchain network.",
    suggestion: "Check your internet connection and try again. The network may be temporarily unavailable.",
    severity: "warning",
  },
  "timeout": {
    title: "Request Timeout",
    description: "The request took too long to complete.",
    suggestion: "The network may be congested. Please try again in a few moments.",
    severity: "warning",
  },
  "rate limit": {
    title: "Rate Limited",
    description: "Too many requests have been made in a short period.",
    suggestion: "Please wait a moment before trying again.",
    severity: "warning",
  },
  "rpc error": {
    title: "RPC Connection Error",
    description: "Unable to communicate with the blockchain node.",
    suggestion: "Check your network connection or try a different RPC endpoint.",
    link: "/console/layer-1/create",
  },

  // Wallet errors
  "user rejected": {
    title: "Transaction Rejected",
    description: "You cancelled the transaction in your wallet.",
    suggestion: "If this was unintentional, you can try the action again.",
    severity: "info",
  },
  "user denied": {
    title: "Request Denied",
    description: "The wallet request was denied.",
    suggestion: "Approve the request in your wallet to continue.",
    severity: "info",
  },
  "wallet not connected": {
    title: "Wallet Not Connected",
    description: "No wallet is connected to this application.",
    suggestion: "Connect your wallet using the button in the header.",
  },
  "wrong network": {
    title: "Wrong Network",
    description: "Your wallet is connected to a different network.",
    suggestion: "Switch to the correct network in your wallet.",
  },
  "chain mismatch": {
    title: "Chain Mismatch",
    description: "The selected chain does not match your wallet's network.",
    suggestion: "Switch networks in your wallet or select a different chain.",
  },

  // Contract errors
  "contract not deployed": {
    title: "Contract Not Found",
    description: "The smart contract does not exist at the specified address.",
    suggestion: "Verify the contract address and ensure it's deployed on this network.",
  },
  "invalid address": {
    title: "Invalid Address",
    description: "The provided address is not a valid blockchain address.",
    suggestion: "Check the address format. It should start with 0x followed by 40 hexadecimal characters.",
  },
  "invalid signature": {
    title: "Invalid Signature",
    description: "The transaction signature is invalid.",
    suggestion: "Try signing the transaction again with your wallet.",
  },
  "call exception": {
    title: "Contract Call Failed",
    description: "The smart contract call returned an error.",
    suggestion: "Check the contract function parameters and ensure you meet all requirements.",
  },

  // Validator errors
  "validator not found": {
    title: "Validator Not Found",
    description: "The specified validator does not exist.",
    suggestion: "Verify the validator's NodeID and ensure it's registered on the network.",
    link: "/console/layer-1/validator-set",
  },
  "validator already exists": {
    title: "Validator Already Exists",
    description: "A validator with this NodeID is already registered.",
    suggestion: "Each node can only be registered as a validator once.",
    link: "/console/permissioned-l1s/add-validator",
  },
  "stake amount too low": {
    title: "Stake Amount Too Low",
    description: "The staking amount does not meet the minimum requirement.",
    suggestion: "Increase your stake amount to meet the minimum threshold.",
    link: "/console/primary-network/stake",
  },
  "delegation period": {
    title: "Invalid Delegation Period",
    description: "The delegation period is outside the allowed range.",
    suggestion: "Choose a delegation period within the validator's acceptable range.",
  },

  // L1 specific errors
  "subnet not found": {
    title: "L1 Not Found",
    description: "The specified L1 (subnet) does not exist.",
    suggestion: "Verify the Subnet ID and ensure the L1 has been created.",
    link: "/console/layer-1/create",
  },
  "blockchain not found": {
    title: "Blockchain Not Found",
    description: "The specified blockchain does not exist on this L1.",
    suggestion: "Verify the blockchain ID and L1 configuration.",
  },
  "permission denied": {
    title: "Permission Denied",
    description: "You do not have permission to perform this action.",
    suggestion: "Ensure you're using an authorized wallet address.",
    link: "/console/l1-access-restrictions/deployer-allowlist",
  },

  // ICM errors
  "message not found": {
    title: "Message Not Found",
    description: "The interchain message could not be found.",
    suggestion: "Verify the message ID and ensure it was sent successfully.",
    link: "/console/icm/test-connection",
  },
  "relayer error": {
    title: "Relayer Error",
    description: "The ICM relayer encountered an error.",
    suggestion: "Check the relayer status and try again.",
    link: "/console/icm/setup",
  },
};

/**
 * Parse an error and return a user-friendly message
 */
export function parseError(error: unknown): ParsedError {
  const errorString = getErrorString(error);
  const lowerError = errorString.toLowerCase();

  // Check for known error patterns
  for (const [pattern, mapping] of Object.entries(errorMappings)) {
    if (lowerError.includes(pattern.toLowerCase())) {
      return {
        ...mapping,
        severity: mapping.severity || "error",
        originalError: errorString,
      };
    }
  }

  // Check for Solidity revert reasons
  const revertMatch = errorString.match(/reverted with reason string '([^']+)'/);
  if (revertMatch) {
    return {
      title: "Contract Reverted",
      description: revertMatch[1],
      suggestion: "Review the error message and adjust your transaction parameters.",
      severity: "error",
      originalError: errorString,
    };
  }

  // Check for custom error selectors
  const customErrorMatch = errorString.match(/reverted with custom error '([^']+)'/);
  if (customErrorMatch) {
    return {
      title: "Contract Error",
      description: `The contract returned: ${customErrorMatch[1]}`,
      suggestion: "This is a custom error from the smart contract. Check the contract documentation.",
      severity: "error",
      originalError: errorString,
    };
  }

  // Default fallback for unknown errors
  return {
    title: "Something Went Wrong",
    description: truncateError(errorString),
    suggestion: "Please try again. If the problem persists, check the console for more details.",
    severity: "error",
    originalError: errorString,
  };
}

/**
 * Convert various error types to a string
 */
function getErrorString(error: unknown): string {
  if (error === null || error === undefined) {
    return "Unknown error";
  }

  if (typeof error === "string") {
    return error;
  }

  if (error instanceof Error) {
    // Handle errors with cause
    if (error.cause) {
      const causeStr = getErrorString(error.cause);
      if (causeStr !== error.message) {
        return `${error.message}: ${causeStr}`;
      }
    }
    return error.message;
  }

  // Handle objects with message property
  if (typeof error === "object" && "message" in error) {
    return String((error as { message: unknown }).message);
  }

  // Handle objects with error property
  if (typeof error === "object" && "error" in error) {
    return getErrorString((error as { error: unknown }).error);
  }

  // Handle objects with reason property (ethers.js style)
  if (typeof error === "object" && "reason" in error) {
    return String((error as { reason: unknown }).reason);
  }

  // Handle objects with shortMessage property (viem style)
  if (typeof error === "object" && "shortMessage" in error) {
    return String((error as { shortMessage: unknown }).shortMessage);
  }

  return String(error);
}

/**
 * Truncate long error messages for display
 */
function truncateError(error: string, maxLength: number = 200): string {
  if (error.length <= maxLength) {
    return error;
  }
  return error.substring(0, maxLength - 3) + "...";
}

/**
 * Check if an error is a user rejection (not a real error)
 */
export function isUserRejection(error: unknown): boolean {
  const errorString = getErrorString(error).toLowerCase();
  return (
    errorString.includes("user rejected") ||
    errorString.includes("user denied") ||
    errorString.includes("user cancelled") ||
    errorString.includes("user canceled") ||
    errorString.includes("rejected by user")
  );
}

/**
 * Check if an error is retryable
 */
export function isRetryableError(error: unknown): boolean {
  const errorString = getErrorString(error).toLowerCase();
  return (
    errorString.includes("network error") ||
    errorString.includes("timeout") ||
    errorString.includes("rate limit") ||
    errorString.includes("rpc error") ||
    errorString.includes("connection") ||
    errorString.includes("ECONNREFUSED") ||
    errorString.includes("ETIMEDOUT")
  );
}

/**
 * Get a simple error message for toast notifications
 */
export function getToastMessage(error: unknown): { title: string; description: string } {
  const parsed = parseError(error);
  return {
    title: parsed.title,
    description: parsed.description,
  };
}
