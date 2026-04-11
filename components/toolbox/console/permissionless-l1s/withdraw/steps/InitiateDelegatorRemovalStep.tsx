'use client';

import React from 'react';
import { Alert } from '@/components/toolbox/components/Alert';
import { useRemoveDelegationStore } from '@/components/toolbox/stores/removeDelegationStore';
import { useValidatorManagerDetails } from '@/components/toolbox/hooks/useValidatorManagerDetails';
import { useViemChainStore } from '@/components/toolbox/stores/toolboxStore';
import InitiateDelegatorRemoval from '@/components/toolbox/console/permissionless-l1s/withdraw/InitiateDelegatorRemoval';

export default function InitiateDelegatorRemovalStep() {
  const store = useRemoveDelegationStore();
  const validatorManagerDetails = useValidatorManagerDetails({ subnetId: store.subnetIdL1 });
  const viemChain = useViemChainStore();

  return (
    <div className="space-y-4">
      {!store.subnetIdL1 && (
        <Alert variant="warning">
          No L1 subnet selected. Go back to <strong>Select L1 & Token Type</strong>.
        </Alert>
      )}
      {!store.delegationId && store.subnetIdL1 && (
        <Alert variant="warning">
          No delegation selected. Go back to <strong>Select L1 & Token Type</strong> and choose a delegation.
        </Alert>
      )}

      <div className="flex flex-col rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
        <div className="p-4 space-y-3">
          <p className="text-sm text-gray-500">
            Call the{' '}
            <a
              href="https://github.com/ava-labs/icm-contracts/blob/main/contracts/validator-manager/IStakingManager.sol#L281"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 underline"
            >
              initiateDelegatorRemoval
            </a>{' '}
            function on the Staking Manager contract. You can optionally include an uptime proof to potentially increase
            your rewards.
          </p>

          <Alert variant="info" className="mb-4">
            <p className="text-sm">
              <strong>Uptime Proof:</strong> Including an uptime proof fetches the validator&apos;s uptime and may result
              in higher reward calculations based on the validator&apos;s performance.
            </p>
          </Alert>

          <InitiateDelegatorRemoval
            delegationID={store.delegationId}
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
          <span className="text-xs text-zinc-500">Calls initiateDelegatorRemoval()</span>
          <span className="text-[11px] text-zinc-400 font-mono">
            {store.tokenType === 'native' ? 'NativeTokenStakingManager' : 'ERC20TokenStakingManager'}
          </span>
        </div>
      </div>
    </div>
  );
}
