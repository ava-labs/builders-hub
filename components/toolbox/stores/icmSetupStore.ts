import { create } from 'zustand';
import { persist, createJSONStorage, combine } from 'zustand/middleware';
import { localStorageComp, STORE_VERSION } from './utils';
import type {
  Address,
  Hex,
  IcmActivityEvent,
  IcmActivityStatus,
  IcmChainStatus,
  L1Id,
  RelayerConfig,
  RelayerMode,
} from '@/components/toolbox/console/icm/network/types';

const ACTIVITY_CAP = 50;
const STORE_KEY = `${STORE_VERSION}-icm-setup-storage`;

interface IcmSetupState {
  chains: Record<L1Id, IcmChainStatus>;
  relayer: RelayerConfig;
  activityLog: IcmActivityEvent[];
  lastActiveL1Id: L1Id | null;
  lastCounterpartL1Id: L1Id | null;
}

const defaultRelayer: RelayerConfig = {
  mode: 'self-hosted',
  sources: [],
  destinations: [],
  relayerKey: null,
  logLevel: 'info',
  storageLocation: './awm-relayer-storage',
  apiPort: 8080,
  processMissedBlocks: true,
  savedAt: null,
};

const initialIcmState: IcmSetupState = {
  chains: {},
  relayer: defaultRelayer,
  activityLog: [],
  lastActiveL1Id: null,
  lastCounterpartL1Id: null,
};

function makeStatus(l1Id: L1Id): IcmChainStatus {
  return {
    l1Id,
    messengerDeployedAt: null,
    registryAddress: null,
    demoAddress: null,
  };
}

