'use client';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { useL1List, type L1ListItem } from '../../stores/l1ListStore';
import { useTestnetFaucet } from '@/hooks/useTestnetFaucet';
import { useFaucetRateLimit } from '@/hooks/useFaucetRateLimit';
import { findERC20FaucetToken, getERC20ClaimScope } from '@/lib/faucet/erc20';

interface ERC20FaucetButtonProps {
  chainId: number;
  tokenAddress: string;
  className?: string;
  buttonProps?: React.ButtonHTMLAttributes<HTMLButtonElement>;
  children?: React.ReactNode;
  showRateLimitStatus?: boolean;
  onClaimed?: () => void;
}

export const ERC20FaucetButton = ({
  chainId,
  tokenAddress,
  className,
  buttonProps,
  children,
  showRateLimitStatus = true,
  onClaimed,
}: ERC20FaucetButtonProps) => {
  const { walletEVMAddress, isTestnet } = useWalletStore();
  const l1List = useL1List();
  const { claimERC20Tokens, isClaimingERC20 } = useTestnetFaucet();

  const chainConfig = l1List.find((chain: L1ListItem) => chain.evmChainId === chainId && chain.hasBuilderHubFaucet);
  const token = findERC20FaucetToken(chainConfig, tokenAddress);
  const scope = getERC20ClaimScope(chainId, tokenAddress);

  const {
    canClaim,
    isLoading: isCheckingRateLimit,
    getRateLimitMessage,
    allowed,
    timeUntilReset,
    checkRateLimit,
    markRateLimited,
  } = useFaucetRateLimit({
    faucetType: 'erc20',
    chainId: scope,
  });

  if (!isTestnet || !chainConfig || !token) {
    return null;
  }

  const isRequestingTokens = isClaimingERC20[scope] || false;
  const isDisabled = isRequestingTokens || !canClaim || isCheckingRateLimit;

  const handleTokenRequest = async () => {
    if (isDisabled || !walletEVMAddress) return;

    try {
      await claimERC20Tokens(chainId, token.address, false);
      onClaimed?.();
      // Refresh rate limit status after successful claim
      setTimeout(() => checkRateLimit(), 1000);
    } catch (error) {
      // Immediately disable button if rate limited
      const msg = error instanceof Error ? error.message : '';
      if (msg.toLowerCase().includes('rate limit') || msg.toLowerCase().includes('daily limit')) {
        markRateLimited();
      }
    }
  };

  const getButtonText = () => {
    if (isRequestingTokens) return 'Requesting...';
    if (isCheckingRateLimit) return 'Checking...';
    if (!allowed && timeUntilReset) return `Wait ${timeUntilReset}`;
    return children || `${token.symbol} Faucet`;
  };

  const defaultClassName = `px-2 py-1 text-xs font-medium text-white rounded transition-colors ${
    allowed ? 'bg-zinc-600 hover:bg-zinc-700' : 'bg-zinc-500 cursor-not-allowed'
  } ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`;

  return (
    <button
      {...buttonProps}
      onClick={handleTokenRequest}
      disabled={isDisabled}
      className={className || defaultClassName}
      title={showRateLimitStatus && !allowed ? getRateLimitMessage() : `Get free ${token.symbol} tokens`}
    >
      {getButtonText()}
    </button>
  );
};
