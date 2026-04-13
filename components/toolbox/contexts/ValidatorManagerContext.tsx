'use client';

import React, { createContext, useContext, useMemo, useState, useEffect } from 'react';
import { useVMCAddress } from '@/components/toolbox/hooks/useVMCAddress';
import { useVMCDetails } from '@/components/toolbox/hooks/useVMCDetails';
import { useChainPublicClient } from '@/components/toolbox/hooks/useChainPublicClient';
import { useValidatorManagerDetails } from '@/components/toolbox/hooks/useValidatorManagerDetails';
import ERC20TokenStakingManager from '@/contracts/icm-contracts/compiled/ERC20TokenStakingManager.json';
import NativeTokenStakingManager from '@/contracts/icm-contracts/compiled/NativeTokenStakingManager.json';
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

interface ValidatorManagerContextType extends ValidatorManagerDetailsReturn {
  subnetId: string;
  isContractInitialized: boolean;
  isValidatorSetInitialized: boolean;
  staking: StakingDetails;
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

  useEffect(() => {
    let cancelled = false;

    const detectStaking = async () => {
      // Skip staking detection for PoA L1s or when data isn't ready.
      // Allow 'EOA' owners through — inheritance model (NativeTokenStakingManager
      // IS the ValidatorManager, and its Ownable.owner() is an EOA).
      if (!chainPublicClient || !validatorManagerAddress || !ownerType || ownerType === 'PoAManager') {
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
