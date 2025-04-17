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
        <div className="p-4 border rounded-lg">
            <h3 className="font-medium mb-4">Network Check</h3>
            {!isConnected ? (
                <button
                    onClick={checkConnection}
                    className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                >
                    Connect Wallet
                </button>
            ) : (
                <button
                    onClick={switchChain}
                    className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                >
                    Switch to {chainConfig.chainName}
                </button>
            )}
        </div>
    );
}
