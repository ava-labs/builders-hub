'use client';

import React from 'react';
import SubmitPChainTxWeightUpdate from '@/components/toolbox/console/shared/SubmitPChainTxWeightUpdate';
import { useDelegateStore } from '@/components/toolbox/stores/delegateStore';
import { useValidatorManagerContext } from '@/components/toolbox/contexts/ValidatorManagerContext';
import { Alert } from '@/components/toolbox/components/Alert';
import { StepCodeViewer } from '@/components/console/step-code-viewer';
import { NATIVE_STEP_CONFIG, ERC20_STEP_CONFIG } from '../codeConfig';

export default function PChainWeightUpdateStep() {
  const store = useDelegateStore();
  const vmcCtx = useValidatorManagerContext();

  const isNative = store.tokenType === 'native';
  const stepConfig = isNative ? NATIVE_STEP_CONFIG : ERC20_STEP_CONFIG;

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
              txHashLabel="Initiate Delegation Transaction Hash"
              txHashPlaceholder="0x..."
              additionalInfo={
                store.delegationID ? (
                  <p className="text-xs text-zinc-500">
                    Delegation ID:{' '}
                    <code className="font-mono text-zinc-700 dark:text-zinc-300">
                      {store.delegationID.slice(0, 18)}...
                    </code>
                  </p>
                ) : undefined
              }
              onSuccess={(pChainTxId) => {
                store.setPChainTxId(pChainTxId);
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
      <StepCodeViewer activeStep={1} steps={stepConfig} className="lg:sticky lg:top-4 lg:self-start" />
    </div>
  );
}
