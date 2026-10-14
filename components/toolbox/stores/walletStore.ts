import { create } from 'zustand';
import { networkIDs } from '@avalabs/avalanchejs';
import { CoreWalletClientType } from '../coreViem';
import { createPublicClient, custom, http } from 'viem';
import { avalancheFuji } from 'viem/chains';
import { balanceService } from '../services/balanceService';
import { useMemo } from 'react';

// Wallet type: 'core' for Core Wallet (window.avalanche), 'generic-evm' for any other EVM wallet (window.ethereum)
export type WalletType = 'core' | 'generic-evm' | null;

// Types for better type safety
interface WalletState {
  // Core wallet state
  coreWalletClient: CoreWalletClientType | null;
  publicClient: ReturnType<typeof createPublicClient>;

  // Wallet connection data
  walletChainId: number;
  /**
   * True after WalletSync reads the chain from the wallet provider itself (eth_chainId or a chainChanged event) for
   * the current connection. Before that, walletChainId and isTestnet can come from wagmi's persisted chain, which is
   * the last Fuji or Mainnet C-Chain that wagmi saw, not the chain the wallet is on now.
   */
  walletChainConfirmed: boolean;
  walletEVMAddress: `0x${string}` | '';
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
    // Key: chainId. null = the balance could NOT be fetched (RPC unreachable,
    // mixed content, ...). It is deliberately distinct from 0, which is a real
    // on-chain value. Rendering null as 0 sent funded users to faucets (#4450).
    l1Chains: Record<string, number | null>;
  };
  isLoading: {
    pChain: boolean;
    cChain: boolean;
    l1Chains: Record<string, boolean>; // Key: chainId, Value: loading state
  };
  // Copies of balances.pChain, balances.cChain and isLoading for older readers.
  // setBalance and setLoading write them. They must be plain fields: the first
  // set() copies a getter's value into a plain field, and it never changes again.
  pChainBalance: number;
  cChainBalance: number;
  isPChainBalanceLoading: boolean;
  isCChainBalanceLoading: boolean;
  bootstrapped: boolean;

  // What kind of wallet is connected
  walletType: WalletType;
}

