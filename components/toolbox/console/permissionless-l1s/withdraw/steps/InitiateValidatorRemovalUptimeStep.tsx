'use client';

import React from 'react';
import { Alert } from '@/components/toolbox/components/Alert';
import SelectValidationID from '@/components/toolbox/components/SelectValidationID';
import { useRemovePoSValidatorStore } from '@/components/toolbox/stores/removePoSValidatorStore';
import { useValidatorManagerContext } from '@/components/toolbox/contexts/ValidatorManagerContext';
import { useViemChainStore } from '@/components/toolbox/stores/toolboxStore';
import InitiateValidatorRemovalUptime from '@/components/toolbox/console/permissionless-l1s/withdraw/InitiateValidatorRemovalUptime';
import { StepCodeViewer } from '@/components/console/step-code-viewer';
import { VALIDATOR_REMOVAL_STEPS } from '../codeConfig';
import versions from '@/scripts/versions.json';

const ICM_COMMIT = versions['ava-labs/icm-services'];

export default function InitiateValidatorRemovalUptimeStep() {
  const store = useRemovePoSValidatorStore();
  const vmcCtx = useValidatorManagerContext();
  const viemChain = useViemChainStore();

  const stakingManagerAddress = vmcCtx.staking?.stakingManagerAddress || vmcCtx.validatorManagerAddress || '';
  const tokenType = vmcCtx.staking?.stakingType || 'native';
  const uptimeBlockchainID = vmcCtx.staking?.settings?.uptimeBlockchainID || '';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
      <div className="space-y-4">
        {!store.subnetIdL1 && <Alert variant="warning">No L1 subnet selected. Go back to the previous step.</Alert>}

        <div className="flex flex-col rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
          <div className="p-4 space-y-4">
            <SelectValidationID
              value={store.validationId}
              onChange={(selection) => {
                store.setValidationId(selection.validationId);
                store.setNodeId(selection.nodeId);
              }}
              format="hex"
              subnetId={store.subnetIdL1}
              validatorManagerAddress={stakingManagerAddress}
            />

            {store.nodeId && (
              <p className="text-xs text-zinc-500">
                Validator: <code className="font-mono text-zinc-700 dark:text-zinc-300">{store.nodeId}</code>
              </p>
            )}

            {store.validationId && stakingManagerAddress && (
              <div className="border-t border-zinc-200 dark:border-zinc-800 pt-4">
                <InitiateValidatorRemovalUptime
                  validationID={store.validationId}
                  stakingManagerAddress={stakingManagerAddress}
                  rpcUrl={viemChain?.rpcUrls?.default?.http[0] || ''}
                  uptimeBlockchainID={uptimeBlockchainID}
                  tokenType={tokenType}
                  onSuccess={(data) => {
                    store.setEvmTxHash(data.txHash);
                    store.setGlobalError(null);
                  }}
                  onError={(message) => store.setGlobalError(message)}
                />
              </div>
            )}
          </div>
          <div className="shrink-0 px-4 py-2.5 border-t border-zinc-200/80 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 flex items-center justify-between mt-auto">
            <span className="text-xs text-zinc-500">initiateValidatorRemoval() + uptime proof</span>
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
      <StepCodeViewer activeStep={0} steps={VALIDATOR_REMOVAL_STEPS} className="lg:sticky lg:top-4 lg:self-start" />
    </div>
  );
}
