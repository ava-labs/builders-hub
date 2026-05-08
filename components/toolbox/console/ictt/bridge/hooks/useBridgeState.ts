'use client';

import { useCallback, useMemo, useState } from 'react';
import { useL1ByChainId } from '@/components/toolbox/stores/l1ListStore';
import { useIcttBridgeStore } from '@/components/toolbox/stores/iccttBridgeStore';
import type { BridgeId, BridgeState, RemoteId } from '../types';
import { derivePhaseStatus, highestReachablePhase } from '../utils/derive-status';

interface UseBridgeStateOptions {
  bridgeId: BridgeId | null;
  remoteId?: RemoteId | null;
}

/**
 * Read-only aggregator for PR 2. Reads the bridge graph from the store
 * and derives phase status. On-chain reads (token symbol/decimals/balance,
 * `getRemoteTokenTransferrerSettings`, `isCollateralized`, etc.) are wired
 * in PR 3 alongside the action hooks.
 */
export function useBridgeState({ bridgeId, remoteId }: UseBridgeStateOptions): BridgeState {
  const bridges = useIcttBridgeStore((s) => s.bridges);
  const activityLog = useIcttBridgeStore((s) => s.activityLog);

  const bridge = bridgeId ? (bridges[bridgeId] ?? null) : null;
  const remote = useMemo(() => {
    if (!bridge) return null;
    if (remoteId) return bridge.remotes.find((r) => r.id === remoteId) ?? null;
    return bridge.remotes[0] ?? null;
  }, [bridge, remoteId]);

  const homeL1 = useL1ByChainId(bridge?.homeL1Id ?? '') ?? null;
  const remoteL1 = useL1ByChainId(remote?.l1Id ?? '') ?? null;

  const [refreshTick, setRefreshTick] = useState(0);
  const refresh = useCallback(() => setRefreshTick((t) => t + 1), []);

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

  // refreshTick is intentionally part of the dep array so consumers re-render after a manual refresh.
  void refreshTick;

  return useMemo<BridgeState>(
    () => ({
      homeL1,
      remoteL1,
      bridge,
      remote,
      phaseStatus,
      highestReachablePhase: reachable,
      // PR 2 has no on-chain reads yet; once they land, isLoading reflects them.
      isLoading: false,
      error: null,
      refresh,
    }),
    [homeL1, remoteL1, bridge, remote, phaseStatus, reachable, refresh, refreshTick],
  );
}
