"use client";

import { formatEther, parseEther, createPublicClient, http, Chain } from 'viem'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { L1ListItem, useSelectedL1 } from '@/components/toolbox/stores/l1ListStore';
import { useL1ListStore } from '@/components/toolbox/stores/l1ListStore';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { Input, RawInput } from '@/components/toolbox/components/Input';
import { Button } from '@/components/toolbox/components/Button';
import { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';

import versions from '@/scripts/versions.json';
import { Note } from '@/components/toolbox/components/Note';
import { DynamicCodeBlock } from 'fumadocs-ui/components/dynamic-codeblock';
import { WalletRequirementsConfigKey } from '@/components/toolbox/hooks/useWalletRequirements';
import { BaseConsoleToolProps, ConsoleToolMetadata, withConsoleToolMetadata } from '../../../components/WithConsoleToolMetadata';
import { useConnectedWallet } from '@/components/toolbox/contexts/ConnectedWalletContext';
import useConsoleNotifications from "@/hooks/useConsoleNotifications";
import { Steps, Step } from "fumadocs-ui/components/steps";
import { DockerInstallation } from '@/components/toolbox/components/DockerInstallation';
import { generateConsoleToolGitHubUrl } from "@/components/toolbox/utils/github-url";

const metadata: ConsoleToolMetadata = {
    title: "ICM Relayer",
    description: "Configure the ICM Relayer for cross-chain message delivery",
    walletRequirements: [
        WalletRequirementsConfigKey.EVMChainBalance
    ],
    githubUrl: generateConsoleToolGitHubUrl(import.meta.url)
};

function ICMRelayer({ onSuccess }: BaseConsoleToolProps) {
    const selectedL1 = useSelectedL1()();
    const [criticalError, setCriticalError] = useState<Error | null>(null);
    const { isTestnet, walletEVMAddress } = useWalletStore();
    const { coreWalletClient } = useConnectedWallet();
    const { l1List } = useL1ListStore()();
    const { notify } = useConsoleNotifications();
    // Initialize state with one-time calculation
    const [selectedSources, setSelectedSources] = useState<string[]>(() => {
        return [...new Set([selectedL1?.id, l1List[0]?.id].filter(Boolean) as string[])];
    });

    const [selectedDestinations, setSelectedDestinations] = useState<string[]>(selectedSources);
    const [error, setError] = useState<string | null>(null);

    const [balances, setBalances] = useState<Record<string, string>>({});
    const [isLoadingBalances, setIsLoadingBalances] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [tokenAmounts, setTokenAmounts] = useState<Record<string, string>>({});

    const updateTokenAmount = (chainId: string, amount: string) => {
        setTokenAmounts(prev => ({
            ...prev,
            [chainId]: amount
        }));
    };

    // Use sessionStorage for private key to persist across refreshes
    const [privateKey, setPrivateKey] = useState<`0x${string}` | null>(null);

    // Throw critical errors during render
    if (criticalError) {
        throw criticalError;
    }

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const storedKey = sessionStorage.getItem('icm-relayer-private-key');
            if (storedKey) {
                setPrivateKey(storedKey as `0x${string}`);
            } else {
                const newKey = generatePrivateKey();
                sessionStorage.setItem('icm-relayer-private-key', newKey);
                setPrivateKey(newKey);
            }
        }
    }, []);

    const relayerAddress = privateKey ? privateKeyToAccount(privateKey).address : null;

    // Validate selections whenever they change
    useEffect(() => {
        if (selectedSources.length === 0 || selectedDestinations.length === 0) {
            setError("You must select at least one source and one destination network");
            return;
        }

        if (selectedSources.length === 1 && selectedDestinations.length === 1 &&
            selectedSources[0] === selectedDestinations[0]) {
            setError("Source and destination cannot be the same network when selecting one each");
            return;
        }

        setError(null);
    }, [selectedSources, selectedDestinations]);

    const handleToggleSource = (l1Id: string) => {
        setSelectedSources(prev =>
            prev.includes(l1Id)
                ? prev.filter(id => id !== l1Id)
                : [...prev, l1Id]
        );
    };

    const handleToggleDestination = (l1Id: string) => {
        setSelectedDestinations(prev =>
            prev.includes(l1Id)
                ? prev.filter(id => id !== l1Id)
                : [...prev, l1Id]
        );
    };

    const getConfigSources = () => {
        if (error) return [];
        return l1List
            .filter((l1: L1ListItem) => selectedSources.includes(l1.id))
            .map((l1: L1ListItem) => ({
                subnetId: l1.subnetId,
                blockchainId: l1.id,
                rpcUrl: l1.rpcUrl
            }));
    };

    const getConfigDestinations = () => {
        if (error || !privateKey) return [];
        return l1List
            .filter((l1: L1ListItem) => selectedDestinations.includes(l1.id))
            .map((l1: L1ListItem) => ({
                subnetId: l1.subnetId,
                blockchainId: l1.id,
                rpcUrl: l1.rpcUrl,
                privateKey: privateKey
            }));
    };

    // Get unique chains from both sources and destinations
    const selectedChains = [...new Set([...selectedSources, ...selectedDestinations])]
        .map((id: string) => l1List.find((l1: L1ListItem) => l1.id === id))
        .filter(Boolean) as typeof l1List;

    const fetchBalances = async () => {
        setIsLoadingBalances(true);
        try {
            const newBalances: Record<string, string> = {};
            if (!relayerAddress) {
                setBalances(newBalances);
                return;
            }
            for (const chain of selectedChains) {
                const client = createPublicClient({
                    transport: http(chain.rpcUrl),
                });
                const balance = await client.getBalance({ address: relayerAddress });
                newBalances[chain.id] = formatEther(balance);
            }
            setBalances(newBalances);
        } catch (error) {
            setCriticalError(error instanceof Error ? error : new Error(String(error)));
        } finally {
            setIsLoadingBalances(false);
        }
    };

    const sendOneCoin = async (chainId: string) => {
        setIsSending(true);
        try {
            const chain = l1List.find((l1: L1ListItem) => l1.id === chainId);
            if (!chain) return;

            const amount = tokenAmounts[chainId] || '1';
            if (!amount || parseFloat(amount) <= 0) {
                setCriticalError(new Error('Please enter a valid amount'));
                return;
            }

            const viemChain: Chain = {
                id: chain.evmChainId,
                name: chain.name,
                rpcUrls: {
                    default: { http: [chain.rpcUrl] },
                },
                nativeCurrency: {
                    name: chain.coinName,
                    symbol: chain.coinName,
                    decimals: 18,
                },
            };
            console.log('viemChain', viemChain);

            const publicClient = createPublicClient({
                transport: http(chain.rpcUrl),
            });

            const nextNonce = await publicClient.getTransactionCount({
                address: walletEVMAddress as `0x${string}`,
                blockTag: 'pending',
            });

            const transactionPromise = coreWalletClient.sendTransaction({
                to: relayerAddress as `0x${string}`,
                value: parseEther(amount),
                chain: viemChain,
                gas: 21000n,
                nonce: nextNonce,
            });
            notify({
                type: 'transfer',
                name: 'Send Native Coin'
            }, transactionPromise, viemChain ?? undefined);
            const hash = await transactionPromise;
            await publicClient.waitForTransactionReceipt({ hash });
            await fetchBalances();
        } catch (error) {
            setCriticalError(error instanceof Error ? error : new Error(String(error)));
        } finally {
            setIsSending(false);
        }
    };

    // Add this to existing useEffect to fetch balances on mount
    useEffect(() => {
        fetchBalances();
    }, []);

    return (
        <Steps>
            <Step>
                <DockerInstallation includeCompose={false} />
            </Step>
            
            <Step>
                <h3 className="text-xl font-bold mb-4">Configure Relayer</h3>
                <Input
                    label="Relayer EVM Address"
                    value={relayerAddress || ''}
                    disabled
                />
                <Note variant="warning">
                    <span className="font-semibold">Important:</span> The Relayer EVM Address above uses a temporary private key generated in your browser. Feel free to replace it with another private key in the relayer config file (field <code>account-private-key</code> of all destination blockchains) below.
                    This generated key is stored only in session storage and will be <span className="font-semibold">lost when you close this browser tab</span>.
                    Ensure you fund this address sufficiently.
                </Note>

                {error && (
                    <div className="text-red-500 p-2 bg-red-50 rounded-md">
                        {error}
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Source Networks Column */}
                    <div className="space-y-4">
                        <div className="text-lg font-bold">Source Networks</div>
                        <div className="space-y-2 border rounded-md p-4 bg-gray-50 dark:bg-gray-900/20">
                            {l1List.map((l1: L1ListItem) => (
                                <div key={`source-${l1.id}`} className="flex items-center gap-3 p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded">
                                    <input
                                        type="checkbox"
                                        id={`source-${l1.id}`}
                                        checked={selectedSources.includes(l1.id)}
                                        onChange={() => handleToggleSource(l1.id)}
                                        className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                    />
                                    <label htmlFor={`source-${l1.id}`} className="flex-1">
                                        <div className="font-medium">{l1.name}</div>
                                        <div className="text-xs text-gray-500">Chain ID: {l1.evmChainId}</div>
                                    </label>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Destination Networks Column */}
                    <div className="space-y-4">
                        <div className="text-lg font-bold">Destination Networks</div>
                        <div className="space-y-2 border rounded-md p-4 bg-gray-50 dark:bg-gray-900/20">
                            {l1List.map((l1: L1ListItem) => (
                                <div key={`dest-${l1.id}`} className="flex items-center gap-3 p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded">
                                    <input
                                        type="checkbox"
                                        id={`dest-${l1.id}`}
                                        checked={selectedDestinations.includes(l1.id)}
                                        onChange={() => handleToggleDestination(l1.id)}
                                        className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                    />
                                    <label htmlFor={`dest-${l1.id}`} className="flex-1">
                                        <div className="font-medium">{l1.name}</div>
                                        <div className="text-xs text-gray-500">Chain ID: {l1.evmChainId}</div>
                                    </label>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Balances Section */}
                <div className="space-y-4">
                    <div className="text-lg font-bold">Relayer Balances</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                        Ensure the relayer address maintains a positive balance on all selected chains to cover transaction fees for message delivery.
                    </div>
                    <div className="space-y-2">
                {selectedChains.map((chain: L1ListItem) => (
                            <div key={`balance-${chain.id}`} className="flex items-center justify-between p-3 border rounded-md">
                                <div>
                                    <div className="font-medium">{chain.name}</div>
                                    <div className="flex items-center gap-1 text-sm text-gray-500">
                                        {balances[chain.id] ? `${balances[chain.id]} ${chain.coinName}` : 'Loading...'}
                                        <button
                                            onClick={() => fetchBalances()}
                                            disabled={isLoadingBalances}
                                            className="p-1 text-gray-500 hover:text-gray-700 disabled:opacity-50"
                                            style={{ lineHeight: 0 }}
                                        >
                                            <RefreshCw className={`h-4 w-4 ${isLoadingBalances ? 'animate-spin' : ''}`} />
                                        </button>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <RawInput
                                        value={tokenAmounts[chain.id] || '1'}
                                        onChange={(e) => updateTokenAmount(chain.id, e.target.value)}
                                        placeholder="1.0"
                                        type="number"
                                        step="0.1"
                                        min="0"
                                        className="w-20 h-8"
                                    />
                                    <Button
                                        size="sm"
                                        variant="primary"
                                        className="w-24 px-2 flex-shrink-0 h-8 text-sm"
                                        onClick={() => sendOneCoin(chain.id)}
                                        loading={isSending}
                                    >
                                        Send {chain.coinName}
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="text-lg font-bold">Relayer Configuration</div>
                <DynamicCodeBlock
                    code={genConfigCommand(getConfigSources(), getConfigDestinations(), isTestnet ?? false)}
                    lang="bash"
                />

            </Step>
            
            <Step>
                <h3 className="text-xl font-bold mb-4">Run the Relayer</h3>
                <p>Start the ICM Relayer using the following Docker command:</p>
                <DynamicCodeBlock
                    code={relayerDockerCommand()}
                    lang="sh"
                />
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                    The relayer will monitor the source blockchains for cross-chain messages and deliver them to the destination blockchains.
                </p>
            </Step>
        </Steps>
    );
}

export default withConsoleToolMetadata(ICMRelayer, metadata);

const genConfigCommand = (
    sources: {
        subnetId: string;
        blockchainId: string;
        rpcUrl: string;
    }[],
    destinations: {
        subnetId: string;
        blockchainId: string;
        rpcUrl: string;
        privateKey: string;
    }[],
    isTestnet: boolean
) => {
    const config = {
        "api-port": 63123,
        "info-api": {
            "base-url": isTestnet ? "https://api.avax-test.network" : "https://api.avax.network"
        },
        "p-chain-api": {
            "base-url": isTestnet ? "https://api.avax-test.network" : "https://api.avax.network"
        },
        "source-blockchains": sources.map(source => ({
            "subnet-id": source.subnetId,
            "blockchain-id": source.blockchainId,
            "vm": "evm",
            "rpc-endpoint": {
                "base-url": source.rpcUrl,
            },
            "ws-endpoint": {
                "base-url": source.rpcUrl.replace("http", "ws").replace("/rpc", "/ws"),
            },
            "message-contracts": {
                "0x253b2784c75e510dD0fF1da844684a1aC0aa5fcf": {
                    "message-format": "teleporter",
                    "settings": {
                        "reward-address": "0x0000000000000000000000000000000000000000"
                    }
                }
            }
        })),
        "destination-blockchains": destinations.map(destination => ({
            "subnet-id": destination.subnetId,
            "blockchain-id": destination.blockchainId,
            "vm": "evm",
            "rpc-endpoint": {
                "base-url": destination.rpcUrl
            },
            "account-private-key": destination.privateKey
        }))
    };

    const configStr = JSON.stringify(config, null, 4);
    return `mkdir -p ~/.icm-relayer && echo '${configStr}' > ~/.icm-relayer/config.json`;
}


const relayerDockerCommand = () => {
    return `docker run --name relayer -d \\
    --restart on-failure  \\
    --user=root \\
    --network=host \\
    -v ~/.icm-relayer/:/icm-relayer/ \\
    avaplatform/icm-relayer:${versions['avaplatform/icm-relayer']} \\
    --config-file /icm-relayer/config.json`
}
