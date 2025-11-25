"use client";
import { useState } from "react";
import { useWalletStore } from "@/components/toolbox/stores/walletStore";
import { useL1List, type L1ListItem } from "../../stores/l1ListStore";
import { useTestnetFaucet } from "@/hooks/useTestnetFaucet";

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
  const l1List = useL1List();
  const { claimEVMTokens, isClaimingEVM } = useTestnetFaucet();

  const chainConfig = l1List.find(
    (chain: L1ListItem) =>
      chain.evmChainId === chainId && chain.hasBuilderHubFaucet
  );

  if (!isTestnet || !chainConfig) {
    return null;
  }

  const isRequestingTokens = isClaimingEVM[chainId] || false;

  const handleTokenRequest = async () => {
    if (isRequestingTokens || !walletEVMAddress) return;

    try {
      await claimEVMTokens(chainId, false);
    } catch (error) {
      // error handled via notifications from useTestnetFaucet
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
      {isRequestingTokens
        ? "Requesting..."
        : children || `${chainConfig.coinName} Faucet`}
    </button>
  );
};