function makeEventId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export const useIcmSetupStore = create(
  persist(
    combine(initialIcmState, (set, get) => ({
      upsertChain: (l1Id: L1Id, patch: Partial<IcmChainStatus>) =>
        set((state) => {
          const existing = state.chains[l1Id] ?? makeStatus(l1Id);
          return {
            chains: {
              ...state.chains,
              [l1Id]: { ...existing, ...patch, l1Id },
            },
          };
        }),

      setMessengerDeployed: (l1Id: L1Id, at: number = Date.now()) =>
        set((state) => {
          const existing = state.chains[l1Id] ?? makeStatus(l1Id);
          return {
            chains: {
              ...state.chains,
              [l1Id]: { ...existing, messengerDeployedAt: at, l1Id },
            },
          };
        }),

      setRegistryAddress: (l1Id: L1Id, address: Address | null) =>
        set((state) => {
          const existing = state.chains[l1Id] ?? makeStatus(l1Id);
          return {
            chains: {
              ...state.chains,
              [l1Id]: { ...existing, registryAddress: address, l1Id },
            },
          };
        }),

      setDemoAddress: (l1Id: L1Id, address: Address | null) =>
        set((state) => {
          const existing = state.chains[l1Id] ?? makeStatus(l1Id);
          return {
            chains: {
              ...state.chains,
              [l1Id]: { ...existing, demoAddress: address, l1Id },
            },
          };
        }),

      setRelayerMode: (mode: RelayerMode) =>
        set((state) => ({
          relayer: { ...state.relayer, mode },
        })),

      toggleRelayerSource: (l1Id: L1Id) =>
        set((state) => {
          const has = state.relayer.sources.includes(l1Id);
          return {
            relayer: {
              ...state.relayer,
              sources: has ? state.relayer.sources.filter((id) => id !== l1Id) : [...state.relayer.sources, l1Id],
            },
          };
        }),

      toggleRelayerDestination: (l1Id: L1Id) =>
        set((state) => {
          const has = state.relayer.destinations.includes(l1Id);
          return {
            relayer: {
              ...state.relayer,
              destinations: has
                ? state.relayer.destinations.filter((id) => id !== l1Id)
                : [...state.relayer.destinations, l1Id],
            },
          };
        }),

      setRelayerSources: (sources: L1Id[]) =>
        set((state) => ({
          relayer: { ...state.relayer, sources: [...sources] },
        })),

      setRelayerDestinations: (destinations: L1Id[]) =>
        set((state) => ({
          relayer: { ...state.relayer, destinations: [...destinations] },
        })),

      setRelayerKey: (key: Hex | null) =>
        set((state) => ({
          relayer: { ...state.relayer, relayerKey: key },
        })),

      setRelayerSettings: (
        patch: Partial<Pick<RelayerConfig, 'logLevel' | 'storageLocation' | 'apiPort' | 'processMissedBlocks'>>,
      ) =>
        set((state) => ({
          relayer: { ...state.relayer, ...patch },
        })),

      saveRelayerConfig: (at: number = Date.now()) =>
        set((state) => ({
          relayer: { ...state.relayer, savedAt: at },
        })),

      setLastActiveL1: (l1Id: L1Id | null) => set({ lastActiveL1Id: l1Id }),
      setLastCounterpartL1: (l1Id: L1Id | null) => set({ lastCounterpartL1Id: l1Id }),

      pushActivity: (
        event: Omit<IcmActivityEvent, 'id' | 'createdAt' | 'updatedAt'> &
          Partial<Pick<IcmActivityEvent, 'id' | 'createdAt' | 'updatedAt'>>,
      ) => {
        const id = event.id ?? makeEventId();
        const now = Date.now();
        const next: IcmActivityEvent = {
          id,
          kind: event.kind,
          status: event.status,
          l1Id: event.l1Id,
          counterpartL1Id: event.counterpartL1Id,
          txHash: event.txHash,
          icmMessageId: event.icmMessageId,
          pairedWith: event.pairedWith,
          label: event.label,
          sublabel: event.sublabel,
          createdAt: event.createdAt ?? now,
          updatedAt: event.updatedAt ?? now,
        };
        set((state) => ({
          activityLog: [next, ...state.activityLog].slice(0, ACTIVITY_CAP),
        }));
        return id;
      },

      updateActivity: (id: string, patch: Partial<IcmActivityEvent>) =>
        set((state) => ({
          activityLog: state.activityLog.map((e) => (e.id === id ? { ...e, ...patch, updatedAt: Date.now() } : e)),
        })),

      bindDelivery: (input: { sourceActivityId: string; txHash?: Hex; icmMessageId?: Hex; label?: string }) => {
        const source = get().activityLog.find((e) => e.id === input.sourceActivityId);
        if (!source) return null;
        if (source.pairedWith) return source.pairedWith;
        const deliveredId = makeEventId();
        const now = Date.now();
        const delivered: IcmActivityEvent = {
          id: deliveredId,
          kind: 'message-delivered',
          status: 'delivered',
          l1Id: source.counterpartL1Id ?? source.l1Id,
          counterpartL1Id: source.l1Id,
          txHash: input.txHash,
          icmMessageId: input.icmMessageId ?? source.icmMessageId,
          pairedWith: source.id,
          label: input.label ?? 'Message delivered on destination',
          createdAt: now,
          updatedAt: now,
        };
        set((state) => ({
          activityLog: [
            delivered,
            ...state.activityLog.map((e) =>
              e.id === source.id
                ? { ...e, status: 'delivered' as IcmActivityStatus, pairedWith: deliveredId, updatedAt: now }
                : e,
            ),
          ].slice(0, ACTIVITY_CAP),
        }));
        return deliveredId;
      },

      markFailed: (id: string, reason?: string) =>
        set((state) => ({
          activityLog: state.activityLog.map((e) =>
            e.id === id
              ? { ...e, status: 'failed' as IcmActivityStatus, sublabel: reason ?? e.sublabel, updatedAt: Date.now() }
              : e,
          ),
        })),

      removeActivity: (id: string) =>
        set((state) => ({
          activityLog: state.activityLog.filter((e) => e.id !== id),
        })),

      clearActivity: () => set({ activityLog: [] }),

      reset: () => {
        set(initialIcmState);
        if (typeof window !== 'undefined') {
          try {
            window.localStorage.removeItem(STORE_KEY);
          } catch {}
        }
      },

      _internalGet: () => get(),
    })),
    {
      name: STORE_KEY,
      storage: createJSONStorage(localStorageComp),
      partialize: (state) => ({
        chains: state.chains,
        relayer: state.relayer,
        activityLog: state.activityLog,
        lastActiveL1Id: state.lastActiveL1Id,
        lastCounterpartL1Id: state.lastCounterpartL1Id,
      }),
    },
  ),
);

export const ICM_SETUP_STORE_KEY = STORE_KEY;
