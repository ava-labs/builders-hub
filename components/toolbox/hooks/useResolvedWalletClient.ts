import { useMemo } from 'react';
import { useWalletClient } from 'wagmi';
import { createWalletClient, custom } from 'viem';
import type { WalletClient } from 'viem';
import { useWalletStore } from '../stores/walletStore';
import { useViemChainStore } from '../stores/toolboxStore';

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

  return useMemo(() => {
    if (wagmiWalletClient) return wagmiWalletClient;

    if (!walletEVMAddress || !viemChain) return undefined;

    const provider = typeof window !== 'undefined'
      ? (window.avalanche || (window as any).ethereum)
      : null;
    if (!provider) return undefined;

    return createWalletClient({
      chain: viemChain,
      transport: custom(provider),
      account: walletEVMAddress as `0x${string}`,
    });
  }, [wagmiWalletClient, walletEVMAddress, viemChain]);
}
