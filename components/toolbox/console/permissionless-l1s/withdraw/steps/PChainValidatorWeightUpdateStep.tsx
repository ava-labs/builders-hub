'use client';

import React from 'react';
import { Alert } from '@/components/toolbox/components/Alert';
import { useRemovePoSValidatorStore } from '@/components/toolbox/stores/removePoSValidatorStore';
import { useValidatorManagerDetails } from '@/components/toolbox/hooks/useValidatorManagerDetails';
import SubmitPChainTxWeightUpdate from '@/components/toolbox/console/shared/SubmitPChainTxWeightUpdate';

export default function PChainValidatorWeightUpdateStep() {
  const store = useRemovePoSValidatorStore();
  const validatorManagerDetails = useValidatorManagerDetails({ subnetId: store.subnetIdL1 });

  return (
    <div className="space-y-4">
      {!store.evmTxHash && (
        <Alert variant="warning">
          No transaction hash from the initiation step. You can enter it manually below, or go back to{' '}
          <strong>Initiate Removal</strong>.
        </Alert>
      )}

      <div className="flex flex-col rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
        <div className="p-4 space-y-3">
          <p className="text-sm text-gray-500">
            Submit the weight update to the P-Chain. This step aggregates signatures from L1 validators and updates the
            validator&apos;s weight on the P-Chain to reflect the removal.
          </p>

          <SubmitPChainTxWeightUpdate
            subnetIdL1={store.subnetIdL1}
            initialEvmTxHash={store.evmTxHash}
            signingSubnetId={validatorManagerDetails.signingSubnetId}
            txHashLabel="Initiate Removal Transaction Hash"
            txHashPlaceholder="Enter the transaction hash from the initiate removal step (0x...)"
            onSuccess={(txId) => {
              store.setPChainTxId(txId);
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
