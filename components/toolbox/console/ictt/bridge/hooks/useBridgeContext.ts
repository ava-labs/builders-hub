'use client';

import { useEffect, useMemo } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { useSelectedL1, useL1ByChainId } from '@/components/toolbox/stores/l1ListStore';
import { useIcttBridgeStore } from '@/components/toolbox/stores/iccttBridgeStore';
import type { Address, Bridge, BridgePhase, BridgeStatus, Remote } from '../types';
import { derivePhaseStatus, highestReachablePhase } from '../utils/derive-status';
import { useMigrationOnce } from './useMigrationOnce';

export interface BridgeContextValue {
  // Phase state derived from URL [step] param.
  phase: BridgePhase;
  setRemoteId: (next: string | null) => void;

  // Bridge graph state.
  activeBridgeId: Bridge['id'] | null;
  bridge: Bridge | null;
  remote: Remote | null;
  remotes: Remote[];
  selectedRemoteId: Remote['id'] | null;
  selectRemote: (id: Remote['id']) => void;
  removeRemoteFromView: (id: Remote['id']) => void;

  // Resolved L1s for cards / wallet checks.
  homeL1: ReturnType<typeof useL1ByChainId> | null;
  remoteL1: ReturnType<typeof useL1ByChainId> | null;
  isWalletOnHome: boolean;
  isWalletOnRemote: boolean;

  // Status / readiness.
  phaseStatus: Record<BridgePhase, BridgeStatus>;
  highestReachablePhase: BridgePhase;

  // Pre-bridge token (Phase 1 may run before any bridge is created).
  pendingTokenAddress: Address | null;
  setPendingTokenAddress: (a: Address | null) => void;
  effectiveTokenAddress: Address | null;

  // Pre-deploy destination selection (Phase 3, before TokenRemote exists).
  pendingDestinationL1Id: string | null;
  setPendingDestinationL1Id: (id: string | null) => void;

  /** Reset the active bridge association so the user can start fresh. */
  startNewBridge: () => void;
  /** True while the user has explicitly chosen to start a fresh bridge.
   *  Consumers can branch on this (e.g. suppress "editing existing bridge"
   *  callouts) without re-checking bridge nullability. */
  newBridgeIntent: boolean;

  // Migration / readiness flags.
  migrationReady: boolean;
}

const VALID: ReadonlyArray<BridgePhase> = ['token', 'home', 'remote', 'register', 'collateral', 'live'];

function normalizePhase(input: string | null | undefined, fallback: BridgePhase = 'token'): BridgePhase {
  if (input && VALID.includes(input as BridgePhase)) return input as BridgePhase;
  return fallback;
}

interface UseBridgeContextOptions {
  /** Current step key from the URL. Falls back to ?phase= for legacy bookmarks. */
  step?: string;
}

