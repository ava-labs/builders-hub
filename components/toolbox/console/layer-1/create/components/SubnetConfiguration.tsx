import React from 'react';
import { Button } from '@/components/toolbox/components/Button';
import InputSubnetId from '@/components/toolbox/components/InputSubnetId';

interface SubnetConfigurationProps {
    subnetId: string;
    isCreatingSubnet: boolean;
    onCreateSubnet: () => void;
    onSubnetIdChange: (value: string) => void;
    embedMode?: boolean;
}

export function SubnetConfiguration({
    subnetId,
    isCreatingSubnet,
    onCreateSubnet,
    onSubnetIdChange,
    embedMode = false
}: SubnetConfigurationProps) {
    const containerClass = embedMode 
        ? "bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4"
        : "";

    return (
        <div className={containerClass}>
            {embedMode ? (
                <div className="flex items-center justify-between mb-2">
                    <div>
                        <h3 className="text-base font-semibold text-zinc-900 dark:text-white">
                            Subnet Configuration
                        </h3>
                        <p className="text-xs text-zinc-600 dark:text-zinc-400">
                            Create a new subnet or use an existing one
                        </p>
                    </div>
                    {subnetId && (
                        <span className="text-xs px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full">
                            ✓ Ready
                        </span>
                    )}
                </div>
            ) : (
                subnetId && (
                    <div className="flex justify-end mb-2">
                        <span className="text-xs px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full">
                            ✓ Ready
                        </span>
                    </div>
                )
            )}
            
            <div className="space-y-2">
                <Button
                    onClick={onCreateSubnet}
                    loading={isCreatingSubnet}
                    variant="secondary"
                    className="w-full h-9 text-sm"
                >
                    Create New Subnet
                </Button>
                
                <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t border-zinc-200 dark:border-zinc-700" />
                    </div>
                    <div className="relative flex justify-center text-xs">
                        <span className={embedMode ? "bg-white dark:bg-zinc-900 px-2 text-zinc-500" : "bg-white dark:bg-zinc-900 px-2 text-zinc-500"}>
                            or
                        </span>
                    </div>
                </div>

                <InputSubnetId
                    id="create-chain-subnet-id"
                    label=""
                    value={subnetId}
                    onChange={onSubnetIdChange}
                    validationDelayMs={3000}
                    hideSuggestions={true}
                    placeholder="Enter an existing Subnet ID"
                />
            </div>
        </div>
    );
}
