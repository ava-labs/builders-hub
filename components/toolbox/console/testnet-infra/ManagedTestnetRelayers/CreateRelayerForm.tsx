"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/toolbox/components/Button";
import { L1ListItem } from "@/components/toolbox/stores/l1ListStore";
import { RelayerConfig } from "@/components/toolbox/console/testnet-infra/ManagedTestnetRelayers/types";

interface CreateRelayerFormProps {
    onClose: () => void;
    onSubmit: (configs: RelayerConfig[]) => void;
    l1List: L1ListItem[];
    isCreating: boolean;
}

export default function CreateRelayerForm({ 
    onClose, 
    onSubmit, 
    l1List,
    isCreating 
}: CreateRelayerFormProps) {
    // Initialize with first chain as both source and destination if available
    const [selectedSources, setSelectedSources] = useState<string[]>(() => {
        return l1List.length > 0 ? [l1List[0].id] : [];
    });
    const [selectedDestinations, setSelectedDestinations] = useState<string[]>(() => {
        return l1List.length > 0 ? [l1List[0].id] : [];
    });
    const [error, setError] = useState<string | null>(null);

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

    const handleCreateRelayer = () => {
        if (error) {
            return;
        }

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

        onSubmit(configs);
    };

    return (
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-6 mb-6 not-prose">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold">Create New Relayer</h3>
                <Button
                    onClick={onClose}
                    variant="outline"
                    size="sm"
                    className="!w-auto"
                >
                    Cancel
                </Button>
            </div>
            <p className="mb-4">Select the source networks to monitor and destination networks to deliver messages to.</p>

            {error && (
                <div className="text-red-500 p-2 bg-red-50 dark:bg-red-900/20 rounded-md mb-4">
                    {error}
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

            <Button
                onClick={handleCreateRelayer}
                loading={isCreating}
                disabled={!!error || l1List.length === 0}
                className="mt-4 !w-auto"
            >
                Create Relayer
            </Button>
        </div>
    );
}

