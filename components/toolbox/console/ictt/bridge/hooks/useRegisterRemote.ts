'use client';

import { useEffect, useRef, useState } from 'react';
import { parseEventLogs } from 'viem';
import { useTokenRemote } from '@/components/toolbox/hooks/contracts/bridge/useTokenRemote';
import { useIcttBridgeStore } from '@/components/toolbox/stores/iccttBridgeStore';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { useL1ByChainId } from '@/components/toolbox/stores/l1ListStore';
import { makePublicClientForChain } from '@/components/toolbox/hooks/usePublicClientForChain';
import { cb58ToHex } from '@/components/tools/common/utils/cb58';
import ERC20TokenHomeAbi from '@/contracts/icm-contracts/compiled/ERC20TokenHome.json';
import TeleporterMessengerAbi from '@/contracts/icm-contracts/compiled/TeleporterMessenger.json';
import { truncateAddress } from '../utils/explorer-url';
import type { Address, BridgeId, Remote, RemoteId } from '../types';

interface UseRegisterRemoteOptions {
  bridgeId: BridgeId;
  remote: Remote | null;
  /** Home contract on the Home L1 — needed to poll on-chain registration. */
  homeAddress?: Address | null;
  /** Home L1 RPC URL — used to read the registration state. */
  homeRpcUrl?: string | null;
  /** Default zero-fee tuple `[address(0), 0]` matches legacy behavior. */
  feeAddress?: Address;
  feeAmount?: bigint;
}

export type HomePollState = 'idle' | 'polling' | 'delivered' | 'timeout';

const POLL_INTERVAL_MS = 4000;
const POLL_MAX_ATTEMPTS = 45;

