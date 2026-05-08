'use client';

import { useState } from 'react';
import { useTokenHome } from '@/components/toolbox/hooks/contracts/bridge/useTokenHome';
import { useContractActions } from '@/components/toolbox/hooks/contracts';
import ExampleERC20 from '@/contracts/icm-contracts/compiled/ExampleERC20.json';
import { cb58ToHex } from '@/components/tools/common/utils/cb58';
import { useIcttBridgeStore } from '@/components/toolbox/stores/iccttBridgeStore';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import type { Address, Bridge, Remote } from '../types';

interface SendParams {
  amount: bigint;
  recipient: Address;
  /** Optional ICM fee; defaults to zero. */
  primaryFee?: bigint;
  secondaryFee?: bigint;
  /** Optional gas limit on the destination chain (default: 250_000). */
  requiredGasLimit?: bigint;
}

interface UseSendTokensOptions {
  bridge: Bridge | null;
  remote: Remote | null;
}

export function useSendTokens({ bridge, remote }: UseSendTokensOptions) {
  const tokenHome = useTokenHome(bridge?.homeAddress ?? null, bridge?.kind === 'native-home' ? 'native' : 'erc20');
  const erc20 = useContractActions(bridge?.underlyingTokenAddress ?? null, ExampleERC20.abi);
  const pushActivity = useIcttBridgeStore((s) => s.pushActivity);
  const updateActivity = useIcttBridgeStore((s) => s.updateActivity);
  const walletChainId = useWalletStore((s) => s.walletChainId);
  const [stage, setStage] = useState<'idle' | 'approving' | 'sending' | 'submitted' | 'error'>('idle');
  const [error, setError] = useState<Error | null>(null);

  const send = async (params: SendParams): Promise<{ approveTx?: Address; sendTx: Address } | null> => {
    if (!bridge || !remote) return null;
    setError(null);
    const activityId = pushActivity({
      bridgeId: bridge.id,
      remoteId: remote.id,
      kind: 'send',
      label: 'Send tokens cross-chain',
      sublabel: bridge.kind === 'native-home' ? 'Sending native via Home' : 'Approve + send',
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
          [bridge.homeAddress, params.amount],
          'Approve TokenHome to spend send amount',
        )) as Address;
      }

      setStage('sending');
      const input = {
        destinationBlockchainID: blockchainIDHex,
        destinationTokenTransferrerAddress: remote.address,
        recipient: params.recipient,
        primaryFeeTokenAddress: bridge.underlyingTokenAddress ?? bridge.homeAddress,
        primaryFee: params.primaryFee ?? 0n,
        secondaryFee: params.secondaryFee ?? 0n,
        requiredGasLimit: params.requiredGasLimit ?? 250_000n,
        multiHopFallback: '0x0000000000000000000000000000000000000000' as Address,
      };
      const sendTx = (await tokenHome.send(input, params.amount)) as Address;

      updateActivity(activityId, {
        status: 'confirmed',
        txHash: sendTx,
        sublabel: 'Send tx confirmed on Home',
      });
      setStage('submitted');
      return { approveTx, sendTx };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      updateActivity(activityId, { status: 'failed', sublabel: error.message });
      setStage('error');
      return null;
    }
  };

  return {
    send,
    stage,
    isBusy: stage === 'approving' || stage === 'sending',
    error,
  };
}
