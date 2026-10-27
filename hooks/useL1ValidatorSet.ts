'use client';

import { useEffect, useRef, useState } from 'react';
import { PRIMARY_NETWORK_SUBNET_ID } from '@/lib/console/my-l1/types';
import { listL1Validators } from '@/components/toolbox/coreViem/utils/statsApi';

const POLL_INTERVAL_MS = 60_000;

export interface L1ValidatorSetState {
  count: number | null;
  nodeIds: string[];
  isLoading: boolean;
  error: string | null;
}

export function useL1ValidatorSet(
  subnetId: string | undefined,
  isTestnet: boolean,
): L1ValidatorSetState {
  const [state, setState] = useState<L1ValidatorSetState>({
    count: null,
    nodeIds: [],
    isLoading: false,
    error: null,
  });
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (!subnetId) {
      setState({ count: null, nodeIds: [], isLoading: false, error: null });
      return;
    }

    const requestId = ++requestIdRef.current;

    const sample = async () => {
      setState((s) => ({ ...s, isLoading: true }));
      try {
        if (subnetId === PRIMARY_NETWORK_SUBNET_ID) {
          const network = isTestnet ? 'fuji' : 'mainnet';
          const res = await fetch(`/api/validator-stats?network=${network}`);
          if (!res.ok) throw new Error(`Validator stats ${res.status}`);
          const data = (await res.json()) as Array<{
            id: string;
            byClientVersion?: Record<string, { nodes: number }>;
          }>;
          const primary = data.find((s) => s.id === PRIMARY_NETWORK_SUBNET_ID);
          const count = primary?.byClientVersion
            ? Object.values(primary.byClientVersion).reduce((acc, v) => acc + (v.nodes ?? 0), 0)
            : null;
          if (requestId === requestIdRef.current) {
            setState({ count, nodeIds: [], isLoading: false, error: null });
          }
          return;
        }

        const validators = await listL1Validators(isTestnet ? 'testnet' : 'mainnet', subnetId);
        const active = validators.filter((v) => v.remainingBalance > 0);
        const nodeIds = active.map((v) => v.nodeId).filter((v): v is string => Boolean(v));
        if (requestId === requestIdRef.current) {
          setState({ count: active.length, nodeIds, isLoading: false, error: null });
        }
      } catch (err) {
        if (requestId !== requestIdRef.current) return;
        setState({
          count: null,
          nodeIds: [],
          isLoading: false,
          error: err instanceof Error ? err.message : 'Failed to load validators',
        });
      }
    };

    sample();
    const id = setInterval(sample, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [subnetId, isTestnet]);

  return state;
}
