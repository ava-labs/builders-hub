import { create } from 'zustand';
import { persist, createJSONStorage, combine } from 'zustand/middleware';
import { localStorageComp, STORE_VERSION } from './utils';
import type {
  ActivityEvent,
  ActivityStatus,
  Address,
  Bridge,
  BridgeId,
  Remote,
  RemoteId,
} from '@/components/toolbox/console/ictt/bridge/types';

interface BridgeState {
  /** All bridges the user has ever set up in this browser, keyed by id. */
  bridges: Record<BridgeId, Bridge>;
  /** Preferred Remote tab per Home, persisted across reloads. */
  selectedRemoteByBridge: Record<BridgeId, RemoteId>;
  /** Last bridge the user worked with, for default-landing. */
  lastActiveBridgeId: BridgeId | null;
  /** Capped activity log (50 entries, FIFO). */
  activityLog: ActivityEvent[];
  /** Phase 1 selection that hasn't been committed to a Bridge yet. Persists
   *  across phase navigation and page reloads. Cleared by `useDeployTokenHome`
   *  after a bridge is created (the bridge now owns `underlyingTokenAddress`). */
  pendingTokenAddress: Address | null;
  /** Phase 3 destination selection that hasn't been deployed yet. Single source
   *  of truth shared by `BridgeRibbon` and `RemoteInspector`. Cleared by
   *  `useDeployTokenRemote` after a Remote record is created. */
  pendingDestinationL1Id: string | null;
  /** True when the user has explicitly asked to start fresh. Suppresses the
   *  "auto-revive `visibleBridges[0]` as active" fallback in `useBridgeContext`
   *  so the reset isn't immediately undone. Cleared automatically by
   *  `upsertBridge` (a new bridge is being committed) or `selectBridge`. */
  newBridgeIntent: boolean;
}

