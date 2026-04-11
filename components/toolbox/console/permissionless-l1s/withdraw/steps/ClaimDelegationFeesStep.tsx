'use client';

import React from 'react';
import { Alert } from '@/components/toolbox/components/Alert';
import { useRemovePoSValidatorStore } from '@/components/toolbox/stores/removePoSValidatorStore';
import { useValidatorManagerDetails } from '@/components/toolbox/hooks/useValidatorManagerDetails';
import ClaimDelegationFees from '@/components/toolbox/console/permissionless-l1s/withdraw/ClaimDelegationFees';

export default function ClaimDelegationFeesStep() {
  const store = useRemovePoSValidatorStore();
  const validatorManagerDetails = useValidatorManagerDetails({ subnetId: store.subnetIdL1 });

  return (
    <div className="space-y-4">
      {!store.validationId && (
        <Alert variant="warning">
          No validation ID found. Go back to <strong>Select L1 & Token Type</strong> and choose a validator.
        </Alert>
      )}

      <div className="flex flex-col rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
        <div className="p-4 space-y-3">
          <p className="text-sm text-gray-500">
            If you had delegators, you can claim the accumulated delegation fees separately. These fees are based on the
            delegation fee percentage you set when registering the validator.
          </p>

          <ClaimDelegationFees
            validationID={store.validationId}
            stakingManagerAddress={validatorManagerDetails.contractOwner || ''}
            tokenType={store.tokenType}
            onSuccess={(data) => {
              store.setGlobalSuccess(data.message);
              store.setGlobalError(null);
            }}
            onError={(message) => store.setGlobalError(message)}
          />
        </div>
        <div className="shrink-0 px-4 py-2.5 border-t border-zinc-200/80 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 flex items-center justify-between mt-auto">
          <span className="text-xs text-zinc-500">Calls claimDelegationFees()</span>
          <span className="text-[11px] text-zinc-400 font-mono">
            {store.tokenType === 'native' ? 'NativeTokenStakingManager' : 'ERC20TokenStakingManager'}
          </span>
        </div>
      </div>
    </div>
  );
}
