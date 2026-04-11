'use client';

import React from 'react';
import InitiateValidatorRegistration from '@/components/toolbox/console/permissionless-l1s/stake/InitiateValidatorRegistration';
import {
  useStakeValidatorStore,
  deserializeStakeValidators,
} from '@/components/toolbox/stores/stakeValidatorStore';
import { useValidatorManagerContext } from '@/components/toolbox/console/permissioned-l1s/shared/ValidatorManagerContext';
import { useToolboxStore } from '@/components/toolbox/stores/toolboxStore';
import { Alert } from '@/components/toolbox/components/Alert';

export default function InitiateRegistrationStep() {
  const store = useStakeValidatorStore();
  const vmcCtx = useValidatorManagerContext();
  const { exampleErc20Address } = useToolboxStore();

  const validators = deserializeStakeValidators(store.validators);
  const validator = validators[0];

  const nodeID = validator?.nodeID || '';
  const blsPublicKey = validator?.nodePOP?.publicKey || '';

  const isNative = store.tokenType === 'native';
  const tokenLabel = isNative ? 'Native Token' : 'ERC20 Token';

  return (
    <div className="space-y-4">
      {(!store.subnetIdL1 || store.validators.length === 0) && (
        <Alert variant="warning">
          No L1 subnet selected or no validator configured. Go back to{' '}
          <strong>Select L1 & Token Type</strong> to set these up.
        </Alert>
      )}

      <div className="flex flex-col rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
        <div className="p-4 space-y-3">
          <h2 className="text-lg font-semibold">Initiate Validator Registration</h2>
          <p className="text-sm text-gray-500 mb-4">
            Register your validator on the staking manager contract and lock your{' '}
            {isNative ? 'native token' : 'ERC20 token'} stake.
            {!isNative && ' You will need to approve ERC20 tokens first.'}
          </p>

          <InitiateValidatorRegistration
            nodeID={nodeID}
            blsPublicKey={blsPublicKey}
            stakingManagerAddress={vmcCtx.contractOwner || ''}
            tokenType={store.tokenType}
            erc20TokenAddress={!isNative ? exampleErc20Address : undefined}
            remainingBalanceOwner={validator?.remainingBalanceOwner}
            disableOwner={validator?.deactivationOwner}
            onSuccess={(data) => {
              store.setEvmTxHash(data.txHash);
              store.setValidationID(data.validationID);
              store.setGlobalError(null);
            }}
            onError={(message) => store.setGlobalError(message)}
          />
        </div>
        <div className="shrink-0 px-4 py-2.5 border-t border-zinc-200/80 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 flex items-center justify-between mt-auto">
          <span className="text-xs text-zinc-500">Calls initiateValidatorRegistration() ({tokenLabel})</span>
        </div>
      </div>
    </div>
  );
}