interface WalletActions {
  // Simplified setters - group related updates
  updateWalletConnection: (data: {
    coreWalletClient?: CoreWalletClientType | null;
    walletEVMAddress?: `0x${string}` | '';
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
  setBalance: (type: 'pChain' | 'cChain' | string, amount: number | null) => void;
  setLoading: (type: 'pChain' | 'cChain' | string, loading: boolean) => void;

  // Legacy individual setters for backward compatibility
  setCoreWalletClient: (coreWalletClient: CoreWalletClientType | null) => void;
  setWalletChainId: (walletChainId: number) => void;
  setWalletChainConfirmed: (walletChainConfirmed: boolean) => void;
  setWalletEVMAddress: (walletEVMAddress: `0x${string}` | '') => void;
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
  updateAllBalancesWithAllL1s: (l1List?: Array<{ evmChainId: number; rpcUrl?: string }>) => Promise<void>;

  // Getters for L1 chains
  getL1Balance: (chainId: string) => number | null;
  getL1Loading: (chainId: string) => boolean;

  getBootstrapped: () => boolean;
  setBootstrapped: (bootstrapped: boolean) => void;

  // Wallet type
  setWalletType: (walletType: WalletType) => void;
}

type WalletStore = WalletState & WalletActions;

type BalanceUpdate = Pick<WalletState, 'balances'> & Partial<Pick<WalletState, 'pChainBalance' | 'cChainBalance'>>;
type LoadingUpdate = Pick<WalletState, 'isLoading'> &
  Partial<Pick<WalletState, 'isPChainBalanceLoading' | 'isCChainBalanceLoading'>>;

/** The state change of setBalance. A P-Chain or C-Chain amount also goes to its copy field. */
export function balanceUpdate(
  balances: WalletState['balances'],
  type: 'pChain' | 'cChain' | string,
  amount: number | null,
): BalanceUpdate {
  // The P-Chain and C-Chain fetchers never produce null
  if (type === 'pChain') return { balances: { ...balances, pChain: amount ?? 0 }, pChainBalance: amount ?? 0 };
  if (type === 'cChain') return { balances: { ...balances, cChain: amount ?? 0 }, cChainBalance: amount ?? 0 };
  // Handle L1 chainId
  return { balances: { ...balances, l1Chains: { ...balances.l1Chains, [type]: amount } } };
}

/** The state change of setLoading. A P-Chain or C-Chain flag also goes to its copy field. */
export function loadingUpdate(
  isLoading: WalletState['isLoading'],
  type: 'pChain' | 'cChain' | string,
  loading: boolean,
): LoadingUpdate {
  if (type === 'pChain') return { isLoading: { ...isLoading, pChain: loading }, isPChainBalanceLoading: loading };
  if (type === 'cChain') return { isLoading: { ...isLoading, cChain: loading }, isCChainBalanceLoading: loading };
  // Handle L1 chainId
  return { isLoading: { ...isLoading, l1Chains: { ...isLoading.l1Chains, [type]: loading } } };
}

export const useWalletStore = create<WalletStore>((set, get) => {
  // Initialize balance service with callbacks
  const store = {
    // Initial state
    coreWalletClient: null,
    publicClient: createPublicClient({
      // An element with id="avalanche" (an "Avalanche" heading) is also window.avalanche: require a provider
      transport:
        typeof window !== 'undefined' && typeof window.avalanche?.request === 'function'
          ? custom(window.avalanche)
          : http(avalancheFuji.rpcUrls.default.http[0]),
    }),
    walletChainId: 0,
    walletChainConfirmed: false,
    walletEVMAddress: '' as `0x${string}` | '',
    avalancheNetworkID: networkIDs.FujiID as typeof networkIDs.FujiID | typeof networkIDs.MainnetID,
    pChainAddress: '',
    coreEthAddress: '',
    isTestnet: false,
    evmChainName: '',
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
    pChainBalance: 0,
    cChainBalance: 0,
    isPChainBalanceLoading: false,
    isCChainBalanceLoading: false,
    bootstrapped: false,
    walletType: null,

    // Actions
    updateWalletConnection: (data: {
      coreWalletClient?: CoreWalletClientType | null;
      walletEVMAddress?: `0x${string}` | '';
      walletChainId?: number;
      pChainAddress?: string;
      coreEthAddress?: string;
    }) => {
      set((state) => ({ ...state, ...data }));
    },

    updateNetworkSettings: (data: {
      avalancheNetworkID?: typeof networkIDs.FujiID | typeof networkIDs.MainnetID;
      isTestnet?: boolean;
      evmChainName?: string;
    }) => {
      set((state) => ({
        ...state,
        ...data,
      }));
    },

    setBalance: (type: 'pChain' | 'cChain' | string, amount: number | null) => {
      set((state) => balanceUpdate(state.balances, type, amount));
    },

    setLoading: (type: 'pChain' | 'cChain' | string, loading: boolean) => {
      set((state) => loadingUpdate(state.isLoading, type, loading));
    },

    // Legacy individual setters for backward compatibility
    setCoreWalletClient: (coreWalletClient: CoreWalletClientType | null) => set({ coreWalletClient }),
    setWalletChainId: (walletChainId: number) => set({ walletChainId }),
    setWalletChainConfirmed: (walletChainConfirmed: boolean) => set({ walletChainConfirmed }),
    setWalletEVMAddress: (walletEVMAddress: `0x${string}` | '') => set({ walletEVMAddress }),
    setAvalancheNetworkID: (avalancheNetworkID: typeof networkIDs.FujiID | typeof networkIDs.MainnetID) =>
      set({ avalancheNetworkID }),
    setPChainAddress: (pChainAddress: string) => set({ pChainAddress }),
    setCoreEthAddress: (coreEthAddress: string) => set({ coreEthAddress }),
    setIsTestnet: (isTestnet: boolean) => set({ isTestnet }),
    setEvmChainName: (evmChainName: string) => set({ evmChainName }),

    // Balance update methods - delegate to service
    updatePChainBalance: async () => balanceService.updatePChainBalance(),
    updateL1Balance: async (chainId: string) => balanceService.updateL1Balance(chainId),
    updateCChainBalance: async () => balanceService.updateCChainBalance(),
    updateAllBalances: async () => balanceService.updateAllBalances(),
    updateAllBalancesWithAllL1s: async (l1List?: Array<{ evmChainId: number }>) =>
      balanceService.updateAllBalancesWithAllL1s(l1List),

    // Getters for L1 chains. null = balance could not be fetched;
    // absent chainId also reads as null (never fetched yet).
    getL1Balance: (chainId: string): number | null => {
      return get().balances.l1Chains[chainId] ?? null;
    },
    getL1Loading: (chainId: string) => {
      return get().isLoading.l1Chains[chainId] || false;
    },

    // Legacy L1 methods for backward compatibility - delegate to unified methods
    setL1Balance: (chainId: string, amount: number | null) => store.setBalance(chainId, amount),
    setL1Loading: (chainId: string, loading: boolean) => store.setLoading(chainId, loading),

    getBootstrapped: () => get().bootstrapped,
    setBootstrapped: (bootstrapped: boolean) => set({ bootstrapped: bootstrapped }),

    setWalletType: (walletType: WalletType) => set({ walletType }),
  };

  // Set up balance service callbacks
  balanceService.setCallbacks({
    setBalance: store.setBalance,
    setLoading: store.setLoading,
    getState: get,
  });

  return store;
});

// Performance selectors for commonly accessed data
export const useWalletAddress = () => useWalletStore((state) => state.walletEVMAddress);

// Balances selector with memoization to avoid infinite loop
export const useBalances = () => {
  const balances = useWalletStore((state) => state.balances);
  const walletChainId = useWalletStore((state) => state.walletChainId);

  return useMemo(
    () => ({
      ...balances,
      // Backward compatibility: provide l1 balance for current chain
      l1: balances.l1Chains[walletChainId?.toString()] || 0,
    }),
    [balances, walletChainId],
  );
};

// Network info selector with memoization to avoid infinite loop
export const useNetworkInfo = () => {
  const isTestnet = useWalletStore((state) => state.isTestnet);
  const chainId = useWalletStore((state) => state.walletChainId);
  const avalancheNetworkID = useWalletStore((state) => state.avalancheNetworkID);
  const evmChainName = useWalletStore((state) => state.evmChainName);

  return useMemo(() => {
    const networkName = avalancheNetworkID === networkIDs.MainnetID ? 'mainnet' : 'fuji';
    return {
      isTestnet,
      chainId,
      networkName: networkName,
      avalancheNetworkID,
      evmChainName,
    };
  }, [isTestnet, chainId, avalancheNetworkID, evmChainName]);
};

// Wallet type selectors
export const useWalletType = () => useWalletStore((state) => state.walletType);

// Selector for specific L1 balance. null = could not be fetched (do not
// render as 0. See the l1Chains comment above).
export const useL1Balance = (chainId: string) => useWalletStore((state) => state.balances.l1Chains[chainId] ?? null);
export const useL1Loading = (chainId: string) => useWalletStore((state) => state.isLoading.l1Chains[chainId] || false);
