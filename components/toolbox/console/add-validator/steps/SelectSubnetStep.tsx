'use client';

import React, { useId, useState } from 'react';
import SelectSubnetId from '@/components/toolbox/components/SelectSubnetId';
import { ValidatorManagerDetails } from '@/components/toolbox/components/ValidatorManagerDetails';
import { useAddValidatorStore } from '@/components/toolbox/stores/addValidatorStore';
import { useValidatorManagerContext } from '@/components/toolbox/contexts/ValidatorManagerContext';
import { ManagerTypeBadge } from '../ManagerTypeBadge';
import { VmcChainSwitchBanner } from '../VmcChainSwitchBanner';
import { ActionPanel, LEAD, StepLayout } from '@/components/toolbox/console/shared/validator-flow-ui';
import { StartOverButton } from '@/components/toolbox/console/shared/StartOverButton';

export default function SelectSubnetStep() {
  const store = useAddValidatorStore();
  const vmcCtx = useValidatorManagerContext();
  // Start over moves the focus to this field
  const subnetFieldId = useId();
  const [isExpanded, setIsExpanded] = useState(true);

  // Treat staking-type resolution as part of "detection" so the badge doesn't
  // briefly read "PoA" before the staking probe finishes for an inheritance-model
  // L1 (NativeStakingManager IS the VMC). When the wallet is on the wrong chain
  // the reads are skipped entirely. The badge stays in "Detecting…" so it
  // doesn't claim a type we haven't actually confirmed on-chain.
  const isDetecting =
    !!vmcCtx.chainMismatch ||
    vmcCtx.isDetectingOwnerType ||
    vmcCtx.isLoadingOwnership ||
    (vmcCtx.ownerType === 'StakingManager' && vmcCtx.staking.isLoading);

  return (
    <StepLayout
      aside={
        store.subnetIdL1 ? (
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
        ) : undefined
      }
    >
      <ActionPanel
        label="L1"
        action={
          <div className="flex items-center gap-2">
            {store.subnetIdL1 && (
              <ManagerTypeBadge
                ownerType={vmcCtx.ownerType}
                stakingType={vmcCtx.staking.stakingType}
                isDetecting={isDetecting}
              />
            )}
            <StartOverButton show={!!store.subnetIdL1} onStartOver={store.reset} focusId={subnetFieldId} />
          </div>
        }
      >
        <p className={LEAD}>
          Pick the L1 that gets the new validator. The next steps adapt to its validator manager type.
        </p>
        <SelectSubnetId
          id={subnetFieldId}
          value={store.subnetIdL1}
          onChange={store.setSubnetIdL1}
          error={vmcCtx.error}
          hidePrimaryNetwork={true}
        />
      </ActionPanel>

      {store.subnetIdL1 && vmcCtx.chainMismatch && <VmcChainSwitchBanner mismatch={vmcCtx.chainMismatch} />}
    </StepLayout>
  );
}
