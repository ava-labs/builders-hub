'use client';

import React from 'react';
import SubmitPChainTxWeightUpdate from '@/components/toolbox/console/shared/SubmitPChainTxWeightUpdate';
import { useDelegateStore } from '@/components/toolbox/stores/delegateStore';
import { useValidatorManagerContext } from '@/components/toolbox/contexts/ValidatorManagerContext';
import { Alert } from '@/components/toolbox/components/Alert';

export default function PChainWeightUpdateStep() {
  const store = useDelegateStore();
  const vmcCtx = useValidatorManagerContext();

  return (
    <div className="space-y-4">
      {!store.evmTxHash && (
        <Alert variant="warning">
          No transaction hash from the initiation step. You can enter it manually below, or go back to{' '}
          <strong>Initiate Delegation</strong>.
        </Alert>
      )}

      <div className="flex flex-col rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
        <div className="p-4 space-y-3">
          <SubmitPChainTxWeightUpdate
            subnetIdL1={store.subnetIdL1}
            initialEvmTxHash={store.evmTxHash}
            signingSubnetId={vmcCtx.signingSubnetId || store.subnetIdL1}
            txHashLabel="Initiate Delegation Transaction Hash"
            txHashPlaceholder="Enter the transaction hash from the Initiate Delegation step (0x...)"
            additionalInfo={
              store.delegationID ? (
                <div className="text-sm text-zinc-600 dark:text-zinc-400">
                  <p>
                    <strong>Delegation ID:</strong>
                  </p>
                  <p className="font-mono text-xs break-all">{store.delegationID}</p>
                </div>
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
          <span className="text-xs text-zinc-500">Submits SetL1ValidatorWeightTx</span>
          <span className="text-[11px] text-zinc-400 font-mono">P-Chain</span>
        </div>
      </div>
    </div>
  );
}
