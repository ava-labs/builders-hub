'use client';

import React, { createContext, useContext, useMemo } from 'react';
import { useVMCAddress } from '@/components/toolbox/hooks/useVMCAddress';
import { useVMCDetails } from '@/components/toolbox/hooks/useVMCDetails';
import { useChainPublicClient } from '@/components/toolbox/hooks/useChainPublicClient';
import { useValidatorManagerDetails } from '@/components/toolbox/hooks/useValidatorManagerDetails';

type ValidatorManagerDetailsReturn = ReturnType<typeof useValidatorManagerDetails>;

interface ValidatorManagerContextType extends ValidatorManagerDetailsReturn {
  subnetId: string;
  isContractInitialized: boolean;
  isValidatorSetInitialized: boolean;
}

const ValidatorManagerContext = createContext<ValidatorManagerContextType | null>(null);

export function ValidatorManagerProvider({ subnetId, children }: { subnetId: string; children: React.ReactNode }) {
  const chainPublicClient = useChainPublicClient();
  const { validatorManagerAddress, blockchainId, signingSubnetId, isLoading, error } = useVMCAddress(subnetId);
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

  const value = useMemo<ValidatorManagerContextType>(() => {
    const isContractInitialized = !!validatorManagerAddress && !error;

    const isValidatorSetInitialized = isContractInitialized && contractTotalWeight > 0n && !l1WeightError;

    return {
      validatorManagerAddress,
      blockchainId,
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
    };
  }, [
    validatorManagerAddress,
    blockchainId,
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