export function useRegisterRemote({
  bridgeId,
  remote,
  homeAddress = null,
  homeRpcUrl = null,
  feeAddress = '0x0000000000000000000000000000000000000000' as Address,
  feeAmount = 0n,
}: UseRegisterRemoteOptions) {
  const tokenRemote = useTokenRemote(remote?.address ?? null, remote?.kind === 'native-remote' ? 'native' : 'erc20');
  const upsertRemote = useIcttBridgeStore((s) => s.upsertRemote);
  const pushActivity = useIcttBridgeStore((s) => s.pushActivity);
  const updateActivity = useIcttBridgeStore((s) => s.updateActivity);
  const walletChainId = useWalletStore((s) => s.walletChainId);
  // The registerWithHome tx runs on the Remote chain — use its RPC to fetch
  // the receipt and parse the Teleporter SendCrossChainMessage event.
  const remoteL1 = useL1ByChainId(remote?.l1Id ?? '');
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [lastTxHash, setLastTxHash] = useState<Address | null>(null);
  const [homePollState, setHomePollState] = useState<HomePollState>('idle');
  const [pollAttempts, setPollAttempts] = useState(0);

  const pollAbortRef = useRef<{ cancelled: boolean } | null>(null);
  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (pollAbortRef.current) pollAbortRef.current.cancelled = true;
    };
  }, []);

  // If the store already shows the remote as registered (e.g., persisted across
  // reloads after a previous successful run), short-circuit to 'delivered'.
  useEffect(() => {
    if (remote?.registeredAt && homePollState === 'idle') {
      setHomePollState('delivered');
    }
  }, [remote?.registeredAt, homePollState]);

  const startHomePoll = (
    target: Remote,
    options: { activityId?: string; bridgeId: BridgeId; homeAddress: Address; homeRpcUrl: string },
  ) => {
    // Cancel any prior poll so we never have two loops alive at once.
    if (pollAbortRef.current) pollAbortRef.current.cancelled = true;
    const token = { cancelled: false };
    pollAbortRef.current = token;

    const client = makePublicClientForChain(options.homeRpcUrl);
    if (!client) {
      setHomePollState('timeout');
      return;
    }

    setHomePollState('polling');
    setPollAttempts(0);

    const blockchainIDHex = cb58ToHex(target.l1Id) as Address;
    let attempt = 0;

    const tick = async () => {
      if (token.cancelled || !isMountedRef.current) return;
      attempt += 1;
      setPollAttempts(attempt);
      try {
        const settings = (await client.readContract({
          address: options.homeAddress,
          abi: ERC20TokenHomeAbi.abi,
          functionName: 'getRemoteTokenTransferrerSettings',
          args: [blockchainIDHex, target.address],
        })) as { registered: boolean };
        if (token.cancelled || !isMountedRef.current) return;
        if (settings?.registered) {
          upsertRemote(options.bridgeId, { ...target, registeredAt: Date.now() } as Remote);
          setHomePollState('delivered');
          if (options.activityId) {
            // Flip status to `delivered` here so the activity log reflects the
            // cross-chain final state even if the global delivery watcher hasn't
            // observed the `ReceiveCrossChainMessage` event yet. The watcher
            // will still push a paired `register-received` row when it catches
            // the log (idempotent — won't double-bind once `pairedWith` is set).
            updateActivity(options.activityId, {
              status: 'delivered',
              sublabel: 'Remote registered on Home',
            });
          }
          return;
        }
      } catch {
        // Transient RPC errors — keep polling until the cap.
      }
      if (attempt >= POLL_MAX_ATTEMPTS) {
        if (token.cancelled || !isMountedRef.current) return;
        setHomePollState('timeout');
        if (options.activityId) {
          updateActivity(options.activityId, {
            status: 'failed',
            sublabel: 'Timed out waiting for ICM delivery',
          });
        }
        return;
      }
      setTimeout(tick, POLL_INTERVAL_MS);
    };

    setTimeout(tick, POLL_INTERVAL_MS);
  };

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

      // Best-effort: parse the Teleporter `SendCrossChainMessage` event on the
      // Remote chain so the activity entry carries the ICM message ID. The
      // registration *is* an ICM message and is the most useful one to link
      // from the log. Falls back to the generic sublabel on any failure.
      let icmMessageId: string | undefined;
      if (remoteL1?.rpcUrl) {
        try {
          const client = makePublicClientForChain(remoteL1.rpcUrl);
          if (client) {
            const receipt = await client.waitForTransactionReceipt({ hash: txHash, timeout: 60_000 });
            const logs = parseEventLogs({
              abi: TeleporterMessengerAbi.abi,
              eventName: 'SendCrossChainMessage',
              logs: receipt.logs,
            }) as Array<{ args?: { messageID?: string } }>;
            icmMessageId = logs[0]?.args?.messageID;
          }
        } catch {
          // Best-effort — keep going so the poll still kicks off.
        }
      }

      // Local receipt mined (we just waited on it to parse the ICM message ID).
      // Move the row to `confirmed`: the local tx is final, but delivery to
      // Home is still pending — the row stays `confirmed` until the poll or
      // the global delivery watcher flips it to `delivered`.
      updateActivity(activityId, {
        status: icmMessageId ? 'confirmed' : 'pending',
        txHash,
        icmMessageId,
        sublabel: icmMessageId
          ? `ICM msg ${truncateAddress(icmMessageId, 8, 4)} · waiting for delivery to Home`
          : 'Local tx broadcast — waiting for ICM delivery to Home',
      });
      // Kick off the Home-side poll. The activity event stays `confirmed` until
      // the Home contract reports `registered: true` (flips to `delivered`) or
      // we hit the timeout cap.
      if (homeAddress && homeRpcUrl) {
        startHomePoll(remote, { activityId, bridgeId, homeAddress, homeRpcUrl });
      } else {
        // No way to verify — fall back to optimistic mark so the flow still works.
        upsertRemote(bridgeId, { ...remote, registeredAt: Date.now() } as Remote);
        setHomePollState('delivered');
        updateActivity(activityId, { status: 'delivered', sublabel: 'Local registration tx confirmed' });
      }
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

  /** Manual mark used by legacy flows / store migrations. */
  const markRegistered = (remoteId: RemoteId, registeredAt: number = Date.now()) => {
    if (!remote) return;
    upsertRemote(bridgeId, { ...remote, id: remoteId, registeredAt } as Remote);
    setHomePollState('delivered');
  };

  return {
    sendRegister,
    markRegistered,
    isRegistering,
    error,
    lastTxHash,
    homePollState,
    pollAttempts,
    pollMaxAttempts: POLL_MAX_ATTEMPTS,
  };
}
