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

const LOW_BALANCE_THRESHOLD = 1;

const SUPPORTED_CHAINS = {
  43113: { name: "C-Chain (Fuji)", symbol: "AVAX" },
  173750: { name: "Echo L1", symbol: "ECH" },
  779672: { name: "Dispatch L1", symbol: "DIS" },
} as const;

type SupportedChainId = keyof typeof SUPPORTED_CHAINS;

interface EVMFaucetButtonProps {
  chainId: SupportedChainId;
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
  const { walletEVMAddress, isTestnet, cChainBalance, updateCChainBalance } =
    useWalletStore();

  const [isRequestingTokens, setIsRequestingTokens] = useState(false);
  const [isAlertDialogOpen, setIsAlertDialogOpen] = useState(false);
  const [alertDialogTitle, setAlertDialogTitle] = useState("Error");
  const [alertDialogMessage, setAlertDialogMessage] = useState("");
  const [isLoginError, setIsLoginError] = useState(false);

  const chainConfig = SUPPORTED_CHAINS[chainId];

  const handleLogin = () => {
    window.location.href = "/login";
  };

  const handleTokenRequest = async () => {
    if (isRequestingTokens || !walletEVMAddress) return;
    setIsRequestingTokens(true);

    try {
      const response = await fetch(
        `/api/evm-chain-faucet?address=${walletEVMAddress}&chainId=${chainId}`
      );
      const rawText = await response.text();
      let data;

      try {
        data = JSON.parse(rawText);
      } catch (parseError) {
        throw new Error(`Invalid response: ${rawText.substring(0, 100)}...`);
      }

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("Please login first");
        }
        if (response.status === 429) {
          throw new Error(
            data.message || "Rate limit exceeded. Please try again later."
          );
        }
        throw new Error(
          data.message || `Error ${response.status}: Failed to get tokens`
        );
      }

      if (data.success) {
        console.log(
          `${chainConfig.name} token request successful, txHash:`,
          data.txHash
        );

        if (chainId === 43113) {
          setTimeout(() => updateCChainBalance(), 3000);
        }
      } else {
        throw new Error(data.message || "Failed to get tokens");
      }
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

  if (!isTestnet) {
    return null;
  }

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
        title={`Get free ${chainConfig.symbol} tokens`}
      >
        {isRequestingTokens
          ? "Requesting..."
          : children || `${chainConfig.symbol} Faucet`}
      </button>
    </>
  );
};
