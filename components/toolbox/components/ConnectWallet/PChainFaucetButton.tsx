"use client";
import { useWalletStore } from "@/components/toolbox/stores/walletStore";
import { useTestnetFaucet } from "@/hooks/useTestnetFaucet";
import { useFaucetRateLimit } from "@/hooks/useFaucetRateLimit";

const LOW_BALANCE_THRESHOLD = 0.5;

interface PChainFaucetButtonProps {
  className?: string;
  buttonProps?: React.ButtonHTMLAttributes<HTMLButtonElement>;
  children?: React.ReactNode;
  showRateLimitStatus?: boolean;
}

export const PChainFaucetButton = ({
  className,
  buttonProps,
  children,
  showRateLimitStatus = true,
}: PChainFaucetButtonProps = {}) => {
  const { pChainAddress, isTestnet, pChainBalance } =
    useWalletStore();
  const { claimPChainAVAX, isClaimingPChain } = useTestnetFaucet();
  const { 
    canClaim, 
    isLoading: isCheckingRateLimit, 
    getRateLimitMessage,
    allowed,
    timeUntilReset,
    checkRateLimit
  } = useFaucetRateLimit({ faucetType: 'pchain' });

  const isDisabled = isClaimingPChain || !canClaim || isCheckingRateLimit;

  const handlePChainTokenRequest = async () => {
    if (isDisabled || !pChainAddress) return;

    try {
      await claimPChainAVAX(false);
      // Refresh rate limit status after successful claim
      setTimeout(() => checkRateLimit(), 1000);
    } catch (error) {
      // error handling done via notifications
    }
  };

  if (!isTestnet) {
    return null;
  }

  const getButtonText = () => {
    if (isClaimingPChain) return "Requesting...";
    if (isCheckingRateLimit) return "Checking...";
    if (!allowed && timeUntilReset) return `Wait ${timeUntilReset}`;
    return children || "Faucet";
  };

  const defaultClassName = `px-2 py-1 text-xs font-medium text-white rounded transition-colors ${
    pChainBalance < LOW_BALANCE_THRESHOLD && allowed
      ? "bg-blue-500 hover:bg-blue-600 shimmer"
      : allowed
        ? "bg-zinc-600 hover:bg-zinc-700"
        : "bg-zinc-500 cursor-not-allowed"
  } ${isDisabled ? "opacity-50 cursor-not-allowed" : ""}`;

  return (
    <button
      {...buttonProps}
      onClick={handlePChainTokenRequest}
      disabled={isDisabled}
      className={className || defaultClassName}
      title={showRateLimitStatus && !allowed ? getRateLimitMessage() : "Get free P-Chain AVAX"}
    >
      {getButtonText()}
    </button>
  );
};
