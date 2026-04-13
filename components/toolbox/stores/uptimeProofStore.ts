import { createFlowStore } from './createFlowStore';
import { STORE_VERSION } from './utils';

interface UptimeProofState {
  subnetIdL1: string;
  nodeUrl: string;
  globalError: string | null;

  setSubnetIdL1: (subnetIdL1: string) => void;
  setNodeUrl: (nodeUrl: string) => void;
  setGlobalError: (globalError: string | null) => void;
  reset: () => void;
}

const initialValues = {
  subnetIdL1: '',
  nodeUrl: '',
  globalError: null as string | null,
};

const { getStore: getUptimeProofStore, useStore: useUptimeProofStore } = createFlowStore<UptimeProofState>({
  name: 'uptime-proof-store',
  storeCreator: (set, isTestnet) => ({
    ...initialValues,

    setSubnetIdL1: (subnetIdL1: string) => set({ subnetIdL1, globalError: null }),
    setNodeUrl: (nodeUrl: string) => set({ nodeUrl }),
    setGlobalError: (globalError: string | null) => set({ globalError }),

    reset: () => {
      set({ ...initialValues });
      window?.localStorage.removeItem(`${STORE_VERSION}-uptime-proof-store-${isTestnet ? 'testnet' : 'mainnet'}`);
    },
  }),
  partialize: (state) => {
    const { globalError, ...rest } = state;
    return rest;
  },
});

export { getUptimeProofStore, useUptimeProofStore };
