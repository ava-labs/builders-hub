import { create } from 'zustand';
import { persist, createJSONStorage, combine } from 'zustand/middleware';
import { localStorageComp, STORE_VERSION } from './utils';
import type { ActivityEvent, Bridge, BridgeId, Remote, RemoteId } from '@/components/toolbox/console/ictt/bridge/types';

interface BridgeState {
  /** All bridges the user has ever set up in this browser, keyed by id. */
  bridges: Record<BridgeId, Bridge>;
  /** Preferred Remote tab per Home, persisted across reloads. */
  selectedRemoteByBridge: Record<BridgeId, RemoteId>;
  /** Last bridge the user worked with, for default-landing. */
  lastActiveBridgeId: BridgeId | null;
  /** Capped activity log (50 entries, FIFO). */
  activityLog: ActivityEvent[];
}

const initialBridgeState: BridgeState = {
  bridges: {},
  selectedRemoteByBridge: {},
  lastActiveBridgeId: null,
  activityLog: [],
};

const ACTIVITY_CAP = 50;

const STORE_KEY = `${STORE_VERSION}-ictt-bridges-storage`;

export const useIcttBridgeStore = create(
  persist(
    combine(initialBridgeState, (set, get) => ({
      upsertBridge: (bridge: Bridge) =>
        set((state) => ({
          bridges: { ...state.bridges, [bridge.id]: bridge },
          lastActiveBridgeId: state.lastActiveBridgeId ?? bridge.id,
        })),

      archiveBridge: (bridgeId: BridgeId) =>
        set((state) => {
          const existing = state.bridges[bridgeId];
          if (!existing) return state;
          return {
            bridges: {
              ...state.bridges,
              [bridgeId]: { ...existing, archivedAt: Date.now() },
            },
          };
        }),

      setLastActiveBridge: (bridgeId: BridgeId | null) => set({ lastActiveBridgeId: bridgeId }),

      upsertRemote: (bridgeId: BridgeId, remote: Remote) =>
        set((state) => {
          const bridge = state.bridges[bridgeId];
          if (!bridge) return state;
          const existingIndex = bridge.remotes.findIndex((r) => r.id === remote.id);
          const nextRemotes =
            existingIndex >= 0
              ? bridge.remotes.map((r, i) => (i === existingIndex ? { ...r, ...remote } : r))
              : [...bridge.remotes, remote];
          return {
            bridges: {
              ...state.bridges,
              [bridgeId]: { ...bridge, remotes: nextRemotes },
            },
            selectedRemoteByBridge: {
              ...state.selectedRemoteByBridge,
              [bridgeId]: remote.id,
            },
          };
        }),

      removeRemote: (bridgeId: BridgeId, remoteId: RemoteId) =>
        set((state) => {
          const bridge = state.bridges[bridgeId];
          if (!bridge) return state;
          const nextRemotes = bridge.remotes.filter((r) => r.id !== remoteId);
          const selected = state.selectedRemoteByBridge[bridgeId];
          const nextSelected = { ...state.selectedRemoteByBridge };
          if (selected === remoteId) {
            if (nextRemotes[0]) nextSelected[bridgeId] = nextRemotes[0].id;
            else delete nextSelected[bridgeId];
          }
          return {
            bridges: {
              ...state.bridges,
              [bridgeId]: { ...bridge, remotes: nextRemotes },
            },
            selectedRemoteByBridge: nextSelected,
          };
        }),

      setSelectedRemote: (bridgeId: BridgeId, remoteId: RemoteId) =>
        set((state) => ({
          selectedRemoteByBridge: { ...state.selectedRemoteByBridge, [bridgeId]: remoteId },
        })),

      pushActivity: (
        event: Omit<ActivityEvent, 'id' | 'timestampMs'> & Partial<Pick<ActivityEvent, 'id' | 'timestampMs'>>,
      ) => {
        const id = event.id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const timestampMs = event.timestampMs ?? Date.now();
        const next: ActivityEvent = {
          id,
          timestampMs,
          bridgeId: event.bridgeId,
          kind: event.kind,
          label: event.label,
          sublabel: event.sublabel,
          chainId: event.chainId,
          txHash: event.txHash,
          icmMessageId: event.icmMessageId,
          remoteId: event.remoteId,
          status: event.status,
        };
        set((state) => ({
          activityLog: [next, ...state.activityLog].slice(0, ACTIVITY_CAP),
        }));
        return id;
      },

      updateActivity: (id: string, patch: Partial<ActivityEvent>) =>
        set((state) => ({
          activityLog: state.activityLog.map((e) => (e.id === id ? { ...e, ...patch } : e)),
        })),

      removeActivity: (id: string) =>
        set((state) => ({
          activityLog: state.activityLog.filter((e) => e.id !== id),
        })),

      clearActivity: (filter?: { bridgeId?: BridgeId; remoteId?: RemoteId }) =>
        set((state) => {
          if (!filter) return { activityLog: [] };
          return {
            activityLog: state.activityLog.filter((e) => {
              if (filter.bridgeId && e.bridgeId !== filter.bridgeId) return true;
              if (filter.remoteId && e.remoteId !== filter.remoteId) return true;
              return false;
            }),
          };
        }),

      replaceState: (next: Partial<BridgeState>) => set(next as BridgeState),

      reset: () => {
        set(initialBridgeState);
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
        bridges: state.bridges,
        selectedRemoteByBridge: state.selectedRemoteByBridge,
        lastActiveBridgeId: state.lastActiveBridgeId,
        activityLog: state.activityLog,
      }),
    },
  ),
);

export const ICTT_BRIDGE_STORE_KEY = STORE_KEY;
