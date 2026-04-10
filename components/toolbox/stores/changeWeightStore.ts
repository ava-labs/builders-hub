import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { useWalletStore } from "./walletStore";
import { localStorageComp, STORE_VERSION } from "./utils";

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
  subnetIdL1: "",
  nodeId: "",
  validationId: "",
  newWeight: "",
  evmTxHash: "",
  pChainTxId: "",
  globalError: null as string | null,
  globalSuccess: null as string | null,
};

const storeCache: { testnet?: ReturnType<typeof createStore>; mainnet?: ReturnType<typeof createStore> } = {};

const createStore = (isTestnet: boolean) =>
  create<ChangeWeightState>()(
    persist(
      (set) => ({
        ...initialValues,

        setSubnetIdL1: (subnetIdL1: string) =>
          set({
            subnetIdL1,
            nodeId: "",
            validationId: "",
            newWeight: "",
            evmTxHash: "",
            pChainTxId: "",
            globalError: null,
            globalSuccess: null,
          }),

        setNodeId: (nodeId: string) => set({ nodeId }),

        setValidationId: (validationId: string) =>
          set({ validationId, evmTxHash: "", pChainTxId: "", globalError: null, globalSuccess: null }),

        setNewWeight: (newWeight: string) =>
          set({ newWeight, evmTxHash: "", pChainTxId: "", globalError: null, globalSuccess: null }),

        setEvmTxHash: (evmTxHash: string) =>
          set({ evmTxHash, pChainTxId: "", globalError: null, globalSuccess: null }),

        setPChainTxId: (pChainTxId: string) =>
          set({ pChainTxId, globalError: null, globalSuccess: null }),

        setGlobalError: (globalError: string | null) => set({ globalError }),
        setGlobalSuccess: (globalSuccess: string | null) => set({ globalSuccess }),

        reset: () => {
          set({ ...initialValues });
          window?.localStorage.removeItem(
            `${STORE_VERSION}-change-weight-store-${isTestnet ? "testnet" : "mainnet"}`
          );
        },
      }),
      {
        name: `${STORE_VERSION}-change-weight-store-${isTestnet ? "testnet" : "mainnet"}`,
        storage: createJSONStorage(localStorageComp),
        partialize: (state) => {
          const { globalError, globalSuccess, ...rest } = state;
          return rest;
        },
      }
    )
  );

export const getChangeWeightStore = (isTestnet: boolean) => {
  const key = isTestnet ? "testnet" : "mainnet";
  if (!storeCache[key]) {
    storeCache[key] = createStore(isTestnet);
  }
  return storeCache[key]!;
};

export function useChangeWeightStore() {
  const { isTestnet } = useWalletStore();
  return getChangeWeightStore(Boolean(isTestnet))();
}
