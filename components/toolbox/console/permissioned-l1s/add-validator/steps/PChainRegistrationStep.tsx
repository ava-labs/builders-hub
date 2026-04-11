'use client';

import React from 'react';
import SubmitPChainTxRegisterL1Validator from '../SubmitPChainTxRegisterL1Validator';
import { useAddValidatorStore } from '@/components/toolbox/stores/addValidatorStore';
import { useValidatorManagerContext } from '@/components/toolbox/contexts/ValidatorManagerContext';
import { Alert } from '@/components/toolbox/components/Alert';
import { StepCodeViewer } from '@/components/console/step-code-viewer';
import { STEP_CONFIG } from '../codeConfig';

export default function PChainRegistrationStep() {
  const store = useAddValidatorStore();
  const vmcCtx = useValidatorManagerContext();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
      <div className="space-y-4">
        {!store.evmTxHash && (
          <Alert variant="warning">
            No transaction hash from the initiation step. You can enter it manually below, or go back to{' '}
            <strong>Initiate Registration</strong>.
          </Alert>
        )}
        <div className="flex flex-col rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
          <div className="p-4 space-y-3">
            <SubmitPChainTxRegisterL1Validator
              subnetIdL1={store.subnetIdL1}
              signingSubnetId={vmcCtx.signingSubnetId}
              validatorBalance={store.validatorBalance}
              blsProofOfPossession={store.blsProofOfPossession}
              evmTxHash={store.evmTxHash}
              onSuccess={(pChainTxId) => {
                store.setPChainTxId(pChainTxId);
                store.setGlobalError(null);
              }}
              onError={(message) => store.setGlobalError(message)}
            />
          </div>
          <div className="shrink-0 px-4 py-2.5 border-t border-zinc-200/80 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 flex items-center justify-between mt-auto">
            <span className="text-xs text-zinc-500">Submits RegisterL1ValidatorTx</span>
            <span className="text-[11px] text-zinc-400 font-mono">P-Chain</span>
          </div>
        </div>
      </div>
      <StepCodeViewer activeStep={2} steps={STEP_CONFIG} className="lg:sticky lg:top-4 lg:self-start" />
    </div>
  );
}
