'use client';

import { useMemo } from 'react';
import { useIcttBridgeStore } from '@/components/toolbox/stores/iccttBridgeStore';
import type { Bridge } from '@/components/toolbox/console/ictt/bridge/types';

export interface UserActivityForL1 {
  /** Total `send` events the user has initiated for bridges touching this L1. */
  sends: number;
  /** Source rows whose paired destination event has landed (`delivered`). */
  delivered: number;
  /** Pending or confirmed-without-pair source rows still in flight. */
  inFlight: number;
  /** Rows where the watcher / hook marked the event failed. */
  failed: number;
  /** Last activity timestamp across all matching events; null when total = 0. */
  lastTimestamp: number | null;
  /** sends + delivered + inFlight + failed — drives the empty-state branch. */
  total: number;
}

const EMPTY: UserActivityForL1 = {
  sends: 0,
  delivered: 0,
  inFlight: 0,
  failed: 0,
  lastTimestamp: null,
  total: 0,
};

/**
 * Local-state counterpart to {@link useUserBridgesForL1} and
 * {@link useL1CrossChainStats}. Reflects only the user's own activity log
 * — no server fetch — so the dashboard gives immediate feedback after a
 * Live-phase test send, even when upstream indexers haven't caught up.
 *
 * Counts every event whose bridge has `homeL1Id === blockchainId` OR any
 * `remote.l1Id === blockchainId` (i.e. the L1 is on either end of the
 * bridge). Same boundary as {@link useUserBridgesForL1}.
 */
export function useUserActivityForL1(blockchainId: string | null | undefined): UserActivityForL1 {
  const bridgesRecord = useIcttBridgeStore((s) => s.bridges);
  const activityLog = useIcttBridgeStore((s) => s.activityLog);
  return useMemo(() => {
    if (!blockchainId) return EMPTY;
    const touching = new Set<string>();
    for (const bridge of Object.values(bridgesRecord) as Bridge[]) {
      const matches =
        bridge.homeL1Id === blockchainId || bridge.remotes.some((r) => r.l1Id === blockchainId);
      if (matches) touching.add(bridge.id);
    }
    if (touching.size === 0) return EMPTY;

    let sends = 0;
    let delivered = 0;
    let inFlight = 0;
    let failed = 0;
    let lastTimestamp: number | null = null;

    for (const event of activityLog) {
      if (!touching.has(event.bridgeId)) continue;
      if (lastTimestamp === null || event.timestampMs > lastTimestamp) {
        lastTimestamp = event.timestampMs;
      }
      if (event.kind === 'send') sends += 1;
      if (event.status === 'failed') {
        failed += 1;
        continue;
      }
      if (event.status === 'delivered') {
        delivered += 1;
        continue;
      }
      if (event.status === 'pending') {
        inFlight += 1;
        continue;
      }
      // `confirmed` source row without a paired delivery counts as in flight —
      // matches the `deriveIcmHealth` heuristic in ManageBridgesButton.
      if (
        event.status === 'confirmed' &&
        (event.kind === 'send' || event.kind === 'register-sent') &&
        !event.pairedWith
      ) {
        inFlight += 1;
      }
    }

    const total = sends + delivered + inFlight + failed;
    return { sends, delivered, inFlight, failed, lastTimestamp, total };
  }, [bridgesRecord, activityLog, blockchainId]);
}
