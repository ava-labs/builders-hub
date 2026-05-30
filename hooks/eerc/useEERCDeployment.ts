'use client';

import { useMemo } from 'react';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { getEERCDeployment } from '@/lib/eerc/deployments';
import type { EERCDeployment, EERCMode } from '@/lib/eerc/types';

export interface EERCDeploymentState {
  deployment: EERCDeployment | undefined;
  chainId: number;
  mode: EERCMode;
  /** True when we have a canonical deployment for this chain+mode. */
  isReady: boolean;
}

/**
 * Resolve the canonical eERC deployment for the user's current chain.
 *
 * Returns `undefined` `deployment` when no known deployment exists — tools
 * should surface a "no deployment on this chain yet, deploy your own" call
 * to action rather than hard-erroring.
 */
export function useEERCDeployment(mode: EERCMode): EERCDeploymentState {
  const chainId = useWalletStore((s) => s.walletChainId);

  const deployment = useMemo(
    () => getEERCDeployment(chainId, mode),
    [chainId, mode],
  );

  return {
    deployment,
    chainId,
    mode,
    isReady: deployment !== undefined,
  };
}
