"use client";
import { useState } from "react";
import { useWalletStore } from "@/components/toolbox/stores/walletStore";
import { useBuilderHubFaucet } from "../../hooks/useBuilderHubFaucet";
import { useL1List, type L1ListItem } from "../../stores/l1ListStore";
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
