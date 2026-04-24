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
  const walletEVMAddress = useWalletStore((s) => s.walletEVMAddress);
  const { data: wagmiWalletClient, isLoading: isWalletClientLoading } = useWalletClient();
  const { data: connectorClient } = useConnectorClient();
  const { address } = useAccount();
  const viemChain = useViemChainStore();

  // Fallback: create a wallet client manually when wagmi can't provide one.
  // This happens when:
  // 1. The wallet is on a custom L1 chain not in wagmi's static config
  // 2. After page refresh when wagmi hasn't reconnected but our bootstrap detected the wallet
  const fallbackWalletClient = useMemo(() => {
    if (wagmiWalletClient || connectorClient) return null;

    // Use wagmi's address if connected, otherwise our bootstrap's address
    const effectiveAddress = address || walletEVMAddress;
    if (!effectiveAddress || !viemChain) return null;

    const provider = typeof window !== 'undefined' ? window.avalanche || (window as any).ethereum : null;
    if (!provider) return null;

    return createWalletClient({
      chain: viemChain,
      transport: custom(provider),
      account: effectiveAddress as `0x${string}`,
    });
  }, [wagmiWalletClient, connectorClient, address, walletEVMAddress, viemChain]);

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
