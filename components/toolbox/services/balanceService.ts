import { getPChainBalance, getNativeTokenBalance, getChains } from '../coreViem/utils/glacier';
import { avalancheFuji, avalanche } from 'viem/chains';

// Local debounce function
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

// Cache for indexed chains to avoid repeated API calls
let indexedChainsCache: Number[] | null = null;
let indexedChainsPromise: Promise<Number[]> | null = null;

async function getIndexedChains(): Promise<Number[]> {
  if (indexedChainsCache) return indexedChainsCache;

  if (!indexedChainsPromise) {
    indexedChainsPromise = getChains().then(chains => {
      const chainIds = chains.map(chain => parseInt(chain.chainId));
      indexedChainsCache = chainIds;
      return chainIds;
    });
  }

  return indexedChainsPromise;
}

interface BalanceUpdateCallbacks {
  setBalance: (type: 'pChain' | 'cChain' | string, amount: number) => void;
  setLoading: (type: 'pChain' | 'cChain' | string, loading: boolean) => void;
  getState: () => {
    isTestnet?: boolean;
    pChainAddress: string;
    walletChainId: number;
    walletEVMAddress: string;
    publicClient: any;
    isLoading: {
      pChain: boolean;
      cChain: boolean;
      l1Chains: Record<string, boolean>;
    };
  };
}

// Service class for managing balance operations
class BalanceService {
  private callbacks: BalanceUpdateCallbacks | null = null;


  constructor(private debounceTime: number = 500) { }

  setCallbacks(callbacks: BalanceUpdateCallbacks) {
    this.callbacks = callbacks;
    this.initializeDebouncedMethods();
  }

  private initializeDebouncedMethods() {
    if (!this.callbacks) return;

    const debouncedPChainUpdate = debounce(async () => {
      if (!this.callbacks) return;
      const state = this.callbacks.getState();

      if (state.isLoading.pChain) return;

      this.callbacks.setLoading('pChain', true);
      try {
        const balance = await this.fetchPChainBalance(state.isTestnet ?? false, state.pChainAddress);
        this.callbacks.setBalance('pChain', balance);
      } finally {
        this.callbacks.setLoading('pChain', false);
      }
    }, this.debounceTime);

    this.updatePChainBalance = async () => {
      await debouncedPChainUpdate();
    };

    // Create debounced L1 update function that takes chainId
    const createDebouncedL1Update = (chainId: string) => debounce(async () => {
      if (!this.callbacks) return;
      const state = this.callbacks.getState();

      if (state.isLoading.l1Chains[chainId]) return;

      this.callbacks.setLoading(chainId, true);
      try {
        const balance = await this.fetchL1Balance(
          parseInt(chainId),
          state.walletEVMAddress,
          state.publicClient
        );
        this.callbacks.setBalance(chainId, balance);
      } finally {
        this.callbacks.setLoading(chainId, false);
      }
    }, this.debounceTime);

    // Store debounced functions for each chain
    const debouncedL1Updates = new Map<string, ReturnType<typeof createDebouncedL1Update>>();

    this.updateL1Balance = async (chainId: string) => {
      if (!debouncedL1Updates.has(chainId)) {
        debouncedL1Updates.set(chainId, createDebouncedL1Update(chainId));
      }
      await debouncedL1Updates.get(chainId)!();
    };

    const debouncedCChainUpdate = debounce(async () => {
      if (!this.callbacks) return;
      const state = this.callbacks.getState();

      if (state.isLoading.cChain) return;

      this.callbacks.setLoading('cChain', true);
      try {
        const balance = await this.fetchCChainBalance(state.isTestnet ?? false, state.walletEVMAddress);
        this.callbacks.setBalance('cChain', balance);
      } finally {
        this.callbacks.setLoading('cChain', false);
      }
    }, this.debounceTime);

    this.updateCChainBalance = async () => {
      await debouncedCChainUpdate();
    };
  }

  // P-Chain balance fetching
  async fetchPChainBalance(isTestnet: boolean, pChainAddress: string): Promise<number> {
    if (!pChainAddress) return 0;

    try {
      const network = isTestnet ? "testnet" : "mainnet";
      const response = await getPChainBalance(network, pChainAddress);
      return Number(response.balances.unlockedUnstaked[0]?.amount || 0) / 1e9;
    } catch (error) {
      console.error('Failed to fetch P-Chain balance:', error);
      return 0;
    }
  }

  // L1 balance fetching
  async fetchL1Balance(
    walletChainId: number,
    walletEVMAddress: string,
    publicClient: any
  ): Promise<number> {
    if (!walletEVMAddress || !walletChainId) return 0;

    try {
      const indexedChains = await getIndexedChains();
      const isIndexedChain = indexedChains.includes(walletChainId);

      if (isIndexedChain) {
        const balance = await getNativeTokenBalance(walletChainId, walletEVMAddress);
        return Number(balance.balance) / (10 ** balance.decimals);
      } else {
        const balance = await publicClient.getBalance({
          address: walletEVMAddress as `0x${string}`,
        });
        return Number(balance) / 1e18;
      }
    } catch (error) {
      console.error('Failed to fetch L1 balance:', error);
      return 0;
    }
  }

  // C-Chain balance fetching
  async fetchCChainBalance(isTestnet: boolean, walletEVMAddress: string): Promise<number> {
    if (!walletEVMAddress) return 0;

    try {
      const chain = isTestnet ? avalancheFuji : avalanche;
      const balance = await getNativeTokenBalance(chain.id, walletEVMAddress);
      return Number(balance.balance) / (10 ** balance.decimals);
    } finally {
      // Handle any cleanup if needed
    }
  }


  // These will be set up by initializeDebouncedMethods
  updatePChainBalance = async () => Promise.resolve();
  updateL1Balance = async (_chainId: string) => Promise.resolve();
  updateCChainBalance = async () => Promise.resolve();



  // Update all balances (normal behavior - only current L1)
  updateAllBalances = async () => {
    await Promise.all([
      this.updatePChainBalance(),
      this.updateCurrentL1Balance(),
      this.updateCChainBalance(),
    ]);
  };

  // Update all balances including all L1s
  updateAllBalancesWithAllL1s = async (l1List?: Array<{ evmChainId: number }>) => {
    if (l1List && l1List.length > 0) {
      // Update balances for all L1s in the list
      const updatePromises = l1List.map(l1 =>
        this.updateL1Balance(l1.evmChainId.toString())
      );
      await Promise.all([
        this.updatePChainBalance(),
        Promise.all(updatePromises),
        this.updateCChainBalance(),
      ]);
    } else {
      // Fallback: update the current wallet chain (same as updateAllBalances)
      await this.updateAllBalances();
    }
  };

  // Helper method to update only the current wallet's L1 balance
  updateCurrentL1Balance = async () => {
    if (!this.callbacks) return;
    const state = this.callbacks.getState();
    if (state.walletChainId && state.walletChainId !== 0) {
      await this.updateL1Balance(state.walletChainId.toString());
    }
  };
}

// Export singleton instance
export const balanceService = new BalanceService();
