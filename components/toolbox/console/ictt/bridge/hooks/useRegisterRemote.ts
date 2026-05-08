'use client';

import { useState } from 'react';
import { useTokenRemote } from '@/components/toolbox/hooks/contracts/bridge/useTokenRemote';
import { useIcttBridgeStore } from '@/components/toolbox/stores/iccttBridgeStore';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import type { Address, BridgeId, Remote, RemoteId } from '../types';

interface UseRegisterRemoteOptions {
  bridgeId: BridgeId;
  remote: Remote | null;
  /** Default zero-fee tuple `[address(0), 0]` matches legacy behavior. */
  feeAddress?: Address;
  feeAmount?: bigint;
}

export function useRegisterRemote({
  bridgeId,
  remote,
  feeAddress = '0x0000000000000000000000000000000000000000' as Address,
  feeAmount = 0n,
}: UseRegisterRemoteOptions) {
  const tokenRemote = useTokenRemote(remote?.address ?? null, remote?.kind === 'native-remote' ? 'native' : 'erc20');
  const upsertRemote = useIcttBridgeStore((s) => s.upsertRemote);
  const pushActivity = useIcttBridgeStore((s) => s.pushActivity);
  const updateActivity = useIcttBridgeStore((s) => s.updateActivity);
  const walletChainId = useWalletStore((s) => s.walletChainId);
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [lastTxHash, setLastTxHash] = useState<Address | null>(null);

  const sendRegister = async (): Promise<{ txHash: Address; activityId: string } | null> => {
    if (!remote) return null;
    setError(null);
    setIsRegistering(true);
    const activityId = pushActivity({
      bridgeId,
      remoteId: remote.id,
      kind: 'register-sent',
      label: 'Register Remote with Home',
      sublabel: 'Sending registration over ICM',
      chainId: walletChainId,
      status: 'pending',
    });
    try {
      const txHash = (await tokenRemote.registerWithHome([feeAddress, feeAmount])) as Address;
      setLastTxHash(txHash);
      updateActivity(activityId, { status: 'confirmed', txHash, sublabel: 'Registration tx confirmed on Remote' });
      // Optimistically mark the remote as registered. The Home-side confirmation
      // is best verified manually via "Refresh" in the inspector or in a follow-up
      // PR that wires automatic ICM polling.
      upsertRemote(bridgeId, { ...remote, registeredAt: Date.now() } as Remote);
      return { txHash, activityId };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      updateActivity(activityId, { status: 'failed', sublabel: error.message });
      return null;
    } finally {
      setIsRegistering(false);
    }
  };

  /** Manual refresh that re-marks the remote as registered if the activity log shows a confirmed event. */
  const markRegistered = (remoteId: RemoteId, registeredAt: number = Date.now()) => {
    if (!remote) return;
    upsertRemote(bridgeId, { ...remote, id: remoteId, registeredAt } as Remote);
  };

  return {
    sendRegister,
    markRegistered,
    isRegistering,
    error,
    lastTxHash,
  };
}
