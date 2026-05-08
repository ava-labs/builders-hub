'use client';

import { useMemo } from 'react';
import { useIcttBridgeStore } from '@/components/toolbox/stores/iccttBridgeStore';
import type { Bridge, BridgeId, Remote } from '../types';

export interface UseBridgeRemotesResult {
  bridge: Bridge | null;
  remotes: Remote[];
  selectedRemoteId: Remote['id'] | null;
  selectRemote: (id: Remote['id']) => void;
}

export function useBridgeRemotes(bridgeId: BridgeId | null): UseBridgeRemotesResult {
  const bridges = useIcttBridgeStore((s) => s.bridges);
  const selectedByBridge = useIcttBridgeStore((s) => s.selectedRemoteByBridge);
  const setSelected = useIcttBridgeStore((s) => s.setSelectedRemote);

  return useMemo(() => {
    const bridge = bridgeId ? (bridges[bridgeId] ?? null) : null;
    const remotes = bridge?.remotes ?? [];
    const persistedSelection = bridgeId ? (selectedByBridge[bridgeId] ?? null) : null;
    const selectedRemoteId =
      persistedSelection && remotes.some((r) => r.id === persistedSelection)
        ? persistedSelection
        : (remotes[0]?.id ?? null);

    return {
      bridge,
      remotes,
      selectedRemoteId,
      selectRemote: (id: Remote['id']) => {
        if (!bridgeId) return;
        setSelected(bridgeId, id);
      },
    };
  }, [bridgeId, bridges, selectedByBridge, setSelected]);
}
