import React, { createContext, useContext } from 'react';
import { useWalletStore } from '../stores/walletStore';
import { useWalletClient } from 'wagmi';
import type { CoreWalletClientType } from '../coreViem';
import type { WalletClient } from 'viem';

interface ConnectedWalletContextValue {
    /** Wagmi wallet client — works for ALL connected EVM wallets (Core, MetaMask, Rabby, etc.) */
    walletClient: WalletClient;
    /** Core wallet client with P-Chain methods — null when connected with a non-Core wallet */
    coreWalletClient: CoreWalletClientType | null;
}

const ConnectedWalletContext = createContext<ConnectedWalletContextValue | null>(null);

export function ConnectedWalletProvider({ children }: { children: React.ReactNode }) {
    const coreWalletClient = useWalletStore((s) => s.coreWalletClient);
    const { data: wagmiWalletClient } = useWalletClient();

    // Requirements have been checked, so the wallet should be connected.
    // If wagmiWalletClient is not yet available (brief async gap), don't render children.
    if (!wagmiWalletClient) {
        return null;
    }

    const contextValue: ConnectedWalletContextValue = {
        walletClient: wagmiWalletClient,
        coreWalletClient: coreWalletClient ?? null,
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
            'Make sure your component is wrapped with CheckRequirements.'
        );
    }

    return context;
}
