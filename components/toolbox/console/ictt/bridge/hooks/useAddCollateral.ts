'use client';

import { useState } from 'react';
import { useTokenHome } from '@/components/toolbox/hooks/contracts/bridge/useTokenHome';
import { useContractActions } from '@/components/toolbox/hooks/contracts';
import ExampleERC20 from '@/contracts/icm-contracts/compiled/ExampleERC20.json';
import { cb58ToHex } from '@/components/tools/common/utils/cb58';
import { useIcttBridgeStore } from '@/components/toolbox/stores/iccttBridgeStore';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import type { Address, Bridge, Remote } from '../types';

interface UseAddCollateralOptions {
  bridge: Bridge | null;
  remote: Remote | null;
}

export function useAddCollateral({ bridge, remote }: UseAddCollateralOptions) {
  const tokenHome = useTokenHome(bridge?.homeAddress ?? null, bridge?.kind === 'native-home' ? 'native' : 'erc20');
  const erc20 = useContractActions(bridge?.underlyingTokenAddress ?? null, ExampleERC20.abi);
  const upsertRemote = useIcttBridgeStore((s) => s.upsertRemote);
  const pushActivity = useIcttBridgeStore((s) => s.pushActivity);
  const updateActivity = useIcttBridgeStore((s) => s.updateActivity);
  const walletChainId = useWalletStore((s) => s.walletChainId);
  const [stage, setStage] = useState<'idle' | 'approving' | 'depositing' | 'done' | 'error'>('idle');
  const [error, setError] = useState<Error | null>(null);

  const addCollateral = async (amount: bigint): Promise<{ approveTx?: Address; depositTx: Address } | null> => {
    if (!bridge || !remote) return null;
    setError(null);
    const activityId = pushActivity({
      bridgeId: bridge.id,
      remoteId: remote.id,
      kind: 'collateral',
      label: 'Add collateral',
      sublabel: bridge.kind === 'native-home' ? 'Sending native to Home' : 'Approve + add collateral',
      chainId: walletChainId,
      status: 'pending',
    });
    try {
      const blockchainIDHex = cb58ToHex(remote.l1Id) as Address;
      let approveTx: Address | undefined;

      if (bridge.kind === 'erc20-home') {
        setStage('approving');
        approveTx = (await erc20.write(
          'approve',
          [bridge.homeAddress, amount],
          'Approve TokenHome to spend collateral',
        )) as Address;
      }

      setStage('depositing');
      const depositTx = (await tokenHome.addCollateral(blockchainIDHex, remote.address, amount)) as Address;

      updateActivity(activityId, {
        status: 'confirmed',
        txHash: depositTx,
        sublabel: `Collateral added · ${depositTx ? 'tx confirmed' : ''}`,
      });
      upsertRemote(bridge.id, { ...remote, collateralizedAt: Date.now() });
      setStage('done');
      return { approveTx, depositTx };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      updateActivity(activityId, { status: 'failed', sublabel: error.message });
      setStage('error');
      return null;
    }
  };

  return {
    addCollateral,
    stage,
    isBusy: stage === 'approving' || stage === 'depositing',
    error,
  };
}
