import React from 'react';
import { Button } from './Button';
import { useWallet } from '../hooks/useWallet';
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
    const { addChain } = useWallet();

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
                onClick={async () => {
                    const result = await addChain({ 
                        rpcUrl: getRPCUrl(), 
                        allowLookup: false 
                    });
                    if (result.success) {
                        const chainName = result.chainData.name;
                        onChainAdded?.(chainName);
                    }
                }}
                className="mt-4 w-48"
            >
                Add to Wallet
            </Button>
        </div>
    );
}; 