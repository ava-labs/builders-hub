"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/toolbox/components/Button";
import { useManagedTestnetRelayers } from "@/hooks/useManagedTestnetRelayers";
import { Relayer, RelayerConfig } from "./types";
import { Steps, Step } from 'fumadocs-ui/components/steps';
import Link from 'next/link';
import useConsoleNotifications from "@/hooks/useConsoleNotifications";
import { ConsoleToolMetadata, withConsoleToolMetadata } from "../../../components/WithConsoleToolMetadata";
import { WalletRequirementsConfigKey } from "@/components/toolbox/hooks/useWalletRequirements";
import { generateConsoleToolGitHubUrl } from "@/components/toolbox/utils/github-url";
import { useL1ListStore, L1ListItem } from "@/components/toolbox/stores/l1ListStore";
import { RefreshCw } from "lucide-react";
import { Input, RawInput } from "@/components/toolbox/components/Input";
import { createPublicClient, http, formatEther, parseEther, Chain } from 'viem';
import { useConnectedWallet } from "@/components/toolbox/contexts/ConnectedWalletContext";
import { useWalletStore } from "@/components/toolbox/stores/walletStore";

const metadata: ConsoleToolMetadata = {
    title: "Create Managed Testnet Relayer",
    description: "Create a free testnet ICM relayer to enable cross-chain message delivery between your L1s. These relayers will shut down after 3 days. They are suitable for quick testing. For production settings or extended testing, use self-hosted relayers. You need a Builder Hub Account to use this tool.",
    walletRequirements: [WalletRequirementsConfigKey.TestnetRequired],
    githubUrl: generateConsoleToolGitHubUrl(import.meta.url)
};

