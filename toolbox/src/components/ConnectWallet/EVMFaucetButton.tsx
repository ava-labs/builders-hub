"use client";
import { useState } from "react";
import { useWalletStore } from "../../stores/walletStore";
import { useBuilderHubFaucet } from "../../hooks/useBuilderHubFaucet";
import { useL1List, type L1ListItem } from "../../stores/l1ListStore";
import { consoleToast } from "../../lib/console-toast";

const LOW_BALANCE_THRESHOLD = 1;

interface EVMFaucetButtonProps {
  chainId: number;
  className?: string;
  buttonProps?: React.ButtonHTMLAttributes<HTMLButtonElement>;
  children?: React.ReactNode;
}

export const EVMFaucetButton = ({
  chainId,
  className,
  buttonProps,
  children,
}: EVMFaucetButtonProps) => {
  const {
    walletEVMAddress,
    isTestnet,
    cChainBalance,
    updateL1Balance,
    updateCChainBalance,
  } = useWalletStore();
  const { requestTokens } = useBuilderHubFaucet();
  const l1List = useL1List();

  const [isRequestingTokens, setIsRequestingTokens] = useState(false);

  const chainConfig = l1List.find(
    (chain: L1ListItem) =>
      chain.evmChainId === chainId && chain.hasBuilderHubFaucet
  );

  if (!isTestnet || !chainConfig) {
    return null;
  }

  const handleTokenRequest = async () => {
    if (isRequestingTokens || !walletEVMAddress) return;
    setIsRequestingTokens(true);
    const faucetRequest = requestTokens(chainId);
    let loadingToastId: string | number | undefined;

    try {
      const loadingToastId = consoleToast.loading(`Requesting ${chainConfig.coinName} tokens...`);
      const result = await faucetRequest;
      consoleToast.dismiss(loadingToastId);

      const txHash = result.txHash;
      consoleToast.success(txHash ? `${chainConfig.coinName} tokens sent! TX: ${txHash.substring(0, 10)}...` : `${chainConfig.coinName} tokens sent successfully!`);

      if (result.txHash) { consoleToast.info(`Transaction hash: ${result.txHash}`) }

      setTimeout(async () => {
        try {
          updateL1Balance(chainId.toString());
        } catch {}
        try {
          updateCChainBalance();
        } catch {}
      }, 3000);
      setTimeout(() => {consoleToast.info("Your wallet balance has been refreshed")}, 3500);
    } catch (error) {
      if (loadingToastId) {
        consoleToast.dismiss(loadingToastId);
      }

      console.error(`${chainConfig.name} token request error:`, error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";

      if (errorMessage.includes("login") || errorMessage.includes("401")) {
        consoleToast.action(`Authentication Required: You need to be logged in to request free tokens from the ${chainConfig.name} Faucet.`,
          {action: {label: "Login", onClick: () => (window.location.href = "/login")}}
        );
      } else if (errorMessage.includes("rate limit") || errorMessage.includes("429")) {
        consoleToast.warning("Rate Limited: Please wait before requesting tokens again. Try again in a few minutes.");
      } else {
        consoleToast.error(`Faucet Error - Chain: ${chainConfig.name}, Address: ${walletEVMAddress?.substring(0, 10)}..., Error: ${errorMessage}`);
      }
    } finally {
      setIsRequestingTokens(false);
    }
  };

  const defaultClassName = `px-2 py-1 text-xs font-medium text-white rounded transition-colors ${
    cChainBalance < LOW_BALANCE_THRESHOLD
      ? "bg-blue-500 hover:bg-blue-600 shimmer"
      : "bg-zinc-600 hover:bg-zinc-700"
  } ${isRequestingTokens ? "opacity-50 cursor-not-allowed" : ""}`;

  return (
    <button
      {...buttonProps}
      onClick={handleTokenRequest}
      disabled={isRequestingTokens}
      className={className || defaultClassName}
      title={`Get free ${chainConfig.coinName} tokens`}
    >
      {isRequestingTokens ? "Requesting..." : children || `${chainConfig.coinName} Faucet`}
    </button>
  );
};
