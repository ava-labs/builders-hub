'use client';

import React, { useMemo } from 'react';
import { Alert } from '@/components/toolbox/components/Alert';
import { useRemoveValidatorStore } from '@/components/toolbox/stores/removeValidatorStore';
import { useValidatorManagerContext } from '@/components/toolbox/contexts/ValidatorManagerContext';
import ClaimDelegationFees from '@/components/toolbox/console/permissionless-l1s/withdraw/ClaimDelegationFees';
import { StepCodeViewer } from '@/components/console/step-code-viewer';
import { ManagerTypeBadge } from '@/components/toolbox/console/add-validator/ManagerTypeBadge';
import { buildStepConfig, type ManagerCodeFlavor } from '../codeConfig';
import { ActionPanel, EYEBROW, FRAME, LEAD, StepLayout } from '@/components/toolbox/console/shared/validator-flow-ui';

function flavorFor(
  ownerType: ReturnType<typeof useValidatorManagerContext>['ownerType'],
  stakingType: ReturnType<typeof useValidatorManagerContext>['staking']['stakingType'],
): ManagerCodeFlavor {
  if (ownerType === 'StakingManager' && stakingType === 'native') return 'PoS-Native';
  if (ownerType === 'StakingManager' && stakingType === 'erc20') return 'PoS-ERC20';
  return 'PoA';
}

/**
 * Optional final step — only meaningful for PoS staking managers (where the
 * validator has accrued delegation fees from delegators). For PoA the step is
 * present in the flow shape but renders an "n/a" placeholder so the user can
 * skip straight to verify-validator-set.
 */
export default function ClaimDelegationFeesStep() {
  const store = useRemoveValidatorStore();
  const vmcCtx = useValidatorManagerContext();

  const flavor = useMemo(
    () => flavorFor(vmcCtx.ownerType, vmcCtx.staking.stakingType),
    [vmcCtx.ownerType, vmcCtx.staking.stakingType],
  );
  const stepConfig = useMemo(() => buildStepConfig(flavor), [flavor]);
  const isStaking = flavor !== 'PoA';

  const stakingManagerAddress = vmcCtx.staking.stakingManagerAddress || vmcCtx.validatorManagerAddress || '';
  const tokenType: 'native' | 'erc20' = vmcCtx.staking.stakingType === 'erc20' ? 'erc20' : 'native';

  if (!isStaking) {
    return (
      <StepLayout>
        <div className={`${FRAME} flex flex-col gap-2 px-5 py-6 md:px-6`}>
          <div className="flex items-center justify-between gap-4">
            <p className={EYEBROW}>Nothing to claim</p>
            <ManagerTypeBadge
              ownerType={vmcCtx.ownerType}
              stakingType={vmcCtx.staking.stakingType}
              isDetecting={false}
            />
          </div>
          <p className={LEAD}>
            Delegation fees only exist on PoS L1s, where validators earn a commission on delegated stake. This L1 is
            permissioned (PoA), so skip to the next step.
          </p>
        </div>
      </StepLayout>
    );
  }

  return (
    <StepLayout aside={<StepCodeViewer activeStep={4} steps={stepConfig} />}>
      {!store.validationId && <Alert variant="warning">No validation ID found. Go back to the previous step.</Alert>}
      <ActionPanel
        label="Delegation fees"
        action={
          <ManagerTypeBadge ownerType={vmcCtx.ownerType} stakingType={vmcCtx.staking.stakingType} isDetecting={false} />
        }
        call="Calls claimDelegationFees()"
      >
        <ClaimDelegationFees
          validationID={store.validationId}
          stakingManagerAddress={stakingManagerAddress}
          tokenType={tokenType}
          onSuccess={(data) => {
            store.setGlobalSuccess(data.message);
            store.setGlobalError(null);
          }}
          onError={(message) => store.setGlobalError(message)}
        />
      </ActionPanel>
    </StepLayout>
  );
}
