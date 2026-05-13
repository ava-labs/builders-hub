'use client';

import React, { useState } from 'react';
import SelectSubnetId from '@/components/toolbox/components/SelectSubnetId';
import { ValidatorManagerDetails } from '@/components/toolbox/components/ValidatorManagerDetails';
import { useRemoveValidatorStore } from '@/components/toolbox/stores/removeValidatorStore';
import { useValidatorManagerContext } from '@/components/toolbox/contexts/ValidatorManagerContext';
import { ManagerTypeBadge } from '@/components/toolbox/console/add-validator/ManagerTypeBadge';
import { VmcChainSwitchBanner } from '@/components/toolbox/console/add-validator/VmcChainSwitchBanner';

export default function SelectSubnetStep() {
  const store = useRemoveValidatorStore();
  const vmcCtx = useValidatorManagerContext();
  const [isExpanded, setIsExpanded] = useState(true);

  const isDetecting =
    !!vmcCtx.chainMismatch ||
    vmcCtx.isDetectingOwnerType ||
    vmcCtx.isLoadingOwnership ||
    (vmcCtx.ownerType === 'StakingManager' && vmcCtx.staking.isLoading);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">Select L1 Subnet</h2>
          {store.subnetIdL1 && (
            <ManagerTypeBadge
              ownerType={vmcCtx.ownerType}
              stakingType={vmcCtx.staking.stakingType}
              isDetecting={isDetecting}
            />
          )}
        </div>
        <p className="text-sm text-zinc-500 mb-4">
          Choose the L1 with the validator you want to remove. We'll detect the validator manager type — PoS attempts
          uptime-proof removal first (preserves staking rewards) and falls back to force-removal if the validator is
          ineligible for rewards.
        </p>
        <SelectSubnetId
          value={store.subnetIdL1}
          onChange={store.setSubnetIdL1}
          error={vmcCtx.error}
          hidePrimaryNetwork={true}
        />

        {store.subnetIdL1 && vmcCtx.chainMismatch && <VmcChainSwitchBanner mismatch={vmcCtx.chainMismatch} />}
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
