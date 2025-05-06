import { ConnectWallet } from "../../../components/ConnectWallet";
import { useL1ListStore, useViemChainStore } from "../../toolboxStore";
import { useWalletStore } from "../../../lib/walletStore";
import { ChainTile } from "./ChainTile"
import { AddChainModal } from "./AddChainModal";
import { useErrorBoundary } from "react-error-boundary";
import { useState, useCallback } from "react";

export const ConnectWalletToolbox = ({ children, required, chainRequired }: { children: React.ReactNode, required: boolean, chainRequired: boolean }) => {
    const viemChain = useViemChainStore();

    return (
        <>
            <ConnectWallet required={required} extraElements={chainRequired ? <ChainSelector /> : null} >
                {(chainRequired && !viemChain) ? (
                    <div className="p-4 border-2 border-gray-500 rounded-md mb-4">
                        ⚠️ Please connect to an L1 chain before using this component.
                    </div>
                ) : children}
            </ConnectWallet>
        </>
    );
};

const ChainSelector = () => {
    const { walletChainId } = useWalletStore();
    const [isAddChainModalOpen, setIsAddChainModalOpen] = useState(false)
    const { l1List, addL1, removeL1 } = useL1ListStore()();
    const { coreWalletClient } = useWalletStore();
    const { showBoundary } = useErrorBoundary();

    const handleSwitchChain = useCallback((chainId: number) => {
        coreWalletClient.switchChain({
            id: `0x${chainId.toString(16)}`,
        }).then(() => {
            window.location.reload();
        }).catch(showBoundary);
    }, [coreWalletClient, showBoundary]);

    return (
        <>
            {/* Network section - Always displayed */}
            <div className="mb-6">
                <h4 className="text-sm font-medium text-zinc-600 dark:text-zinc-300 mb-2">Your Networks</h4>

                {l1List.length > 0 ? (
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                        {l1List.map((chain) => (
                            <ChainTile
                                key={chain.id}
                                chain={chain}
                                isActive={walletChainId === chain.evmChainId}
                                onClick={() => handleSwitchChain(chain.evmChainId)}
                                onDelete={() => removeL1(chain.id)}
                            />
                        ))}
                        <ChainTile
                            isAddTile
                            onClick={() => setIsAddChainModalOpen(true)}
                        />
                    </div>
                ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                        <ChainTile
                            isAddTile
                            onClick={() => setIsAddChainModalOpen(true)}
                        />
                    </div>
                )}
            </div>

            {/* Add Chain Modal */}
            {isAddChainModalOpen && <AddChainModal
                onClose={() => setIsAddChainModalOpen(false)}
                onAddChain={addL1}
            />}
        </>
    );
}
