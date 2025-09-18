import React from 'react';
import GenesisBuilder from '@/components/toolbox/console/layer-1/create/components/GenesisBuilder';
import { ValidationMessages } from '@/components/toolbox/components/genesis/types';

interface GenesisConfigurationProps {
    genesisData: string;
    isEditMode: boolean;
    onGenesisDataChange: (data: string) => void;
    embedMode?: boolean;
    onValidationChange?: (messages: ValidationMessages) => void;
}

export function GenesisConfiguration({
    genesisData,
    isEditMode,
    onGenesisDataChange,
    embedMode = false,
    onValidationChange
}: GenesisConfigurationProps) {
    const containerClass = embedMode 
        ? "bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4"
        : "";

    return (
        <div className={containerClass}>
            {embedMode && (
                <>
                    <h3 className="text-base font-semibold text-zinc-900 dark:text-white mb-2">
                        Genesis Parameters
                    </h3>
                    <p className="text-xs text-zinc-600 dark:text-zinc-400 mb-3">
                        Configure your blockchain's initial state and parameters
                    </p>
                </>
            )}
            <GenesisBuilder 
                genesisData={genesisData} 
                setGenesisData={(data) => {
                    if (!isEditMode) {
                        onGenesisDataChange(data);
                    }
                }}
                wizardMode={true}
                initiallyExpandedSections={[]}
                onValidationChange={onValidationChange}
            />
        </div>
    );
}
