"use client";
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../AlertDialog";
import { useWalletStore } from "../../stores/walletStore";
import { useBuilderHubFaucet } from "../../hooks/useBuilderHubFaucet";
import { useL1List, type L1ListItem } from "../../stores/l1ListStore";

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
  const [isAlertDialogOpen, setIsAlertDialogOpen] = useState(false);
  const [alertDialogTitle, setAlertDialogTitle] = useState("Error");
  const [alertDialogMessage, setAlertDialogMessage] = useState("");
  const [isLoginError, setIsLoginError] = useState(false);

  const chainConfig = l1List.find(
    (chain: L1ListItem) =>
      chain.evmChainId === chainId && chain.hasBuilderHubFaucet
  );

  if (!isTestnet || !chainConfig) {
    return null;
  }

  const handleLogin = () => {
    window.location.href = "/login";
  };

  const handleTokenRequest = async () => {
    if (isRequestingTokens || !walletEVMAddress) return;
    setIsRequestingTokens(true);

    try {
      await requestTokens(chainId);
      // Refresh balances shortly after a successful request to reflect the drip
      setTimeout(() => {
        try { updateL1Balance(chainId.toString()); } catch {}
        try { updateCChainBalance(); } catch {}
      }, 3000);
    } catch (error) {
      console.error(`${chainConfig.name} token request error:`, error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";
      if (errorMessage.includes("login") || errorMessage.includes("401")) {
        setAlertDialogTitle("Authentication Required");
        setAlertDialogMessage(
          `You need to be logged in to request free tokens from the ${chainConfig.name} Faucet.`
        );
        setIsLoginError(true);
        setIsAlertDialogOpen(true);
      } else {
        setAlertDialogTitle("Faucet Request Failed");
        setAlertDialogMessage(errorMessage);
        setIsLoginError(false);
        setIsAlertDialogOpen(true);
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
    <>
      <AlertDialog open={isAlertDialogOpen} onOpenChange={setIsAlertDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{alertDialogTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {alertDialogMessage}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex gap-2">
            {isLoginError ? (
              <>
                <AlertDialogAction
                  onClick={handleLogin}
                  className="bg-blue-500 hover:bg-blue-600"
                >
                  Login
                </AlertDialogAction>
                <AlertDialogAction className="bg-zinc-200 hover:bg-zinc-300 text-zinc-800">
                  Close
                </AlertDialogAction>
              </>
            ) : (
              <AlertDialogAction>OK</AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
    </>
  );
};
