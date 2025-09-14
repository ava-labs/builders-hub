import React, { useState } from 'react';
import { Button } from './Button';
import { AddChainModal } from './ConnectWallet/AddChainModal';
import { useL1ListStore } from '../stores/l1ListStore';
import { nipify } from './HostInput';

interface AddToWalletStepProps {
    chainId: string;
    domain?: string;
    nodeRunningMode: 'server' | 'localhost';
    onChainAdded?: (chainName: string) => void;
}

export const AddToWalletStep: React.FC<AddToWalletStepProps> = ({
    chainId,
    domain,
    nodeRunningMode,
    onChainAdded
}) => {
    const [isAddChainModalOpen, setIsAddChainModalOpen] = useState(false);
    const { addL1 } = useL1ListStore()();

    const getRPCUrl = () => {
        if (nodeRunningMode === 'server' && domain) {
            return `https://${nipify(domain)}/ext/bc/${chainId}/rpc`;
        }
        return `http://localhost:9650/ext/bc/${chainId}/rpc`;
    };

    return (
        <div className="space-y-4">
            <h3 className="text-xl font-bold mb-4">Add to Wallet</h3>
            <p>Click the button below to add your chain to your wallet:</p>

            <Button
                onClick={() => setIsAddChainModalOpen(true)}
                className="mt-4 w-48"
            >
                Add to Wallet
            </Button>

            {isAddChainModalOpen && (
                <AddChainModal
                    onClose={() => setIsAddChainModalOpen(false)}
                    onAddChain={(chain) => {
                        if (onChainAdded) {
                            onChainAdded(chain.name);
                        }
                        // Try addL1 but catch any errors that might cause resets
                        try {
                            addL1(chain);
                        } catch (error) {
                            console.log("addL1 error (non-blocking):", error);
                        }
                    }}
                    allowLookup={false}
                    fixedRPCUrl={getRPCUrl()}
                />
            )}
        </div>
    );
}; 