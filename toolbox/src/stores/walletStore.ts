import { create } from 'zustand'
import { networkIDs } from "@avalabs/avalanchejs";
import { createCoreWalletClient } from '../coreViem';
import { createPublicClient, custom, http } from 'viem';
import { avalancheFuji } from 'viem/chains';
import { zeroAddress } from 'viem';
import { GlobalParamNetwork } from "@avalabs/avacloud-sdk/models/components";
import { balanceService } from '../services/balanceService';

// Types for better type safety
interface WalletState {
  // Core wallet state
  coreWalletClient: ReturnType<typeof createCoreWalletClient>;
  publicClient: ReturnType<typeof createPublicClient>;
  
  // Wallet connection data
  walletChainId: number;
  walletEVMAddress: string;
  pChainAddress: string;
  coreEthAddress: string;
  
  // Network state
  avalancheNetworkID: typeof networkIDs.FujiID | typeof networkIDs.MainnetID;
  isTestnet: boolean | undefined;
  evmChainName: string;
  
  // Balance state - simplified to single loading state
  balances: {
    pChain: number;
    l1: number;
    cChain: number;
  };
  isLoading: Record<'pChain' | 'l1' | 'cChain', boolean>;
}

interface WalletActions {
  // Simplified setters - group related updates
  updateWalletConnection: (data: {
    coreWalletClient?: ReturnType<typeof createCoreWalletClient>;
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
  
  // Balance actions - simplified
  setBalance: (type: 'pChain' | 'l1' | 'cChain', amount: number) => void;
  setLoading: (type: 'pChain' | 'l1' | 'cChain', loading: boolean) => void;
  
  // Legacy individual setters for backward compatibility
  setCoreWalletClient: (coreWalletClient: ReturnType<typeof createCoreWalletClient>) => void;
  setWalletChainId: (walletChainId: number) => void;
  setWalletEVMAddress: (walletEVMAddress: string) => void;
  setAvalancheNetworkID: (avalancheNetworkID: typeof networkIDs.FujiID | typeof networkIDs.MainnetID) => void;
  setPChainAddress: (pChainAddress: string) => void;
  setCoreEthAddress: (coreEthAddress: string) => void;
  setIsTestnet: (isTestnet: boolean) => void;
  setEvmChainName: (evmChainName: string) => void;
  
  // Balance update methods
  updatePChainBalance: () => Promise<void>;
  updateL1Balance: () => Promise<void>;
  updateCChainBalance: () => Promise<void>;
  updateAllBalances: () => Promise<void>;
  
  // Utility getters
  getNetworkName: () => GlobalParamNetwork;
  
  // Legacy balance getters for backward compatibility
  pChainBalance: number;
  l1Balance: number;
  cChainBalance: number;
  isPChainBalanceLoading: boolean;
  isL1BalanceLoading: boolean;
  isCChainBalanceLoading: boolean;
}

type WalletStore = WalletState & WalletActions;

export const useWalletStore = create<WalletStore>((set, get) => {
  // Initialize balance service with callbacks
  const store = {
    // Initial state
    coreWalletClient: createCoreWalletClient(zeroAddress),
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
    isTestnet: undefined as boolean | undefined,
    evmChainName: "",
    balances: {
      pChain: 0,
      l1: 0,
      cChain: 0,
    },
    isLoading: {
      pChain: false,
      l1: false,
      cChain: false,
    },

    // Actions
    updateWalletConnection: (data: { coreWalletClient?: ReturnType<typeof createCoreWalletClient>; walletEVMAddress?: string; walletChainId?: number; pChainAddress?: string; coreEthAddress?: string; }) => {
      set((state) => ({
        ...state,
        ...data,
      }));
    },

    updateNetworkSettings: (data: { avalancheNetworkID?: typeof networkIDs.FujiID | typeof networkIDs.MainnetID; isTestnet?: boolean; evmChainName?: string; }) => {
      set((state) => ({
        ...state,
        ...data,
      }));
    },

    setBalance: (type: 'pChain' | 'l1' | 'cChain', amount: number) => {
      set((state) => ({
        balances: {
          ...state.balances,
          [type]: amount,
        },
      }));
    },

    setLoading: (type: 'pChain' | 'l1' | 'cChain', loading: boolean) => {
      set((state) => ({
        isLoading: {
          ...state.isLoading,
          [type]: loading,
        },
      }));
    },

    // Legacy individual setters for backward compatibility
    setCoreWalletClient: (coreWalletClient: ReturnType<typeof createCoreWalletClient>) => set({ coreWalletClient }),
    setWalletChainId: (walletChainId: number) => set({ walletChainId }),
    setWalletEVMAddress: (walletEVMAddress: string) => set({ walletEVMAddress }),
    setAvalancheNetworkID: (avalancheNetworkID: typeof networkIDs.FujiID | typeof networkIDs.MainnetID) => set({ avalancheNetworkID }),
    setPChainAddress: (pChainAddress: string) => set({ pChainAddress }),
    setCoreEthAddress: (coreEthAddress: string) => set({ coreEthAddress }),
    setIsTestnet: (isTestnet: boolean) => set({ isTestnet }),
    setEvmChainName: (evmChainName: string) => set({ evmChainName }),

    // Balance update methods - delegate to service
    updatePChainBalance: async () => balanceService.updatePChainBalance(),
    updateL1Balance: async () => balanceService.updateL1Balance(),
    updateCChainBalance: async () => balanceService.updateCChainBalance(),
    updateAllBalances: async () => balanceService.updateAllBalances(),

    getNetworkName: (): GlobalParamNetwork => {
      const { avalancheNetworkID } = get();
      return avalancheNetworkID === networkIDs.MainnetID ? "mainnet" : "fuji";
    },

    // Legacy balance getters for backward compatibility
    get pChainBalance() { return get().balances.pChain; },
    get l1Balance() { return get().balances.l1; },
    get cChainBalance() { return get().balances.cChain; },
    get isPChainBalanceLoading() { return get().isLoading.pChain; },
    get isL1BalanceLoading() { return get().isLoading.l1; },
    get isCChainBalanceLoading() { return get().isLoading.cChain; },
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
export const useBalances = () => useWalletStore((state) => state.balances);
export const useNetworkInfo = () => useWalletStore((state) => ({
  isTestnet: state.isTestnet,
  chainId: state.walletChainId,
  networkName: state.getNetworkName(),
  avalancheNetworkID: state.avalancheNetworkID,
  evmChainName: state.evmChainName,
}));
export const useLoadingStates = () => useWalletStore((state) => state.isLoading);
