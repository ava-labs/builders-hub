'use client';

import React, { useState, useMemo } from 'react';
import { Dialog, DialogOverlay, DialogContent, DialogTitle } from '../../components/ui/dialog';
import { useL1ListStore } from '@/components/toolbox/stores/l1ListStore';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { useWallet } from '../../hooks/useWallet';
import { cn } from '../../lib/utils';
import { Check, Search, Plus, AlertCircle } from 'lucide-react';
import { useModalTrigger } from '../../hooks/useModal';

// Global state for the switch network modal
let switchNetworkModalState = {
    isOpen: false,
    resolve: null as ((result: any) => void) | null,
};

const switchNetworkListeners = new Set<() => void>();

const notifySwitchNetworkChange = () => {
    switchNetworkListeners.forEach(listener => listener());
};

// Hook for triggering the switch network modal
export function useSwitchNetworkModal() {
    const openSwitchNetwork = async (): Promise<{ success: boolean; chainId?: number }> => {
        return new Promise((resolve) => {
            switchNetworkModalState = {
                isOpen: true,
                resolve,
            };
            notifySwitchNetworkChange();
        });
    };

    return { openSwitchNetwork };
}

// Hook for the modal component to manage state
function useSwitchNetworkModalState() {
    const [, forceUpdate] = useState({});

    React.useEffect(() => {
        const listener = () => forceUpdate({});
        switchNetworkListeners.add(listener);
        return () => {
            switchNetworkListeners.delete(listener);
        };
    }, []);

    const closeModal = (result: { success: boolean; chainId?: number } = { success: false }) => {
        if (switchNetworkModalState.resolve) {
            switchNetworkModalState.resolve(result);
        }
        switchNetworkModalState = {
            isOpen: false,
            resolve: null,
        };
        notifySwitchNetworkChange();
    };

    return {
        isOpen: switchNetworkModalState.isOpen,
        closeModal,
    };
}

export function SwitchNetworkModal() {
    const { isOpen, closeModal } = useSwitchNetworkModalState();
    const { client: coreWalletClient } = useWallet();
    const { walletChainId, setWalletChainId } = useWalletStore();
    const l1ListStore = useL1ListStore();
    const l1List = l1ListStore((s: any) => s.l1List);
    const [searchQuery, setSearchQuery] = useState('');
    const [isSwitching, setIsSwitching] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);

    // For opening the Add Chain modal
    const { openModal: openAddChainModal } = useModalTrigger();

    const filteredNetworks = useMemo(() => {
        if (!searchQuery) return l1List;
        const query = searchQuery.toLowerCase();
        return l1List.filter((network: any) =>
            network.name.toLowerCase().includes(query) ||
            network.coinName.toLowerCase().includes(query) ||
            String(network.evmChainId).includes(query)
        );
    }, [l1List, searchQuery]);

    const handleSwitchNetwork = async (network: any) => {
        if (!coreWalletClient) {
            setError('Please connect your wallet first');
            return;
        }

        setIsSwitching(network.evmChainId);
        setError(null);

        try {
            await coreWalletClient.switchChain({ id: network.evmChainId });
            setWalletChainId(network.evmChainId);
            closeModal({ success: true, chainId: network.evmChainId });
        } catch (err) {
            console.error('Failed to switch network:', err);
            setError(`Failed to switch to ${network.name}. The network may need to be added to your wallet first.`);
        } finally {
            setIsSwitching(null);
        }
    };

    const handleAddNetwork = async () => {
        closeModal({ success: false });
        // Open the Add Chain modal
        await openAddChainModal();
    };

    if (!isOpen) return null;

    return (
        <Dialog.Root open={true} onOpenChange={() => closeModal({ success: false })}>
            <Dialog.Portal>
                <DialogOverlay />
                <DialogContent className="max-w-md">
                    <DialogTitle>Switch Network</DialogTitle>

                    {/* Search */}
                    <div className="relative mb-4">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                        <input
                            type="text"
                            placeholder="Search networks..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className={cn(
                                "w-full pl-10 pr-4 py-2.5 rounded-lg border",
                                "bg-white dark:bg-zinc-900",
                                "border-zinc-200 dark:border-zinc-700",
                                "text-zinc-900 dark:text-zinc-100",
                                "placeholder:text-zinc-400 dark:placeholder:text-zinc-500",
                                "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            )}
                        />
                    </div>

                    {/* Error message */}
                    {error && (
                        <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                            <div className="flex items-start gap-2">
                                <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                                <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
                            </div>
                        </div>
                    )}

                    {/* Network list */}
                    <div className="max-h-[400px] overflow-y-auto -mx-4 px-4">
                        <div className="space-y-2">
                            {filteredNetworks.map((network: any) => {
                                const isActive = network.evmChainId === walletChainId;
                                const isLoading = isSwitching === network.evmChainId;

                                return (
                                    <button
                                        key={network.id}
                                        onClick={() => !isActive && handleSwitchNetwork(network)}
                                        disabled={isActive || isLoading}
                                        className={cn(
                                            "w-full flex items-center gap-3 p-3 rounded-lg border transition-colors text-left",
                                            isActive
                                                ? "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800"
                                                : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800",
                                            isLoading && "opacity-70"
                                        )}
                                    >
                                        {/* Logo */}
                                        <div className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center overflow-hidden shrink-0">
                                            {network.logoUrl ? (
                                                <img
                                                    src={network.logoUrl}
                                                    alt={network.name}
                                                    className="w-8 h-8 rounded-full object-cover"
                                                />
                                            ) : (
                                                <span className="text-lg font-bold text-zinc-400">
                                                    {network.name.charAt(0)}
                                                </span>
                                            )}
                                        </div>

                                        {/* Info */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium text-zinc-900 dark:text-zinc-100 truncate">
                                                    {network.name}
                                                </span>
                                                {network.isTestnet && (
                                                    <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
                                                        Testnet
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs text-zinc-500 dark:text-zinc-400">
                                                {network.coinName} • Chain ID: {network.evmChainId}
                                            </p>
                                        </div>

                                        {/* Status */}
                                        {isActive && (
                                            <div className="shrink-0">
                                                <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center">
                                                    <Check className="w-4 h-4 text-white" />
                                                </div>
                                            </div>
                                        )}
                                        {isLoading && (
                                            <div className="shrink-0">
                                                <div className="w-5 h-5 border-2 border-zinc-300 dark:border-zinc-600 border-t-blue-500 rounded-full animate-spin" />
                                            </div>
                                        )}
                                    </button>
                                );
                            })}

                            {filteredNetworks.length === 0 && (
                                <div className="py-8 text-center">
                                    <p className="text-sm text-zinc-500 dark:text-zinc-400">
                                        No networks found matching &quot;{searchQuery}&quot;
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Add network button */}
                    <div className="mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-700">
                        <button
                            onClick={handleAddNetwork}
                            className={cn(
                                "w-full flex items-center justify-center gap-2 p-3 rounded-lg border border-dashed",
                                "border-zinc-300 dark:border-zinc-600",
                                "text-zinc-600 dark:text-zinc-400",
                                "hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-500",
                                "transition-colors"
                            )}
                        >
                            <Plus className="w-4 h-4" />
                            <span className="text-sm font-medium">Add New Network</span>
                        </button>
                    </div>
                </DialogContent>
            </Dialog.Portal>
        </Dialog.Root>
    );
}
