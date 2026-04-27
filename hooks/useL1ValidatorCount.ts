'use client';

import { useEffect, useRef, useState } from 'react';

const GLACIER_BASE = 'https://glacier-api.avax.network/v1';
const POLL_INTERVAL_MS = 60_000;
const PRIMARY_NETWORK_SUBNET_ID = '11111111111111111111111111111111LpoYY';

export interface L1ValidatorCountState {
  count: number | null;
  isLoading: boolean;
  error: string | null;
}

/**
 * Active L1 validator count for a given subnet via Glacier. Active is
 * defined as `remainingBalance > 0` (or absent — older entries don't carry
 * the field). Refreshes every 60s, ignores stale responses if the user
 * switches L1s mid-flight.
 *
 * Returns `null` count when:
 * - subnetId is the primary network (`11111…LpoYY`) — Glacier doesn't
 *   surface L1 validators for primary-network subnets
 * - Glacier returns an error or the response is malformed
 */
export function useL1ValidatorCount(
  subnetId: string | undefined,
  isTestnet: boolean,
): L1ValidatorCountState {
  const [state, setState] = useState<L1ValidatorCountState>({
    count: null,
    isLoading: false,
    error: null,
  });
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (!subnetId || subnetId === PRIMARY_NETWORK_SUBNET_ID) {
      setState({ count: null, isLoading: false, error: null });
      return;
    }

    const requestId = ++requestIdRef.current;
    const network = isTestnet ? 'testnet' : 'mainnet';

    const sample = async () => {
      setState((s) => ({ ...s, isLoading: true }));
      try {
        const url = `${GLACIER_BASE}/networks/${network}/l1Validators?subnetId=${encodeURIComponent(
          subnetId,
        )}&pageSize=100`;
        const res = await fetch(url);
        if (!res.ok) {
          if (requestId === requestIdRef.current) {
            setState({ count: null, isLoading: false, error: `Glacier ${res.status}` });
          }
          return;
        }
        const data = (await res.json()) as { validators?: Array<{ remainingBalance?: number }> };
        const active = (data.validators ?? []).filter(
          (v) => v.remainingBalance === undefined || v.remainingBalance > 0,
        );
        if (requestId === requestIdRef.current) {
          setState({ count: active.length, isLoading: false, error: null });
        }
      } catch (err) {
        if (requestId !== requestIdRef.current) return;
        setState({
          count: null,
          isLoading: false,
          error: err instanceof Error ? err.message : 'Failed to load validators',
        });
      }
    };

    sample();
    const id = setInterval(sample, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [subnetId, isTestnet]);

  return state;
}
