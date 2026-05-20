import React, { createContext, useContext, useMemo, useRef } from 'react';
import { useWalletStore } from '../stores/walletStore';
import { useWalletClient, useAccount, useConnectorClient } from 'wagmi';
import { useViemChainStore } from '../stores/toolboxStore';
import { createWalletClient, custom } from 'viem';
import type { CoreWalletClientType } from '../coreViem';
import type { WalletClient } from 'viem';
import { useActiveWalletProvider } from '../hooks/useLiveWalletChainId';

interface ConnectedWalletContextValue {
  /** Wagmi wallet client — works for ALL connected EVM wallets (Core, MetaMask, Rabby, etc.) */
  walletClient: WalletClient;
  /** Core wallet client with P-Chain methods — null when connected with a non-Core wallet */
  coreWalletClient: CoreWalletClientType | null;
}

const ConnectedWalletContext = createContext<ConnectedWalletContextValue | null>(null);

export function ConnectedWalletProvider({ children }: { children: React.ReactNode }) {
  const coreWalletClient = useWalletStore((s) => s.coreWalletClient);
  const walletEVMAddress = useWalletStore((s) => s.walletEVMAddress);
  const { data: wagmiWalletClient, isLoading: isWalletClientLoading } = useWalletClient();
  const { data: connectorClient } = useConnectorClient();
  const { address } = useAccount();
  const viemChain = useViemChainStore();
  const activeProvider = useActiveWalletProvider({
    enabled: Boolean(address || walletEVMAddress),
    refreshKey: address || walletEVMAddress,
  });

  // Fallback: create a wallet client manually when wagmi can't provide one.
  // This happens when:
  // 1. The wallet is on a custom L1 chain not in wagmi's static config
  // 2. After page refresh when wagmi hasn't reconnected but our bootstrap detected the wallet
  const fallbackWalletClient = useMemo(() => {
    if (wagmiWalletClient || connectorClient) return null;

    // Use wagmi's address if connected, otherwise our bootstrap's address
    const effectiveAddress = address || walletEVMAddress;
    if (!effectiveAddress || !viemChain) return null;
    if (!activeProvider) return null;

    return createWalletClient({
      chain: viemChain,
      transport: custom(activeProvider),
      account: effectiveAddress as `0x${string}`,
    });
  }, [activeProvider, wagmiWalletClient, connectorClient, address, walletEVMAddress, viemChain]);

  const resolvedClient = wagmiWalletClient ?? (connectorClient as WalletClient | undefined) ?? fallbackWalletClient;

  // Cache the last non-null wallet client so a brief wagmi teardown during
  // `walletClient.switchChain` doesn't unmount the children subtree. Without
  // this ref, every chain switch tore down the provider's children (and any
  // `useState` they held), because `wagmiWalletClient` is briefly undefined
  // while wagmi swaps the active chain. Symptoms: ICM relayer setup forgetting
  // `selectedSources` / `createdRelayer` after sending a fund tx, deploy tools
  // flashing back to their initial state, etc.
  const lastClientRef = useRef<WalletClient | null>(null);
  if (resolvedClient) {
    lastClientRef.current = resolvedClient;
  }
  const effectiveClient = resolvedClient ?? lastClientRef.current;

  // Requirements have been checked, so the wallet should be connected.
  // Show loading state only on the cold mount — once we've ever had a client
  // we keep rendering children with the cached one to preserve their state.
  if (!effectiveClient) {
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
    walletClient: effectiveClient,
    coreWalletClient: coreWalletClient ?? null,
  };

  return <ConnectedWalletContext.Provider value={contextValue}>{children}</ConnectedWalletContext.Provider>;
}

export function useConnectedWallet(): ConnectedWalletContextValue {
  const context = useContext(ConnectedWalletContext);

  if (!context) {
    throw new Error(
      'useConnectedWallet must be used within a ConnectedWalletProvider. ' +
        'Make sure your component is wrapped with CheckRequirements.',
    );
  }

  return context;
}
