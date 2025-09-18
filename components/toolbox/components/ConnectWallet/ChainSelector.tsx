import { useWalletStore } from "@/components/toolbox/stores/walletStore";
import { ChainTile } from "./ChainTile"
import { useCallback, useState } from "react";
import { isDefaultChain, useL1ListStore } from "../../stores/l1ListStore";
import type { L1ListItem } from "../../stores/l1ListStore";
import { useWallet } from "../../hooks/useWallet";


export const ChainSelector = ({ enforceChainId }: { enforceChainId?: number }) => {
    const { walletChainId } = useWalletStore();
    const { l1List, removeL1 } = useL1ListStore()();
    const { coreWalletClient } = useWalletStore();
    const { addChain } = useWallet();
    const [criticalError, setCriticalError] = useState<Error | null>(null);

    // Throw critical errors during render
    if (criticalError) {
        throw criticalError;
    }

    const handleSwitchChain = useCallback((chainId: number) => {
        if (!coreWalletClient) {
            setCriticalError(new Error('Core wallet not found'));
            return;
        }

        coreWalletClient.switchChain({
            id: chainId,
        }).catch((error: unknown) => setCriticalError(error instanceof Error ? error : new Error(String(error))));
    }, [coreWalletClient]);

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
                        onClick={() => addChain()}
                        isDimmed={enforceChainId !== undefined}
                    />
                </div>
            </div>

        </>
    );
}
