'use client';

import React, { createContext, useContext, useMemo, useState, useEffect } from 'react';
import { useVMCAddress } from '@/components/toolbox/hooks/useVMCAddress';
import { useVMCDetails } from '@/components/toolbox/hooks/useVMCDetails';
import { useChainPublicClient } from '@/components/toolbox/hooks/useChainPublicClient';
import { useValidatorManagerDetails } from '@/components/toolbox/hooks/useValidatorManagerDetails';
import ERC20TokenStakingManager from '@/contracts/icm-contracts/compiled/ERC20TokenStakingManager.json';
import NativeTokenStakingManager from '@/contracts/icm-contracts/compiled/NativeTokenStakingManager.json';
import ValidatorManagerAbi from '@/contracts/icm-contracts/compiled/ValidatorManager.json';
import type { StakingManagerSettings } from '@/components/toolbox/hooks/contracts/types';

type ValidatorManagerDetailsReturn = ReturnType<typeof useValidatorManagerDetails>;

export type StakingType = 'native' | 'erc20' | null;

export interface StakingDetails {
  stakingType: StakingType;
  /** The address of the staking manager contract — may be the VMC itself (inheritance) or its owner (composition) */
  stakingManagerAddress: string | null;
  erc20TokenAddress: string | null;
  settings: StakingManagerSettings | null;
  isLoading: boolean;
}

export interface ChurnData {
  /** How much churn budget remains in the current period */
  remainingBudget: bigint;
  /** Maximum churn budget for the current period (totalWeight * maxChurnPercent / 100) */
  maxBudget: bigint;
  /** Percentage of churn budget already used (0-100) */
  percentUsed: number;
  /** Unix timestamp when the current churn period ends */
  periodEndsAt: bigint;
  /** Whether the churn data is still loading */
  isLoading: boolean;
}

interface ValidatorManagerContextType extends ValidatorManagerDetailsReturn {
  subnetId: string;
  isContractInitialized: boolean;
  isValidatorSetInitialized: boolean;
  staking: StakingDetails;
  churn: ChurnData | null;
  registrationExpirySeconds: bigint | null;
}

const ValidatorManagerContext = createContext<ValidatorManagerContextType | null>(null);

