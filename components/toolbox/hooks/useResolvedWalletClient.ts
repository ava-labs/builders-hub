import { useMemo } from 'react';
import { useWalletClient } from 'wagmi';
import { createWalletClient, custom } from 'viem';
import type { WalletClient } from 'viem';
import { useWalletStore } from '../stores/walletStore';
import { useViemChainStore } from '../stores/toolboxStore';
import { useActiveWalletProvider } from './useLiveWalletChainId';

/**
 * Returns a wallet client that works on custom L1 chains.
 *
 * wagmi's `useWalletClient` returns undefined when the wallet is on a chain
 * that isn't in wagmi's static config (i.e. most custom Avalanche L1s).
 * This hook falls back to creating a wallet client manually from the
 * browser provider, mirroring the logic in ConnectedWalletContext.
 */
export function useResolvedWalletClient(): WalletClient | undefined {
  const { data: wagmiWalletClient } = useWalletClient();
  const walletEVMAddress = useWalletStore((s) => s.walletEVMAddress);
  const viemChain = useViemChainStore();
  const activeProvider = useActiveWalletProvider({
    enabled: Boolean(walletEVMAddress),
    refreshKey: walletEVMAddress,
  });

  return useMemo(() => {
    // Prefer wagmi's client when its chain matches the wallet's current
    // chain. For custom L1s — which aren't in wagmi's static config —
    // wagmi still returns a client but `wc.chain` is pinned to one of the
    // configured fallbacks (typically avalancheFuji). Callers (and the SDK
    // orchestrators downstream) read `wc.chain` to populate transaction
    // requests, so on custom L1s the tx would target Fuji instead of the
    // L1 and the wallet rejects it ("current chain ... does not match the
    // target chain for the transaction").
    if (wagmiWalletClient && viemChain && wagmiWalletClient.chain?.id === viemChain.id) {
      return wagmiWalletClient;
    }
    if (!walletEVMAddress || !viemChain) return wagmiWalletClient ?? undefined;
    if (!activeProvider) return wagmiWalletClient ?? undefined;

    return createWalletClient({
      chain: viemChain,
      transport: custom(activeProvider),
      account: walletEVMAddress as `0x${string}`,
    });
  }, [activeProvider, wagmiWalletClient, walletEVMAddress, viemChain]);
}
