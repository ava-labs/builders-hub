"use client";
import { useState } from "react";
// Temporarily using simple alerts instead of AlertDialog for compatibility
import { useWalletStore } from "../../stores/walletStore";

const LOW_BALANCE_THRESHOLD = 1;

interface CChainFaucetButtonProps {
  className?: string;
  buttonProps?: React.ButtonHTMLAttributes<HTMLButtonElement>;
  children?: React.ReactNode;
}

export const CChainFaucetButton = ({ className, buttonProps, children }: CChainFaucetButtonProps = {}) => {
  const { walletEVMAddress, isTestnet, cChainBalance, updateCChainBalance } =
    useWalletStore();

  const [isRequestingCTokens, setIsRequestingCTokens] = useState(false);
  // Simplified alert handling
  const handleLogin = () => {
    window.location.href = "/login";
  };

  const handleCChainTokenRequest = async () => {
    if (isRequestingCTokens || !walletEVMAddress) return;
    setIsRequestingCTokens(true);

    try {
      const response = await fetch(
        `/api/cchain-faucet?address=${walletEVMAddress}`
      );
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
        console.log("C-Chain token request successful, txHash:", data.txHash);
        alert("Success! 2 AVAX tokens have been sent to your C-Chain address. Your balance will update shortly.");
        setTimeout(() => updateCChainBalance(), 3000);
      } else {
        throw new Error(data.message || "Failed to get tokens");
      }
    } catch (error) {
      console.error("C-Chain token request error:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";
      if (errorMessage.includes("login") || errorMessage.includes("401")) {
        alert("Authentication Required: You need to be logged in to request free tokens from the C-Chain Faucet.");
        handleLogin();
      } else {
        alert(`Faucet Request Failed: ${errorMessage}`);
      }
    } finally {
      setIsRequestingCTokens(false);
    }
  };

  if (!isTestnet) {
    return null;
  }

  // Default styling
  const defaultClassName = `px-2 py-1 text-xs font-medium text-white rounded transition-colors ${
    cChainBalance < LOW_BALANCE_THRESHOLD
      ? "bg-blue-500 hover:bg-blue-600 shimmer"
      : "bg-zinc-600 hover:bg-zinc-700"
  } ${isRequestingCTokens ? "opacity-50 cursor-not-allowed" : ""}`;

  return (
    <button
      {...(buttonProps || {})}
      onClick={handleCChainTokenRequest}
      disabled={isRequestingCTokens}
      className={className || defaultClassName}
      title="Get free C-Chain AVAX"
    >
      {isRequestingCTokens ? "Requesting..." : (children || "Faucet")}
    </button>
  );
};
