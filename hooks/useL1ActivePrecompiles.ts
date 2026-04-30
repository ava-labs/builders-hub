'use client';

import { useEffect, useState } from 'react';
import { makePublicClientForChain } from '@/components/toolbox/hooks/usePublicClientForChain';
import { getActiveRulesAt } from '@/components/toolbox/coreViem/methods/getActiveRulesAt';

export type L1PrecompileKey =
  | 'warp'
  | 'nativeMinter'
  | 'feeManager'
  | 'rewardManager'
  | 'transactorAllowlist'
  | 'deployerAllowlist';

export type L1PrecompileState = Record<L1PrecompileKey, boolean>;

export interface UseL1ActivePrecompilesState {
  precompiles: L1PrecompileState | null;
  isLoading: boolean;
  error: string | null;
}

const EMPTY_PRECOMPILES: L1PrecompileState = {
  warp: false,
  nativeMinter: false,
  feeManager: false,
  rewardManager: false,
  transactorAllowlist: false,
  deployerAllowlist: false,
};

export function useL1ActivePrecompiles(
  rpcUrl: string | undefined,
  enabled = true,
): UseL1ActivePrecompilesState {
  const [state, setState] = useState<UseL1ActivePrecompilesState>({
    precompiles: null,
    isLoading: false,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!enabled || !rpcUrl) {
        setState({ precompiles: null, isLoading: false, error: null });
        return;
      }

      setState((s) => ({ ...s, isLoading: true, error: null }));
      try {
        const client = makePublicClientForChain(rpcUrl);
        if (!client) throw new Error('RPC URL unavailable');
        const rules = await getActiveRulesAt(client);
        if (cancelled) return;
        const active = rules.precompiles ?? {};
        setState({
          precompiles: {
            warp: Boolean(active.warpConfig),
            nativeMinter: Boolean(active.contractNativeMinterConfig),
            feeManager: Boolean(active.feeManagerConfig),
            rewardManager: Boolean(active.rewardManagerConfig),
            transactorAllowlist: Boolean(active.txAllowListConfig),
            deployerAllowlist: Boolean(active.contractDeployerAllowListConfig),
          },
          isLoading: false,
          error: null,
        });
      } catch (err) {
        if (cancelled) return;
        setState({
          precompiles: EMPTY_PRECOMPILES,
          isLoading: false,
          error: err instanceof Error ? err.message : 'Failed to load precompiles',
        });
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [enabled, rpcUrl]);

  return state;
}
