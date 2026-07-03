'use client';

import { useMemo } from 'react';
import { useIcttBridgeStore } from '@/components/toolbox/stores/iccttBridgeStore';
import type { Bridge } from '@/components/toolbox/console/ictt/bridge/types';

interface UserBridgesForL1 {
  /** Bridges where this L1 is the home (origin) chain. */
  asHome: Bridge[];
  /** Bridges where this L1 is a destination remote. */
  asRemote: Bridge[];
  /** Combined count, deduplicated. */
  total: number;
}

/**
 * Pure selector over `useIcttBridgeStore.bridges`. Splits the user's
 * persisted bridges into "home on this L1" vs "remote on this L1" so the
 * dashboard's "Your bridges" card can render them under intuitive headers.
 *
 * `blockchainId` is the L1ListItem `id` (CB58), which is also what the
 * bridge store keys against (`Bridge.homeL1Id`, `Remote.l1Id`).
 */
export function useUserBridgesForL1(blockchainId: string | null | undefined): UserBridgesForL1 {
  const bridgesRecord = useIcttBridgeStore((s) => s.bridges);
  return useMemo(() => {
    if (!blockchainId) return { asHome: [], asRemote: [], total: 0 };
    const all = Object.values(bridgesRecord).filter((b) => !b.archivedAt);
    const asHome = all.filter((b) => b.homeL1Id === blockchainId);
    const asRemote = all.filter(
      (b) => b.homeL1Id !== blockchainId && b.remotes.some((r) => r.l1Id === blockchainId),
    );
    return { asHome, asRemote, total: asHome.length + asRemote.length };
  }, [bridgesRecord, blockchainId]);
}
