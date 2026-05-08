'use client';

import { useMemo, useCallback } from 'react';
import { useIcttBridgeStore } from '@/components/toolbox/stores/iccttBridgeStore';
import type { ActivityEvent, BridgeId, RemoteId } from '../types';

export interface UseBridgeActivityResult {
  events: ActivityEvent[];
  push: (
    event: Omit<ActivityEvent, 'id' | 'timestampMs'> & Partial<Pick<ActivityEvent, 'id' | 'timestampMs'>>,
  ) => string;
  update: (id: string, patch: Partial<ActivityEvent>) => void;
  remove: (id: string) => void;
  clear: () => void;
}

export function useBridgeActivity(bridgeId: BridgeId | null, remoteId?: RemoteId | null): UseBridgeActivityResult {
  const allEvents = useIcttBridgeStore((s) => s.activityLog);
  const pushRaw = useIcttBridgeStore((s) => s.pushActivity);
  const updateRaw = useIcttBridgeStore((s) => s.updateActivity);
  const removeRaw = useIcttBridgeStore((s) => s.removeActivity);
  const clearRaw = useIcttBridgeStore((s) => s.clearActivity);

  const events = useMemo(() => {
    if (!bridgeId) return [] as ActivityEvent[];
    return allEvents.filter((e) => {
      if (e.bridgeId !== bridgeId) return false;
      if (remoteId && e.remoteId && e.remoteId !== remoteId) return false;
      return true;
    });
  }, [allEvents, bridgeId, remoteId]);

  const push: UseBridgeActivityResult['push'] = useCallback(
    (event) => {
      if (!bridgeId) return '';
      return pushRaw({ ...event, bridgeId, remoteId: event.remoteId ?? remoteId ?? undefined });
    },
    [bridgeId, remoteId, pushRaw],
  );

  const clear = useCallback(() => {
    if (!bridgeId) return;
    clearRaw({ bridgeId, remoteId: remoteId ?? undefined });
  }, [bridgeId, remoteId, clearRaw]);

  return useMemo(
    () => ({ events, push, update: updateRaw, remove: removeRaw, clear }),
    [events, push, updateRaw, removeRaw, clear],
  );
}
