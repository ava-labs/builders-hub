import { Check, Copy as CopyIcon, ExternalLink } from "lucide-react";
import { useState } from "react";
import { isAddress } from "viem";

interface SuccessProps {
    label: string;
    value: string;
    isTestnet?: boolean;
}

export const Success = ({ label, value, isTestnet = true }: SuccessProps) => {
    const [copied, setCopied] = useState(false);
    if (!value) return null;

    const handleCopy = async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    };

    const isPChainTxId = /^[1-9A-HJ-NP-Za-km-z]{40,60}$/.test(value);
    const baseUrl = isTestnet ? "https://subnets-test.avax.network" : "https://subnets.avax.network";
    
    const showCopy = isAddress(value) || isPChainTxId;
    
    const getExplorerUrl = () => {
        if (isPChainTxId) {
            return `${baseUrl}/p-chain/tx/${value}`;
        }
        return null;
    };

    const explorerUrl = getExplorerUrl();

    return (
        <div className="p-6 bg-green-50 dark:bg-green-900/30 rounded-xl shadow-md flex items-center space-x-4">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-green-100 dark:bg-green-800 flex-shrink-0">
                <Check className="h-7 w-7 text-green-600 dark:text-green-400" />
            </div>
            <div className="flex flex-col flex-1 space-y-1">
                <span className="text-lg font-bold text-green-800 dark:text-green-200">{label}</span>
                <div className="flex items-center">
                    {explorerUrl ? (
                        <a
                            href={explorerUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-mono text-sm break-all dark:text-neutral-200 text-green-900 flex-1 hover:underline hover:text-green-700 dark:hover:text-green-300 transition flex items-center gap-1"
                        >
                            {value}
                            <ExternalLink className="h-4 w-4 flex-shrink-0" />
                        </a>
                    ) : (
                        <span className="font-mono text-sm break-all dark:text-neutral-200 text-green-900 flex-1">{value}</span>
                    )}
                    {showCopy && (
                        <button
                            onClick={handleCopy}
                            className="ml-2 focus:outline-none hover:text-green-700 dark:hover:text-green-300 transition"
                            aria-label="Copy to clipboard"
                        >
                            {copied ? (
                                <Check className="h-5 w-5 text-green-600" />
                            ) : (
                                <CopyIcon className="h-5 w-5 text-green-600" />
                            )}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};
