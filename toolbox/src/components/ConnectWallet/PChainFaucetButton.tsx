"use client"
import { useState } from "react"
import { 
    AlertDialog, 
    AlertDialogAction, 
    AlertDialogContent, 
    AlertDialogDescription, 
    AlertDialogFooter,
    AlertDialogHeader, 
    AlertDialogTitle 
} from "../AlertDialog"
import { useWalletStore } from "../../stores/walletStore";

const LOW_BALANCE_THRESHOLD = 0.5

export const PChainFaucetButton = () => {
    const {pChainAddress, isTestnet, pChainBalance, updatePChainBalance } = useWalletStore();

    const [isRequestingPTokens, setIsRequestingPTokens] = useState(false);
    const [isAlertDialogOpen, setIsAlertDialogOpen] = useState(false);
    const [alertDialogTitle, setAlertDialogTitle] = useState("Error");
    const [alertDialogMessage, setAlertDialogMessage] = useState("");
    const [isLoginError, setIsLoginError] = useState(false);
    const handleLogin = () => {window.location.href = "/login";};

    const handlePChainTokenRequest = async () => {
        if (isRequestingPTokens || !pChainAddress) return;        
        setIsRequestingPTokens(true);
               
        try {
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
                console.log('Token request successful, txID:', data.txID);
                setTimeout(() => updatePChainBalance(), 3000);
            } else {
                throw new Error(data.message || "Failed to get tokens");
            }
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

            <button
                onClick={handlePChainTokenRequest}
                disabled={isRequestingPTokens}
                className={`px-2 py-1 text-xs font-medium text-white rounded transition-colors ${
                    pChainBalance < LOW_BALANCE_THRESHOLD ? "bg-blue-500 hover:bg-blue-600 shimmer" : "bg-zinc-600 hover:bg-zinc-700"
                } ${
                    isRequestingPTokens ? "opacity-50 cursor-not-allowed" : ""
                }`}
                title="Get free P-Chain AVAX"
            >
                {isRequestingPTokens ? "Requesting..." : "Faucet"}
            </button>
        </>
    );
};