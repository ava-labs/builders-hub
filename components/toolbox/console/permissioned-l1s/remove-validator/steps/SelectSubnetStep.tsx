'use client';

import React, { useState, useEffect } from 'react';
import SelectSubnetId from '@/components/toolbox/components/SelectSubnetId';
import { ValidatorManagerDetails } from '@/components/toolbox/components/ValidatorManagerDetails';
import { useRemoveValidatorStore } from '@/components/toolbox/stores/removeValidatorStore';
import { useValidatorManagerContext } from '@/components/toolbox/console/permissioned-l1s/shared/ValidatorManagerContext';
import { useCreateChainStore } from '@/components/toolbox/stores/createChainStore';
import { StepCodeViewer } from '@/components/console/step-code-viewer';
import { STEP_CONFIG } from '../codeConfig';

export default function SelectSubnetStep() {
  const store = useRemoveValidatorStore();
  const vmcCtx = useValidatorManagerContext();
  const [isValidatorManagerDetailsExpanded, setIsValidatorManagerDetailsExpanded] = useState(false);

  const createChainStoreSubnetId = useCreateChainStore()((state: { subnetId: string }) => state.subnetId);

  useEffect(() => {
    if (!store.subnetIdL1 && createChainStoreSubnetId) {
      store.setSubnetIdL1(createChainStoreSubnetId);
    }
  }, [createChainStoreSubnetId, store.subnetIdL1, store.setSubnetIdL1]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
      <div className="space-y-4">
        <p className="text-sm text-gray-500 mb-4">Choose the L1 subnet where you want to remove the validator.</p>
        <div className="space-y-2">
          <SelectSubnetId
            value={store.subnetIdL1}
            onChange={store.setSubnetIdL1}
            error={vmcCtx.error}
            hidePrimaryNetwork={true}
          />
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
      </div>
      <StepCodeViewer activeStep={0} steps={STEP_CONFIG} className="lg:sticky lg:top-4 lg:self-start" />
    </div>
  );
}
