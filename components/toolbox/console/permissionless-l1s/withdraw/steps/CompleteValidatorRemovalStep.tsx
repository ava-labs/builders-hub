'use client';

import React from 'react';
import { Alert } from '@/components/toolbox/components/Alert';
import { useRemovePoSValidatorStore } from '@/components/toolbox/stores/removePoSValidatorStore';
import { useValidatorManagerContext } from '@/components/toolbox/contexts/ValidatorManagerContext';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import CompleteValidatorRemoval from '@/components/toolbox/console/permissionless-l1s/withdraw/CompleteValidatorRemoval';
import { StepCodeViewer } from '@/components/console/step-code-viewer';
import { VALIDATOR_REMOVAL_STEPS } from '../codeConfig';
import versions from '@/scripts/versions.json';

const ICM_COMMIT = versions['ava-labs/icm-contracts'];

export default function CompleteValidatorRemovalStep() {
  const store = useRemovePoSValidatorStore();
  const vmcCtx = useValidatorManagerContext();
  const { coreWalletClient } = useWalletStore();

  const stakingManagerAddress = vmcCtx.staking?.stakingManagerAddress || vmcCtx.validatorManagerAddress || '';
  const tokenType = vmcCtx.staking?.stakingType || 'native';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
      <div className="space-y-4">
        {!coreWalletClient && <Alert variant="warning">Core Wallet required for P-Chain signature extraction.</Alert>}
        {!store.pChainTxId && <Alert variant="warning">No P-Chain transaction ID from the previous step.</Alert>}

        <div className="flex flex-col rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
          <div className="p-4 space-y-3">
            <CompleteValidatorRemoval
              validationID={store.validationId}
              stakingManagerAddress={stakingManagerAddress}
              tokenType={tokenType}
              subnetIdL1={store.subnetIdL1}
              signingSubnetId={vmcCtx.signingSubnetId || store.subnetIdL1}
              pChainTxId={store.pChainTxId}
              onSuccess={(data) => {
                store.setGlobalSuccess(data.message);
                store.setGlobalError(null);
              }}
              onError={(message) => store.setGlobalError(message)}
            />
          </div>
          <div className="shrink-0 px-4 py-2.5 border-t border-zinc-200/80 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 flex items-center justify-between mt-auto">
            <span className="text-xs text-zinc-500">completeValidatorRemoval()</span>
            <a
              href={`https://github.com/ava-labs/icm-contracts/tree/${ICM_COMMIT}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 font-mono transition-colors"
            >
              @{ICM_COMMIT.slice(0, 7)}
            </a>
          </div>
        </div>
      </div>
      <StepCodeViewer activeStep={2} steps={VALIDATOR_REMOVAL_STEPS} className="lg:sticky lg:top-4 lg:self-start" />
    </div>
  );
}
