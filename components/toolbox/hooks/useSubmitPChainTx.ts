import { useWalletStore } from '../stores/walletStore';
import { ensureCoreNetworkMode, restoreCoreChain } from '../coreViem';
import type { CoreWalletClientType } from '../coreViem';

/**
 * Returns a function that handles Core Wallet network mode switching
 * and client re-reading for P-Chain operations.
 *
 * Wraps the ensureCoreNetworkMode -> re-read coreWalletClient -> execute -> restoreCoreChain
 * pattern used across all P-Chain transaction components.
 */
export function useSubmitPChainTx() {
  const isTestnet = useWalletStore((s) => s.isTestnet);

  /**
   * Execute a P-Chain operation with proper network mode handling.
   * Switches Core to the correct network, re-reads the wallet client,
   * executes the callback, then restores the previous chain.
   */
  const submitPChainTx = async <T>(
    fn: (client: CoreWalletClientType) => Promise<T>
  ): Promise<T> => {
    const previousChainId = await ensureCoreNetworkMode(isTestnet);

    // After mode switch, chainChanged fires and creates a new coreWalletClient
    // targeting the correct network. We must re-read from the store — the closure
    // captured the OLD client which may be configured for the wrong P-Chain.
    const freshClient = useWalletStore.getState().coreWalletClient;
    if (!freshClient) {
      throw new Error('Core wallet client lost after network mode switch. Please reconnect.');
    }

    const result = await fn(freshClient);

    // Restore the L1 chain if we had to switch for the P-Chain op
    if (previousChainId) await restoreCoreChain(previousChainId);

    return result;
  };

  return { submitPChainTx };
}
