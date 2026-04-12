'use client';

import React from 'react';
import { Alert } from '@/components/toolbox/components/Alert';
import { useRemoveValidatorStore } from '@/components/toolbox/stores/removeValidatorStore';
import { useValidatorManagerContext } from '@/components/toolbox/contexts/ValidatorManagerContext';
import CompleteValidatorRemoval from '../CompleteValidatorRemoval';
import { StepCodeViewer } from '@/components/console/step-code-viewer';
import { STEP_CONFIG } from '../codeConfig';
import versions from '@/scripts/versions.json';

const ICM_COMMIT = versions['ava-labs/icm-contracts'];

export default function CompleteRemovalStep() {
  const store = useRemoveValidatorStore();
  const vmcCtx = useValidatorManagerContext();

  const isContractOwner =
    vmcCtx.ownershipStatus === 'currentWallet' ? true : vmcCtx.ownershipStatus === 'differentEOA' ? false : null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
      <div className="space-y-4">
        {!store.pChainTxId && (
          <Alert variant="warning">
            No P-Chain transaction ID from the previous step. You can enter it manually below, or go back to{' '}
            <strong>P-Chain Weight Update</strong>.
          </Alert>
        )}
        <div className="flex flex-col rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
          <div className="p-4 space-y-3">
            <CompleteValidatorRemoval
              subnetIdL1={store.subnetIdL1}
              validationId={store.validationId}
              pChainTxId={store.pChainTxId}
              eventData={null}
              isContractOwner={isContractOwner}
              validatorManagerAddress={vmcCtx.validatorManagerAddress}
              signingSubnetId={vmcCtx.signingSubnetId}
              contractOwner={vmcCtx.contractOwner}
              isLoadingOwnership={vmcCtx.isLoadingOwnership}
              ownerType={vmcCtx.ownerType}
              onSuccess={(message) => {
                store.setGlobalSuccess(message);
                store.setGlobalError(null);
              }}
              onError={(message) => store.setGlobalError(message)}
            />
          </div>
          <div className="shrink-0 px-4 py-2.5 border-t border-zinc-200/80 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 flex items-center justify-between mt-auto">
            <span className="text-xs text-zinc-500">Calls completeValidatorRemoval()</span>
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
      <StepCodeViewer activeStep={3} steps={STEP_CONFIG} className="lg:sticky lg:top-4 lg:self-start" />
    </div>
  );
}
