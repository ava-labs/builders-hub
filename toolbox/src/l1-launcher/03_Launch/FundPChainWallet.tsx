import { useState, useEffect } from 'react';
import { getRPCEndpoint } from '../../coreViem/utils/rpc';
import { useL1LauncherStore } from '../L1LauncherStore';
import { RefreshCw } from 'lucide-react';
import NextPrev from '../components/NextPrev';
import { useWalletStore } from '../../lib/walletStore';
import CrossChainTransfer from '../components/CrossChainTransfer';

const TRANSFER_BUFFER = 0.1; // Buffer amount to account for fees/precision loss

export async function getPChainBalance(address: string): Promise<string> {
    const response = await fetch(getRPCEndpoint(true) + '/ext/bc/P', {
        method: 'POST',
        headers: {
            'content-type': 'application/json;'
        },
        body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "platform.getBalance",
            params: {
                addresses: [address]
            }
        })
    });

    const data = await response.json();
    if (data.error) {
        throw new Error(data.error.message || 'Failed to fetch P-chain balance');
    }

    return data.result.balance;
}


export default function FundPChainWallet() {
    const { nodesCount } = useL1LauncherStore();
    const { pChainAddress } = useWalletStore();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [pChainBalance, setPChainBalance] = useState<string>("0");
    const [balanceLoaded, setBalanceLoaded] = useState(false);

    const requiredAmount = nodesCount + 0.5;
    const currentPBalance = Number(pChainBalance) / 1e9;
    const hasEnoughFunds = currentPBalance >= (requiredAmount - TRANSFER_BUFFER);
    const remainingAmount = Math.max(0, requiredAmount - currentPBalance).toFixed(2);

    const checkPChainBalance = async () => {
        if (!pChainAddress) return;

        setIsLoading(true);
        setError(null);
        try {
            const balance = await getPChainBalance(pChainAddress);
            setPChainBalance(balance);
            setBalanceLoaded(true);
        } catch (err) {
            console.error('Failed to get P-Chain balance:', err);
            setError('Failed to get P-Chain balance: ' + err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (pChainAddress) {
            checkPChainBalance();
            const interval = setInterval(checkPChainBalance, 10000); // Refresh every 10 seconds
            return () => clearInterval(interval);
        }
    }, [pChainAddress]);

    return (
        <div className="space-y-4">
            <div className="space-y-4">
                <h1 className="text-2xl font-medium">Fund P-Chain Wallet</h1>
                <p>To set up your L1, you need to have <a
                    href="https://chromewebstore.google.com/detail/core-crypto-wallet-nft-ex/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300"
                >Core wallet</a> installed and have at least {requiredAmount} AVAX on the P-Chain. You can claim testnet AVAX with the <a
                    href="https://core.app/tools/testnet-faucet/?subnet=c&token=c"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300"
                >faucet</a> (use the code avalanche-academy) and transfer {requiredAmount} AVAX to your P-Chain address. You can do this using the <a
                    href="https://test.core.app/stake/cross-chain-transfer/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300"
                >
                        Cross-Chain Transfer
                    </a> tool in Core.app.</p>
                {!hasEnoughFunds && (
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                        Transfer {remainingAmount} more AVAX to continue.
                    </p>
                )}
            </div>

            <div className="pb-4">
                <div className="flex justify-between items-center mb-1">
                    <div className="text-sm text-gray-600 dark:text-gray-400">P-Chain Address:</div>
                    <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
                        <span>Balance: {currentPBalance.toFixed(4)} AVAX</span>
                        <button
                            onClick={checkPChainBalance}
                            disabled={isLoading}
                            className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
                            title="Refresh Balance"
                        >
                            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                        </button>
                    </div>
                </div>
                <div className="font-mono text-sm break-all mb-3 text-gray-900 dark:text-gray-100">
                    {pChainAddress}
                </div>

                <div className="mt-2">
                    {!hasEnoughFunds ? (
                        balanceLoaded && <CrossChainTransfer suggestedAmount={remainingAmount} />
                    ) : (
                        <div className="flex items-center justify-center space-x-2 p-4 bg-green-100 dark:bg-green-900 rounded border border-green-500">
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            <span className="text-green-600 dark:text-green-400">Funds Sufficient</span>
                        </div>
                    )}
                </div>

                {
                    error && (
                        <p className="mt-4 text-sm text-red-600 dark:text-red-400">
                            {error}
                        </p>
                    )
                }
            </div>

            <NextPrev
                nextEnabled={hasEnoughFunds}
            />
        </div>
    );
}
