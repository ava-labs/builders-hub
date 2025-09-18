import React from 'react';
import { Input } from '@/components/toolbox/components/Input';

interface ChainNameConfigurationProps {
    chainName: string;
    onChainNameChange: (value: string) => void;
    embedMode?: boolean;
}

export function ChainNameConfiguration({
    chainName,
    onChainNameChange,
    embedMode = false
}: ChainNameConfigurationProps) {
    const containerClass = embedMode 
        ? "bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4"
        : "";

    return (
        <div className={containerClass}>
            {embedMode && (
                <>
                    <h3 className="text-base font-semibold text-zinc-900 dark:text-white mb-2">
                        Chain Name
                    </h3>
                    <p className="text-xs text-zinc-600 dark:text-zinc-400 mb-2">
                        Choose a name for your blockchain
                    </p>
                </>
            )}
            <Input
                label=""
                value={chainName}
                onChange={onChainNameChange}
                placeholder="Enter your chain name"
            />
        </div>
    );
}
