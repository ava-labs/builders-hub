'use client';

import React from 'react';
import { Alert } from '@/components/toolbox/components/Alert';
import { useRemovePoSValidatorStore } from '@/components/toolbox/stores/removePoSValidatorStore';
import { useValidatorManagerDetails } from '@/components/toolbox/hooks/useValidatorManagerDetails';
import { useViemChainStore } from '@/components/toolbox/stores/toolboxStore';
import InitiateValidatorRemoval from '@/components/toolbox/console/permissionless-l1s/withdraw/InitiateValidatorRemoval';

export default function InitiateValidatorRemovalStep() {
  const store = useRemovePoSValidatorStore();
  const validatorManagerDetails = useValidatorManagerDetails({ subnetId: store.subnetIdL1 });
  const viemChain = useViemChainStore();

  return (
    <div className="space-y-4">
      {!store.subnetIdL1 && (
        <Alert variant="warning">
          No L1 subnet selected. Go back to <strong>Select L1 & Token Type</strong>.
        </Alert>
      )}
      {!store.validationId && store.subnetIdL1 && (
        <Alert variant="warning">
          No validator selected. Go back to <strong>Select L1 & Token Type</strong> and choose a validator.
        </Alert>
      )}

      <div className="flex flex-col rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
        <div className="p-4 space-y-3">
          <p className="text-sm text-gray-500">
            Call the{' '}
            <a
              href="https://github.com/ava-labs/icm-contracts/blob/main/contracts/validator-manager/StakingManager.sol#L241"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 underline"
            >
              initiateValidatorRemoval
            </a>{' '}
            function on the Staking Manager contract. This will start the validator removal process and emit a warp
            message for P-Chain submission.
          </p>

          <InitiateValidatorRemoval
            validationID={store.validationId}
            stakingManagerAddress={validatorManagerDetails.contractOwner || ''}
            rpcUrl={viemChain?.rpcUrls?.default?.http[0] || ''}
            signingSubnetId={validatorManagerDetails.signingSubnetId}
            tokenType={store.tokenType}
            onSuccess={(data) => {
              store.setEvmTxHash(data.txHash);
              store.setGlobalError(null);
            }}
            onError={(message) => store.setGlobalError(message)}
          />
        </div>
        <div className="shrink-0 px-4 py-2.5 border-t border-zinc-200/80 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 flex items-center justify-between mt-auto">
          <span className="text-xs text-zinc-500">Calls initiateValidatorRemoval()</span>
          <span className="text-[11px] text-zinc-400 font-mono">
            {store.tokenType === 'native' ? 'NativeTokenStakingManager' : 'ERC20TokenStakingManager'}
          </span>
        </div>
      </div>
    </div>
  );
}
