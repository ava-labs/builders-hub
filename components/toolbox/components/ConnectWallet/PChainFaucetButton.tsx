"use client"
import { useState } from "react"
import { useWalletStore } from "@/components/toolbox/stores/walletStore"
import useConsoleNotifications from "@/hooks/useConsoleNotifications"

const LOW_BALANCE_THRESHOLD = 0.5

interface PChainFaucetButtonProps {
  className?: string;
  buttonProps?: React.ButtonHTMLAttributes<HTMLButtonElement>;
  children?: React.ReactNode;
}

export const PChainFaucetButton = ({ className, buttonProps, children }: PChainFaucetButtonProps = {}) => {
  const { pChainAddress, isTestnet, pChainBalance, updatePChainBalance } = useWalletStore();
  const { notify } = useConsoleNotifications();

  const [isRequestingPTokens, setIsRequestingPTokens] = useState(false);

  const handlePChainTokenRequest = async () => {
    if (isRequestingPTokens || !pChainAddress) return;
    setIsRequestingPTokens(true);

    const faucetRequest = async () => {
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

      if (!data.success) { throw new Error(data.message || "Failed to get tokens") }
      return data;
    };

    const faucetPromise = faucetRequest();

    notify(
      {
        type: "local",
        name: "P-Chain AVAX Faucet Claim",
      },
      faucetPromise
    );

    try { 
      await faucetPromise;
    } catch (error) {
    } finally {
      setIsRequestingPTokens(false);
    }
  };

  if (!isTestnet) { return null }

  const defaultClassName = `px-2 py-1 text-xs font-medium text-white rounded transition-colors ${pChainBalance < LOW_BALANCE_THRESHOLD
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
