'use client';

import { useEffect, useRef, useState } from 'react';
import { createPublicClient, formatEther, http } from 'viem';

export type L1HealthStatus = 'healthy' | 'degraded' | 'stale' | 'offline' | 'unknown';

export interface L1HealthState {
  status: L1HealthStatus;
  /** Latest block number returned by the chain. */
  blockNumber: bigint | null;
  /** Seconds since the last block was produced. */
  blockAgeSec: number | null;
  /** Average inter-block gap measured between the latest block and its parent. */
  blockTimeSec: number | null;
  /** Current gas price reported by the RPC, formatted in eth (= 1 unit of native). */
  gasPriceEth: string | null;
  isLoading: boolean;
  /** Last time we successfully sampled the chain. */
  lastSampledAt: number | null;
}

const POLL_INTERVAL_MS = 30_000;

// Status thresholds for the L1's most-recent block. Exported for unit
// testing — the hook itself uses the same boundaries.
export const HEALTHY_MAX_AGE_SEC = 120;
export const DEGRADED_MAX_AGE_SEC = 600;

/**
 * Derive a textual health status from the age of the latest produced block.
 * Pure helper so the boundaries can be tested without spinning up viem.
 */
export function deriveHealthStatus(blockAgeSec: number): L1HealthStatus {
  if (blockAgeSec <= HEALTHY_MAX_AGE_SEC) return 'healthy';
  if (blockAgeSec <= DEGRADED_MAX_AGE_SEC) return 'degraded';
  return 'stale';
}

/**
 * Per-L1 RPC health probe. Independent of the wallet's selected chain — the
 * `rpcUrl` + `evmChainId` come from the L1 the dashboard is currently
 * viewing, not from the user's wallet. Polls every 30s and falls back to
 * `offline` on any RPC error.
 *
 * Status semantics:
 * - healthy   — last block produced ≤ 2 min ago
 * - degraded  — last block produced 2-10 min ago
 * - stale     — last block produced > 10 min ago
 * - offline   — RPC unreachable or chain ID mismatch
 * - unknown   — no RPC URL provided yet
 */
export function useL1Health(rpcUrl: string | undefined, evmChainId: number | null): L1HealthState {
  const [state, setState] = useState<L1HealthState>({
    status: 'unknown',
    blockNumber: null,
    blockAgeSec: null,
    blockTimeSec: null,
    gasPriceEth: null,
    isLoading: false,
    lastSampledAt: null,
  });

  // Guard against stale responses from a previous rpcUrl writing into state
  // after the user has switched to a different L1.
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (!rpcUrl) {
      setState((s) => ({ ...s, status: 'unknown' }));
      return;
    }

    const requestId = ++requestIdRef.current;
    const client = createPublicClient({ transport: http(rpcUrl) });

    const sample = async () => {
      setState((s) => ({ ...s, isLoading: true }));
      try {
        // Liveness probe — fail fast if the chain ID doesn't match what we
        // expect from Glacier metadata.
        if (evmChainId !== null) {
          const chainId = await client.getChainId();
          if (chainId !== evmChainId && requestId === requestIdRef.current) {
            setState({
              status: 'offline',
              blockNumber: null,
              blockAgeSec: null,
              blockTimeSec: null,
              gasPriceEth: null,
              isLoading: false,
              lastSampledAt: Date.now(),
            });
            return;
          }
        }

        const [blockResult, gasPriceResult] = await Promise.allSettled([
          client.getBlock(),
          client.getGasPrice(),
        ]);

        if (requestId !== requestIdRef.current) return;

        if (blockResult.status === 'rejected') {
          setState({
            status: 'offline',
            blockNumber: null,
            blockAgeSec: null,
            blockTimeSec: null,
            gasPriceEth: null,
            isLoading: false,
            lastSampledAt: Date.now(),
          });
          return;
        }

        const block = blockResult.value;
        const blockAgeSec = Math.floor(Date.now() / 1000) - Number(block.timestamp);
        const status = deriveHealthStatus(blockAgeSec);

        let blockTimeSec: number | null = null;
        if (block.number > 0n) {
          try {
            const previous = await client.getBlock({ blockNumber: block.number - 1n });
            if (requestId === requestIdRef.current) {
              blockTimeSec = Number(block.timestamp - previous.timestamp);
            }
          } catch {
            // Older blocks may have been pruned; leave block time null rather
            // than failing the whole sample.
          }
        }

        const gasPriceEth =
          gasPriceResult.status === 'fulfilled' ? formatEther(gasPriceResult.value) : null;

        if (requestId !== requestIdRef.current) return;

        setState({
          status,
          blockNumber: block.number,
          blockAgeSec,
          blockTimeSec,
          gasPriceEth,
          isLoading: false,
          lastSampledAt: Date.now(),
        });
      } catch {
        if (requestId !== requestIdRef.current) return;
        setState({
          status: 'offline',
          blockNumber: null,
          blockAgeSec: null,
          blockTimeSec: null,
          gasPriceEth: null,
          isLoading: false,
          lastSampledAt: Date.now(),
        });
      }
    };

    sample();
    const id = setInterval(sample, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [rpcUrl, evmChainId]);

  return state;
}
