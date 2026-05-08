'use client';

import { useCallback, useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { BRIDGE_PHASE_ORDER, type BridgePhase } from '../types';

const VALID_PHASES = new Set<string>(BRIDGE_PHASE_ORDER);

function normalizePhase(input: string | null | undefined, fallback: BridgePhase): BridgePhase {
  if (input && VALID_PHASES.has(input)) return input as BridgePhase;
  return fallback;
}

export interface UseBridgePhaseResult {
  phase: BridgePhase;
  remoteId: string | null;
  setPhase: (next: BridgePhase) => void;
  setRemoteId: (next: string | null) => void;
  setBoth: (params: { phase?: BridgePhase; remoteId?: string | null }) => void;
}

export function useBridgePhase(defaultPhase: BridgePhase = 'token'): UseBridgePhaseResult {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const phase = normalizePhase(searchParams.get('phase'), defaultPhase);
  const remoteId = searchParams.get('remote');

  const setBoth: UseBridgePhaseResult['setBoth'] = useCallback(
    (params) => {
      const next = new URLSearchParams(searchParams.toString());
      if (params.phase !== undefined) next.set('phase', params.phase);
      if (params.remoteId !== undefined) {
        if (params.remoteId === null) next.delete('remote');
        else next.set('remote', params.remoteId);
      }
      const query = next.toString();
      router.replace(query ? `${pathname}?${query}` : pathname);
    },
    [pathname, router, searchParams],
  );

  const setPhase = useCallback((next: BridgePhase) => setBoth({ phase: next }), [setBoth]);
  const setRemoteId = useCallback((next: string | null) => setBoth({ remoteId: next }), [setBoth]);

  return useMemo(
    () => ({ phase, remoteId, setPhase, setRemoteId, setBoth }),
    [phase, remoteId, setPhase, setRemoteId, setBoth],
  );
}
