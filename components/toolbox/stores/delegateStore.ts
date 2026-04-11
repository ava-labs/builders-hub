import { createFlowStore } from './createFlowStore';
import { STORE_VERSION } from './utils';

export type TokenType = 'native' | 'erc20';

interface DelegateState {
  subnetIdL1: string;
  tokenType: TokenType;
  validationId: string;
  nodeId: string;
  delegationAmount: string;
  evmTxHash: string;
  delegationID: string;
  pChainTxId: string;
  globalError: string | null;
  globalSuccess: string | null;

  setSubnetIdL1: (subnetIdL1: string) => void;
  setTokenType: (tokenType: TokenType) => void;
  setValidationId: (validationId: string) => void;
  setNodeId: (nodeId: string) => void;
  setDelegationAmount: (delegationAmount: string) => void;
  setEvmTxHash: (evmTxHash: string) => void;
  setDelegationID: (delegationID: string) => void;
  setPChainTxId: (pChainTxId: string) => void;
  setGlobalError: (globalError: string | null) => void;
  setGlobalSuccess: (globalSuccess: string | null) => void;
  reset: () => void;
}

const initialValues = {
  subnetIdL1: '',
  tokenType: 'native' as TokenType,
  validationId: '',
  nodeId: '',
  delegationAmount: '',
  evmTxHash: '',
  delegationID: '',
  pChainTxId: '',
  globalError: null as string | null,
  globalSuccess: null as string | null,
};

const { getStore: getDelegateStore, useStore: useDelegateStore } = createFlowStore<DelegateState>({
  name: 'delegate-store',
  storeCreator: (set, isTestnet) => ({
    ...initialValues,

    setSubnetIdL1: (subnetIdL1: string) =>
      set({
        subnetIdL1,
        validationId: '',
        nodeId: '',
        delegationAmount: '',
        evmTxHash: '',
        delegationID: '',
        pChainTxId: '',
        globalError: null,
        globalSuccess: null,
      }),

    setTokenType: (tokenType: TokenType) => set({ tokenType }),

    setValidationId: (validationId: string) =>
      set({
        validationId,
        evmTxHash: '',
        delegationID: '',
        pChainTxId: '',
        globalError: null,
        globalSuccess: null,
      }),

    setNodeId: (nodeId: string) => set({ nodeId }),
    setDelegationAmount: (delegationAmount: string) => set({ delegationAmount }),

    setEvmTxHash: (evmTxHash: string) => set({ evmTxHash, pChainTxId: '', globalError: null, globalSuccess: null }),

    setDelegationID: (delegationID: string) => set({ delegationID }),

    setPChainTxId: (pChainTxId: string) => set({ pChainTxId, globalError: null, globalSuccess: null }),

    setGlobalError: (globalError: string | null) => set({ globalError }),
    setGlobalSuccess: (globalSuccess: string | null) => set({ globalSuccess }),

    reset: () => {
      set({ ...initialValues });
      window?.localStorage.removeItem(`${STORE_VERSION}-delegate-store-${isTestnet ? 'testnet' : 'mainnet'}`);
    },
  }),
  partialize: (state) => {
    const { globalError, globalSuccess, ...rest } = state;
    return rest;
  },
});

export { getDelegateStore, useDelegateStore };
