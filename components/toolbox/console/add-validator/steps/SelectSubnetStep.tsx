'use client';

import React, { useState } from 'react';
import SelectSubnetId from '@/components/toolbox/components/SelectSubnetId';
import { ValidatorManagerDetails } from '@/components/toolbox/components/ValidatorManagerDetails';
import { useAddValidatorStore } from '@/components/toolbox/stores/addValidatorStore';
import { useValidatorManagerContext } from '@/components/toolbox/contexts/ValidatorManagerContext';
import { ManagerTypeBadge } from '../ManagerTypeBadge';
import { VmcChainSwitchBanner } from '../VmcChainSwitchBanner';

export default function SelectSubnetStep() {
  const store = useAddValidatorStore();
  const vmcCtx = useValidatorManagerContext();
  const [isExpanded, setIsExpanded] = useState(true);

  // Treat staking-type resolution as part of "detection" so the badge doesn't
  // briefly read "PoA" before the staking probe finishes for an inheritance-model
  // L1 (NativeStakingManager IS the VMC). When the wallet is on the wrong chain
  // the reads are skipped entirely — the badge stays in "Detecting…" so it
  // doesn't claim a type we haven't actually confirmed on-chain.
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
          Choose the L1 where you want to add a validator. We'll detect the validator manager type and adapt the next
          steps automatically.
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
