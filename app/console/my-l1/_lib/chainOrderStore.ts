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
//
// `hidden` is the user's per-network "I don't want to see this in the
// rail" set, also keyed by pill key. Used for managed L1s (server-backed,
// 3-day TTL) which can't be removed from `l1ListStore` because the next
// `useMyL1s` poll would re-add them. Hiding is purely visual — the
// underlying node fleet stays running. Decommissioning still happens via
// the existing per-node Delete button in the L1 detail's Managed Nodes
// card.

export type ChainOrderState = {
  order: string[];
  hidden: string[];
  setOrder: (order: string[]) => void;
  hide: (key: string) => void;
  unhide: (key: string) => void;
  unhideAll: () => void;
  reset: () => void;
};

const initialState: { order: string[]; hidden: string[] } = { order: [], hidden: [] };

let testnetSingleton: ReturnType<typeof createOrderStore> | null = null;
let mainnetSingleton: ReturnType<typeof createOrderStore> | null = null;

function createOrderStore(storageKey: string) {
  return create<ChainOrderState>()(
    persist(
      (set) => ({
        ...initialState,
        setOrder: (order: string[]) => set({ order }),
        // hide/unhide treat `hidden` as a Set semantically — dedupe on
        // hide, no-op when unhiding a key that wasn't there. Spread into
        // a fresh array so persisted state never mutates in place
        // (Zustand's `persist` snapshots references, so mutation would
        // skip the rehydrate path on the next page load).
        hide: (key: string) =>
          set((s) => (s.hidden.includes(key) ? s : { hidden: [...s.hidden, key] })),
        unhide: (key: string) =>
          set((s) => ({ hidden: s.hidden.filter((k) => k !== key) })),
        unhideAll: () => set({ hidden: [] }),
        reset: () => {
          set(initialState);
          if (typeof window !== 'undefined') window.localStorage.removeItem(storageKey);
        },
      }),
      {
        name: storageKey,
        storage: createJSONStorage(localStorageComp),
        // Older persisted blobs (pre-`hidden`) won't carry the field —
        // merge them with the initial state's empty array so reading
        // `hidden` doesn't blow up on first hydration after upgrade.
        merge: (persisted, current) => {
          const p = (persisted ?? {}) as Partial<ChainOrderState>;
          return {
            ...current,
            order: Array.isArray(p.order) ? p.order : current.order,
            hidden: Array.isArray(p.hidden) ? p.hidden : current.hidden,
          };
        },
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

export const useHiddenL1s = (): string[] => {
  const store = useChainOrderStore();
  return store((s) => s.hidden);
};

// Stable pill key — must match what SwitchChainRail and DashboardBody use
// to identify each entry across the order list.
export function chainKey(l1: { evmChainId: number | null; subnetId: string }): string {
  return l1.evmChainId !== null ? `chain:${l1.evmChainId}` : `subnet:${l1.subnetId}`;
}
