'use client';

import React, { useState, useEffect } from 'react';
import SelectSubnetId from '@/components/toolbox/components/SelectSubnetId';
import { ValidatorManagerDetails } from '@/components/toolbox/components/ValidatorManagerDetails';
import { useStakeValidatorStore, useStakeValidatorStoreApi } from '@/components/toolbox/stores/stakeValidatorStore';
import { useValidatorManagerContext } from '@/components/toolbox/contexts/ValidatorManagerContext';
import { useCreateChainStore } from '@/components/toolbox/stores/createChainStore';
import { Alert } from '@/components/toolbox/components/Alert';

interface SelectSubnetStepProps {
  tokenType: 'native' | 'erc20';
}

export default function SelectSubnetStep({ tokenType }: SelectSubnetStepProps) {
  const store = useStakeValidatorStore();
  const vmcCtx = useValidatorManagerContext();
  const createChainStoreSubnetId = useCreateChainStore()((state: { subnetId: string }) => state.subnetId);

  const storeApi = useStakeValidatorStoreApi();
  const setTokenType = storeApi((s) => s.setTokenType);
  const setSubnetIdL1 = storeApi((s) => s.setSubnetIdL1);

  const [isExpanded, setIsExpanded] = useState<boolean>(true);

  const isNative = tokenType === 'native';

  useEffect(() => {
    setTokenType(tokenType);
  }, [setTokenType, tokenType]);

  useEffect(() => {
    if (!store.subnetIdL1 && createChainStoreSubnetId) {
      setSubnetIdL1(createChainStoreSubnetId);
    }
  }, [store.subnetIdL1, createChainStoreSubnetId, setSubnetIdL1]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Select L1 Subnet</h2>
        <p className="text-sm text-gray-500 mb-4">
          Choose the L1 subnet where you want to stake a validator with {isNative ? 'native tokens' : 'ERC20 tokens'}.
        </p>
        <SelectSubnetId
          value={store.subnetIdL1}
          onChange={store.setSubnetIdL1}
          error={vmcCtx.error}
          hidePrimaryNetwork={true}
        />

        {vmcCtx.ownerType && vmcCtx.ownerType !== 'StakingManager' && (
          <Alert variant="error">
            This L1 is not using a Staking Manager. This tool is only for {isNative ? 'Native Token' : 'ERC20 Token'}{' '}
            Staking.
          </Alert>
        )}
      </div>
      {store.subnetIdL1 && (
        <div className="lg:sticky lg:top-4 lg:self-start">
          <ValidatorManagerDetails
            validatorManagerAddress={vmcCtx.validatorManagerAddress}
            blockchainId={vmcCtx.blockchainId}
            subnetId={store.subnetIdL1}
            isLoading={vmcCtx.isLoading}
            signingSubnetId={vmcCtx.signingSubnetId}
            contractTotalWeight={vmcCtx.contractTotalWeight}
            l1WeightError={vmcCtx.l1WeightError}
            isLoadingL1Weight={vmcCtx.isLoadingL1Weight}
            contractOwner={vmcCtx.contractOwner}
            ownershipError={vmcCtx.ownershipError}
            isLoadingOwnership={vmcCtx.isLoadingOwnership}
            isOwnerContract={vmcCtx.isOwnerContract}
            ownerType={vmcCtx.ownerType}
            isDetectingOwnerType={vmcCtx.isDetectingOwnerType}
            isExpanded={isExpanded}
            onToggleExpanded={() => setIsExpanded((prev) => !prev)}
            staking={vmcCtx.staking}
          />
        </div>
      )}
    </div>
  );
}
