import { useState, useEffect, ReactNode } from 'react';
import Pre from './Pre';
import { deduplicateEthRequestAccounts } from './deduplicateEthRequestAccounts';
export interface ChainConfig {
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

/**
 * @value children: Content to be shown if wallet is connected correctly
 * @value chainConfig: Configuration for the chain that the wallet needs to be connected to
 */
interface RequireWalletConnectionProps {
    children?: ReactNode;
    chainConfig: ChainConfig;
    requiredBalance?: number;
    onConnection?: () => void;
}

type Status = 'no_wallet_installed' | 'wrong_chain' | 'rpc_error' | 'insufficient_balance' | 'correct_chain_connected';

/**
 * Component that checks if the user has a wallet installed and is connected to the right chain. If
 * not, the user will be prompted to install a wallet and connect to the chain. If the connection
 * is correctly established, the children elements will be shown.
 */
export default function RequireWalletConnection({ children, chainConfig, requiredBalance, onConnection }: RequireWalletConnectionProps) {
    const [connectionStatus, setConnectionStatus] = useState<Status>('no_wallet_installed');
    const [account, setAccount] = useState<string | null>(null);
    const [accountBalance, setAccountBalance] = useState<number | null>(null);

    const [error, setError] = useState<string | null>(null);

    // Check if user is connected and on the right chain
    const checkConnection = async () => {
        try {
            // reset errors
            setError(null);

            // Check if wallet is installed
            setConnectionStatus('no_wallet_installed');
            if (!window.ethereum) return;

            // Check if connected to the correct chain
            setConnectionStatus('wrong_chain');
            const chainId = await window.ethereum.request({ method: 'eth_chainId' });
            if (chainId !== chainConfig.chainId) return;

            if (!window.avalanche) {
                setError('No wallet detected');
                return;
            }

            // Check if account can be accessed
            const accounts = await deduplicateEthRequestAccounts()
            if (!accounts || accounts.length === 0) {
                setError('No account detected');
                return;
            }
            const account = accounts[0];
            setAccount(account);

            // Check if RPC endpoint is reachable
            setConnectionStatus('rpc_error');
            const latestBlock = await window.ethereum.request({
                method: 'eth_blockNumber',
            });

            // Optional balance check
            if (requiredBalance && requiredBalance > 0) {

                // Check if account has sufficient balance
                setConnectionStatus('insufficient_balance');
                const response = await fetch(chainConfig.rpcUrls[0], {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        jsonrpc: '2.0',
                        method: 'eth_getBalance',
                        params: [account, 'latest'],
                        id: 1,
                    }),
                });

                const data = await response.json();
                if (data.error) {
                    setError(`Error requesting balance ${data.error.message}`);
                    return;
                }

                const balance = parseInt(data.result, 16) / 1e18; // Convert balance from wei to ether
                setAccountBalance(balance);

                if (balance < requiredBalance) return;
            }

            // Set status to connected if every check passed and call onConnection callback
            setError(null);
            setConnectionStatus('correct_chain_connected');
            onConnection && onConnection();

        } catch (error) {
            if (error instanceof Error) {
                setError(`Connection error: ${error.message}`);
            } else {
                setError(`An unknown error occurred ${error}`);
            }
        }
    };

    useEffect(() => {
        checkConnection();

        if (window.ethereum) {
            const provider = window.ethereum!;
            provider.on('chainChanged', checkConnection);
            provider.on('accountsChanged', checkConnection);

            return () => {
                provider.removeListener('chainChanged', checkConnection);
                provider.removeListener('accountsChanged', checkConnection);
            };
        }
    }, []);

    const switchChain = async () => {
        if (!window.ethereum) {
            setConnectionStatus('no_wallet_installed');
            return;
        }

        try {
            await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: chainConfig.chainId }] });
        } catch (error: any) {
            // If the chain hasn't been added to the wallet, add it
            if (error.code === 4902) {
                try {
                    await window.ethereum.request({
                        method: 'wallet_addEthereumChain',
                        params: [chainConfig]
                    });
                    checkConnection();
                } catch (addError) {
                    if (addError instanceof Error) {
                        setError(`Failed to add network: ${addError.message}`);
                    } else {
                        console.error(addError);
                        setError(`An unknown error occurred ${addError}`);
                    }
                }
            } else {
                setError(`Failed to switch network: ${error}`);
            }
        }
    };

    const renderContent = () => {
        switch (connectionStatus) {
            case 'no_wallet_installed':
                return <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
                    <h3 className="font-medium mb-2">No Wallet Detected</h3>
                    <p className="mb-4">
                        You need a Web3 wallet to interact with your L1 chain. We recommend installing Core wallet:
                    </p>
                    <a
                        href="https://chromewebstore.google.com/detail/core-crypto-wallet-nft-ex/agoakfejjabomempkjlepdflaleeobhb"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 inline-block"
                    >
                        Install Core Wallet
                    </a>
                </div>;
            case 'wrong_chain':
                return <div>
                    <h3 className="font-medium mb-2">Add the Chain</h3>
                    <p className="mb-4">
                        You need to add and connect the {chainConfig.chainName} chain to your wallet to continue.
                    </p>
                    <div className="space-y-4">
                        <div>
                            <div className="font-medium">Chain Name:</div>
                            <div>{chainConfig.chainName}</div>
                        </div>
                        <div>
                            <div className="font-medium">Chain ID:</div>
                            <div>{chainConfig.chainId}</div>
                        </div>
                        <div>
                            <div className="font-medium">RPC URLs:</div>
                            {chainConfig.rpcUrls.map((rpcUrl, index) => (
                                <div key={index} className="break-all">{rpcUrl}</div>
                            ))}
                        </div>
                    </div>

                    <div className='mt-4 space-x-4'>
                        <button
                            onClick={switchChain}
                            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                        >
                            Add/Switch to {chainConfig.chainName}
                        </button>

                        <button
                            onClick={checkConnection}
                            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                        >
                            Check Wallet Connection
                        </button>
                    </div>
                </div>;
            case 'rpc_error':
                return <>
                    <p>The RPC endpoint is unreachable. Please make sure it is accessible.</p>
                    <Pre>{chainConfig.rpcUrls[0]}</Pre>
                </>
            case "insufficient_balance":
                return <>
                    <p>The balance of the account {account} is {accountBalance?.toFixed(4)} {chainConfig.nativeCurrency.symbol}. That is lower than the required balance of {requiredBalance} {chainConfig.nativeCurrency.symbol}. Please fund your account to proceed.</p>
                    <button
                        onClick={checkConnection}
                        className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 mt-4"
                    >
                        Check Again
                    </button>
                </>;
            case 'correct_chain_connected':
                return <>
                    {children ? children : `Succesful connected to ${chainConfig.chainName}!`}
                </>;
            default:
                return <p>An Unexpected error occured</p>
        }
    }

    return (
        <div className="p-4 border rounded-lg bg-blue-50 dark:bg-blue-900 border-l-4 border-blue-400 dark:border-blue-600 mb-6">
            <h3 className="font-medium mb-4">Network Check</h3>
            <div className='steps space-y-6 mb-6'>
                <div className="step">Wallet installed</div>
                <div className="step">Connected to {chainConfig.chainName}</div>
                <div className="step">RPC is reachable</div>
                {requiredBalance && requiredBalance > 0 &&
                    <div className="step">
                        Account has at least {requiredBalance} {chainConfig.nativeCurrency.symbol}
                    </div>
                }
            </div>
            {error && <p className="text-red-500 mb-4">{error}</p>}
            {renderContent()}
        </div>
    );
}
