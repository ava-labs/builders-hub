'use client';

import { useEffect, useMemo, useRef } from 'react';
import type { Abi } from 'viem';
import { useIcttBridgeStore } from '@/components/toolbox/stores/iccttBridgeStore';
import { useL1List, type L1ListItem } from '@/components/toolbox/stores/l1ListStore';
import { makePublicClientForChain } from '@/components/toolbox/hooks/usePublicClientForChain';
import TeleporterMessengerAbi from '@/contracts/icm-contracts/compiled/TeleporterMessenger.json';
import type { Address, BridgeId } from '../types';

// Cast the compiled JSON ABI to viem's `Abi` shape once. The compiled
// `.json` files load as `unknown[]` which doesn't satisfy viem's branded
// type, but the runtime shape is identical. Casting at module scope keeps
// the per-call sites readable.
const TELEPORTER_ABI = TeleporterMessengerAbi.abi as Abi;

/**
 * Universal CREATE2 address for the Teleporter messenger. The same contract
 * lives at this address on every Avalanche L1 that ships ICM, so the watcher
 * can filter `ReceiveCrossChainMessage` by address without per-chain config.
 */
const TELEPORTER_ADDRESS: Address = '0x253b2784c75e510dD0fF1da844684a1aC0aa5fcf';

/**
 * One pending source event awaiting a destination-chain `ReceiveCrossChainMessage`.
 * Built once per effect run from the `activityLog` ∩ `bridges` ∩ `l1List`.
 */
interface PendingDelivery {
  activityId: string;
  bridgeId: BridgeId;
  messageID: `0x${string}`;
  destinationRpcUrl: string;
  destinationChainId: string | number;
  /** Source kind drives the paired-row kind: send→receive, register-sent→register-received. */
  kind: 'send' | 'register-sent';
}

/**
 * Closes the bridge delivery loop. For every unresolved `send` or
 * `register-sent` activity row with an `icmMessageId`, watch the destination
 * chain's Teleporter for a matching `ReceiveCrossChainMessage`. On match,
 * call `bindReceive` to push a paired `receive` / `register-received` row
 * and flip the source row to `delivered`.
 *
 * Strategy: per destination chain, run two passes:
 *   1. `getContractEvents` backfill from `earliest` → `latest` filtered by
 *      messageID. Resolves anything that landed before this watcher mounted
 *      (including across page reloads, since the activity log persists).
 *   2. `watchContractEvent` live subscription. Resolves anything that lands
 *      while this watcher is mounted. Viem's HTTP transport polls under the
 *      hood, so a separate poll fallback isn't needed.
 *
 * Mount once at the top of `BridgeRibbon`. The hook is global — it scans
 * every bridge's pending events, not just the active bridge — so a refresh
 * mid-transfer can still catch up regardless of which bridge is now focused.
 */
