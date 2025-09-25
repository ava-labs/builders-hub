import React, { createContext, useContext } from 'react';
import { useWalletStore } from '../stores/walletStore';
import type { CoreWalletClientType } from '../coreViem';
import { useWallet } from '../hooks/useWallet';
import { AvalancheWalletClient } from '@avalanche-sdk/client';

interface ConnectedWalletContextValue {
    coreWalletClient: CoreWalletClientType;
    avalancheWalletClient: AvalancheWalletClient;
}

const ConnectedWalletContext = createContext<ConnectedWalletContextValue | null>(null);

export function ConnectedWalletProvider({ children }: { children: React.ReactNode }) {
    const coreWalletClient = useWalletStore((s) => s.coreWalletClient);
    const { avalancheWalletClient } = useWallet();

    // At this point, we know all requirements are met, so type assertion is safe
    const contextValue: ConnectedWalletContextValue = {
        coreWalletClient: coreWalletClient as CoreWalletClientType,
        avalancheWalletClient: avalancheWalletClient as AvalancheWalletClient
    };

    return (
        <ConnectedWalletContext.Provider value={contextValue}>
            {children}
        </ConnectedWalletContext.Provider>
    );
}

export function useConnectedWallet(): ConnectedWalletContextValue {
    const context = useContext(ConnectedWalletContext);

    if (!context) {
        throw new Error(
            'useConnectedWallet must be used within a ConnectedWalletProvider. ' +
            'Make sure your component is wrapped with CheckWalletRequirements.'
        );
    }

    return context;
}