export function ValidatorManagerProvider({ subnetId, children }: { subnetId: string; children: React.ReactNode }) {
  const chainPublicClient = useChainPublicClient();
  const { validatorManagerAddress, blockchainId, l1BlockchainId, signingSubnetId, isLoading, error } =
    useVMCAddress(subnetId);
  const {
    contractTotalWeight,
    l1WeightError,
    isLoadingL1Weight,
    contractOwner,
    ownershipError,
    isLoadingOwnership,
    isOwnerContract,
    ownerType,
    isDetectingOwnerType,
    ownershipStatus,
    refetchOwnership,
  } = useVMCDetails(validatorManagerAddress || null, chainPublicClient);

  // ── PoS staking details ──
  const [stakingType, setStakingType] = useState<StakingType>(null);
  const [resolvedStakingManagerAddress, setResolvedStakingManagerAddress] = useState<string | null>(null);
  const [erc20TokenAddress, setErc20TokenAddress] = useState<string | null>(null);
  const [stakingSettings, setStakingSettings] = useState<StakingManagerSettings | null>(null);
  const [isLoadingStaking, setIsLoadingStaking] = useState(false);

  // ── Churn budget + registration expiry ──
  const [churnData, setChurnData] = useState<ChurnData | null>(null);
  const [isLoadingChurn, setIsLoadingChurn] = useState(false);
  const [registrationExpirySeconds, setRegistrationExpirySeconds] = useState<bigint | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchChurnAndExpiry = async () => {
      if (!chainPublicClient || !validatorManagerAddress) {
        if (!cancelled) {
          setChurnData(null);
          setRegistrationExpirySeconds(null);
          setIsLoadingChurn(false);
        }
        return;
      }

      if (!cancelled) setIsLoadingChurn(true);

      try {
        const vmcAddr = validatorManagerAddress as `0x${string}`;
        const abi = ValidatorManagerAbi.abi;

        const [churnTrackerResult, expiryResult] = await Promise.all([
          chainPublicClient.readContract({
            address: vmcAddr,
            abi,
            functionName: 'getChurnTracker',
          }) as Promise<
            [bigint, number, { startTime: bigint; initialWeight: bigint; totalWeight: bigint; churnAmount: bigint }]
          >,
          chainPublicClient.readContract({
            address: vmcAddr,
            abi,
            functionName: 'REGISTRATION_EXPIRY_LENGTH',
          }) as Promise<bigint>,
        ]);

        if (cancelled) return;

        const [churnPeriodSeconds, maxChurnPercent, period] = churnTrackerResult;

        // Churn budget is calculated from initialWeight (weight at start of period),
        // NOT totalWeight (current weight after changes). Matches on-chain logic.
        const baseWeight = period.initialWeight > 0n ? period.initialWeight : contractTotalWeight;
        const maxBudget = baseWeight > 0n ? (baseWeight * BigInt(maxChurnPercent)) / 100n : 0n;

        // Check if we're within the current churn period
        const now = BigInt(Math.floor(Date.now() / 1000));
        const periodEnd = period.startTime + BigInt(churnPeriodSeconds);
        const isWithinPeriod = now < periodEnd;

        const currentChurnAmount = isWithinPeriod ? period.churnAmount : 0n;
        const remainingBudget = maxBudget > currentChurnAmount ? maxBudget - currentChurnAmount : 0n;
        const percentUsed = maxBudget > 0n ? Number((currentChurnAmount * 100n) / maxBudget) : 0;

        setChurnData({
          remainingBudget,
          maxBudget,
          percentUsed,
          periodEndsAt: periodEnd,
          isLoading: false,
        });

        setRegistrationExpirySeconds(expiryResult);
      } catch {
        // Churn/expiry reads failed — set to null gracefully
        if (!cancelled) {
          setChurnData(null);
          setRegistrationExpirySeconds(null);
        }
      } finally {
        if (!cancelled) setIsLoadingChurn(false);
      }
    };

    fetchChurnAndExpiry();
    return () => {
      cancelled = true;
    };
  }, [chainPublicClient, validatorManagerAddress, contractTotalWeight]);

  useEffect(() => {
    let cancelled = false;

    const detectStaking = async () => {
      if (!chainPublicClient || !validatorManagerAddress || ownerType !== 'StakingManager') {
        if (!cancelled) {
          setStakingType(null);
          setResolvedStakingManagerAddress(null);
          setErc20TokenAddress(null);
          setStakingSettings(null);
          setIsLoadingStaking(false);
        }
        return;
      }

      if (!cancelled) setIsLoadingStaking(true);

      // The staking manager could be:
      // 1. validatorManagerAddress itself (inheritance — NativeTokenStakingManager IS the VMC)
      // 2. contractOwner (composition — separate contract owns the VMC)
      // Try validatorManagerAddress first (more common in modern ICM contracts)
      const candidates = [validatorManagerAddress, contractOwner].filter(Boolean) as string[];

      for (const addr of candidates) {
        try {
          const settings = (await chainPublicClient.readContract({
            address: addr as `0x${string}`,
            abi: NativeTokenStakingManager.abi,
            functionName: 'getStakingManagerSettings',
          })) as StakingManagerSettings;

          if (cancelled) return;
          setResolvedStakingManagerAddress(addr);
          setStakingSettings(settings);

          // Try to read erc20() — if it exists, it's an ERC20 staking manager
          try {
            const tokenAddr = await chainPublicClient.readContract({
              address: addr as `0x${string}`,
              abi: ERC20TokenStakingManager.abi,
              functionName: 'erc20',
            });
            if (!cancelled) {
              setStakingType('erc20');
              setErc20TokenAddress(tokenAddr as string);
            }
          } catch {
            // No erc20() function → native staking manager
            if (!cancelled) {
              setStakingType('native');
              setErc20TokenAddress(null);
            }
          }
          break; // Found the staking manager, stop searching
        } catch {
          // This candidate doesn't have getStakingManagerSettings, try next
        }
      }

      if (!cancelled) setIsLoadingStaking(false);
    };

    detectStaking();
    return () => {
      cancelled = true;
    };
  }, [chainPublicClient, validatorManagerAddress, contractOwner, ownerType]);

  const staking = useMemo<StakingDetails>(
    () => ({
      stakingType,
      stakingManagerAddress: resolvedStakingManagerAddress,
      erc20TokenAddress,
      settings: stakingSettings,
      isLoading: isLoadingStaking,
    }),
    [stakingType, resolvedStakingManagerAddress, erc20TokenAddress, stakingSettings, isLoadingStaking],
  );

  const churn = useMemo<ChurnData | null>(() => {
    if (isLoadingChurn) {
      return { remainingBudget: 0n, maxBudget: 0n, percentUsed: 0, periodEndsAt: 0n, isLoading: true };
    }
    return churnData;
  }, [churnData, isLoadingChurn]);

  const value = useMemo<ValidatorManagerContextType>(() => {
    const isContractInitialized = !!validatorManagerAddress && !error;
    const isValidatorSetInitialized = isContractInitialized && contractTotalWeight > 0n && !l1WeightError;

    return {
      validatorManagerAddress,
      blockchainId,
      l1BlockchainId,
      signingSubnetId,
      isLoading,
      error,
      contractTotalWeight,
      l1WeightError,
      isLoadingL1Weight,
      contractOwner,
      ownershipError,
      isLoadingOwnership,
      isOwnerContract,
      ownerType,
      isDetectingOwnerType,
      ownershipStatus,
      refetchOwnership,
      subnetId,
      isContractInitialized,
      isValidatorSetInitialized,
      staking,
      churn,
      registrationExpirySeconds,
    };
  }, [
    validatorManagerAddress,
    blockchainId,
    l1BlockchainId,
    signingSubnetId,
    isLoading,
    error,
    contractTotalWeight,
    l1WeightError,
    isLoadingL1Weight,
    contractOwner,
    ownershipError,
    isLoadingOwnership,
    isOwnerContract,
    ownerType,
    isDetectingOwnerType,
    ownershipStatus,
    refetchOwnership,
    subnetId,
    staking,
    churn,
    registrationExpirySeconds,
  ]);

  return <ValidatorManagerContext.Provider value={value}>{children}</ValidatorManagerContext.Provider>;
}

export function useValidatorManagerContext(): ValidatorManagerContextType {
  const ctx = useContext(ValidatorManagerContext);
  if (!ctx) {
    throw new Error('useValidatorManagerContext must be used within a ValidatorManagerProvider');
  }
  return ctx;
}