export function useDeliveryWatcher() {
  const activityLog = useIcttBridgeStore((s) => s.activityLog);
  const bridges = useIcttBridgeStore((s) => s.bridges);
  const bindReceive = useIcttBridgeStore((s) => s.bindReceive);
  const l1List = useL1List();

  // Stable signature of the pending set — only effect-triggering identity is
  // the list of message IDs being waited on, not unrelated activityLog churn
  // (timestamps in `updateActivity`, new events from other flows, etc.).
  const pending = useMemo<PendingDelivery[]>(() => {
    const out: PendingDelivery[] = [];
    for (const event of activityLog) {
      if (event.pairedWith) continue;
      if (event.status === 'failed' || event.status === 'delivered') continue;
      if (!event.icmMessageId) continue;
      if (event.kind !== 'send' && event.kind !== 'register-sent') continue;

      const bridge = bridges[event.bridgeId];
      if (!bridge) continue;

      let destinationL1Id: string;
      if (event.kind === 'send') {
        const remote = bridge.remotes.find((r) => r.id === event.remoteId);
        if (!remote) continue;
        destinationL1Id = remote.l1Id;
      } else {
        destinationL1Id = bridge.homeL1Id;
      }

      const destinationL1 = l1List.find((l1: L1ListItem) => l1.id === destinationL1Id);
      if (!destinationL1?.rpcUrl) continue;

      out.push({
        activityId: event.id,
        bridgeId: event.bridgeId,
        messageID: event.icmMessageId as `0x${string}`,
        destinationRpcUrl: destinationL1.rpcUrl,
        destinationChainId: destinationL1.evmChainId ?? destinationL1.id,
        kind: event.kind as 'send' | 'register-sent',
      });
    }
    return out;
  }, [activityLog, bridges, l1List]);

  const pendingKey = useMemo(
    () =>
      pending
        .map((p) => `${p.activityId}:${p.messageID}`)
        .sort()
        .join('|'),
    [pending],
  );

  // Live ref so the effect callback sees up-to-date `pending` without making
  // the effect itself re-fire on every changed timestamp.
  const pendingRef = useRef<PendingDelivery[]>(pending);
  pendingRef.current = pending;

  useEffect(() => {
    if (pending.length === 0) return;

    const cleanups: Array<() => void> = [];

    // Group by destination chain — one client + one live subscription per chain.
    const byChain = new Map<string, PendingDelivery[]>();
    for (const p of pending) {
      const arr = byChain.get(p.destinationRpcUrl) ?? [];
      arr.push(p);
      byChain.set(p.destinationRpcUrl, arr);
    }

    for (const [rpcUrl, msgs] of byChain) {
      const client = makePublicClientForChain(rpcUrl, l1List);
      if (!client) continue;

      // Backfill: scan history for each messageID in parallel.
      void Promise.all(
        msgs.map(async (msg) => {
          try {
            const events = await client.getContractEvents({
              abi: TELEPORTER_ABI,
              address: TELEPORTER_ADDRESS,
              eventName: 'ReceiveCrossChainMessage',
              args: { messageID: msg.messageID } as Record<string, unknown>,
              fromBlock: 0n,
              toBlock: 'latest',
            });
            const match = events[0];
            if (!match) return;
            bindReceive({
              sourceActivityId: msg.activityId,
              txHash: match.transactionHash as Address,
              blockNumber: match.blockNumber ?? undefined,
              chainId: msg.destinationChainId,
              kind: msg.kind === 'send' ? 'receive' : 'register-received',
            });
          } catch {
            // RPC may reject wide log ranges — rely on the live watch below.
          }
        }),
      );

      // Live subscription. Viem with HTTP transport polls (~4s default) under
      // the hood, so no separate poll fallback is needed here.
      const unwatch = client.watchContractEvent({
        abi: TELEPORTER_ABI,
        address: TELEPORTER_ADDRESS,
        eventName: 'ReceiveCrossChainMessage',
        onLogs: (logs) => {
          // Match each incoming log against any *currently* pending message
          // (read from the ref so we stay correct even after the source row
          // we're tracking has been bound from somewhere else).
          for (const log of logs) {
            const args = (log as unknown as { args?: { messageID?: string } }).args;
            const messageID = args?.messageID?.toLowerCase();
            if (!messageID) continue;
            const matched = pendingRef.current.find((m) => m.messageID.toLowerCase() === messageID);
            if (!matched) continue;
            bindReceive({
              sourceActivityId: matched.activityId,
              txHash: log.transactionHash as Address,
              blockNumber: log.blockNumber ?? undefined,
              chainId: matched.destinationChainId,
              kind: matched.kind === 'send' ? 'receive' : 'register-received',
            });
          }
        },
        onError: () => {
          // Best-effort: a failed subscription doesn't tear down the bridge UI.
          // The next mount or next pending event will retry.
        },
      });
      cleanups.push(unwatch);
    }

    return () => {
      for (const c of cleanups) {
        try {
          c();
        } catch {
          // Ignore — unwatch is best-effort during teardown.
        }
      }
    };
    // Re-run only when the set of pending message IDs changes (`pendingKey`
    // is a derived string identity), not on every activityLog tick. `pending`
    // and `l1List` are read inside the effect but are *derived* from the same
    // upstream state as `pendingKey`, so depending on the key alone keeps the
    // effect stable without losing freshness.
  }, [pendingKey, bindReceive]);
}
