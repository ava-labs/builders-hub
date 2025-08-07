"use client"
import { useState } from "react"
// Temporarily using simple alerts instead of AlertDialog for compatibility
import { useWalletStore } from "../../stores/walletStore";

const LOW_BALANCE_THRESHOLD = 0.5

interface PChainFaucetButtonProps {
    className?: string;
    buttonProps?: React.ButtonHTMLAttributes<HTMLButtonElement>;
    children?: React.ReactNode;
}

export const PChainFaucetButton = ({ className, buttonProps, children }: PChainFaucetButtonProps = {}) => {
    const {pChainAddress, isTestnet, pChainBalance, updatePChainBalance } = useWalletStore();

    const [isRequestingPTokens, setIsRequestingPTokens] = useState(false);
    // Simplified alert handling
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
                alert("Success! 2 AVAX tokens have been sent to your P-Chain address. Your balance will update shortly.");
                setTimeout(() => updatePChainBalance(), 3000);
            } else {
                throw new Error(data.message || "Failed to get tokens");
            }
        } catch (error) {
            console.error("P-Chain token request error:", error);
            const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
            if (errorMessage.includes("login") || errorMessage.includes("401")) {
                alert("Authentication Required: You need to be logged in to request free tokens from the P-Chain Faucet.");
                handleLogin();
            } else {
                alert(`Faucet Request Failed: ${errorMessage}`);
            }
        } finally {
            setIsRequestingPTokens(false);
        }
    };

    if (!isTestnet) {
        return null;
    }

    // Default styling
    const defaultClassName = `px-2 py-1 text-xs font-medium text-white rounded transition-colors ${
        pChainBalance < LOW_BALANCE_THRESHOLD ? "bg-blue-500 hover:bg-blue-600 shimmer" : "bg-zinc-600 hover:bg-zinc-700"
    } ${
        isRequestingPTokens ? "opacity-50 cursor-not-allowed" : ""
    }`;

    return (
        <button
            {...(buttonProps || {})}
            onClick={handlePChainTokenRequest}
            disabled={isRequestingPTokens}
            className={className || defaultClassName}
            title="Get free P-Chain AVAX"
        >
            {isRequestingPTokens ? "Requesting..." : (children || "Faucet")}
        </button>
    );
};