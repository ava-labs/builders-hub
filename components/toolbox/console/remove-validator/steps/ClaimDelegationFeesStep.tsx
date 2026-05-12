'use client';

import React, { useMemo } from 'react';
import { Alert } from '@/components/toolbox/components/Alert';
import { useRemoveValidatorStore } from '@/components/toolbox/stores/removeValidatorStore';
import { useValidatorManagerContext } from '@/components/toolbox/contexts/ValidatorManagerContext';
import ClaimDelegationFees from '@/components/toolbox/console/permissionless-l1s/withdraw/ClaimDelegationFees';
import { StepCodeViewer } from '@/components/console/step-code-viewer';
import { ManagerTypeBadge } from '@/components/toolbox/console/add-validator/ManagerTypeBadge';
import { buildStepConfig, type ManagerCodeFlavor } from '../codeConfig';
import versions from '@/scripts/versions.json';

const ICM_COMMIT = versions['ava-labs/icm-services'];

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

  const flavor = useMemo(() => flavorFor(vmcCtx.ownerType, vmcCtx.staking.stakingType), [
    vmcCtx.ownerType,
    vmcCtx.staking.stakingType,
  ]);
  const stepConfig = useMemo(() => buildStepConfig(flavor), [flavor]);
  const isStaking = flavor !== 'PoA';

  const stakingManagerAddress = vmcCtx.staking.stakingManagerAddress || vmcCtx.validatorManagerAddress || '';
  const tokenType: 'native' | 'erc20' =
    vmcCtx.staking.stakingType === 'erc20' ? 'erc20' : 'native';

  if (!isStaking) {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Claim Delegation Fees</h2>
        <Alert variant="info">
          Delegation fees only exist on PoS L1s (validators on PoS managers earn a commission on delegated stake). This
          L1 is permissioned (PoA), so there's nothing to claim — you can skip to the next step.
        </Alert>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">Claim Delegation Fees</h2>
          <ManagerTypeBadge
            ownerType={vmcCtx.ownerType}
            stakingType={vmcCtx.staking.stakingType}
            isDetecting={false}
          />
        </div>
        {!store.validationId && (
          <Alert variant="warning">No validation ID found. Go back to the previous step.</Alert>
        )}
        <div className="flex flex-col rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
          <div className="p-4">
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
          </div>
          <div className="shrink-0 px-4 py-2.5 border-t border-zinc-200/80 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 flex items-center justify-between mt-auto">
            <span className="text-xs text-zinc-500">claimDelegationFees()</span>
            <a
              href={`https://github.com/ava-labs/icm-services/tree/${ICM_COMMIT}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 font-mono transition-colors"
            >
              @{ICM_COMMIT.slice(0, 7)}
            </a>
          </div>
        </div>
      </div>
      <StepCodeViewer activeStep={4} steps={stepConfig} className="lg:sticky lg:top-4 lg:self-start" />
    </div>
  );
}
