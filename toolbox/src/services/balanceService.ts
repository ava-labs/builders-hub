import debounce from 'debounce';
import { getPChainBalance, getNativeTokenBalance, getChains } from '../coreViem/utils/glacier';
import { avalancheFuji, avalanche } from 'viem/chains';

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

export interface BalanceUpdateCallbacks {
  setBalance: (type: 'pChain' | 'l1' | 'cChain', amount: number) => void;
  setLoading: (type: 'pChain' | 'l1' | 'cChain', loading: boolean) => void;
  getState: () => {
    isTestnet?: boolean;
    pChainAddress: string;
    walletChainId: number;
    walletEVMAddress: string;
    publicClient: any;
    isLoading: Record<'pChain' | 'l1' | 'cChain', boolean>;
  };
}

// Service class for managing balance operations
export class BalanceService {
  private callbacks: BalanceUpdateCallbacks | null = null;


  constructor(private debounceTime: number = 500) {}

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

    const debouncedL1Update = debounce(async () => {
      if (!this.callbacks) return;
      const state = this.callbacks.getState();
      
      if (state.isLoading.l1) return;
      
      this.callbacks.setLoading('l1', true);
      try {
        const balance = await this.fetchL1Balance(
          state.walletChainId, 
          state.walletEVMAddress, 
          state.publicClient
        );
        this.callbacks.setBalance('l1', balance);
      } finally {
        this.callbacks.setLoading('l1', false);
      }
    }, this.debounceTime);
    
    this.updateL1Balance = async () => {
      await debouncedL1Update();
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
  updateL1Balance = async () => Promise.resolve();
  updateCChainBalance = async () => Promise.resolve();

  // Update all balances
  updateAllBalances = async () => {
    await Promise.all([
      this.updatePChainBalance(),
      this.updateL1Balance(),
      this.updateCChainBalance(),
    ]);
  };
}

// Export singleton instance
export const balanceService = new BalanceService();
