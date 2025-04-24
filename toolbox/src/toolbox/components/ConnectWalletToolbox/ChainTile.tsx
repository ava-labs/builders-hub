import React from 'react';
import { ExternalLink } from 'lucide-react';

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
}

export const ChainTile: React.FC<ChainTileProps> = ({
    chain,
    isActive = false,
    isAddTile = false,
    onClick
}) => {
    return (
        <div
            onClick={onClick}
            className={`
        ${isAddTile ? 'h-16 flex items-center justify-center' : 'h-16 flex flex-col items-center justify-center'} 
        w-full rounded-lg border cursor-pointer transition-all relative overflow-hidden
        transform hover:scale-[1.02] hover:shadow-sm active:scale-[0.98]
        ${isAddTile
                    ? "hover:bg-gray-100 dark:hover:bg-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-500"
                    : chain?.isTestnet
                        ? "hover:border-orange-300 dark:hover:border-orange-600"
                        : "hover:border-green-300 dark:hover:border-green-600"
                }
        ${isActive
                    ? "border-2 border-black dark:border-white shadow-sm"
                    : "border-zinc-200 dark:border-zinc-700 hover:bg-opacity-80 dark:hover:bg-opacity-80"}
      `}
            title={chain?.name || "Add new chain"}
        >
            {isAddTile ? (
                <div className="flex flex-col items-center justify-center gap-1">
                    <div className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">Add Chain</div>
                </div>
            ) : (
                <>
                    {/* Network Type Indicator - Testnet/Mainnet */}
                    {chain && (
                        <div className={`absolute top-0 right-0 ${isActive ? 'mt-0.5 mr-0.5' : 'mt-1 mr-1'} z-10`}>
                            {chain.isTestnet ? (
                                <div className="px-1.5 py-0.5 bg-orange-100 dark:bg-orange-800/60 rounded-sm text-[8px] font-semibold text-orange-700 dark:text-orange-300 leading-none shadow-sm border border-orange-200 dark:border-orange-800/50">
                                    Testnet
                                </div>
                            ) : (
                                <div className="px-1.5 py-0.5 bg-green-100 dark:bg-green-800/60 rounded-sm text-[8px] font-semibold text-green-700 dark:text-green-300 leading-none shadow-sm border border-green-200 dark:border-green-800/50">
                                    Mainnet
                                </div>
                            )}
                        </div>
                    )}

                    {/* Chain Name */}
                    <div className="font-medium text-sm text-zinc-800 dark:text-zinc-100 truncate max-w-[90%] px-1 text-center mb-1">
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
