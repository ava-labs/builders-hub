"use client";
import { useState, useEffect } from "react";
import {
    Clock,
    Trash2,
    XCircle,
    CheckCircle2,
    AlertTriangle,
    RotateCw,
    ChevronDown,
    ChevronUp,
    RefreshCw,
} from "lucide-react";
import { Relayer } from "@/components/toolbox/console/testnet-infra/ManagedTestnetRelayers/types";
import { calculateTimeRemaining, formatTimeRemaining, getStatusData } from "@/components/toolbox/console/testnet-infra/ManagedTestnetNodes/useTimeRemaining";
import { Button } from "@/components/toolbox/components/Button";
import { Input, RawInput } from "@/components/toolbox/components/Input";
import { CodeBlock, Pre } from 'fumadocs-ui/components/codeblock';
import { createPublicClient, http, formatEther, parseEther, Chain } from 'viem';
import { useConnectedWallet } from "@/components/toolbox/contexts/ConnectedWalletContext";
import { useWalletStore } from "@/components/toolbox/stores/walletStore";
import { useL1ListStore, L1ListItem } from "@/components/toolbox/stores/l1ListStore";
import useConsoleNotifications from "@/hooks/useConsoleNotifications";

interface RelayerCardProps {
    relayer: Relayer;
    onDeleteRelayer: (relayer: Relayer) => void;
    onRestartRelayer: (relayer: Relayer) => void;
    isDeletingRelayer: boolean;
    isRestartingRelayer: boolean;
}

// Helper to safely parse dates that might be timestamps or ISO strings
function parseDateSafely(dateValue: string | number): Date {
    if (!dateValue) return new Date();
    
    // If it's a number or numeric string
    const numValue = typeof dateValue === 'number' ? dateValue : Number(dateValue);
    if (!Number.isNaN(numValue)) {
        // If it's in seconds (< year 3000 in milliseconds), convert to ms
        const ms = numValue < 10000000000 ? numValue * 1000 : numValue;
        return new Date(ms);
    }
    
    // Otherwise treat as ISO string
    return new Date(dateValue);
}

function formatDateSafely(dateValue: string | number): string {
    try {
        const date = parseDateSafely(dateValue);
        if (isNaN(date.getTime())) return 'Invalid Date';
        
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    } catch {
        return 'Invalid Date';
    }
}

