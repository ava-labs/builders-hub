import { createFlowStore } from './createFlowStore';
import { STORE_VERSION } from './utils';

type TokenType = 'native' | 'erc20';

interface RemoveDelegationState {
  subnetIdL1: string;
  tokenType: TokenType;
  delegationId: string;
  evmTxHash: string;
  pChainTxId: string;
  globalError: string | null;
  globalSuccess: string | null;

  setSubnetIdL1: (subnetIdL1: string) => void;
  setTokenType: (tokenType: TokenType) => void;
  setDelegationId: (delegationId: string) => void;
  setEvmTxHash: (evmTxHash: string) => void;
  setPChainTxId: (pChainTxId: string) => void;
  setGlobalError: (globalError: string | null) => void;
  setGlobalSuccess: (globalSuccess: string | null) => void;
  reset: () => void;
}

const initialValues = {
  subnetIdL1: '',
  tokenType: 'native' as TokenType,
  delegationId: '',
  evmTxHash: '',
  pChainTxId: '',
  globalError: null as string | null,
  globalSuccess: null as string | null,
};

const { getStore: getRemoveDelegationStore, useStore: useRemoveDelegationStore } =
  createFlowStore<RemoveDelegationState>({
    name: 'remove-delegation-store',
    storeCreator: (set, isTestnet) => ({
      ...initialValues,

      setSubnetIdL1: (subnetIdL1: string) =>
        set({
          subnetIdL1,
          delegationId: '',
          evmTxHash: '',
          pChainTxId: '',
          globalError: null,
          globalSuccess: null,
        }),

      setTokenType: (tokenType: TokenType) => set({ tokenType }),

      setDelegationId: (delegationId: string) =>
        set({ delegationId, evmTxHash: '', pChainTxId: '', globalError: null, globalSuccess: null }),

      setEvmTxHash: (evmTxHash: string) =>
        set({ evmTxHash, pChainTxId: '', globalError: null, globalSuccess: null }),

      setPChainTxId: (pChainTxId: string) => set({ pChainTxId, globalError: null, globalSuccess: null }),

      setGlobalError: (globalError: string | null) => set({ globalError }),
      setGlobalSuccess: (globalSuccess: string | null) => set({ globalSuccess }),

      reset: () => {
        set({ ...initialValues });
        window?.localStorage.removeItem(
          `${STORE_VERSION}-remove-delegation-store-${isTestnet ? 'testnet' : 'mainnet'}`,
        );
      },
    }),
    partialize: (state) => {
      const { globalError, globalSuccess, ...rest } = state;
      return rest;
    },
  });

export { getRemoveDelegationStore, useRemoveDelegationStore };
