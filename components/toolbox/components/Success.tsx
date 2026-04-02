import { Check, Copy as CopyIcon, ExternalLink, XCircle } from "lucide-react";
import { useState } from "react";
import { isAddress } from "viem";

interface SuccessProps {
    label: string;
    value: string;
    isTestnet?: boolean;
    xpChain?: "P" | "C";
    variant?: "success" | "error";
}

export const Success = ({ label, value, isTestnet = true, xpChain = "P", variant = "success" }: SuccessProps) => {
    const [copied, setCopied] = useState(false);
    if (!value) return null;

    const handleCopy = async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    };

    const isPChainTxId = /^[1-9A-HJ-NP-Za-km-z]{40,60}$/.test(value);
    
    const showCopy = isAddress(value) || isPChainTxId;
    
    const getExplorerUrl = () => {
        if (isPChainTxId) {
            if (xpChain === "P") {
                // P-Chain uses external explorer
                const baseUrl = isTestnet ? "https://subnets-test.avax.network" : "https://subnets.avax.network";
                return `${baseUrl}/p-chain/tx/${value}`;
            } else {
                // C-Chain uses internal explorer
                return `/explorer/avalanche-c-chain/tx/${value}`;
            }
        }
        return null;
    };

    const explorerUrl = getExplorerUrl();

    const isError = variant === "error";

    return (
        <div className={`p-6 rounded-xl shadow-md flex items-center space-x-4 ${isError ? "bg-red-50 dark:bg-red-900/30" : "bg-green-50 dark:bg-green-900/30"}`}>
            <div className={`flex items-center justify-center w-12 h-12 rounded-full flex-shrink-0 ${isError ? "bg-red-100 dark:bg-red-800" : "bg-green-100 dark:bg-green-800"}`}>
                {isError ? (
                    <XCircle className="h-7 w-7 text-red-600 dark:text-red-400" />
                ) : (
                    <Check className="h-7 w-7 text-green-600 dark:text-green-400" />
                )}
            </div>
            <div className="flex flex-col flex-1 space-y-1">
                <span className={`text-lg font-bold ${isError ? "text-red-800 dark:text-red-200" : "text-green-800 dark:text-green-200"}`}>{label}</span>
                <div className="flex items-center">
                    {explorerUrl ? (
                        <a
                            href={explorerUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`font-mono text-sm break-all flex-1 hover:underline transition flex items-center gap-1 ${isError ? "text-red-900 dark:text-neutral-200 hover:text-red-700 dark:hover:text-red-300" : "text-green-900 dark:text-neutral-200 hover:text-green-700 dark:hover:text-green-300"}`}
                        >
                            {value}
                            <ExternalLink className="h-4 w-4 flex-shrink-0" />
                        </a>
                    ) : (
                        <span className={`font-mono text-sm break-all flex-1 ${isError ? "text-red-900 dark:text-neutral-200" : "text-green-900 dark:text-neutral-200"}`}>{value}</span>
                    )}
                    {showCopy && (
                        <button
                            onClick={handleCopy}
                            className={`ml-2 focus:outline-none transition ${isError ? "hover:text-red-700 dark:hover:text-red-300" : "hover:text-green-700 dark:hover:text-green-300"}`}
                            aria-label="Copy to clipboard"
                        >
                            {copied ? (
                                <Check className={`h-5 w-5 ${isError ? "text-red-600" : "text-green-600"}`} />
                            ) : (
                                <CopyIcon className={`h-5 w-5 ${isError ? "text-red-600" : "text-green-600"}`} />
                            )}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};
