"use client"
import { useState } from "react"
import { useWalletStore } from "../../stores/walletStore"
import { consoleToast } from "../../lib/console-toast"

const LOW_BALANCE_THRESHOLD = 0.5

interface PChainFaucetButtonProps {
  className?: string;
  buttonProps?: React.ButtonHTMLAttributes<HTMLButtonElement>;
  children?: React.ReactNode;
}

export const PChainFaucetButton = ({ className, buttonProps, children }: PChainFaucetButtonProps = {}) => {
    const {pChainAddress, isTestnet, pChainBalance, updatePChainBalance } = useWalletStore();

  const [isRequestingPTokens, setIsRequestingPTokens] = useState(false);

  const handlePChainTokenRequest = async () => {
    if (isRequestingPTokens || !pChainAddress) return;
    setIsRequestingPTokens(true);
    let loadingToastId: string | number | undefined;

    try {
      loadingToastId = consoleToast.loading("Requesting P-Chain AVAX tokens...");
      const response = await fetch(`/api/pchain-faucet?address=${pChainAddress}`);
      const rawText = await response.text();

      let data;

      try {
        data = JSON.parse(rawText);
      } catch (parseError) {
        throw new Error(`Invalid response: ${rawText.substring(0, 100)}...`);
      }

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("Please login first");
        }
        if (response.status === 429) {
          throw new Error(
            data.message || "Rate limit exceeded. Please try again later."
          );
        }
        throw new Error(
          data.message || `Error ${response.status}: Failed to get tokens`
        );
      }

      if (data.success) {
        consoleToast.dismiss(loadingToastId);
        consoleToast.success(data.txID ? `P-Chain AVAX tokens sent! TX: ${data.txID.substring(0, 10)}...` : "P-Chain AVAX tokens sent successfully!");

        if (data.txID) {
          consoleToast.info(`Transaction ID: ${data.txID}`);
        }

        setTimeout(() => {
          updatePChainBalance();
          consoleToast.info("Your P-Chain balance has been refreshed");
        }, 3000);
      } else {
        throw new Error(data.message || "Failed to get tokens");
      }
    } catch (error) {
      if (loadingToastId) {
        consoleToast.dismiss(loadingToastId);
      }

      console.error("P-Chain token request error:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";

      if (errorMessage.includes("login") || errorMessage.includes("401")) {
        consoleToast.error("Authentication Required: You need to be logged in to request free tokens from the P-Chain Faucet. Please login first.");
      } else if (errorMessage.includes("rate limit") || errorMessage.includes("429")) {
        consoleToast.warning("Rate Limited: Please wait before requesting tokens again. Try again in a few minutes.");
      } else {
        consoleToast.error(`P-Chain Faucet Error: ${errorMessage}`);
      }
    } finally {
      setIsRequestingPTokens(false);
    }
  };

  if (!isTestnet) { return null }

  const defaultClassName = `px-2 py-1 text-xs font-medium text-white rounded transition-colors ${
    pChainBalance < LOW_BALANCE_THRESHOLD
      ? "bg-blue-500 hover:bg-blue-600 shimmer"
      : "bg-zinc-600 hover:bg-zinc-700"
  } ${isRequestingPTokens ? "opacity-50 cursor-not-allowed" : ""}`;

  return (
    <button
      {...buttonProps}
      onClick={handlePChainTokenRequest}
      disabled={isRequestingPTokens}
      className={className || defaultClassName}
      title="Get free P-Chain AVAX"
    >
      {isRequestingPTokens ? "Requesting..." : children || "Faucet"}
    </button>
  );
};