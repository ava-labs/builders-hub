"use client";
import { useState } from "react";
import { useWalletStore } from "@/components/toolbox/stores/walletStore";
import { useTestnetFaucet } from "@/hooks/useTestnetFaucet";

const LOW_BALANCE_THRESHOLD = 0.5;

interface PChainFaucetButtonProps {
  className?: string;
  buttonProps?: React.ButtonHTMLAttributes<HTMLButtonElement>;
  children?: React.ReactNode;
}

export const PChainFaucetButton = ({
  className,
  buttonProps,
  children,
}: PChainFaucetButtonProps = {}) => {
  const { pChainAddress, isTestnet, pChainBalance, updatePChainBalance } = useWalletStore();
  const { claimPChainAVAX, isClaimingPChain } = useTestnetFaucet();

  const handlePChainTokenRequest = async () => {
    if (isClaimingPChain || !pChainAddress) return;

    try {
      await claimPChainAVAX(false);
    } catch (error) {
      // error handling done via notifications
    }
  };

  if (!isTestnet) {
    return null;
  }

  const defaultClassName = `px-2 py-1 text-xs font-medium text-white rounded transition-colors ${
    pChainBalance < LOW_BALANCE_THRESHOLD
      ? "bg-blue-500 hover:bg-blue-600 shimmer"
      : "bg-zinc-600 hover:bg-zinc-700"
  } ${isClaimingPChain ? "opacity-50 cursor-not-allowed" : ""}`;

  return (
    <button
      {...buttonProps}
      onClick={handlePChainTokenRequest}
      disabled={isClaimingPChain}
      className={className || defaultClassName}
      title="Get free P-Chain AVAX"
    >
      {isClaimingPChain ? "Requesting..." : children || "Faucet"}
    </button>
  );
};
