import { useState, useEffect, ReactNode } from 'react';
import { deduplicateEthRequestAccounts } from './deduplicateEthRequestAccounts';

interface ChainConfig {
    chainId: string;
    chainName: string;
    nativeCurrency: {
        name: string;
        symbol: string;
        decimals: number;
    };
    rpcUrls: string[];
    blockExplorerUrls: string[];
    isTestnet: boolean;
}

export const fujiConfig: ChainConfig = {
    chainId: '0xa869',
    chainName: 'Avalanche Fuji Testnet',
    nativeCurrency: {
        name: 'Avalanche',
        symbol: 'AVAX',
        decimals: 18
    },
    rpcUrls: ['https://api.avax-test.network/ext/bc/C/rpc'],
    blockExplorerUrls: ['https://testnet.snowtrace.io/'],
    isTestnet: true
};

interface Props {
    children: ReactNode;
    chainConfig: ChainConfig;
}

type Status = 'not_started' | 'wrong_chain' | 'success';

export default function SwitchChain({ children, chainConfig }: Props) {
    const [chainStatus, setChainStatus] = useState<Status>('not_started');
    const [isConnected, setIsConnected] = useState(false);

    // Check if user is connected and on the right chain
    const checkConnection = async () => {
        if (!window.avalanche) {
            setChainStatus('wrong_chain');
            return;
        }

        try {
            // Request account access
            const accounts = await deduplicateEthRequestAccounts()

            if (!accounts || accounts.length === 0) {
                setChainStatus('wrong_chain');
                setIsConnected(false);
                return;
            }

            setIsConnected(true);

            // Check chain
            const chainId = await window.avalanche.request<string>({
                method: 'eth_chainId',
                params: []
            });

            if (chainId === chainConfig.chainId) {
                setChainStatus('success');
            } else {
                setChainStatus('wrong_chain');
            }
        } catch (error) {
            console.error('Connection error:', error);
            setChainStatus('wrong_chain');
            setIsConnected(false);
        }
    };

    useEffect(() => {
        checkConnection();

        if (window.avalanche) {
            const provider = window.avalanche!;
            provider.on('chainChanged', checkConnection);
            provider.on('accountsChanged', checkConnection);

            return () => {
                provider.removeListener('chainChanged', checkConnection);
                provider.removeListener('accountsChanged', checkConnection);
            };
        }
    }, []);

    const switchChain = async () => {
        if (!window.avalanche) return;

        try {

            await window.avalanche.request({
                method: 'wallet_addEthereumChain',
                params: [chainConfig]
            });
            await window.avalanche.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: chainConfig.chainId }],
            });
        } catch (error: any) {
            console.error('Failed to add network:', error);
        }
    };

    if (chainStatus === 'success' && isConnected) {
        return <>{children}</>;
    }

    return (
        <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
            <div className="flex items-start gap-3 mb-4">
                <div className="rounded-full p-2 bg-amber-100 dark:bg-amber-900/50">
                    <svg className="w-5 h-5 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                </div>
                <div className="flex-1">
                    <h3 className="font-semibold text-amber-900 dark:text-amber-100 mb-1">
                        {!isConnected ? 'Connect Core Wallet' : 'Switch Network Required'}
                    </h3>
                    <p className="text-sm text-amber-700 dark:text-amber-300 mb-3">
                        {!isConnected 
                            ? 'Connect your Core wallet to continue'
                            : `Please switch to ${chainConfig.chainName} to continue`
                        }
                    </p>
                    {!isConnected ? (
                        <button
                            onClick={checkConnection}
                            className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 dark:bg-amber-700 dark:hover:bg-amber-600 text-white rounded-lg transition-colors font-medium text-sm"
                        >
                            <img src="/core-logo-dark.svg" alt="Core logo" className="h-4 w-4 object-contain brightness-0 invert" />
                            Connect Core Wallet
                        </button>
                    ) : (
                        <button
                            onClick={switchChain}
                            className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 dark:bg-amber-700 dark:hover:bg-amber-600 text-white rounded-lg transition-colors font-medium text-sm"
                        >
                            <img src="/core-logo-dark.svg" alt="Core logo" className="h-4 w-4 object-contain brightness-0 invert" />
                            Switch to {chainConfig.chainName}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
