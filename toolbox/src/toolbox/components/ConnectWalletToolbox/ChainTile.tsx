import React from 'react';
import { ExternalLink, X } from 'lucide-react';

// Use the correct interface from the L1ListStore
interface ChainInfo {
    id: string;
    name: string;
    rpcUrl: string;
    evmChainId: number;
    coinName: string;
    isTestnet: boolean;
    subnetId: string;
    imageUri?: string;
}

interface ChainTileProps {
    chain?: ChainInfo;
    isActive?: boolean;
    isAddTile?: boolean;
    onClick: () => void;
    onDelete?: () => void;
}

export const ChainTile: React.FC<ChainTileProps> = ({
    chain,
    isActive = false,
    isAddTile = false,
    onClick,
    onDelete
}) => {


    return (
        <div
            onClick={onClick}
            className={`
        ${isAddTile ? 'h-16 flex items-center justify-center' : 'h-16 flex flex-col items-center justify-center'}
        w-full rounded-lg border cursor-pointer transition-all relative
        transform hover:scale-[1.02] hover:shadow-sm active:scale-[0.98]
        ${isAddTile
                    ? "hover:bg-gray-100 dark:hover:bg-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-500"
                    : chain?.isTestnet // Keep conditional hover based on testnet, but don't show the badge
                        ? "hover:border-orange-300 dark:hover:border-orange-600"
                        : "hover:border-green-300 dark:hover:border-green-600"
                }
        ${isActive
                    ? "border-2 border-black dark:border-white shadow-sm"
                    : "border-zinc-200 dark:border-zinc-700 hover:bg-opacity-80 dark:hover:bg-opacity-80"}
      `}
            title={chain?.name || "Add new chain"}
            style={{ overflow: 'visible' }}
        >
            {isAddTile ? (
                <div className="flex flex-col items-center justify-center gap-1">
                    <div className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">Add Chain</div>
                </div>
            ) : (
                <>
                    {/* Delete Button */}
                    {onDelete && chain && (
                        <button
                            onClick={(e) => { e.stopPropagation(); confirm(`Are you sure you want to delete the chain "${chain.name}"? This cannot be undone.`) && onDelete() }}
                            className="absolute top-[-8px] right-[-8px] z-20 p-1 rounded-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-400 dark:text-zinc-500 hover:bg-red-100 dark:hover:bg-red-900/50 hover:text-red-600 dark:hover:text-red-400 transition-colors shadow-sm hover:shadow"
                            title={`Delete ${chain.name}`}
                            aria-label={`Delete ${chain.name}`}
                        >
                            <X size={12} strokeWidth={2.5} />
                        </button>
                    )}

                    {/* Chain Name */}
                    <div className="font-medium text-sm text-zinc-800 dark:text-zinc-100 truncate max-w-[90%] px-1 text-center mb-1 mt-1">
                        {chain?.name}
                    </div>

                    {/* Chain ID Badge */}
                    <div className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${chain?.isTestnet
                        ? "bg-orange-100/50 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300"
                        : "bg-green-100/50 dark:bg-green-900/30 text-green-800 dark:text-green-300"
                        }`}>
                        ID: {chain?.evmChainId}
                    </div>

                    {/* External Link Indicator (subtle) */}
                    <div className="absolute bottom-1 right-1 opacity-30">
                        <ExternalLink className="w-3 h-3 text-zinc-400 dark:text-zinc-600" />
                    </div>
                </>
            )}
        </div>
    );
}; 
