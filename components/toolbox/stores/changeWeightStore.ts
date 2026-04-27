import { createFlowStore } from './createFlowStore';
import { STORE_VERSION } from './utils';

interface ChangeWeightState {
  subnetIdL1: string;
  nodeId: string;
  validationId: string;
  newWeight: string;
  evmTxHash: string;
  pChainTxId: string;
  globalError: string | null;
  globalSuccess: string | null;

  setSubnetIdL1: (subnetIdL1: string) => void;
  setNodeId: (nodeId: string) => void;
  setValidationId: (validationId: string) => void;
  setNewWeight: (newWeight: string) => void;
  setEvmTxHash: (evmTxHash: string) => void;
  setPChainTxId: (pChainTxId: string) => void;
  setGlobalError: (globalError: string | null) => void;
  setGlobalSuccess: (globalSuccess: string | null) => void;
  reset: () => void;
}

const initialValues = {
  subnetIdL1: '',
  nodeId: '',
  validationId: '',
  newWeight: '',
  evmTxHash: '',
  pChainTxId: '',
  globalError: null as string | null,
  globalSuccess: null as string | null,
};

const { getStore: getChangeWeightStore, useStore: useChangeWeightStore } = createFlowStore<ChangeWeightState>({
  name: 'change-weight-store',
  storeCreator: (set, isTestnet) => ({
    ...initialValues,

    setSubnetIdL1: (subnetIdL1: string) =>
      set({
        subnetIdL1,
        nodeId: '',
        validationId: '',
        newWeight: '',
        evmTxHash: '',
        pChainTxId: '',
        globalError: null,
        globalSuccess: null,
      }),

    setNodeId: (nodeId: string) => set({ nodeId }),

    setValidationId: (validationId: string) =>
      set({ validationId, evmTxHash: '', pChainTxId: '', globalError: null, globalSuccess: null }),

    setNewWeight: (newWeight: string) =>
      set({ newWeight, evmTxHash: '', pChainTxId: '', globalError: null, globalSuccess: null }),

    setEvmTxHash: (evmTxHash: string) => set({ evmTxHash, pChainTxId: '', globalError: null, globalSuccess: null }),

    setPChainTxId: (pChainTxId: string) => set({ pChainTxId, globalError: null, globalSuccess: null }),

    setGlobalError: (globalError: string | null) => set({ globalError }),
    setGlobalSuccess: (globalSuccess: string | null) => set({ globalSuccess }),

    reset: () => {
      set({ ...initialValues });
      window?.localStorage.removeItem(`${STORE_VERSION}-change-weight-store-${isTestnet ? 'testnet' : 'mainnet'}`);
    },
  }),
  partialize: (state) => {
    const { globalError, globalSuccess, ...rest } = state;
    return rest;
  },
});

export { getChangeWeightStore, useChangeWeightStore };
