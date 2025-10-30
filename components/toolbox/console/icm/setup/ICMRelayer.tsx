"use client";

import { formatEther, parseEther, createPublicClient, http, Chain } from 'viem';
import { L1ListItem, useSelectedL1 } from '@/components/toolbox/stores/l1ListStore';
import { useL1ListStore } from '@/components/toolbox/stores/l1ListStore';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { useState, useEffect, useMemo } from 'react';
import { DynamicCodeBlock } from 'fumadocs-ui/components/dynamic-codeblock';
import { WalletRequirementsConfigKey } from '@/components/toolbox/hooks/useWalletRequirements';
import { BaseConsoleToolProps, ConsoleToolMetadata, withConsoleToolMetadata } from '../../../components/WithConsoleToolMetadata';
import { useConnectedWallet } from '@/components/toolbox/contexts/ConnectedWalletContext';
import useConsoleNotifications from "@/hooks/useConsoleNotifications";
import { Steps, Step } from "fumadocs-ui/components/steps";
import { DockerInstallation } from '@/components/toolbox/components/DockerInstallation';
import { generateConsoleToolGitHubUrl } from "@/components/toolbox/utils/github-url";
import { GenesisHighlightProvider, useGenesisHighlight } from '@/components/toolbox/components/genesis/GenesisHighlightContext';
import { NetworkSelector } from './NetworkSelector';
import { RelayerFunding } from './RelayerFunding';
import { AdvancedSettings } from './AdvancedSettings';
import { ConfigPreview } from './ConfigPreview';
import { useRelayerKey } from './useRelayerKey';
import { useConfigHighlighting } from './useConfigHighlighting';
import { generateRelayerConfig, genConfigCommand, relayerDockerCommand } from './relayer-config';

const metadata: ConsoleToolMetadata = {
    title: "ICM Relayer",
    description: "Configure the ICM Relayer for cross-chain message delivery",
    toolRequirements: [
        WalletRequirementsConfigKey.EVMChainBalance
    ],
    githubUrl: generateConsoleToolGitHubUrl(import.meta.url)
};

