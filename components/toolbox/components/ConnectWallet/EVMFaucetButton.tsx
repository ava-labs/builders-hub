"use client";
import { useState } from "react";
import { useWalletStore } from "@/components/toolbox/stores/walletStore";
import { useBuilderHubFaucet } from "../../hooks/useBuilderHubFaucet";
import { useL1List, type L1ListItem } from "../../stores/l1ListStore";
import { consoleToast } from "../../lib/console-toast";
import useConsoleNotifications from "@/hooks/useConsoleNotifications";

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
  const { notify } = useConsoleNotifications();

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

    notify(
      {
        type: "local",
        name: `${chainConfig.coinName} Faucet Claim`,
      },
      faucetRequest
    );

    consoleToast.promise(faucetRequest, {
      loading: `Requesting ${chainConfig.coinName} tokens...`,
      success: (result) => {
        const txHash = result.txHash;
        const successMessage = txHash ? `${chainConfig.coinName} tokens sent! TX: ${txHash.substring(0, 10)}...` : `${chainConfig.coinName} tokens sent successfully!`;
        if (result.txHash && chainConfig.explorerUrl) {
          const explorerUrl = `${chainConfig.explorerUrl}/tx/${result.txHash}`;
          setTimeout(() => {
            consoleToast.action(`View transaction on explorer`, {
              action: {
                label: "Open Explorer",
                onClick: () => window.open(explorerUrl, '_blank')
              }
            });
          }, 2000);
        } else if (result.txHash) {
          setTimeout(() => consoleToast.info(`Transaction hash: ${result.txHash}`), 2000);
        }

        setTimeout(async () => {
          try {
            updateL1Balance(chainId.toString());
          } catch { }
          try {
            updateCChainBalance();
          } catch { }
        }, 3000);

        setTimeout(() => consoleToast.info("Your wallet balance has been refreshed"), 2000);
        return successMessage;
      },
      error: (error) => {
        console.error(`${chainConfig.name} token request error:`, error);
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        if (errorMessage.includes("login") || errorMessage.includes("401")) {
          const currentUrl = window.location.href;
          const loginUrl = `/login?callbackUrl=${encodeURIComponent(currentUrl)}`;
          setTimeout(() => {
            consoleToast.action(`Please Login/Signup to request free tokens from the ${chainConfig.name} Faucet.`,
              { action: { label: "Login", onClick: () => (window.location.href = loginUrl) } });
          }, 2000);
          return "Authentication required";
        } else if (errorMessage.includes("rate limit") || errorMessage.includes("429")) {
          setTimeout(() => {
            const timestampMatch = errorMessage.match(/You can try again after (.+?)\./);
            const timeInfo = timestampMatch ? timestampMatch[1] : "24 hours";
            consoleToast.warning(`Rate Limited: You can request tokens again after ${timeInfo}. Each address can only request tokens once per day.`);
          }, 500);
          return "Rate limited";
        } else {
          return `Faucet Error - Chain: ${chainConfig.name}, Address: ${walletEVMAddress?.substring(0, 10)}..., Error: ${errorMessage}`;
        }
      },
    });

    try {
      await faucetRequest;
    } catch (error) {
    } finally {
      setIsRequestingTokens(false);
    }
  };

  const defaultClassName = `px-2 py-1 text-xs font-medium text-white rounded transition-colors ${cChainBalance < LOW_BALANCE_THRESHOLD
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