const initialBridgeState: BridgeState = {
  bridges: {},
  selectedRemoteByBridge: {},
  lastActiveBridgeId: null,
  activityLog: [],
  pendingTokenAddress: null,
  pendingDestinationL1Id: null,
  newBridgeIntent: false,
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
          // Committing a bridge clears any "start fresh" intent — we now have
          // a concrete bridge to be active on, so the fallback can resume.
          newBridgeIntent: false,
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
          // Dedup by destination L1: the user's mental model is one remote per
          // chain per bridge. A new TokenRemote deploy on the same L1 (whether
          // by accident or by intent) REPLACES the existing entry rather than
          // creating a duplicate. The merge below keeps incoming fields, which
          // implicitly resets `registeredAt`/`collateralizedAt` for a fresh
          // contract — correct semantics since the address changed.
          // Falls back to `id` match so a `removeRemote` + `upsertRemote`
          // round-trip with the same id still updates the right entry.
          const existingIndex = bridge.remotes.findIndex((r) => r.l1Id === remote.l1Id || r.id === remote.id);
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

      setPendingTokenAddress: (address: Address | null) => set({ pendingTokenAddress: address }),

      setPendingDestinationL1Id: (id: string | null) => set({ pendingDestinationL1Id: id }),

      // Clears the per-flow state that ties the UI to an existing bridge so the
      // user can start a fresh setup. Bridges themselves stay in `bridges` and
      // remain reachable via a future "My bridges" picker.
      //
      // `newBridgeIntent: true` is load-bearing: without it, `useBridgeContext`
      // would auto-fall-back to `visibleBridges[0]` and immediately re-promote
      // it via the sync effect, undoing the reset within the same tick.
      //
      // TODO(my-bridges): wire up a `selectBridge(id)` action and a list view
      // so users can switch back to any persisted bridge without going through
      // a fresh start.
      startNewBridge: () =>
        set({
          lastActiveBridgeId: null,
          pendingTokenAddress: null,
          pendingDestinationL1Id: null,
          newBridgeIntent: true,
        }),

      // Future-proof: explicit bridge selection always lifts the new-bridge
      // intent. Currently unused, but exporting the action now means the
      // future "My bridges" picker is a one-line UI hook.
      selectBridge: (bridgeId: BridgeId) =>
        set({
          lastActiveBridgeId: bridgeId,
          newBridgeIntent: false,
        }),

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
          pairedWith: event.pairedWith,
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

      /**
       * Pair a destination-chain delivery (`receive` or `register-received`)
       * with a pending source event. Idempotent: if the source already has a
       * `pairedWith`, the call is a no-op. The source row flips to `delivered`
       * and both rows reference each other via `pairedWith`.
       *
       * Called by `useDeliveryWatcher` when it observes a matching
       * `ReceiveCrossChainMessage` on the destination chain — either via the
       * mount-time getLogs backfill or the live event subscription.
       */
      bindReceive: (input: {
        sourceActivityId: string;
        txHash: Address;
        chainId?: string | number;
        blockNumber?: bigint;
        kind: 'receive' | 'register-received';
        label?: string;
        sublabel?: string;
      }) => {
        const source = get().activityLog.find((e) => e.id === input.sourceActivityId);
        if (!source) return null;
        if (source.pairedWith) return source.pairedWith;
        const receiveId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const label =
          input.label ?? (input.kind === 'receive' ? 'Tokens received on destination' : 'Remote registered with Home');
        const receiveEvent: ActivityEvent = {
          id: receiveId,
          timestampMs: Date.now(),
          bridgeId: source.bridgeId,
          remoteId: source.remoteId,
          kind: input.kind,
          label,
          sublabel: input.sublabel,
          chainId: input.chainId,
          txHash: input.txHash,
          icmMessageId: source.icmMessageId,
          status: 'delivered',
          pairedWith: source.id,
        };
        set((state) => ({
          activityLog: [
            receiveEvent,
            ...state.activityLog.map((e) =>
              e.id === source.id ? { ...e, status: 'delivered' as ActivityStatus, pairedWith: receiveId } : e,
            ),
          ].slice(0, ACTIVITY_CAP),
        }));
        return receiveId;
      },

      /**
       * Mark an activity row as failed with an optional reason. Currently used
       * by the future delivery-timeout path and the ICM detail sheet's manual
       * "mark as failed" affordance; not auto-emitted in this PR.
       */
      markFailed: (id: string, reason?: string) =>
        set((state) => ({
          activityLog: state.activityLog.map((e) =>
            e.id === id ? { ...e, status: 'failed' as ActivityStatus, sublabel: reason ?? e.sublabel } : e,
          ),
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
        pendingTokenAddress: state.pendingTokenAddress,
        pendingDestinationL1Id: state.pendingDestinationL1Id,
        // Persist the intent so a "Start new bridge" survives reload — otherwise
        // a refresh would revive the old bridge and look like the reset failed.
        newBridgeIntent: state.newBridgeIntent,
      }),
      // One-shot cleanup for legacy persisted state where the same
      // destination L1 ended up as multiple `Remote` entries on a single
      // bridge (one per redeploy address). The current `upsertRemote`
      // prevents new dupes by dedup'ing on `l1Id`; this rehydrate pass
      // collapses any historical ones too. Last entry per `l1Id` wins
      // (typically the most recent deploy). When the previously-selected
      // remote gets dropped, re-point `selectedRemoteByBridge` to the
      // kept entry so the BridgeRibbon doesn't reference a missing id.
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        let mutated = false;
        const nextBridges: Record<BridgeId, Bridge> = { ...state.bridges };
        const nextSelected: Record<BridgeId, RemoteId> = { ...state.selectedRemoteByBridge };
        for (const [id, bridge] of Object.entries(state.bridges) as [BridgeId, Bridge][]) {
          const byL1 = new Map<string, Remote>();
          for (const r of bridge.remotes) {
            byL1.set(r.l1Id, r);
          }
          const deduped = Array.from(byL1.values());
          if (deduped.length === bridge.remotes.length) continue;
          mutated = true;
          nextBridges[id] = { ...bridge, remotes: deduped };
          const sel = nextSelected[id];
          const stillThere = sel ? deduped.some((r) => r.id === sel) : false;
          if (!stillThere) {
            if (deduped[0]) nextSelected[id] = deduped[0].id;
            else delete nextSelected[id];
          }
        }
        if (mutated) {
          state.bridges = nextBridges;
          state.selectedRemoteByBridge = nextSelected;
        }
      },
    },
  ),
);

export const ICTT_BRIDGE_STORE_KEY = STORE_KEY;
