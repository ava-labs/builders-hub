'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { useMemo } from 'react';
import { localStorageComp, STORE_VERSION } from '@/components/toolbox/stores/utils';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';

// User-defined ordering of chain pills in the My L1 dashboard's "Switch
// Chain" rail. Stored per-network so the user's testnet preference doesn't
// drag mainnet around (and vice versa).
//
// `order` is a list of pill keys — `chain:<evmChainId>` for L1s with an
// EVM id, `subnet:<subnetId>` for entries that haven't surfaced one yet.
// The order is *advisory*: any L1 visible in the dashboard but missing
// from this list falls through to its natural position at the end. That
// keeps newly-added chains discoverable without forcing every interaction
// to mutate the list.

export type ChainOrderState = {
  order: string[];
  setOrder: (order: string[]) => void;
  reset: () => void;
};

const initialState: { order: string[] } = { order: [] };

let testnetSingleton: ReturnType<typeof createOrderStore> | null = null;
let mainnetSingleton: ReturnType<typeof createOrderStore> | null = null;

function createOrderStore(storageKey: string) {
  return create<ChainOrderState>()(
    persist(
      (set) => ({
        ...initialState,
        setOrder: (order: string[]) => set({ order }),
        reset: () => {
          set(initialState);
          if (typeof window !== 'undefined') window.localStorage.removeItem(storageKey);
        },
      }),
      {
        name: storageKey,
        storage: createJSONStorage(localStorageComp),
      },
    ),
  );
}

export const getChainOrderStore = (isTestnet: boolean) => {
  if (isTestnet) {
    if (!testnetSingleton) {
      testnetSingleton = createOrderStore(`${STORE_VERSION}-chain-order-store-testnet`);
    }
    return testnetSingleton;
  }
  if (!mainnetSingleton) {
    mainnetSingleton = createOrderStore(`${STORE_VERSION}-chain-order-store-mainnet`);
  }
  return mainnetSingleton;
};

export const useChainOrderStore = () => {
  const { isTestnet } = useWalletStore();
  return useMemo(() => getChainOrderStore(Boolean(isTestnet)), [isTestnet]);
};

export const useChainOrder = (): string[] => {
  const store = useChainOrderStore();
  return store((s) => s.order);
};

// Stable pill key — must match what SwitchChainRail and DashboardBody use
// to identify each entry across the order list.
export function chainKey(l1: { evmChainId: number | null; subnetId: string }): string {
  return l1.evmChainId !== null ? `chain:${l1.evmChainId}` : `subnet:${l1.subnetId}`;
}
