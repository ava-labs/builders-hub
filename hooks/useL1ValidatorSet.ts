'use client';

import { useEffect, useRef, useState } from 'react';
import { PRIMARY_NETWORK_SUBNET_ID } from '@/lib/console/my-l1/types';

const GLACIER_BASE = 'https://glacier-api.avax.network/v1';
const POLL_INTERVAL_MS = 60_000;

export interface L1ValidatorSetState {
  count: number | null;
  nodeIds: string[];
  isLoading: boolean;
  error: string | null;
}

type GlacierValidator = {
  nodeId?: string;
  nodeID?: string;
  remainingBalance?: number;
};

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

        const network = isTestnet ? 'testnet' : 'mainnet';
        const url = `${GLACIER_BASE}/networks/${network}/l1Validators?subnetId=${encodeURIComponent(
          subnetId,
        )}&pageSize=100`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Glacier ${res.status}`);
        const data = (await res.json()) as { validators?: GlacierValidator[] };
        const active = (data.validators ?? []).filter(
          (v) => v.remainingBalance === undefined || v.remainingBalance > 0,
        );
        const nodeIds = active.map((v) => v.nodeId ?? v.nodeID).filter((v): v is string => Boolean(v));
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
