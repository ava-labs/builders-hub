"use client";
import { useWalletStore } from "@/components/toolbox/stores/walletStore";
import { useL1List, type L1ListItem } from "../../stores/l1ListStore";
import { useTestnetFaucet } from "@/hooks/useTestnetFaucet";
import { useFaucetRateLimit } from "@/hooks/useFaucetRateLimit";

const LOW_BALANCE_THRESHOLD = 1;

interface EVMFaucetButtonProps {
  chainId: number;
  className?: string;
  buttonProps?: React.ButtonHTMLAttributes<HTMLButtonElement>;
  children?: React.ReactNode;
  showRateLimitStatus?: boolean;
}

export const EVMFaucetButton = ({
  chainId,
  className,
  buttonProps,
  children,
  showRateLimitStatus = true,
}: EVMFaucetButtonProps) => {
  const {
    walletEVMAddress,
    isTestnet,
    cChainBalance,
  } = useWalletStore();
  const l1List = useL1List();
  const { claimEVMTokens, isClaimingEVM } = useTestnetFaucet();
  const { 
    canClaim, 
    isLoading: isCheckingRateLimit, 
    getRateLimitMessage,
    allowed,
    timeUntilReset,
    checkRateLimit
  } = useFaucetRateLimit({ 
    faucetType: 'evm', 
    chainId: chainId.toString() 
  });

  const chainConfig = l1List.find(
    (chain: L1ListItem) =>
      chain.evmChainId === chainId && chain.hasBuilderHubFaucet
  );

  if (!isTestnet || !chainConfig) {
    return null;
  }

  const isRequestingTokens = isClaimingEVM[chainId] || false;
  const isDisabled = isRequestingTokens || !canClaim || isCheckingRateLimit;

  const handleTokenRequest = async () => {
    if (isDisabled || !walletEVMAddress) return;

    try {
      await claimEVMTokens(chainId, false);
      // Refresh rate limit status after successful claim
      setTimeout(() => checkRateLimit(), 1000);
    } catch (error) {
      // error handled via notifications from useTestnetFaucet
    }
  };

  const getButtonText = () => {
    if (isRequestingTokens) return "Requesting...";
    if (isCheckingRateLimit) return "Checking...";
    if (!allowed && timeUntilReset) return `Wait ${timeUntilReset}`;
    return children || `${chainConfig.coinName} Faucet`;
  };

  const defaultClassName = `px-2 py-1 text-xs font-medium text-white rounded transition-colors ${
    cChainBalance < LOW_BALANCE_THRESHOLD && allowed
      ? "bg-blue-500 hover:bg-blue-600 shimmer"
      : allowed 
        ? "bg-zinc-600 hover:bg-zinc-700"
        : "bg-zinc-500 cursor-not-allowed"
  } ${isDisabled ? "opacity-50 cursor-not-allowed" : ""}`;

  return (
    <button
      {...buttonProps}
      onClick={handleTokenRequest}
      disabled={isDisabled}
      className={className || defaultClassName}
      title={showRateLimitStatus && !allowed ? getRateLimitMessage() : `Get free ${chainConfig.coinName} tokens`}
    >
      {getButtonText()}
    </button>
  );
};