export default function RelayerCard({
    relayer,
    onDeleteRelayer,
    onRestartRelayer,
    isDeletingRelayer,
    isRestartingRelayer
}: RelayerCardProps) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [balances, setBalances] = useState<Record<string, string>>({});
    const [isLoadingBalances, setIsLoadingBalances] = useState(false);
    const [tokenAmounts, setTokenAmounts] = useState<Record<string, string>>({});
    const [isSending, setIsSending] = useState(false);
    
    const { coreWalletClient } = useConnectedWallet();
    const { walletEVMAddress } = useWalletStore();
    const { l1List } = useL1ListStore()();
    const { notify } = useConsoleNotifications();

    const timeRemaining = calculateTimeRemaining(String(relayer.expiresAt));
    const statusData = getStatusData(timeRemaining);

    // Helper to get chain info from L1 list or fallback
    const getChainInfo = (config: typeof relayer.configs[0]) => {
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
        setIsLoadingBalances(true);
        try {
            const newBalances: Record<string, string> = {};
            if (!relayer.relayerId) {
                setBalances(newBalances);
                return;
            }
            for (const config of relayer.configs) {
                try {
                    const client = createPublicClient({
                        transport: http(config.rpcUrl),
                    });
                    const balance = await client.getBalance({ address: relayer.relayerId as `0x${string}` });
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
        if (relayer.relayerId) {
            fetchBalances();
        }
    }, [relayer.relayerId]);

    const sendFunds = async (config: typeof relayer.configs[0]) => {
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
                to: relayer.relayerId as `0x${string}`,
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

    const getHealthIcon = () => {
        if (!relayer.health) {
            return <XCircle className="w-3 h-3" />;
        }
        if (relayer.health.status === 'up') {
            return <CheckCircle2 className="w-3 h-3" />;
        }
        // Check if any component is healthy (degraded state)
        const hasHealthyComponent = relayer.health.details && 
            Object.values(relayer.health.details).some(v => v?.status === 'up');
        return hasHealthyComponent ? <AlertTriangle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />;
    };

    const getHealthStatus = () => {
        if (!relayer.health) {
            return { label: 'Unreachable', color: 'text-gray-500 bg-gray-50 border-gray-300 dark:bg-gray-800 dark:border-gray-600' };
        }
        if (relayer.health.status === 'up') {
            return { label: 'Healthy', color: 'text-green-700 bg-green-50 border-green-300 dark:bg-green-900/20 dark:border-green-700' };
        }
        const hasHealthyComponent = relayer.health.details && 
            Object.values(relayer.health.details).some(v => v?.status === 'up');
        if (hasHealthyComponent) {
            return { label: 'Degraded', color: 'text-yellow-700 bg-yellow-50 border-yellow-300 dark:bg-yellow-900/20 dark:border-yellow-700' };
        }
        return { label: 'Unhealthy', color: 'text-red-700 bg-red-50 border-red-300 dark:bg-red-900/20 dark:border-red-700' };
    };

    const getStatusIcon = (iconType: 'expired' | 'warning' | 'active') => {
        switch (iconType) {
            case 'expired':
                return <XCircle className="w-3 h-3" />;
            case 'warning':
                return <AlertTriangle className="w-3 h-3" />;
            case 'active':
                return <CheckCircle2 className="w-3 h-3" />;
            default:
                return <XCircle className="w-3 h-3" />;
        }
    };

    const healthStatus = getHealthStatus();

    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 transition-colors min-w-0">
            {/* Relayer Header */}
            <div className="p-4 border-b border-gray-100 dark:border-gray-700">
                <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="min-w-0 flex-1">
                            <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-1">
                                Relayer
                            </h3>
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border ${healthStatus.color}`}>
                                    {getHealthIcon()}
                                    {healthStatus.label}
                                </span>
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border ${statusData.color}`}>
                                    {getStatusIcon(statusData.iconType)}
                                    {statusData.label}
                                </span>
                                <span className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {formatTimeRemaining(timeRemaining)} remaining
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-start gap-3">
                        <div className="text-right text-xs text-gray-500 dark:text-gray-400 space-y-1">
                            <div>
                                Created: {formatDateSafely(relayer.createdAt)}
                            </div>
                            <div>
                                Expires: {formatDateSafely(relayer.expiresAt)}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Relayer Details (compact) */}
            <div className="p-4 space-y-4 min-w-0">
                <Input
                    label="Relayer EVM Address"
                    value={relayer.relayerId || ''}
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
                        {relayer.configs.map((config) => {
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

                {/* Expandable Chain Details */}
                <div className="mt-2">
                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100"
                    >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        {isExpanded ? 'Hide' : 'Show'} Chain Configuration
                    </button>
                    
                    {isExpanded && (
                        <div className="mt-2">
                            <CodeBlock lang="json" allowCopy={true}>
                                <Pre>{JSON.stringify(relayer.configs, null, 2)}</Pre>
                            </CodeBlock>
                        </div>
                    )}
                </div>

                {/* Primary Actions */}
                <div className="mt-2 flex items-center justify-end gap-2 border-t border-gray-200 dark:border-gray-700 pt-3">
                    <Button
                        onClick={() => onRestartRelayer(relayer)}
                        variant="secondary"
                        size="sm"
                        loading={isRestartingRelayer}
                        loadingText="Restarting..."
                        className="!w-auto"
                        icon={<RotateCw className="w-4 h-4" />}
                    >
                        Restart Relayer
                    </Button>
                    <Button
                        onClick={() => onDeleteRelayer(relayer)}
                        variant="danger"
                        size="sm"
                        loading={isDeletingRelayer}
                        loadingText="Deleting..."
                        className="!w-auto"
                        icon={<Trash2 className="w-4 h-4" />}
                    >
                        Delete Relayer
                    </Button>
                </div>
            </div>
        </div>
    );
}

