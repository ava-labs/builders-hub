import { create } from 'zustand'
import { networkIDs } from "@avalabs/avalanchejs";
import { createCoreWalletClient, CoreWalletClientType } from '../coreViem';
import { createPublicClient, custom, http } from 'viem';
import { avalancheFuji } from 'viem/chains';
import { zeroAddress } from 'viem';
import { balanceService } from '../services/balanceService';
import { useMemo } from 'react';

// Types for better type safety
interface WalletState {
  // Core wallet state
  coreWalletClient: CoreWalletClientType | null;
  publicClient: ReturnType<typeof createPublicClient>;

  // Wallet connection data
  walletChainId: number;
  walletEVMAddress: string;
  pChainAddress: string;
  coreEthAddress: string;

  // Network state
  avalancheNetworkID: typeof networkIDs.FujiID | typeof networkIDs.MainnetID;
  isTestnet: boolean;
  evmChainName: string;

  // Balance state - support individual L1 balances by chain ID
  balances: {
    pChain: number;
    cChain: number;
    l1Chains: Record<string, number>; // Key: chainId, Value: balance
  };
  isLoading: {
    pChain: boolean;
    cChain: boolean;
    l1Chains: Record<string, boolean>; // Key: chainId, Value: loading state
  };
  bootstrapped: boolean;


}

interface WalletActions {
  // Simplified setters - group related updates
  updateWalletConnection: (data: {
    coreWalletClient?: CoreWalletClientType | null;
    walletEVMAddress?: string;
    walletChainId?: number;
    pChainAddress?: string;
    coreEthAddress?: string;
  }) => void;

  updateNetworkSettings: (data: {
    avalancheNetworkID?: typeof networkIDs.FujiID | typeof networkIDs.MainnetID;
    isTestnet?: boolean;
    evmChainName?: string;
  }) => void;

  // Balance actions - unified with chainId support
  setBalance: (type: 'pChain' | 'cChain' | string, amount: number) => void;
  setLoading: (type: 'pChain' | 'cChain' | string, loading: boolean) => void;

  // Legacy individual setters for backward compatibility
  setCoreWalletClient: (coreWalletClient: CoreWalletClientType | null) => void;
  setWalletChainId: (walletChainId: number) => void;
  setWalletEVMAddress: (walletEVMAddress: string) => void;
  setAvalancheNetworkID: (avalancheNetworkID: typeof networkIDs.FujiID | typeof networkIDs.MainnetID) => void;
  setPChainAddress: (pChainAddress: string) => void;
  setCoreEthAddress: (coreEthAddress: string) => void;
  setIsTestnet: (isTestnet: boolean) => void;
  setEvmChainName: (evmChainName: string) => void;

  // Balance update methods
  updatePChainBalance: () => Promise<void>;
  updateL1Balance: (chainId: string) => Promise<void>;
  updateCChainBalance: () => Promise<void>;
  updateAllBalances: () => Promise<void>;
  updateAllBalancesWithAllL1s: (l1List?: Array<{ evmChainId: number }>) => Promise<void>;

  // Legacy balance getters for backward compatibility
  pChainBalance: number;
  l1Balance: number; // Returns balance for current wallet chain
  cChainBalance: number;
  isPChainBalanceLoading: boolean;
  isL1BalanceLoading: boolean; // Returns loading state for current wallet chain
  isCChainBalanceLoading: boolean;

  // New getters for L1 chains
  getL1Balance: (chainId: string) => number;
  getL1Loading: (chainId: string) => boolean;

  getBootstrapped: () => boolean;
  setBootstrapped: (bootstrapped: boolean) => void;


}

type WalletStore = WalletState & WalletActions;

