import { useWalletStore } from "../../stores/walletStore";
import { ChainTile } from "./ChainTile"
import { AddChainModal } from "./AddChainModal";
import { useErrorBoundary } from "react-error-boundary";
import { useState, useCallback } from "react";
import { isDefaultChain, useL1ListStore } from "../../stores/l1ListStore";
import type { L1ListItem } from "../../stores/l1ListStore";


export const ChainSelector = ({ enforceChainId }: { enforceChainId?: number }) => {
    const { walletChainId } = useWalletStore();
    const [isAddChainModalOpen, setIsAddChainModalOpen] = useState(false)
    const { l1List, addL1, removeL1 } = useL1ListStore()();
    const { coreWalletClient } = useWalletStore();
    const { showBoundary } = useErrorBoundary();

    const handleSwitchChain = useCallback((chainId: number) => {
        coreWalletClient.switchChain({
            id: `0x${chainId.toString(16)}`,
        }).catch(showBoundary);
    }, [coreWalletClient, showBoundary]);

    return (
        <>
            {/* Network section - Always displayed */}
            <div className="mb-6">
                <h4 className="text-sm font-medium text-zinc-600 dark:text-zinc-300 mb-2">Your Networks</h4>
                <div className="grid grid-cols-4 sm:grid-cols-2 md:grid-cols-4 gap-2">
                    {l1List.map((chain: L1ListItem) => {
                        const isChainEnforced = enforceChainId !== undefined && chain.evmChainId !== enforceChainId;
                        return (
                            <ChainTile
                                key={chain.id}
                                chain={chain}
                                isActive={walletChainId === chain.evmChainId}
                                onClick={isChainEnforced ? () => { } : () => handleSwitchChain(chain.evmChainId)}
                                onDelete={isDefaultChain(chain.id) ? undefined : () => removeL1(chain.id)}
                                isDimmed={isChainEnforced}
                            />
                        );
                    })}
                    <ChainTile
                        isAddTile
                        onClick={() => setIsAddChainModalOpen(true)}
                        isDimmed={enforceChainId !== undefined}
                    />
                </div>
            </div>

            {/* Add Chain Modal */}
            {isAddChainModalOpen && <AddChainModal
                onClose={() => setIsAddChainModalOpen(false)}
                onAddChain={addL1}
            />}
        </>
    );
}