function CreateManagedTestnetRelayerBase() {
    const { createRelayer, fetchRelayers, relayers } = useManagedTestnetRelayers();
    const { notify } = useConsoleNotifications();
    const { l1List } = useL1ListStore()();
    const { coreWalletClient } = useConnectedWallet();
    const { walletEVMAddress } = useWalletStore();

    // Step 1: Network selection
    const [selectedSources, setSelectedSources] = useState<string[]>([]);
    const [selectedDestinations, setSelectedDestinations] = useState<string[]>([]);
    const [selectionError, setSelectionError] = useState<string | null>(null);

    // Step 2: Relayer creation
    const [createdRelayerResponse, setCreatedRelayerResponse] = useState<Relayer | null>(null);
    const [createdRelayer, setCreatedRelayer] = useState<Relayer | null>(null);
    const [isCreatingRelayer, setIsCreatingRelayer] = useState(false);

    // Step 3: Funding
    const [balances, setBalances] = useState<Record<string, string>>({});
    const [isLoadingBalances, setIsLoadingBalances] = useState(false);
    const [tokenAmounts, setTokenAmounts] = useState<Record<string, string>>({});
    const [isSending, setIsSending] = useState(false);

    // Initialize with first chain if available
    useEffect(() => {
        if (l1List.length > 0 && selectedSources.length === 0 && selectedDestinations.length === 0) {
            setSelectedSources([l1List[0].id]);
            setSelectedDestinations([l1List[0].id]);
        }
    }, [l1List]);

    // Validate selections
    useEffect(() => {
        if (selectedSources.length === 0 || selectedDestinations.length === 0) {
            setSelectionError("You must select at least one source and one destination network");
            return;
        }

        if (selectedSources.length === 1 && selectedDestinations.length === 1 &&
            selectedSources[0] === selectedDestinations[0]) {
            setSelectionError("Source and destination cannot be the same network when selecting one each");
            return;
        }

        setSelectionError(null);
    }, [selectedSources, selectedDestinations]);

    // Load relayers when component mounts
    useEffect(() => {
        fetchRelayers();
    }, [fetchRelayers]);

    // Find the created relayer in the relayers list after creation
    // We find the most recently created relayer since relayers are already filtered by user
    useEffect(() => {
        if (createdRelayerResponse && relayers.length > 0) {
            console.log('Looking for relayer. Response relayerId:', createdRelayerResponse.relayerId);
            console.log('Available relayers:', relayers.map(r => ({ id: r.relayerId, created: r.createdAt })));
            
            // Sort by createdAt descending (most recent first) and take the first one
            const sortedRelayers = [...relayers].sort((a, b) => {
                const timeA = typeof a.createdAt === 'number' ? a.createdAt : new Date(a.createdAt).getTime();
                const timeB = typeof b.createdAt === 'number' ? b.createdAt : new Date(b.createdAt).getTime();
                return timeB - timeA;
            });
            
            const mostRecentRelayer = sortedRelayers[0];
            console.log('Most recent relayer:', mostRecentRelayer);
            
            if (mostRecentRelayer) {
                setCreatedRelayer(mostRecentRelayer);
            }
        }
    }, [relayers, createdRelayerResponse]);

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

    // Helper to get chain info from L1 list or fallback
    const getChainInfo = (config: RelayerConfig) => {
        // First check if it's C-Chain
        if (config.rpcUrl.includes('avax-test.network') || config.subnetId === '11111111111111111111111111111111LpoYY') {
            return { name: 'C-Chain (Fuji)', coinName: 'AVAX' };
        }
        
        // Look up in L1 list by blockchain ID
        const l1 = l1List.find((item: L1ListItem) => item.id === config.blockchainId);
        if (l1) {
            return { name: l1.name, coinName: l1.coinName };
        }
        
        // Fallback: use blockchain ID prefix
        return { 
            name: `${config.blockchainId.substring(0, 8)}...`,
            coinName: 'Token'
        };
    };

    const updateTokenAmount = (blockchainId: string, amount: string) => {
        setTokenAmounts(prev => ({
            ...prev,
            [blockchainId]: amount
        }));
    };

    const fetchBalances = async () => {
        if (!createdRelayer?.relayerId) return;
        
        setIsLoadingBalances(true);
        try {
            const newBalances: Record<string, string> = {};
            for (const config of createdRelayer.configs) {
                try {
                    const client = createPublicClient({
                        transport: http(config.rpcUrl),
                    });
                    const balance = await client.getBalance({ address: createdRelayer.relayerId as `0x${string}` });
                    newBalances[config.blockchainId] = formatEther(balance);
                } catch (error) {
                    console.error(`Failed to fetch balance for ${config.blockchainId}:`, error);
                    newBalances[config.blockchainId] = 'Error';
                }
            }
            setBalances(newBalances);
        } catch (error) {
            console.error('Failed to fetch balances:', error);
        } finally {
            setIsLoadingBalances(false);
        }
    };

    useEffect(() => {
        if (createdRelayer?.relayerId) {
            fetchBalances();
        }
    }, [createdRelayer?.relayerId]);

    const sendFunds = async (config: RelayerConfig) => {
        if (!createdRelayer?.relayerId) return;
        
        setIsSending(true);
        try {
            const amount = tokenAmounts[config.blockchainId] || '1';
            if (!amount || parseFloat(amount) <= 0) {
                throw new Error('Please enter a valid amount');
            }

            // Get chain info for the transaction
            const chainInfo = getChainInfo(config);
            const l1 = l1List.find((item: L1ListItem) => item.id === config.blockchainId);
            const evmChainId = l1?.evmChainId || (config.rpcUrl.includes('avax-test.network') ? 43113 : parseInt(config.blockchainId.slice(0, 8), 16));

            const viemChain: Chain = {
                id: evmChainId,
                name: chainInfo.name,
                rpcUrls: {
                    default: { http: [config.rpcUrl] },
                },
                nativeCurrency: {
                    name: chainInfo.coinName,
                    symbol: chainInfo.coinName,
                    decimals: 18,
                },
            };

            // Switch chain in Core wallet
            await coreWalletClient.switchChain({ id: evmChainId });

            const publicClient = createPublicClient({
                transport: http(config.rpcUrl),
            });

            const nextNonce = await publicClient.getTransactionCount({
                address: walletEVMAddress as `0x${string}`,
                blockTag: 'pending',
            });

            const transactionPromise = coreWalletClient.sendTransaction({
                to: createdRelayer.relayerId as `0x${string}`,
                value: parseEther(amount),
                account: walletEVMAddress as `0x${string}`,
                chain: viemChain,
                nonce: nextNonce,
            });

            notify({
                type: 'transfer',
                name: 'Fund Relayer'
            }, transactionPromise, viemChain);

            const hash = await transactionPromise;
            await publicClient.waitForTransactionReceipt({ hash });
            await fetchBalances();
        } catch (error) {
            throw error;
        } finally {
            setIsSending(false);
        }
    };

    const handleCreate = async () => {
        if (selectionError) return;

        setIsCreatingRelayer(true);
        try {
            // Get unique chains from both sources and destinations
            const allChainIds = [...new Set([...selectedSources, ...selectedDestinations])];
            
            const configs: RelayerConfig[] = l1List
                .filter((l1: L1ListItem) => allChainIds.includes(l1.id))
                .map((l1: L1ListItem) => ({
                    subnetId: l1.subnetId,
                    blockchainId: l1.id,
                    rpcUrl: l1.rpcUrl,
                    wsUrl: l1.rpcUrl.replace("http", "ws").replace("/rpc", "/ws")
                }));

            const createRelayerPromise = createRelayer(configs);
            notify({
                name: "Managed Testnet Relayer Creation",
                type: "local"
            }, createRelayerPromise);
            
            const response = await createRelayerPromise;
            console.log('Relayer creation response:', response);
            setCreatedRelayerResponse(response);
        } finally {
            setIsCreatingRelayer(false);
            console.log('Fetching relayers list...');
            await fetchRelayers();
        }
    };

    return (
        <Steps>
            <Step>
                <h2 className="text-lg font-semibold">Step 1: Select Networks</h2>
                <p className="text-sm text-gray-500 mb-8">
                    Select the source networks to monitor and destination networks to deliver messages to.
                </p>

                {selectionError && (
                    <div className="text-red-500 p-2 bg-red-50 dark:bg-red-900/20 rounded-md mb-4">
                        {selectionError}
                    </div>
                )}

                {l1List.length === 0 ? (
                    <div className="text-center py-8 text-gray-500 dark:text-gray-400 border rounded-md p-4 bg-gray-50 dark:bg-gray-900/20">
                        <p className="mb-2">No L1s available in your list.</p>
                        <p className="text-sm">Please create an L1 first before setting up a relayer.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Source Networks Column */}
                        <div className="space-y-4">
                            <div className="text-base font-semibold">Source Networks</div>
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
                                        <label htmlFor={`source-${l1.id}`} className="flex-1 cursor-pointer">
                                            <div className="font-medium">{l1.name}</div>
                                            <div className="text-xs text-gray-500">Chain ID: {l1.evmChainId}</div>
                                        </label>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Destination Networks Column */}
                        <div className="space-y-4">
                            <div className="text-base font-semibold">Destination Networks</div>
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
                                        <label htmlFor={`dest-${l1.id}`} className="flex-1 cursor-pointer">
                                            <div className="font-medium">{l1.name}</div>
                                            <div className="text-xs text-gray-500">Chain ID: {l1.evmChainId}</div>
                                        </label>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </Step>

            <Step>
                <h2 className="text-lg font-semibold">Step 2: Create Relayer</h2>
                <p className="text-sm text-gray-500 mb-8">
                    Review your network selection and create the managed testnet relayer.
                </p>
                <Button
                    onClick={handleCreate}
                    loading={isCreatingRelayer}
                    disabled={!!selectionError || l1List.length === 0 || isCreatingRelayer}
                >
                    Create Relayer
                </Button>
            </Step>

            <Step>
                <h2 className="text-lg font-semibold">Step 3: Fund Relayer</h2>
                <p className="text-sm text-gray-500 mb-8">
                    Your relayer has been created. Fund the relayer address on all configured chains to cover transaction fees.
                </p>
                {createdRelayerResponse && !createdRelayer && (
                    <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-md">
                        Loading relayer details...
                    </div>
                )}
                {createdRelayer && createdRelayer.relayerId && (
                    <div className="mb-6 space-y-4">
                        <Input
                            label="Relayer EVM Address"
                            value={createdRelayer.relayerId || ''}
                            disabled
                        />

                        {/* Relayer Balances */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <div className="text-sm font-semibold text-gray-700 dark:text-gray-300">Relayer Balances</div>
                                <button
                                    onClick={fetchBalances}
                                    disabled={isLoadingBalances}
                                    className="p-1 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 disabled:opacity-50"
                                    style={{ lineHeight: 0 }}
                                    title="Refresh balances"
                                >
                                    <RefreshCw className={`h-4 w-4 ${isLoadingBalances ? 'animate-spin' : ''}`} />
                                </button>
                            </div>
                            <div className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                                Ensure the relayer address maintains a positive balance on all configured chains to cover transaction fees.
                            </div>
                            <div className="space-y-2">
                                {createdRelayer.configs.map((config) => {
                                    const chainInfo = getChainInfo(config);
                                    
                                    return (
                                        <div key={config.blockchainId} className="flex items-center justify-between p-3 border rounded-md bg-gray-50 dark:bg-gray-900/20">
                                            <div>
                                                <div className="text-xs font-medium text-gray-700 dark:text-gray-300">{chainInfo.name}</div>
                                                <div className="flex items-center gap-1 text-sm text-gray-500">
                                                    {balances[config.blockchainId] !== undefined 
                                                        ? `${parseFloat(balances[config.blockchainId]).toFixed(4)} ${chainInfo.coinName}`
                                                        : 'Loading...'}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <RawInput
                                                    value={tokenAmounts[config.blockchainId] || '1'}
                                                    onChange={(e) => updateTokenAmount(config.blockchainId, e.target.value)}
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
                                                    onClick={() => sendFunds(config)}
                                                    loading={isSending}
                                                >
                                                    Send {chainInfo.coinName}
                                                </Button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}
            </Step>

            <Step>
                <h2 className="text-lg font-semibold">Step 4: Manage Relayer</h2>
                <p className="text-sm text-gray-500 mb-8">
                    Open the Testnet Relayer Manager to view, fund, and manage all your relayers.
                </p>
                <Link href="/console/testnet-infra/icm-relayer" target="_blank">
                    <Button
                        disabled={!createdRelayer}
                    >
                        Open Testnet Relayer Manager
                    </Button>
                </Link>
            </Step>
        </Steps>
    );
}

export default withConsoleToolMetadata(CreateManagedTestnetRelayerBase, metadata);

