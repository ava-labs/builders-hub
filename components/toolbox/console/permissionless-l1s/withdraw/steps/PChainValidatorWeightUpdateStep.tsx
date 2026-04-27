'use client';

import React from 'react';
import { Alert } from '@/components/toolbox/components/Alert';
import { useRemovePoSValidatorStore } from '@/components/toolbox/stores/removePoSValidatorStore';
import { useValidatorManagerContext } from '@/components/toolbox/contexts/ValidatorManagerContext';
import SubmitPChainTxWeightUpdate from '@/components/toolbox/console/shared/SubmitPChainTxWeightUpdate';
import { StepCodeViewer } from '@/components/console/step-code-viewer';
import { VALIDATOR_REMOVAL_STEPS } from '../codeConfig';

export default function PChainValidatorWeightUpdateStep() {
  const store = useRemovePoSValidatorStore();
  const vmcCtx = useValidatorManagerContext();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
      <div className="space-y-4">
        {!store.evmTxHash && <Alert variant="warning">No transaction hash from the initiation step.</Alert>}

        <div className="flex flex-col rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
          <div className="p-4 space-y-3">
            <SubmitPChainTxWeightUpdate
              subnetIdL1={store.subnetIdL1}
              initialEvmTxHash={store.evmTxHash}
              signingSubnetId={vmcCtx.signingSubnetId || store.subnetIdL1}
              txHashLabel="Initiate Removal Transaction Hash"
              txHashPlaceholder="0x..."
              onSuccess={(txId) => {
                store.setPChainTxId(txId);
                store.setGlobalError(null);
              }}
              onError={(message) => store.setGlobalError(message)}
            />
          </div>
          <div className="shrink-0 px-4 py-2.5 border-t border-zinc-200/80 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 flex items-center justify-between mt-auto">
            <span className="text-xs text-zinc-500">SetL1ValidatorWeightTx</span>
            <span className="text-[11px] text-zinc-400 font-mono">P-Chain</span>
          </div>
        </div>
      </div>
      <StepCodeViewer activeStep={1} steps={VALIDATOR_REMOVAL_STEPS} className="lg:sticky lg:top-4 lg:self-start" />
    </div>
  );
}
