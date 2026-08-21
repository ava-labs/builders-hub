'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useWalletStore } from '../stores/walletStore';
import { useSelectedL1 } from '../stores/l1ListStore';
import { useChainPublicClient } from './useChainPublicClient';
import { getPChainRpcUrl } from '../utils/avalancheEndpoints';
import {
  computeEpochStatus,
  deriveProposerVMUrl,
  fetchCurrentEpoch,
  fetchLivePChainHeight,
  type EpochStatus,
  type ProposerVMEpoch,
} from '../utils/proposervm';

export interface ProposerVMSnapshot {
  epoch: ProposerVMEpoch | null;
  liveHeight: bigint | null;
  tipTimestampSec: number | null;
  readAtMs: number;
}

export interface ProposerVMStatusResult {
  epoch: ProposerVMEpoch | null;
  liveHeight: bigint | null;
  status: EpochStatus;
  /** True when the chain's /proposervm endpoint could not be read (gateway
   *  RPCs don't proxy it; some operators disable it). Not an error state. */
  unreachable: boolean;
  proposerVMUrl: string | null;
  isLoading: boolean;
  refresh: () => Promise<ProposerVMSnapshot>;
}

/**
 * Reads how stale the selected L1's ProposerVM view of the P-Chain is.
 *
 * `refresh()` resolves to the snapshot it just read so async callers (the
 * advance loop) can act on fresh values instead of stale closure state; the
 * hook's state fields exist for rendering.
 */
export function useProposerVMStatus(
  opts: { requiredHeight?: bigint | null; enabled?: boolean } = {},
): ProposerVMStatusResult {
  const { requiredHeight = null, enabled = true } = opts;
  const selectedL1 = useSelectedL1();
  const isTestnet = useWalletStore((s) => s.isTestnet);
  const publicClient = useChainPublicClient();

  const rpcUrl = selectedL1?.rpcUrl ?? null;
  const proposerVMUrl = useMemo(() => (rpcUrl ? deriveProposerVMUrl(rpcUrl) : null), [rpcUrl]);

  const [snapshot, setSnapshot] = useState<ProposerVMSnapshot | null>(null);
  const [unreachable, setUnreachable] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  // Discards responses from a superseded refresh (e.g. after switching L1s).
  const requestIdRef = useRef(0);

  const refresh = useCallback(async (): Promise<ProposerVMSnapshot> => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setIsLoading(true);

    const [epochResult, liveResult, tipResult] = await Promise.allSettled([
      proposerVMUrl
        ? fetchCurrentEpoch(proposerVMUrl)
        : Promise.reject(new Error('no proposervm URL derivable from this RPC URL')),
      fetchLivePChainHeight(getPChainRpcUrl(isTestnet)),
      publicClient
        ? publicClient.getBlock({ blockTag: 'latest' })
        : Promise.reject(new Error('no public client for the selected chain')),
    ]);

    const next: ProposerVMSnapshot = {
      epoch: epochResult.status === 'fulfilled' ? epochResult.value : null,
      liveHeight: liveResult.status === 'fulfilled' ? liveResult.value : null,
      tipTimestampSec: tipResult.status === 'fulfilled' ? Number(tipResult.value.timestamp) : null,
      readAtMs: Date.now(),
    };

    if (requestIdRef.current === requestId) {
      setSnapshot(next);
      setUnreachable(next.epoch === null);
      setIsLoading(false);
    }
    return next;
  }, [proposerVMUrl, isTestnet, publicClient]);

  useEffect(() => {
    setSnapshot(null);
    setUnreachable(false);
    if (!enabled || !rpcUrl) return;
    void refresh().catch(() => {
      // refresh never rejects (allSettled), but keep the effect noise-free
    });
  }, [enabled, rpcUrl, refresh]);

  const status = useMemo(
    () =>
      computeEpochStatus({
        epoch: snapshot?.epoch ?? null,
        liveHeight: snapshot?.liveHeight ?? null,
        tipTimestampSec: snapshot?.tipTimestampSec ?? null,
        nowMs: snapshot?.readAtMs ?? Date.now(),
        requiredHeight,
      }),
    [snapshot, requiredHeight],
  );

  return {
    epoch: snapshot?.epoch ?? null,
    liveHeight: snapshot?.liveHeight ?? null,
    status,
    unreachable,
    proposerVMUrl,
    isLoading,
    refresh,
  };
}
