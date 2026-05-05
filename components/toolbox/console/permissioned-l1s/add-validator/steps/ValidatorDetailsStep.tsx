'use client';

import React from 'react';
import { ValidatorListInput, type ConvertToL1Validator } from '@/components/toolbox/components/ValidatorListInput';
import {
  useAddValidatorStore,
  deserializeValidators,
  serializeValidators,
} from '@/components/toolbox/stores/addValidatorStore';
import { useValidatorManagerContext } from '@/components/toolbox/contexts/ValidatorManagerContext';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { Alert } from '@/components/toolbox/components/Alert';
import { StepCodeViewer } from '@/components/console/step-code-viewer';
import { STEP_CONFIG } from '../codeConfig';
import InitiateValidatorRegistration from '../InitiateValidatorRegistration';
import versions from '@/scripts/versions.json';

const ICM_COMMIT = versions['ava-labs/icm-services'];

export default function ValidatorDetailsStep() {
  const store = useAddValidatorStore();
  const vmcCtx = useValidatorManagerContext();
  const { pChainAddress, isTestnet } = useWalletStore();

  const validators = deserializeValidators(store.validators);

  const handleChange = (newValidators: ConvertToL1Validator[]) => {
    store.setValidators(serializeValidators(newValidators));
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
      <div className="flex flex-col rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
        <div className="p-4 space-y-4">
          {!store.subnetIdL1 && (
            <Alert variant="warning">
              No L1 subnet selected. Go back to <strong>Select L1 Subnet</strong> to choose one.
            </Alert>
          )}

          <ValidatorListInput
            validators={validators}
            onChange={handleChange}
            defaultAddress={pChainAddress ?? ''}
            label=""
            l1TotalInitializedWeight={
              !vmcCtx.l1WeightError && vmcCtx.contractTotalWeight > 0n ? vmcCtx.contractTotalWeight : null
            }
            maxValidators={1}
            selectedSubnetId={store.subnetIdL1}
            isTestnet={isTestnet}
          />

          {/* Initiate Registration — flows naturally below the validator form */}
          {validators.length > 0 && (
            <div className="border-t border-zinc-200 dark:border-zinc-800 pt-4">
              <InitiateValidatorRegistration
                subnetId={store.subnetIdL1 || ''}
                validatorManagerAddress={vmcCtx.validatorManagerAddress}
                validators={validators}
                ownershipState={vmcCtx.ownershipStatus}
                refetchOwnership={vmcCtx.refetchOwnership}
                ownershipError={vmcCtx.ownershipError}
                contractTotalWeight={vmcCtx.contractTotalWeight}
                l1WeightError={vmcCtx.l1WeightError}
                onSuccess={(data) => {
                  store.setEvmTxHash(data.txHash);
                  store.setValidatorBalance(data.validatorBalance);
                  store.setBlsProofOfPossession(data.blsProofOfPossession);
                  store.setGlobalError(null);
                }}
                onError={(message) => store.setGlobalError(message)}
              />
            </div>
          )}
        </div>
        <div className="shrink-0 px-4 py-2.5 border-t border-zinc-200/80 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 flex items-center justify-between mt-auto">
          <span className="text-xs text-zinc-500">Calls initiateValidatorRegistration()</span>
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
      <StepCodeViewer activeStep={1} steps={STEP_CONFIG} className="lg:sticky lg:top-4 lg:self-start" />
    </div>
  );
}
