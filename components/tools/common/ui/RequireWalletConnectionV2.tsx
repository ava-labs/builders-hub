import { useState, useEffect, ReactNode } from 'react';
import Pre from './Pre';
import { AddEthereumChainParameter, Chain, createWalletClient, custom } from 'viem';
import { deduplicateEthRequestAccounts } from './deduplicateEthRequestAccounts';

// Fuji Testnet configuration
export const fujiConfig: Chain = {
    id: 43113,
    name: 'Avalanche Fuji Testnet',
    nativeCurrency: {
        name: 'Avalanche',
        symbol: 'AVAX',
        decimals: 18
    },
    rpcUrls: {
        default: { http: ['https://api.avax-test.network/ext/bc/C/rpc'] },//hardcoded, do not change
    },
    blockExplorers: {
        default: { name: 'Snowtrace', url: 'https://testnet.snowtrace.io/' }
    }
};

// RequireWalletConnection Props
interface RequireWalletConnectionProps {
    children?: ReactNode;
    chain: Chain;
    onConnection?: () => void;
    skipUI?: boolean;
}

// Main RequireWalletConnection Component
export default function RequireWalletConnection({ children, chain, onConnection, skipUI }: RequireWalletConnectionProps) {
    const [connectionStatus, setConnectionStatus] = useState<'no_wallet_installed' | 'wrong_chain' | 'rpc_error' | 'insufficient_balance' | 'correct_chain_connected'>('no_wallet_installed');
    const [account, setAccount] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Check if user is connected and on the right chain
    const checkConnection = async () => {
        try {
            setError(null);

            // Check if wallet is installed
            setConnectionStatus('no_wallet_installed');
            if (!window.avalanche) return;

            // Check if connected to the correct chain
            setConnectionStatus('wrong_chain');
            const chainId = await window.avalanche.request({ method: 'eth_chainId', params: [] });
            if (chainId !== `0x${chain.id.toString(16)}`) return;

            // Check if account can be accessed
            const accounts = await deduplicateEthRequestAccounts()
            if (!accounts || accounts.length === 0) {
                setError('No account detected');
                return;
            }
            const selectedAccount = accounts[0];
            setAccount(selectedAccount);

            // Check if RPC endpoint is reachable
            setConnectionStatus('rpc_error');
            await window.avalanche.request({
                method: 'eth_blockNumber',
                params: []
            });

            setConnectionStatus('correct_chain_connected');
            onConnection && onConnection();
        } catch (error) {
            if (error instanceof Error) {
                setError(`Connection error: ${error.message}`);
            } else {
                setError(`An unknown error occurred: ${error}`);
            }
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
        if (!window.avalanche) {
            setConnectionStatus('no_wallet_installed');
            return;
        }

        const walletClient = createWalletClient({
            chain,
            transport: custom(window.avalanche)
        });

        const rpcChainPayload: AddEthereumChainParameter = {
            chainId: `0x${chain.id.toString(16)}`,
            chainName: chain.name,
            nativeCurrency: {
                name: chain.nativeCurrency.name,
                symbol: chain.nativeCurrency.symbol,
                decimals: chain.nativeCurrency.decimals,
            },
            rpcUrls: chain.rpcUrls.default.http.map((rpcUrl: string) => rpcUrl)
        }

        try {
            await walletClient.request({
                method: "wallet_addEthereumChain",
                params: [rpcChainPayload]
            });
            await walletClient.switchChain({ id: chain.id });
        } catch (error: any) {
            setError(`Failed to switch network: ${error?.message}`);
        }
    };

    const renderContent = () => {
        switch (connectionStatus) {
            case 'no_wallet_installed':
                return (
                    <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
                        <h3 className="font-medium mb-2">No Wallet Detected</h3>
                        <p className="mb-4">
                            You need an Core Wallet to launch your L1:
                        </p>
                        <a
                            href="https://chromewebstore.google.com/detail/core-crypto-wallet-nft-ex/agoakfejjabomempkjlepdflaleeobhb"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 inline-block"
                        >
                            Install Core Wallet
                        </a>
                    </div>
                );
            case 'wrong_chain':
                return (
                    <div>
                        <h3 className="font-medium mb-2">Add the Chain</h3>
                        <p className="mb-4">
                            You need to add and connect the {chain.name} chain to your wallet to continue.
                        </p>
                        <div className="space-y-4">
                            <div>
                                <div className="font-medium">Chain Name:</div>
                                <div>{chain.name}</div>
                            </div>
                            <div>
                                <div className="font-medium">Chain ID:</div>
                                <div>{chain.id}</div>
                            </div>
                            <div>
                                <div className="font-medium">RPC URLs:</div>
                                {chain.rpcUrls.default.http.map((rpcUrl: string, index: number) => (
                                    <div key={index} className="break-all">{rpcUrl}</div>
                                ))}
                            </div>
                        </div>

                        <div className='mt-4 space-x-4'>
                            <button
                                onClick={switchChain}
                                className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                            >
                                Add/Switch to {chain.name}
                            </button>

                            <button
                                onClick={checkConnection}
                                className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                            >
                                Check Wallet Connection
                            </button>
                        </div>
                    </div>
                );
            case 'rpc_error':
                return (
                    <>
                        <p>The RPC endpoint is unreachable. Please make sure it is accessible.</p>
                        <Pre>{chain.rpcUrls.default.http[0]}</Pre>
                    </>
                );
            case 'correct_chain_connected':
                return (
                    <>
                        {children ? children : `Successfully connected to ${chain.name}!`}
                    </>
                );
            default:
                return <p>An unexpected error occurred</p>;
        }
    };

    if (skipUI && connectionStatus === 'correct_chain_connected') {
        return renderContent();
    }

    if (!chain.rpcUrls?.default?.http[0]) {
        return <p>No RPC URL found for {chain?.name || 'unknown chain'}. This is likely a bug, please contact support.</p>;
    }

    return (
        <div className="p-4 border rounded-lg bg-blue-50 dark:bg-blue-900 border-l-4 border-blue-400 dark:border-blue-600 mb-6">
            <h3 className="font-medium mb-4">Network Check</h3>
            <div className='steps space-y-6 mb-6'>
                <div className="step">Wallet installed</div>
                <div className="step">Connected to {chain.name}</div>
                <div className="step">RPC is reachable</div>
            </div>
            {error && connectionStatus !== 'correct_chain_connected' && (
                <p className="text-red-500 mb-4">{error}</p>
            )}
            {renderContent()}
        </div>
    );
}
