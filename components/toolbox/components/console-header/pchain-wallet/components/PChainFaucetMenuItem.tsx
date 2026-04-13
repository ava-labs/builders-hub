'use client';
import { useState } from 'react';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { Droplet } from 'lucide-react';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/toolbox/components/AlertDialog';
import useConsoleNotifications from '@/hooks/useConsoleNotifications';
import { useFaucetRateLimit } from '@/hooks/useFaucetRateLimit';
import { apiFetch, ApiClientError } from '@/lib/api/client';

export function PChainFaucetMenuItem() {
  const pChainAddress = useWalletStore((s) => s.pChainAddress);
  const updatePChainBalance = useWalletStore((s) => s.updatePChainBalance);
  const isTestnet = useWalletStore((s) => s.isTestnet);
  const { notify } = useConsoleNotifications();

  const {
    canClaim,
    allowed,
    timeUntilReset,
    getRateLimitMessage,
    checkRateLimit,
    isLoading: isCheckingRateLimit,
  } = useFaucetRateLimit({ faucetType: 'pchain' });

  // Faucet state
  const [isRequestingPTokens, setIsRequestingPTokens] = useState(false);
  const [isAlertDialogOpen, setIsAlertDialogOpen] = useState(false);
  const [alertDialogTitle, setAlertDialogTitle] = useState('Error');
  const [alertDialogMessage, setAlertDialogMessage] = useState('');
  const [isLoginError, setIsLoginError] = useState(false);

  const handleLogin = () => {
    window.location.href = '/login';
  };

  const handlePChainTokenRequest = async () => {
    if (isRequestingPTokens || !pChainAddress || !canClaim) return;
    setIsRequestingPTokens(true);

    const faucetRequest = async () => {
      try {
        const data = await apiFetch<{ success: boolean; message?: string }>(
          `/api/pchain-faucet?address=${pChainAddress}`,
        );
        setTimeout(() => {
          updatePChainBalance();
          checkRateLimit(); // Refresh rate limit status
        }, 3000);
        return data;
      } catch (error) {
        if (error instanceof ApiClientError) {
          if (error.status === 401) throw new Error('Please login first');
          if (error.status === 429) throw new Error(error.message || 'Rate limit exceeded. Please try again later.');
          throw new Error(error.message || `Error ${error.status}: Failed to get tokens`);
        }
        throw error;
      }
    };

    const faucetPromise = faucetRequest();

    notify(
      {
        type: 'local',
        name: 'P-Chain AVAX Faucet Claim',
      },
      faucetPromise,
    );

    try {
      await faucetPromise;
    } catch (error) {
      console.error('P-Chain token request error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      if (errorMessage.includes('login') || errorMessage.includes('401')) {
        setAlertDialogTitle('Authentication Required');
        setAlertDialogMessage('You need to be logged in to request free tokens from the P-Chain Faucet.');
        setIsLoginError(true);
        setIsAlertDialogOpen(true);
      } else {
        setAlertDialogTitle('Faucet Request Failed');
        setAlertDialogMessage(errorMessage);
        setIsLoginError(false);
        setIsAlertDialogOpen(true);
      }
    } finally {
      setIsRequestingPTokens(false);
    }
  };

  // Don't render if not on testnet
  if (!isTestnet) {
    return null;
  }

  const isDisabled = isRequestingPTokens || !canClaim || isCheckingRateLimit;

  const getMenuItemText = () => {
    if (isRequestingPTokens) return 'Requesting...';
    if (isCheckingRateLimit) return 'Checking...';
    if (!allowed && timeUntilReset) return `Faucet available in ${timeUntilReset}`;
    return 'Get AVAX from Faucet';
  };

  return (
    <>
      <AlertDialog open={isAlertDialogOpen} onOpenChange={setIsAlertDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{alertDialogTitle}</AlertDialogTitle>
            <AlertDialogDescription>{alertDialogMessage}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex gap-2">
            {isLoginError ? (
              <>
                <AlertDialogAction onClick={handleLogin} className="bg-blue-500 hover:bg-blue-600">
                  Login
                </AlertDialogAction>
                <AlertDialogAction className="bg-zinc-200 hover:bg-zinc-300 text-zinc-800">Close</AlertDialogAction>
              </>
            ) : (
              <AlertDialogAction>OK</AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <DropdownMenuItem
        onClick={handlePChainTokenRequest}
        disabled={isDisabled}
        className="cursor-pointer"
        title={!allowed ? getRateLimitMessage() : undefined}
      >
        <Droplet className="mr-2 h-3 w-3" />
        {getMenuItemText()}
      </DropdownMenuItem>
    </>
  );
}
