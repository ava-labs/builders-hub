'use client';

import React from 'react';
import InitiateDelegation from '@/components/toolbox/console/permissionless-l1s/delegate/InitiateDelegation';
import { useDelegateStore } from '@/components/toolbox/stores/delegateStore';
import { useValidatorManagerContext } from '@/components/toolbox/contexts/ValidatorManagerContext';
import { useToolboxStore } from '@/components/toolbox/stores/toolboxStore';
import { Alert } from '@/components/toolbox/components/Alert';

export default function InitiateDelegationStep() {
  const store = useDelegateStore();
  const vmcCtx = useValidatorManagerContext();
  const { exampleErc20Address } = useToolboxStore();

  const isNative = store.tokenType === 'native';

  return (
    <div className="space-y-4">
      {(!store.subnetIdL1 || !store.validationId) && (
        <Alert variant="warning">
          No L1 subnet selected or no validator chosen. Go back to <strong>Select L1 & Token Type</strong> to set these
          up.
        </Alert>
      )}

      <div className="flex flex-col rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
        <div className="p-4 space-y-3">
          <h2 className="text-lg font-semibold">Initiate Delegation</h2>
          <p className="text-sm text-gray-500 mb-4">
            Lock your {isNative ? 'native' : 'ERC20'} tokens to delegate to the selected validator.
            {!isNative && ' You will need to approve ERC20 tokens first.'}
          </p>

          <InitiateDelegation
            validationID={store.validationId}
            stakingManagerAddress={vmcCtx.contractOwner || ''}
            tokenType={store.tokenType}
            erc20TokenAddress={!isNative ? exampleErc20Address : undefined}
            onSuccess={(data) => {
              store.setEvmTxHash(data.txHash);
              store.setDelegationID(data.delegationID);
              store.setGlobalError(null);
            }}
            onError={(message) => store.setGlobalError(message)}
          />
        </div>
        <div className="shrink-0 px-4 py-2.5 border-t border-zinc-200/80 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 flex items-center justify-between mt-auto">
          <span className="text-xs text-zinc-500">Calls initiateDelegatorRegistration()</span>
        </div>
      </div>
    </div>
  );
}
