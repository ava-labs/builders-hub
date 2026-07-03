'use client';

import { useState } from 'react';
import WrappedNativeToken from '@/contracts/icm-contracts/compiled/WrappedNativeToken.json';
import { useContractDeployer } from '@/components/toolbox/hooks/contracts';
import { useSelectedL1, useSetWrappedNativeToken } from '@/components/toolbox/stores/l1ListStore';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { useIcttBridgeStore } from '@/components/toolbox/stores/iccttBridgeStore';
import type { Address, BridgeId } from '../types';

interface DeployWrappedResult {
  contractAddress: Address;
}

/**
 * Deploys a `WrappedNativeToken` contract on the currently-selected L1 and
 * registers the address in `l1ListStore.wrappedTokenAddress` so other tools
 * (and future ICTT sessions) can read it.
 *
 * Mirrors the legacy `DeployWrappedNative.tsx` deploy path but exposes it as
 * a small hook usable from the new TokenInspector "Wrap native token" tab.
 */
export function useDeployWrappedNative() {
  const { deploy, isDeploying } = useContractDeployer();
  const selectedL1 = useSelectedL1();
  const setWrappedNativeToken = useSetWrappedNativeToken();
  const walletChainId = useWalletStore((s) => s.walletChainId);
  const pushActivity = useIcttBridgeStore((s) => s.pushActivity);
  const [error, setError] = useState<Error | null>(null);

  const deployWrappedNative = async (placeholderBridgeId?: BridgeId): Promise<Address | null> => {
    setError(null);
    try {
      const symbol = selectedL1?.coinName ? `W${selectedL1.coinName}` : 'WNT';
      const result = (await deploy({
        abi: WrappedNativeToken.abi as unknown as never[],
        bytecode: WrappedNativeToken.bytecode.object,
        args: [symbol],
        name: 'WrappedNativeToken',
      })) as DeployWrappedResult;
      // Persist the wrapped-native address on the L1 list so every other tool
      // sees it (matching legacy behavior).
      setWrappedNativeToken(result.contractAddress);
      if (placeholderBridgeId) {
        pushActivity({
          bridgeId: placeholderBridgeId,
          kind: 'deploy',
          label: 'Wrapped native deployed',
          sublabel: `${symbol} on ${selectedL1?.name ?? 'Home chain'}`,
          chainId: walletChainId,
          status: 'confirmed',
        });
      }
      return result.contractAddress;
    } catch (err) {
      const wrapped = err instanceof Error ? err : new Error(String(err));
      setError(wrapped);
      return null;
    }
  };

  return {
    deployWrappedNative,
    isDeploying,
    error,
  };
}
