'use client';

import React from 'react';
import { Alert } from '@/components/toolbox/components/Alert';
import { useRemovePoSValidatorStore } from '@/components/toolbox/stores/removePoSValidatorStore';
import { useValidatorManagerContext } from '@/components/toolbox/contexts/ValidatorManagerContext';
import ClaimDelegationFees from '@/components/toolbox/console/permissionless-l1s/withdraw/ClaimDelegationFees';
import { StepCodeViewer } from '@/components/console/step-code-viewer';
import { VALIDATOR_REMOVAL_STEPS } from '../codeConfig';
import versions from '@/scripts/versions.json';

const ICM_COMMIT = versions['ava-labs/icm-services'];

export default function ClaimDelegationFeesStep() {
  const store = useRemovePoSValidatorStore();
  const vmcCtx = useValidatorManagerContext();

  const stakingManagerAddress = vmcCtx.staking?.stakingManagerAddress || vmcCtx.contractOwner || '';
  const tokenType = vmcCtx.staking?.stakingType || 'native';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
      <div className="space-y-4">
        {!store.validationId && <Alert variant="warning">No validation ID found. Go back to the previous step.</Alert>}

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
      <StepCodeViewer activeStep={3} steps={VALIDATOR_REMOVAL_STEPS} className="lg:sticky lg:top-4 lg:self-start" />
    </div>
  );
}
