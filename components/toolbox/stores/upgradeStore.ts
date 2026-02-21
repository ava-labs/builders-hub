import { create } from "zustand";
import { persist, createJSONStorage, combine } from 'zustand/middleware';
import { localStorageComp, STORE_VERSION } from "./utils";
import { UpgradeEntry, PrecompileKey } from "@/components/toolbox/console/layer-1/upgrade/types";

function generateId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function defaultEntry(): UpgradeEntry {
  return {
    id: generateId(),
    precompileKey: 'txAllowListConfig' as PrecompileKey,
    action: 'enable',
    blockTimestamp: Math.floor(Date.now() / 1000) + 3600,
    adminAddresses: [],
    managerAddresses: [],
    enabledAddresses: [],
  };
}

const upgradeInitialState = {
  entries: [] as UpgradeEntry[],
};

// Singleton store (not network-specific — upgrade.json is a local JSON file, no wallet needed)
export const upgradeStore = create(
  persist(
    combine(upgradeInitialState, (set) => ({
      addEntry: () =>
        set(state => ({ entries: [...state.entries, defaultEntry()] })),

      removeEntry: (id: string) =>
        set(state => ({ entries: state.entries.filter(e => e.id !== id) })),

      updateEntry: (id: string, patch: Partial<UpgradeEntry>) =>
        set(state => ({
          entries: state.entries.map(e => (e.id === id ? { ...e, ...patch } : e)),
        })),

      reset: () => {
        set({ entries: [] });
        if (typeof window !== 'undefined') {
          window.localStorage.removeItem(`${STORE_VERSION}-upgrade-store`);
        }
      },
    })),
    {
      name: `${STORE_VERSION}-upgrade-store`,
      storage: createJSONStorage(localStorageComp),
    },
  ),
);

export const useUpgradeStore = upgradeStore;
