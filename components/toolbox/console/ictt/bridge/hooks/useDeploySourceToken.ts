'use client';

import { useState } from 'react';
import ExampleERC20 from '@/contracts/icm-contracts/compiled/ExampleERC20.json';
import { useContractDeployer } from '@/components/toolbox/hooks/contracts';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { useIcttBridgeStore } from '@/components/toolbox/stores/iccttBridgeStore';
import type { Address, BridgeId } from '../types';

interface DeployExampleERC20Result {
  contractAddress: Address;
}

/**
 * Deploys the ExampleERC20 mock token and emits an activity event. Its
 * constructor mints 1e28 base units to the deployer: 10,000,000,000 tokens at
 * 18 decimals. Does NOT touch the bridge graph: the Token step only seeds an
 * underlying token, and the Home step creates the Bridge entry.
 */
export function useDeploySourceToken() {
  const { deploy, isDeploying } = useContractDeployer();
  const walletChainId = useWalletStore((s) => s.walletChainId);
  const pushActivity = useIcttBridgeStore((s) => s.pushActivity);
  const [error, setError] = useState<Error | null>(null);

  const deployExampleErc20 = async (placeholderBridgeId?: BridgeId): Promise<Address | null> => {
    setError(null);
    try {
      const result = (await deploy({
        abi: ExampleERC20.abi as unknown as never[],
        bytecode: ExampleERC20.bytecode.object,
        args: [],
        name: 'ExampleERC20',
      })) as DeployExampleERC20Result;
      if (placeholderBridgeId) {
        pushActivity({
          bridgeId: placeholderBridgeId,
          kind: 'deploy',
          label: 'Source token deployed',
          sublabel: 'ExampleERC20 · 10,000,000,000 supply',
          chainId: walletChainId,
          txHash: undefined,
          status: 'confirmed',
        });
      }
      return result.contractAddress;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      return null;
    }
  };

  return {
    deployExampleErc20,
    isDeploying,
    error,
  };
}
