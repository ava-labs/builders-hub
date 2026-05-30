'use client';

import React from 'react';
import CompletePChainWeightUpdate from '@/components/toolbox/console/shared/CompletePChainWeightUpdate';
import { useDelegateStore } from '@/components/toolbox/stores/delegateStore';
import { useValidatorManagerContext } from '@/components/toolbox/contexts/ValidatorManagerContext';
import { Alert } from '@/components/toolbox/components/Alert';
import { StepCodeViewer } from '@/components/console/step-code-viewer';
import { NATIVE_STEP_CONFIG, ERC20_STEP_CONFIG } from '../codeConfig';
import versions from '@/scripts/versions.json';

const ICM_COMMIT = versions['ava-labs/icm-services'];

export default function CompleteDelegationStep() {
  const store = useDelegateStore();
  const vmcCtx = useValidatorManagerContext();

  const isNative = store.tokenType === 'native';
  const stepConfig = isNative ? NATIVE_STEP_CONFIG : ERC20_STEP_CONFIG;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
      <div className="space-y-4">
        {!store.pChainTxId && <Alert variant="warning">No P-Chain transaction ID from the previous step.</Alert>}

        <div className="flex flex-col rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
          <div className="p-4 space-y-3">
            <CompletePChainWeightUpdate
              subnetIdL1={store.subnetIdL1}
              pChainTxId={store.pChainTxId}
              signingSubnetId={vmcCtx.signingSubnetId || store.subnetIdL1}
              updateType="Delegation"
              managerAddress={vmcCtx.staking?.stakingManagerAddress || vmcCtx.validatorManagerAddress || ''}
              delegationID={store.delegationID}
              tokenType={store.tokenType}
              onSuccess={(data) => {
                store.setGlobalSuccess(data.message);
                store.setGlobalError(null);
              }}
              onError={(message) => store.setGlobalError(message)}
            />
          </div>
          <div className="shrink-0 px-4 py-2.5 border-t border-zinc-200/80 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 flex items-center justify-between mt-auto">
            <span className="text-xs text-zinc-500">completeDelegatorRegistration()</span>
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
      <StepCodeViewer activeStep={2} steps={stepConfig} className="lg:sticky lg:top-4 lg:self-start" />
    </div>
  );
}