function ICMRelayerInner({ onSuccess }: BaseConsoleToolProps) {
    const selectedL1 = useSelectedL1()();
    const [criticalError, setCriticalError] = useState<Error | null>(null);
    const { isTestnet, walletEVMAddress } = useWalletStore();
    const { coreWalletClient } = useConnectedWallet();
    const { l1List } = useL1ListStore()();
    const { notify } = useConsoleNotifications();
    const { setHighlightPath, clearHighlight, highlightPath } = useGenesisHighlight();
    const { privateKey, relayerAddress } = useRelayerKey();
    
    const [selectedSources, setSelectedSources] = useState<string[]>(() => {
        return [...new Set([selectedL1?.id, l1List[0]?.id].filter(Boolean) as string[])];
    });

    const [selectedDestinations, setSelectedDestinations] = useState<string[]>(selectedSources);
    const [error, setError] = useState<string | null>(null);
    const [balances, setBalances] = useState<Record<string, string>>({});
    const [isLoadingBalances, setIsLoadingBalances] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [tokenAmounts, setTokenAmounts] = useState<Record<string, string>>({});
    const [logLevel, setLogLevel] = useState<'info' | 'debug' | 'warn' | 'error'>('info');
    const [processMissedBlocks, setProcessMissedBlocks] = useState(true);
    const [storageLocation, setStorageLocation] = useState('./awm-relayer-storage');
    const [apiPort, setApiPort] = useState(8080);
    const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);

    if (criticalError) {
        throw criticalError;
    }

    const updateTokenAmount = (chainId: string, amount: string) => {
        setTokenAmounts(prev => ({ ...prev, [chainId]: amount }));
    };

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

    const configJson = useMemo(() => {
        const sources = getConfigSources();
        const destinations = getConfigDestinations();
        
        if (sources.length === 0 || destinations.length === 0) {
            return '';
        }

        return generateRelayerConfig(
            sources,
            destinations,
            isTestnet ?? false,
            logLevel,
            storageLocation,
            processMissedBlocks,
            apiPort
        );
    }, [selectedSources, selectedDestinations, privateKey, isTestnet, l1List, logLevel, storageLocation, processMissedBlocks, apiPort]);

    const highlightedLines = useConfigHighlighting(highlightPath, configJson);

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
                account: walletEVMAddress as `0x${string}`,
                chain: viemChain,
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

    useEffect(() => {
        if (relayerAddress && selectedChains.length > 0) {
        fetchBalances();
        }
    }, [relayerAddress, selectedChains.length]);

    return (
        <div className="space-y-6">
        <Steps>
            <Step>
                <DockerInstallation includeCompose={false} />
            </Step>
            
            <Step>
                <h3 className="text-xl font-bold mb-4">Configure Relayer</h3>
                    
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="space-y-6">
                {error && (
                                <div className="text-red-500 p-2 bg-red-50 dark:bg-red-900/20 rounded-md text-sm">
                        {error}
                    </div>
                )}

                            <NetworkSelector
                                l1List={l1List}
                                selectedNetworks={selectedSources}
                                onToggle={handleToggleSource}
                                title="Source Networks"
                                idPrefix="source"
                                    onMouseEnter={() => setHighlightPath('sources')}
                                    onMouseLeave={clearHighlight}
                            />

                            <NetworkSelector
                                l1List={l1List}
                                selectedNetworks={selectedDestinations}
                                onToggle={handleToggleDestination}
                                title="Destination Networks"
                                idPrefix="dest"
                                    onMouseEnter={() => setHighlightPath('destinations')}
                                    onMouseLeave={clearHighlight}
                            />

                            <RelayerFunding
                                relayerAddress={relayerAddress}
                                selectedChains={selectedChains}
                                balances={balances}
                                isLoadingBalances={isLoadingBalances}
                                isSending={isSending}
                                tokenAmounts={tokenAmounts}
                                onRefreshBalances={fetchBalances}
                                onSendCoins={sendOneCoin}
                                onUpdateTokenAmount={updateTokenAmount}
                                onFocusAddress={() => setHighlightPath('relayerAddress')}
                                onBlurAddress={clearHighlight}
                            />

                            <AdvancedSettings
                                logLevel={logLevel}
                                apiPort={apiPort}
                                storageLocation={storageLocation}
                                processMissedBlocks={processMissedBlocks}
                                showAdvancedSettings={showAdvancedSettings}
                                onLogLevelChange={setLogLevel}
                                onApiPortChange={setApiPort}
                                onStorageLocationChange={setStorageLocation}
                                onProcessMissedBlocksChange={setProcessMissedBlocks}
                                onToggle={setShowAdvancedSettings}
                                onHighlight={setHighlightPath}
                                onClearHighlight={clearHighlight}
                            />
                        </div>

                        <ConfigPreview 
                            configJson={configJson}
                                            highlightedLines={highlightedLines}
                                        />
                    </div>
                </Step>

                <Step>
                    <h3 className="text-xl font-bold mb-4">Save Configuration to Machine</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                        Run this command to save your relayer configuration to your local machine:
                    </p>
                <DynamicCodeBlock
                        code={genConfigCommand(
                            getConfigSources(), 
                            getConfigDestinations(), 
                            isTestnet ?? false,
                            logLevel,
                            storageLocation,
                            processMissedBlocks,
                            apiPort
                        )}
                    lang="bash"
                />
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                        This creates the configuration file at <code className="px-1 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-xs">~/.icm-relayer/config.json</code>
                    </p>
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
        </div>
    );
}

function ICMRelayer(props: BaseConsoleToolProps) {
    return (
        <GenesisHighlightProvider>
            <ICMRelayerInner {...props} />
        </GenesisHighlightProvider>
    );
}

export default withConsoleToolMetadata(ICMRelayer, metadata);
