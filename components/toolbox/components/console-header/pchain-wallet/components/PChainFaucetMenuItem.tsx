'use client'
import { useState } from "react";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Droplet } from "lucide-react";
import { useWalletStore } from "@/components/toolbox/stores/walletStore";
import { AlertDialog,AlertDialogAction,AlertDialogContent,AlertDialogDescription,AlertDialogFooter,AlertDialogHeader,AlertDialogTitle } from "@/components/toolbox/components/AlertDialog";
import useConsoleNotifications from "@/hooks/useConsoleNotifications";

export function PChainFaucetMenuItem() {
  const pChainAddress = useWalletStore((s) => s.pChainAddress);
  const updatePChainBalance = useWalletStore((s) => s.updatePChainBalance);
  const isTestnet = useWalletStore((s) => s.isTestnet);
  const { notify } = useConsoleNotifications();

  // Faucet state
  const [isRequestingPTokens, setIsRequestingPTokens] = useState(false);
  const [isAlertDialogOpen, setIsAlertDialogOpen] = useState(false);
  const [alertDialogTitle, setAlertDialogTitle] = useState("Error");
  const [alertDialogMessage, setAlertDialogMessage] = useState("");
  const [isLoginError, setIsLoginError] = useState(false);

  const handleLogin = () => {
    window.location.href = "/login";
  };

  const handlePChainTokenRequest = async () => {
    if (isRequestingPTokens || !pChainAddress) return;
    setIsRequestingPTokens(true);

    const faucetRequest = async () => {
      const response = await fetch(`/api/pchain-faucet?address=${pChainAddress}`);
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
          throw new Error(data.message || "Rate limit exceeded. Please try again later.");
        }
        throw new Error(data.message || `Error ${response.status}: Failed to get tokens`);
      }

      if (data.success) {
        setTimeout(() => updatePChainBalance(), 3000);
        return data;
      } else {
        throw new Error(data.message || "Failed to get tokens");
      }
    };

    const faucetPromise = faucetRequest();

    notify(
      {
        type: "local",
        name: "P-Chain AVAX Faucet Claim",
      },
      faucetPromise
    );

    try {
      await faucetPromise;
    } catch (error) {
      console.error("P-Chain token request error:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      if (errorMessage.includes("login") || errorMessage.includes("401")) {
        setAlertDialogTitle("Authentication Required");
        setAlertDialogMessage("You need to be logged in to request free tokens from the P-Chain Faucet.");
        setIsLoginError(true);
        setIsAlertDialogOpen(true);
      } else {
        setAlertDialogTitle("Faucet Request Failed");
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
                <AlertDialogAction onClick={handleLogin} className="bg-blue-500 hover:bg-blue-600">
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

      <DropdownMenuItem
        onClick={handlePChainTokenRequest}
        disabled={isRequestingPTokens}
        className='cursor-pointer'
      >
        <Droplet className="mr-2 h-3 w-3" />
        {isRequestingPTokens ? "Requesting..." : "Get AVAX from Faucet"}
      </DropdownMenuItem>
    </>
  );
}
