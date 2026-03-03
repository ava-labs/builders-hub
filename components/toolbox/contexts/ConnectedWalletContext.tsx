import React, { createContext, useContext, useMemo } from 'react';
import { useWalletStore } from '../stores/walletStore';
import { useWalletClient, useAccount, useConnectorClient } from 'wagmi';
import { useViemChainStore } from '../stores/toolboxStore';
import { createWalletClient, custom } from 'viem';
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
    const { data: wagmiWalletClient, isLoading: isWalletClientLoading } = useWalletClient();
    const { data: connectorClient } = useConnectorClient();
    const { isConnected, address, connector } = useAccount();
    const viemChain = useViemChainStore();

    // Fallback: create a wallet client manually when wagmi can't provide one.
    // This happens when the wallet is on a custom L1 chain not in wagmi's config
    // (which only includes C-Chain mainnet 43114 and Fuji 43113).
    const fallbackWalletClient = useMemo(() => {
        if (wagmiWalletClient || connectorClient) return null;
        if (!isConnected || !address || !viemChain) return null;

        // Try to get the EIP-1193 provider from the browser
        const provider = typeof window !== 'undefined'
            ? (window as any).ethereum
            : null;
        if (!provider) return null;

        return createWalletClient({
            chain: viemChain,
            transport: custom(provider),
            account: address,
        });
    }, [wagmiWalletClient, connectorClient, isConnected, address, viemChain]);

    const resolvedClient = wagmiWalletClient ?? (connectorClient as WalletClient | undefined) ?? fallbackWalletClient;

    // Requirements have been checked, so the wallet should be connected.
    // Show loading state while wallet client initializes.
    if (!resolvedClient) {
        if (isWalletClientLoading) {
            return (
                <div className="flex items-center justify-center p-8">
                    <div className="flex items-center gap-2 text-zinc-500">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-zinc-400" />
                        <span className="text-sm">Connecting wallet...</span>
                    </div>
                </div>
            );
        }
        return null;
    }

    const contextValue: ConnectedWalletContextValue = {
        walletClient: resolvedClient,
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
