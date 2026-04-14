import { useState, useEffect, useCallback } from 'react';
import { useValidatorManager } from '@/components/toolbox/hooks/contracts/core/useValidatorManager';
import type { ValidatorChurnPeriod } from '@/components/toolbox/hooks/contracts/types';

export interface ChurnBudgetResult {
  /** Weight budget remaining in the current churn period */
  remainingBudget: bigint;
  /** Maximum churn weight allowed per period (maxChurnPercent * initialWeight / 100) */
  maxBudget: bigint;
  /** Weight already used in the current churn period */
  usedBudget: bigint;
  /** Percentage of churn budget used (0-100) */
  percentUsed: number;
  /** Unix timestamp when the current churn period ends */
  periodEndsAt: bigint;
  /** Churn period duration in seconds */
  churnPeriodSeconds: bigint;
  /** Max churn percentage per period (0-100) */
  maxChurnPercentage: number;
  /** Raw churn period data from the contract */
  period: ValidatorChurnPeriod | null;
  /** Whether a proposed weight change fits within the remaining budget */
  canAccommodate: (weight: bigint) => boolean;
  /** Whether the hook is still loading data */
  isLoading: boolean;
  /** Error message if the read failed */
  error: string | null;
}

/**
 * Reads the churn tracker and L1 total weight from the ValidatorManager contract
 * to determine the remaining churn budget for the current period.
 *
 * Churn limits restrict how much total validator weight can change in a single
 * period (e.g., no more than 20% of total weight can be added/removed per period).
 *
 * @param validatorManagerAddress - The ValidatorManager proxy address
 */
export function useChurnBudget(validatorManagerAddress: string | null): ChurnBudgetResult {
  const validatorManager = useValidatorManager(validatorManagerAddress);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [churnPeriodSeconds, setChurnPeriodSeconds] = useState<bigint>(0n);
  const [maxChurnPercentage, setMaxChurnPercentage] = useState<number>(0);
  const [period, setPeriod] = useState<ValidatorChurnPeriod | null>(null);
  const [_totalWeight, setTotalWeight] = useState<bigint>(0n);

  useEffect(() => {
    let cancelled = false;

    const fetch = async () => {
      if (!validatorManagerAddress || !validatorManager.isReadReady) return;

      setIsLoading(true);
      setError(null);

      try {
        const [churnResult, weight] = await Promise.all([
          validatorManager.getChurnTracker(),
          validatorManager.l1TotalWeight(),
        ]);

        if (cancelled) return;

        setChurnPeriodSeconds(churnResult.churnPeriodSeconds);
        setMaxChurnPercentage(churnResult.maxChurnPercentage);
        setPeriod(churnResult.period);
        setTotalWeight(weight);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to read churn tracker');
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    fetch();
    return () => {
      cancelled = true;
    };
  }, [validatorManagerAddress, validatorManager.isReadReady]);

  // Compute budget values
  const maxBudget = period && maxChurnPercentage > 0 ? (period.initialWeight * BigInt(maxChurnPercentage)) / 100n : 0n;

  const periodEndsAt = period && churnPeriodSeconds > 0n ? period.startTime + churnPeriodSeconds : 0n;

  // If the churn period has expired, budget resets to full
  const now = BigInt(Math.floor(Date.now() / 1000));
  const isWithinPeriod = periodEndsAt > 0n && now < periodEndsAt;
  const usedBudget = isWithinPeriod ? (period?.churnAmount ?? 0n) : 0n;
  const remainingBudget = maxBudget > usedBudget ? maxBudget - usedBudget : 0n;
  const percentUsed = maxBudget > 0n ? Number((usedBudget * 10000n) / maxBudget) / 100 : 0;

  const canAccommodate = useCallback(
    (weight: bigint): boolean => {
      if (maxBudget === 0n) return true; // no churn limit configured
      return weight <= remainingBudget;
    },
    [maxBudget, remainingBudget],
  );

  return {
    remainingBudget,
    maxBudget,
    usedBudget,
    percentUsed,
    periodEndsAt,
    churnPeriodSeconds,
    maxChurnPercentage,
    period,
    canAccommodate,
    isLoading,
    error,
  };
}
