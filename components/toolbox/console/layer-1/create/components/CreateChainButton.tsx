import React from 'react';
import { Button } from '@/components/toolbox/components/Button';
import { AlertCircle } from 'lucide-react';

interface CreateChainButtonProps {
    subnetId: string;
    genesisData: string;
    isCreating: boolean;
    onClick: () => void;
    embedMode?: boolean;
}

export function CreateChainButton({
    subnetId,
    genesisData,
    isCreating,
    onClick,
    embedMode = false
}: CreateChainButtonProps) {
    if (embedMode) {
        return (
            <>
                <Button
                    onClick={onClick}
                    loading={isCreating}
                    loadingText="Creating Chain..."
                    disabled={!subnetId || !genesisData}
                    className="w-full"
                >
                    Create Chain
                </Button>
                {(!subnetId || !genesisData) && (
                    <div className="mt-2 flex items-center justify-center text-xs text-amber-600 dark:text-amber-400">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        {!subnetId ? "Configure a Subnet ID first" : "Configure genesis parameters"}
                    </div>
                )}
            </>
        );
    }

    return (
        <div className="mt-6 pt-6 border-t border-zinc-200 dark:border-zinc-800">
            <Button
                onClick={onClick}
                loading={isCreating}
                loadingText="Creating Chain..."
                disabled={!subnetId || !genesisData}
                className="w-full"
            >
                Create Chain
            </Button>
            {(!subnetId || !genesisData) && (
                <div className="mt-2 flex items-center justify-center text-xs text-amber-600 dark:text-amber-400">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    {!subnetId ? "Configure a Subnet ID first" : "Configure genesis parameters"}
                </div>
            )}
        </div>
    );
}
