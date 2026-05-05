'use client';

import { useEffect, useState } from 'react';
import { makePublicClientForChain } from '@/components/toolbox/hooks/usePublicClientForChain';

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
  /** True when the RPC successfully reported precompile state. False when
   *  the method isn't supported by the L1's RPC endpoint (older
   *  subnet-EVM versions, custom RPCs, etc.). When false, the consumer
   *  should render an "unknown — RPC doesn't expose precompile state"
   *  message instead of "all off", so a working warp-enabled L1 doesn't
   *  appear gutted just because its RPC is opinionated. */
  rpcSupportsRulesQuery: boolean;
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

// Subnet-EVM exposes a per-config object on each enabled precompile that
// looks like `{ timestamp: number; ...config }`. The presence of the
// object (with any value, including timestamp 0 for "active at genesis")
// means the precompile is enabled. Keep the shape narrow so we don't
// accidentally rely on properties subnet-EVM might rename.
type RulesResponse = {
  precompiles?: {
    warpConfig?: unknown;
    contractDeployerAllowListConfig?: unknown;
    txAllowListConfig?: unknown;
    feeManagerConfig?: unknown;
    rewardManagerConfig?: unknown;
    contractNativeMinterConfig?: unknown;
  };
};

function isMethodNotFound(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const e = error as any;
  if (e.code === -32601) return true;
  const msg = typeof e.message === 'string' ? e.message.toLowerCase() : '';
  return (
    msg.includes('method not found') ||
    msg.includes('does not exist') ||
    msg.includes('is not available') ||
    msg.includes('method not supported')
  );
}

export function useL1ActivePrecompiles(
  rpcUrl: string | undefined,
  enabled = true,
): UseL1ActivePrecompilesState {
  const [state, setState] = useState<UseL1ActivePrecompilesState>({
    precompiles: null,
    rpcSupportsRulesQuery: true,
    isLoading: false,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!enabled || !rpcUrl) {
        setState({ precompiles: null, rpcSupportsRulesQuery: true, isLoading: false, error: null });
        return;
      }

      setState((s) => ({ ...s, isLoading: true, error: null }));
      try {
        const client = makePublicClientForChain(rpcUrl);
        if (!client) throw new Error('RPC URL unavailable');
        // Call the method directly so we can distinguish "RPC doesn't
        // support this" from "RPC returned empty precompiles" — the
        // shared helper swallows the former into the latter, which made
        // every precompile read as Off on chains that simply don't
        // expose the query.
        let raw: RulesResponse;
        try {
          raw = (await client.transport.request({
            method: 'eth_getActiveRulesAt',
            params: [],
          })) as RulesResponse;
        } catch (err) {
          if (isMethodNotFound(err)) {
            if (cancelled) return;
            setState({
              precompiles: null,
              rpcSupportsRulesQuery: false,
              isLoading: false,
              error: null,
            });
            return;
          }
          throw err;
        }
        if (cancelled) return;
        const active = raw.precompiles ?? {};
        setState({
          precompiles: {
            warp: active.warpConfig !== undefined,
            nativeMinter: active.contractNativeMinterConfig !== undefined,
            feeManager: active.feeManagerConfig !== undefined,
            rewardManager: active.rewardManagerConfig !== undefined,
            transactorAllowlist: active.txAllowListConfig !== undefined,
            deployerAllowlist: active.contractDeployerAllowListConfig !== undefined,
          },
          rpcSupportsRulesQuery: true,
          isLoading: false,
          error: null,
        });
      } catch (err) {
        if (cancelled) return;
        setState({
          precompiles: EMPTY_PRECOMPILES,
          rpcSupportsRulesQuery: true,
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
