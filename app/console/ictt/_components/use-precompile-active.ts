'use client';

import { useEffect, useState } from 'react';
import { makePublicClientForChain } from '@/components/toolbox/hooks/usePublicClientForChain';
import { getActiveRulesAt } from '@/components/toolbox/coreViem';

type PrecompileConfigKey =
  | 'warpConfig'
  | 'contractDeployerAllowListConfig'
  | 'txAllowListConfig'
  | 'feeManagerConfig'
  | 'rewardManagerConfig'
  | 'contractNativeMinterConfig';

export interface PrecompileCheck {
  isActive: boolean;
  isLoading: boolean;
  error: string | null;
}

const INITIAL: PrecompileCheck = { isActive: false, isLoading: false, error: null };

/**
 * Lightweight precompile-availability check for inspector preflight slots.
 *
 * Mirrors the underlying logic of `<CheckPrecompile>` but returns plain
 * state (no JSX, no full-page hero) so callers can render compact warnings
 * and gate primary actions inline.
 *
 * Skips entirely when `rpcUrl` is undefined — the caller decides whether
 * to require the check (e.g., remote inspector only checks the
 * native-minter precompile when the user picks `NativeTokenRemote`).
 */
export function usePrecompileActive(args: {
  configKey: PrecompileConfigKey;
  rpcUrl: string | undefined;
  enabled?: boolean;
}): PrecompileCheck {
  const { configKey, rpcUrl, enabled = true } = args;
  const [state, setState] = useState<PrecompileCheck>(INITIAL);

  useEffect(() => {
    if (!enabled || !rpcUrl) {
      setState(INITIAL);
      return;
    }
    let cancelled = false;
    setState({ isActive: false, isLoading: true, error: null });

    (async () => {
      try {
        const client = makePublicClientForChain(rpcUrl);
        if (!client) throw new Error('Could not create RPC client');
        const data = await getActiveRulesAt(client);
        // Match `<CheckPrecompile>`: presence of a timestamp (including 0
        // for genesis-activated precompiles) means the precompile is on.
        const isActive = data.precompiles?.[configKey]?.timestamp !== undefined;
        if (!cancelled) setState({ isActive, isLoading: false, error: null });
      } catch (e: any) {
        if (!cancelled) {
          setState({
            isActive: false,
            isLoading: false,
            error: e?.shortMessage ?? e?.message ?? 'Precompile check failed',
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [configKey, rpcUrl, enabled]);

  return state;
}
