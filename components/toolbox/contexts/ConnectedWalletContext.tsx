import React, { createContext, useContext } from 'react';
import { useWalletStore } from '../stores/walletStore';
import type { CoreWalletClientType } from '../coreViem';

interface ConnectedWalletContextValue {
    coreWalletClient: CoreWalletClientType;
}

const ConnectedWalletContext = createContext<ConnectedWalletContextValue | null>(null);

export function ConnectedWalletProvider({ children }: { children: React.ReactNode }) {
    const coreWalletClient = useWalletStore((s) => s.coreWalletClient);

    // At this point, we know all requirements are met, so type assertion is safe
    const contextValue: ConnectedWalletContextValue = {
        coreWalletClient: coreWalletClient as CoreWalletClientType,
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
