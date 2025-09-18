import React from 'react';

interface GenesisProgressBarProps {
    genesisData: string;
    embedMode?: boolean;
}

export function GenesisProgressBar({ genesisData, embedMode = false }: GenesisProgressBarProps) {
    const genesisSizeBytes = genesisData ? new Blob([genesisData]).size : 0;
    const genesisSizeKiB = genesisSizeBytes / 1024;
    const maxSizeKiB = 64; // P-Chain transaction limit
    const sizePercentage = Math.min((genesisSizeKiB / maxSizeKiB) * 100, 100);

    if (!genesisData) return null;

    const containerClass = embedMode 
        ? "px-4 py-3 border-b border-zinc-200 dark:border-zinc-800"
        : "px-4 py-2 bg-white dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800 flex-shrink-0";

    return (
        <div className={containerClass}>
            <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                    Genesis Size
                </span>
                <span className="text-xs text-zinc-600 dark:text-zinc-400">
                    {genesisSizeKiB.toFixed(2)} KiB / {maxSizeKiB} KiB
                </span>
            </div>
            <div className="w-full bg-zinc-200 dark:bg-zinc-700 rounded-full h-1.5">
                <div
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                        sizePercentage >= 90
                            ? "bg-red-500"
                            : sizePercentage >= 75
                                ? "bg-yellow-500"
                                : "bg-green-500"
                    }`}
                    style={{ width: `${sizePercentage}%` }}
                />
            </div>
            <div className="flex justify-between items-center mt-1">
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                    {sizePercentage >= 90 && "⚠️ Approaching P-Chain limit"}
                    {sizePercentage >= 75 && sizePercentage < 90 && "⚡ Consider optimizing"}
                    {sizePercentage < 75 && "✅ Within safe limits"}
                </span>
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                    {sizePercentage.toFixed(1)}%
                </span>
            </div>
        </div>
    );
}
