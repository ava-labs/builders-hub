import React from 'react';

export function CreateChainHeader() {
    return (
        <div className="px-6 py-3 border-b border-zinc-200 dark:border-zinc-800">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold text-zinc-900 dark:text-white">Create Chain</h1>
                    <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">
                        Configure your Avalanche L1 blockchain with custom parameters and genesis data
                    </p>
                </div>
            </div>
        </div>
    );
}
