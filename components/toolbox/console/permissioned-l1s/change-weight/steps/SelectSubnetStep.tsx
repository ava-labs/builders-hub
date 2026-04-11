'use client';

import React, { useState, useEffect } from 'react';
import SelectSubnetId from '@/components/toolbox/components/SelectSubnetId';
import { ValidatorManagerDetails } from '@/components/toolbox/components/ValidatorManagerDetails';
import { useChangeWeightStore } from '@/components/toolbox/stores/changeWeightStore';
import { useValidatorManagerContext } from '@/components/toolbox/contexts/ValidatorManagerContext';
import { useCreateChainStore } from '@/components/toolbox/stores/createChainStore';

export default function SelectSubnetStep() {
  const store = useChangeWeightStore();
  const vmcCtx = useValidatorManagerContext();
  const [isValidatorManagerDetailsExpanded, setIsValidatorManagerDetailsExpanded] = useState(true);

  const createChainStoreSubnetId = useCreateChainStore()((state: { subnetId: string }) => state.subnetId);

  useEffect(() => {
    if (!store.subnetIdL1 && createChainStoreSubnetId) {
      store.setSubnetIdL1(createChainStoreSubnetId);
    }
  }, [createChainStoreSubnetId]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Select L1 Subnet</h2>
        <p className="text-sm text-zinc-500 mb-4">
          Choose the L1 subnet where you want to change the validator weight.
        </p>
        <SelectSubnetId
          value={store.subnetIdL1}
          onChange={store.setSubnetIdL1}
          error={vmcCtx.error}
          hidePrimaryNetwork={true}
        />
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
            isExpanded={isValidatorManagerDetailsExpanded}
            onToggleExpanded={() => setIsValidatorManagerDetailsExpanded((prev) => !prev)}
          />
        </div>
      )}
    </div>
  );
}
