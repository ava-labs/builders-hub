import { create, type StoreApi, type UseBoundStore } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { useWalletStore } from "./walletStore";
import { localStorageComp, STORE_VERSION } from "./utils";

// Registry for resetAllStores
const flowStoreRegistry: Array<{ reset: (isTestnet?: boolean) => void }> = [];

export function getRegisteredFlowStores() {
  return flowStoreRegistry;
}

type StoreCache<T> = {
  testnet?: UseBoundStore<StoreApi<T>>;
  mainnet?: UseBoundStore<StoreApi<T>>;
};

interface FlowStoreConfig<T> {
  /** localStorage key suffix, e.g. "add-validator-store" */
  name: string;
  /**
   * Factory that receives `set` and `isTestnet` and returns the full
   * state + actions object (including a `reset()` method).
   */
  storeCreator: (
    set: StoreApi<T>["setState"],
    isTestnet: boolean
  ) => T;
  /**
   * Optional partialize function to exclude transient fields from persistence.
   * If omitted, the entire state is persisted.
   */
  partialize?: (state: T) => Partial<T>;
}

/**
 * Factory for creating testnet/mainnet-aware Zustand stores with localStorage
 * persistence. Produces a `getStore(isTestnet)` accessor and a `useStore()` hook
 * that automatically reads `isTestnet` from `useWalletStore`.
 *
 * Each created store is auto-registered for bulk reset via `getRegisteredFlowStores()`.
 */
export function createFlowStore<T extends Record<string, any>>(
  config: FlowStoreConfig<T>
) {
  const { name, storeCreator, partialize } = config;
  const storeCache: StoreCache<T> = {};

  const storageKey = (isTestnet: boolean) =>
    `${STORE_VERSION}-${name}-${isTestnet ? "testnet" : "mainnet"}`;

  const buildStore = (isTestnet: boolean) =>
    create<T>()(
      persist(
        (set) => storeCreator(set, isTestnet),
        {
          name: storageKey(isTestnet),
          storage: createJSONStorage(localStorageComp),
          ...(partialize ? { partialize: partialize as (state: T) => object } : {}),
        }
      )
    );

  const getStore = (isTestnet: boolean): UseBoundStore<StoreApi<T>> => {
    const key = isTestnet ? "testnet" : "mainnet";
    if (!storeCache[key]) {
      storeCache[key] = buildStore(isTestnet);
    }
    return storeCache[key]!;
  };

  /**
   * React hook that returns the fully-resolved state for the current network.
   * Equivalent to `getStore(isTestnet)()`.
   */
  const useStore = () => {
    const { isTestnet } = useWalletStore();
    return getStore(Boolean(isTestnet))();
  };

  /**
   * React hook that returns the bound store (not the state) for the current network.
   * Callers can use selectors: `useStoreApi()((s) => s.field)`.
   */
  const useStoreApi = () => {
    const { isTestnet } = useWalletStore();
    return getStore(Boolean(isTestnet));
  };

  // Register for bulk reset
  flowStoreRegistry.push({
    reset: (isTestnet?: boolean) => {
      if (typeof isTestnet !== "boolean") {
        getStore(true).getState().reset();
        getStore(false).getState().reset();
      } else {
        getStore(isTestnet).getState().reset();
      }
    },
  });

  return { getStore, useStore, useStoreApi };
}