export function useBridgeContext({ step }: UseBridgeContextOptions = {}): BridgeContextValue {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const migration = useMigrationOnce();

  // Phase from URL — falls back to ?phase= search param for backwards compat.
  const fallbackPhase = normalizePhase(searchParams.get('phase'));
  const phase = normalizePhase(step, fallbackPhase);

  const bridgesRecord = useIcttBridgeStore((s) => s.bridges);
  const lastActiveBridgeId = useIcttBridgeStore((s) => s.lastActiveBridgeId);
  const setLastActiveBridge = useIcttBridgeStore((s) => s.setLastActiveBridge);
  const selectedRemoteByBridge = useIcttBridgeStore((s) => s.selectedRemoteByBridge);
  const setSelectedRemoteAction = useIcttBridgeStore((s) => s.setSelectedRemote);
  const removeRemoteAction = useIcttBridgeStore((s) => s.removeRemote);
  const activityLog = useIcttBridgeStore((s) => s.activityLog);
  const newBridgeIntent = useIcttBridgeStore((s) => s.newBridgeIntent);

  const visibleBridges = useMemo(() => Object.values(bridgesRecord).filter((b) => !b.archivedAt), [bridgesRecord]);

  // When the user has explicitly asked for a fresh start (`newBridgeIntent`),
  // bypass the auto-fallback completely. Otherwise we'd quietly re-promote the
  // previous bridge — that's the exact bug the intent flag exists to prevent.
  const activeBridgeId = useMemo<Bridge['id'] | null>(() => {
    if (newBridgeIntent) return null;
    if (lastActiveBridgeId && bridgesRecord[lastActiveBridgeId]) return lastActiveBridgeId;
    return visibleBridges[0]?.id ?? null;
  }, [bridgesRecord, lastActiveBridgeId, newBridgeIntent, visibleBridges]);

  // Same guard on the sync effect — without it, the fallback would still leak
  // back into `lastActiveBridgeId` once `newBridgeIntent` flips off.
  useEffect(() => {
    if (newBridgeIntent) return;
    if (activeBridgeId && activeBridgeId !== lastActiveBridgeId) {
      setLastActiveBridge(activeBridgeId);
    }
  }, [activeBridgeId, lastActiveBridgeId, newBridgeIntent, setLastActiveBridge]);

  const bridge = activeBridgeId ? (bridgesRecord[activeBridgeId] ?? null) : null;
  const remotes = bridge?.remotes ?? [];

  const urlRemote = searchParams.get('remote');
  const persistedSelection = activeBridgeId ? (selectedRemoteByBridge[activeBridgeId] ?? null) : null;

  const selectedRemoteId = useMemo<Remote['id'] | null>(() => {
    if (urlRemote && remotes.some((r) => r.id === urlRemote)) return urlRemote as Remote['id'];
    if (persistedSelection && remotes.some((r) => r.id === persistedSelection)) return persistedSelection;
    return remotes[0]?.id ?? null;
  }, [persistedSelection, remotes, urlRemote]);

  const remote = useMemo<Remote | null>(() => {
    if (!selectedRemoteId) return null;
    return remotes.find((r) => r.id === selectedRemoteId) ?? null;
  }, [remotes, selectedRemoteId]);

  // Pre-bridge tentative token (Phase 1 with no bridge yet). Stored in Zustand
  // so it survives phase navigation — TokenStep unmounts when the user clicks
  // "Continue to Home", so React state would be lost otherwise.
  //
  // Resolution priority: a non-null `pendingTokenAddress` always wins. This lets
  // a user start a new bridge (or re-pick a token in Phase 1) without the
  // previously-deployed bridge's `underlyingTokenAddress` shadowing the fresh
  // value. `useDeployTokenHome` clears `pendingTokenAddress` after `upsertBridge`,
  // so once a bridge is created the bridge's value is authoritative again.
  const pendingTokenAddress = useIcttBridgeStore((s) => s.pendingTokenAddress);
  const setPendingTokenAddress = useIcttBridgeStore((s) => s.setPendingTokenAddress);
  const effectiveTokenAddress = pendingTokenAddress ?? bridge?.underlyingTokenAddress ?? null;

  // Pre-deploy destination selection (shared by the ribbon Sheet picker AND the
  // Remote inspector dropdown, so a pick in either surface updates both).
  const pendingDestinationL1Id = useIcttBridgeStore((s) => s.pendingDestinationL1Id);
  const setPendingDestinationL1Id = useIcttBridgeStore((s) => s.setPendingDestinationL1Id);
  const startNewBridge = useIcttBridgeStore((s) => s.startNewBridge);

  const selectedL1 = useSelectedL1();
  const homeL1 = useL1ByChainId(bridge?.homeL1Id ?? '') ?? selectedL1 ?? null;
  const remoteL1 = useL1ByChainId(remote?.l1Id ?? '') ?? null;
  const walletChainId = useWalletStore((s) => s.walletChainId);
  const isWalletOnHome = Boolean(homeL1 && homeL1.evmChainId === walletChainId);
  const isWalletOnRemote = Boolean(remoteL1 && remoteL1.evmChainId === walletChainId);

  // Phase status derivation, considering pending writes from the activity log.
  const pendingKinds = useMemo(() => {
    const set = new Set<string>();
    for (const event of activityLog) {
      if (bridge && event.bridgeId !== bridge.id) continue;
      if (remote && event.remoteId && event.remoteId !== remote.id) continue;
      if (event.status !== 'pending') continue;
      switch (event.kind) {
        case 'deploy':
          set.add('deploy-token');
          set.add('deploy-home');
          set.add('deploy-remote');
          break;
        case 'register-sent':
        case 'register-received':
          set.add('register-sent');
          break;
        case 'collateral':
          set.add('collateral');
          break;
        case 'send':
        case 'receive':
          set.add('send');
          break;
        default:
          break;
      }
    }
    return set;
  }, [activityLog, bridge, remote]);

  const phaseStatus = useMemo(
    () => derivePhaseStatus({ bridge, remote, pendingKinds }),
    [bridge, remote, pendingKinds],
  );
  const reachable = useMemo(() => highestReachablePhase(phaseStatus), [phaseStatus]);

  const setRemoteIdInUrl = (next: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next === null) params.delete('remote');
    else params.set('remote', next);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  };

  const selectRemote = (id: Remote['id']) => {
    if (!activeBridgeId) return;
    setSelectedRemoteAction(activeBridgeId, id);
    setRemoteIdInUrl(id);
  };

  const removeRemoteFromView = (id: Remote['id']) => {
    if (!activeBridgeId) return;
    removeRemoteAction(activeBridgeId, id);
  };

  return {
    phase,
    setRemoteId: setRemoteIdInUrl,
    activeBridgeId,
    bridge,
    remote,
    remotes,
    selectedRemoteId,
    selectRemote,
    removeRemoteFromView,
    homeL1,
    remoteL1,
    isWalletOnHome,
    isWalletOnRemote,
    phaseStatus,
    highestReachablePhase: reachable,
    pendingTokenAddress,
    setPendingTokenAddress,
    effectiveTokenAddress,
    pendingDestinationL1Id,
    setPendingDestinationL1Id,
    startNewBridge,
    newBridgeIntent,
    migrationReady: migration.ran,
  };
}
