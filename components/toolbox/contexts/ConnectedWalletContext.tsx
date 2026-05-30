import React, { createContext, useContext, useMemo, useRef } from 'react';
import { useWalletStore } from '../stores/walletStore';
import { useWalletClient, useAccount, useConnectorClient } from 'wagmi';
import { useViemChainStore } from '../stores/toolboxStore';
import { createWalletClient, custom } from 'viem';
import { avalanche, avalancheFuji } from 'viem/chains';
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
  const isTestnet = useWalletStore((s) => s.isTestnet);
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
  // Build a manually-constructed client when either:
  //   1. wagmi has no client at all (cold mount / chain wagmi doesn't know)
  //   2. wagmi's client is pinned to the wrong chain (custom L1 case —
  //      wagmi falls back to one of its configured chains, typically
  //      avalancheFuji, so `wc.chain` mis-matches viemChain and any
  //      downstream code reading wc.chain targets the wrong network).
  const fallbackWalletClient = useMemo(() => {
    const wagmiClient = wagmiWalletClient ?? (connectorClient as WalletClient | undefined);
    const wagmiChainMatches = wagmiClient && viemChain && wagmiClient.chain?.id === viemChain.id;
    if (wagmiClient && wagmiChainMatches) return null;

    const effectiveAddress = address || walletEVMAddress;
    if (!effectiveAddress) return null;
    if (!activeProvider) return null;

    // Default to C-Chain (Fuji on testnet, Avalanche on mainnet) when we
    // don't yet have a resolved viemChain. Happens after `resetAllStores()`
    // wipes the custom L1 list and the wallet hasn't reported a known chain
    // yet — without this default the provider rendered "Connecting wallet…"
    // indefinitely. As soon as `walletChainId` resolves to a chain in the
    // L1 list, this memo rebuilds with the correct viemChain.
    const chainForClient = viemChain ?? (isTestnet ? avalancheFuji : avalanche);

    return createWalletClient({
      chain: chainForClient,
      transport: custom(activeProvider),
      account: effectiveAddress as `0x${string}`,
    });
  }, [activeProvider, wagmiWalletClient, connectorClient, address, walletEVMAddress, viemChain, isTestnet]);

  // Resolution order: prefer the wagmi client only when its chain agrees
  // with viemChain. Otherwise (chain mismatch or no wagmi client) take the
  // manually-built fallback so wc.chain reflects the user's actual chain.
  const wagmiChainMatchesViem = (wagmiWalletClient ?? connectorClient)?.chain?.id === viemChain?.id;
  const resolvedClient = wagmiChainMatchesViem
    ? (wagmiWalletClient ?? (connectorClient as WalletClient | undefined) ?? fallbackWalletClient)
    : (fallbackWalletClient ?? wagmiWalletClient ?? (connectorClient as WalletClient | undefined));

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
