'use client';

import React from 'react';
import CompletePChainWeightUpdate from '@/components/toolbox/console/shared/CompletePChainWeightUpdate';
import { useDelegateStore } from '@/components/toolbox/stores/delegateStore';
import { useValidatorManagerContext } from '@/components/toolbox/contexts/ValidatorManagerContext';
import { Alert } from '@/components/toolbox/components/Alert';

export default function CompleteDelegationStep() {
  const store = useDelegateStore();
  const vmcCtx = useValidatorManagerContext();

  return (
    <div className="space-y-4">
      {!store.pChainTxId && (
        <Alert variant="warning">
          No P-Chain transaction ID from the previous step. You can enter it manually below, or go back to{' '}
          <strong>P-Chain Weight Update</strong>.
        </Alert>
      )}

      <div className="flex flex-col rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
        <div className="p-4 space-y-3">
          <CompletePChainWeightUpdate
            subnetIdL1={store.subnetIdL1}
            pChainTxId={store.pChainTxId}
            signingSubnetId={vmcCtx.signingSubnetId || store.subnetIdL1}
            updateType="Delegation"
            managerAddress={vmcCtx.contractOwner || ''}
            delegationID={store.delegationID}
            tokenType={store.tokenType}
            onSuccess={(data) => {
              store.setGlobalSuccess(data.message);
              store.setGlobalError(null);
            }}
            onError={(message) => store.setGlobalError(message)}
          />
        </div>
        <div className="shrink-0 px-4 py-2.5 border-t border-zinc-200/80 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 flex items-center justify-between mt-auto">
          <span className="text-xs text-zinc-500">Calls completeDelegatorRegistration()</span>
        </div>
      </div>
    </div>
  );
}
