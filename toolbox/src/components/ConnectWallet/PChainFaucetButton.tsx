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

    consoleToast.promise(faucetRequest(), {
      loading: "Requesting P-Chain AVAX tokens...",
      success: (data) => {
        const successMessage = data.txID ? `P-Chain AVAX tokens sent! TX: ${data.txID.substring(0, 10)}...` : "P-Chain AVAX tokens sent successfully!";
        if (data.txID) {
          const explorerUrl = `https://subnets.avax.network/p-chain/tx/${data.txID}`;
          setTimeout(() => {
            consoleToast.action(`View P-Chain transaction on explorer`, {
              action: { 
                label: "Open Explorer", 
                onClick: () => window.open(explorerUrl, '_blank') 
              }
            });
          }, 2000);
        }
        setTimeout(() => {
          updatePChainBalance();
          consoleToast.info("Your P-Chain balance has been refreshed");
        }, 2000);

        return successMessage;
      },
      error: (error) => {
        console.error("P-Chain token request error:", error);
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        if (errorMessage.includes("login") || errorMessage.includes("401")) {
          const currentUrl = window.location.href;
          const loginUrl = `/login?callbackUrl=${encodeURIComponent(currentUrl)}`;
          setTimeout(() => {
            consoleToast.action("Please Login/Signup to request free tokens from the P-Chain Faucet.",
              {action: {label: "Login", onClick: () => (window.location.href = loginUrl)}});
            }, 3000);
          return "Authentication required";
        } else if (errorMessage.includes("rate limit") || errorMessage.includes("429")) {
          setTimeout(() => {
            consoleToast.warning("Rate Limited: Please wait before requesting tokens again. Try again in a few minutes.")
          }, 500);
          return "Rate limited";
        } else { return `P-Chain Faucet Error: ${errorMessage}` }
      },
    });

    try {
      await faucetRequest();
    } catch (error) {
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