export const useWalletStore = create<WalletStore>((set, get) => {
  // Initialize balance service with callbacks
  const store = {
    // Initial state
    coreWalletClient: null,
    publicClient: createPublicClient({
      transport: typeof window !== 'undefined' && window.avalanche
        ? custom(window.avalanche)
        : http(avalancheFuji.rpcUrls.default.http[0]),
    }),
    walletChainId: 0,
    walletEVMAddress: "",
    avalancheNetworkID: networkIDs.FujiID as typeof networkIDs.FujiID | typeof networkIDs.MainnetID,
    pChainAddress: "",
    coreEthAddress: "",
    isTestnet: false,
    evmChainName: "",
    balances: {
      pChain: 0,
      cChain: 0,
      l1Chains: {},
    },
    isLoading: {
      pChain: false,
      cChain: false,
      l1Chains: {},
    },
    bootstrapped: false,

    // Actions
    updateWalletConnection: (data: { coreWalletClient?: CoreWalletClientType | null; walletEVMAddress?: string; walletChainId?: number; pChainAddress?: string; coreEthAddress?: string; }) => {
      set((state) => ({ ...state, ...data }));
    },

    updateNetworkSettings: (data: { avalancheNetworkID?: typeof networkIDs.FujiID | typeof networkIDs.MainnetID; isTestnet?: boolean; evmChainName?: string; }) => {
      set((state) => ({
        ...state,
        ...data,
      }));
    },

    setBalance: (type: 'pChain' | 'cChain' | string, amount: number) => {
      set((state) => {
        if (type === 'pChain' || type === 'cChain') {
          // Handle static chain types
          return {
            balances: {
              ...state.balances,
              [type]: amount,
            },
          };
        } else {
          // Handle L1 chainId
          return {
            balances: {
              ...state.balances,
              l1Chains: {
                ...state.balances.l1Chains,
                [type]: amount,
              },
            },
          };
        }
      });
    },

    setLoading: (type: 'pChain' | 'cChain' | string, loading: boolean) => {
      set((state) => {
        if (type === 'pChain' || type === 'cChain') {
          // Handle static chain types
          return {
            isLoading: {
              ...state.isLoading,
              [type]: loading,
            },
          };
        } else {
          // Handle L1 chainId
          return {
            isLoading: {
              ...state.isLoading,
              l1Chains: {
                ...state.isLoading.l1Chains,
                [type]: loading,
              },
            },
          };
        }
      });
    },

    // Legacy individual setters for backward compatibility
    setCoreWalletClient: (coreWalletClient: CoreWalletClientType | null) => set({ coreWalletClient }),
    setWalletChainId: (walletChainId: number) => set({ walletChainId }),
    setWalletEVMAddress: (walletEVMAddress: string) => set({ walletEVMAddress }),
    setAvalancheNetworkID: (avalancheNetworkID: typeof networkIDs.FujiID | typeof networkIDs.MainnetID) => set({ avalancheNetworkID }),
    setPChainAddress: (pChainAddress: string) => set({ pChainAddress }),
    setCoreEthAddress: (coreEthAddress: string) => set({ coreEthAddress }),
    setIsTestnet: (isTestnet: boolean) => set({ isTestnet }),
    setEvmChainName: (evmChainName: string) => set({ evmChainName }),

    // Balance update methods - delegate to service
    updatePChainBalance: async () => balanceService.updatePChainBalance(),
    updateL1Balance: async (chainId: string) => balanceService.updateL1Balance(chainId),
    updateCChainBalance: async () => balanceService.updateCChainBalance(),
    updateAllBalances: async () => balanceService.updateAllBalances(),
    updateAllBalancesWithAllL1s: async (l1List?: Array<{ evmChainId: number }>) => balanceService.updateAllBalancesWithAllL1s(l1List),

    // Legacy balance getters for backward compatibility
    get pChainBalance() { return get().balances.pChain; },
    get l1Balance() {
      const state = get();
      const chainId = state.walletChainId.toString();
      return state.balances.l1Chains[chainId] || 0;
    },
    get cChainBalance() { return get().balances.cChain; },
    get isPChainBalanceLoading() { return get().isLoading.pChain; },
    get isL1BalanceLoading() {
      const state = get();
      const chainId = state.walletChainId.toString();
      return state.isLoading.l1Chains[chainId] || false;
    },
    get isCChainBalanceLoading() { return get().isLoading.cChain; },

    // New getters for L1 chains
    getL1Balance: (chainId: string) => {
      return get().balances.l1Chains[chainId] || 0;
    },
    getL1Loading: (chainId: string) => {
      return get().isLoading.l1Chains[chainId] || false;
    },

    // Legacy L1 methods for backward compatibility - delegate to unified methods
    setL1Balance: (chainId: string, amount: number) => store.setBalance(chainId, amount),
    setL1Loading: (chainId: string, loading: boolean) => store.setLoading(chainId, loading),

    getBootstrapped: () => get().bootstrapped,
    setBootstrapped: (bootstrapped: boolean) => set({ bootstrapped: bootstrapped }),

  };

  // Set up balance service callbacks
  balanceService.setCallbacks({
    setBalance: store.setBalance,
    setLoading: store.setLoading,
    getState: get,
  });

  return store;
})

// Performance selectors for commonly accessed data
export const useWalletAddress = () => useWalletStore((state) => state.walletEVMAddress);

// Balances selector with memoization to avoid infinite loop
export const useBalances = () => {
  const balances = useWalletStore((state) => state.balances);
  const walletChainId = useWalletStore((state) => state.walletChainId);

  return useMemo(() => ({
    ...balances,
    // Backward compatibility: provide l1 balance for current chain
    l1: balances.l1Chains[walletChainId?.toString()] || 0,
  }), [balances, walletChainId]);
};

// Network info selector with memoization to avoid infinite loop
export const useNetworkInfo = () => {
  const isTestnet = useWalletStore((state) => state.isTestnet);
  const chainId = useWalletStore((state) => state.walletChainId);
  const avalancheNetworkID = useWalletStore((state) => state.avalancheNetworkID);
  const evmChainName = useWalletStore((state) => state.evmChainName);

  return useMemo(() => {
    const networkName = avalancheNetworkID === networkIDs.MainnetID ? "mainnet" : "fuji";
    return {
      isTestnet,
      chainId,
      networkName: networkName,
      avalancheNetworkID,
      evmChainName,
    };
  }, [isTestnet, chainId, avalancheNetworkID, evmChainName]);
};

// Selector for specific L1 balance
export const useL1Balance = (chainId: string) => useWalletStore((state) => state.balances.l1Chains[chainId] || 0);
export const useL1Loading = (chainId: string) => useWalletStore((state) => state.isLoading.l1Chains[chainId] || false);
