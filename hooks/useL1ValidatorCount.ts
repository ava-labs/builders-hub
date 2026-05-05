'use client';

import { useL1ValidatorSet } from './useL1ValidatorSet';

export interface L1ValidatorCountState {
  count: number | null;
  isLoading: boolean;
  error: string | null;
}

export function useL1ValidatorCount(
  subnetId: string | undefined,
  isTestnet: boolean,
): L1ValidatorCountState {
  const validators = useL1ValidatorSet(subnetId, isTestnet);
  return {
    count: validators.count,
    isLoading: validators.isLoading,
    error: validators.error,
  };
}
