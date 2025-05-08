"use client";

import { formatEther, parseEther, createPublicClient, http, Chain } from 'viem'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { useSelectedL1, useL1ListStore } from '../toolboxStore';
import { useWalletStore } from '../../lib/walletStore';
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';
import { CodeHighlighter } from '../../components/CodeHighlighter';
import { useState, useEffect } from 'react';
import { useErrorBoundary } from "react-error-boundary";
import { avalancheFuji } from 'viem/chains';
import { ChevronDown, ChevronUp, Plus, Trash2, RefreshCw } from 'lucide-react';

const MINIMUM_BALANCE = parseEther('100')
const MINIMUM_BALANCE_CCHAIN = parseEther('1')

export default function ICMRelayer() {
    const selectedL1 = useSelectedL1()();
    const { showBoundary } = useErrorBoundary();
    const { coreWalletClient } = useWalletStore();
    const { l1List } = useL1ListStore()();

    // Initialize state with one-time calculation
    const [selectedSources, setSelectedSources] = useState<string[]>(() => {
        return [...new Set([selectedL1?.id, l1List[0]?.id].filter(Boolean) as string[])];
    });

    const [selectedDestinations, setSelectedDestinations] = useState<string[]>(selectedSources);
    const [error, setError] = useState<string | null>(null);

    const [balances, setBalances] = useState<Record<string, string>>({});
    const [isLoadingBalances, setIsLoadingBalances] = useState(false);
    const [isSending, setIsSending] = useState(false);

    // Use sessionStorage for private key to persist across refreshes
    const [privateKey] = useState(() => {
        const storedKey = sessionStorage.getItem('icm-relayer-private-key');
        if (storedKey) return storedKey as `0x${string}`;

        const newKey = generatePrivateKey();
        sessionStorage.setItem('icm-relayer-private-key', newKey);
        return newKey;
    });

    const relayerAddress = privateKeyToAccount(privateKey).address;

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
            .filter(l1 => selectedSources.includes(l1.id))
            .map(l1 => ({
                subnetId: l1.subnetId,
                blockchainId: l1.id,
                rpcUrl: l1.rpcUrl
            }));
    };

    const getConfigDestinations = () => {
        if (error) return [];
        return l1List
            .filter(l1 => selectedDestinations.includes(l1.id))
            .map(l1 => ({
                subnetId: l1.subnetId,
                blockchainId: l1.id,
                rpcUrl: l1.rpcUrl,
                privateKey: privateKey
            }));
    };

    // Get unique chains from both sources and destinations
    const selectedChains = [...new Set([...selectedSources, ...selectedDestinations])]
        .map(id => l1List.find(l1 => l1.id === id))
        .filter(Boolean) as typeof l1List;

    const fetchBalances = async () => {
        setIsLoadingBalances(true);
        try {
            const newBalances: Record<string, string> = {};
            for (const chain of selectedChains) {
                const client = createPublicClient({
                    transport: http(chain.rpcUrl),
                });
                const balance = await client.getBalance({ address: relayerAddress });
                newBalances[chain.id] = formatEther(balance);
            }
            setBalances(newBalances);
        } catch (error) {
            showBoundary(error);
        } finally {
            setIsLoadingBalances(false);
        }
    };

    const sendOneCoin = async (chainId: string) => {
        setIsSending(true);
        try {
            const chain = l1List.find(l1 => l1.id === chainId);
            if (!chain) return;

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

            const txHash = await coreWalletClient.sendTransaction({
                to: relayerAddress,
                value: parseEther('1'),
                chain: viemChain,
            });

            const publicClient = createPublicClient({
                transport: http(chain.rpcUrl),
            });

            await publicClient.waitForTransactionReceipt({ hash: txHash });
            await fetchBalances();
        } catch (error) {
            showBoundary(error);
        } finally {
            setIsSending(false);
        }
    };

    // Add this to existing useEffect to fetch balances on mount
    useEffect(() => {
        fetchBalances();
    }, []);

    return (
        <div className="space-y-4">
            <div className="text-lg font-bold">Relayer Configuration</div>
            <Input
                label="Relayer EVM Address"
                value={relayerAddress}
                disabled
            />

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
                        {l1List.map(l1 => (
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
                        {l1List.map(l1 => (
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

            <div className="text-sm">
                ⚠️ The private key is stored in your browser session storage and will persist until you close the browser.
                Please save the address above as you will need to fund it later.
            </div>

            <div className="text-lg font-bold">Write the relayer config file</div>
            <CodeHighlighter
                code={genConfigCommand(getConfigSources(), getConfigDestinations())}
                lang="sh"
            />

            <div className="text-lg font-bold">Run the relayer</div>
            <CodeHighlighter
                code={relayerDockerCommand()}
                lang="sh"
            />

            {/* Balances Section */}
            <div className="space-y-4">
                <div className="text-lg font-bold">Relayer Balances</div>
                <div className="space-y-2">
                    {selectedChains.map(chain => (
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
                            <Button
                                size="sm"
                                variant="primary"
                                className="w-auto px-4 flex-shrink-0"
                                onClick={() => sendOneCoin(chain.id)}
                                loading={isSending}
                            >
                                Send 1 {chain.coinName}
                            </Button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

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
    }[]
) => {
    const config = {
        "info-api": {
            "base-url": "https://api.avax-test.network"
        },
        "p-chain-api": {
            "base-url": "https://api.avax-test.network"
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

import versions from '../../versions.json';
const relayerDockerCommand = () => {
    return `docker run --name relayer -d \\
    --restart on-failure  \\
    --user=root \\
    --network=host \\
    -v ~/.icm-relayer/:/icm-relayer/ \\
    avaplatform/icm-relayer:${versions['avaplatform/icm-relayer']} \\
    --config-file /icm-relayer/config.json`
}
