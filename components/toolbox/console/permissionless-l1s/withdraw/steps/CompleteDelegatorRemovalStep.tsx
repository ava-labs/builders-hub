'use client';

import React from 'react';
import { Alert } from '@/components/toolbox/components/Alert';
import { useRemoveDelegationStore } from '@/components/toolbox/stores/removeDelegationStore';
import { useValidatorManagerDetails } from '@/components/toolbox/hooks/useValidatorManagerDetails';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import CompleteDelegatorRemoval from '@/components/toolbox/console/permissionless-l1s/withdraw/CompleteDelegatorRemoval';

export default function CompleteDelegatorRemovalStep() {
  const store = useRemoveDelegationStore();
  const validatorManagerDetails = useValidatorManagerDetails({ subnetId: store.subnetIdL1 });
  const { coreWalletClient } = useWalletStore();

  return (
    <div className="space-y-4">
      {!coreWalletClient && (
        <Alert variant="warning">
          <strong>Core Wallet required.</strong> The complete removal step uses Core Wallet to extract the
          L1ValidatorWeightMessage from the P-Chain transaction. Please connect Core Wallet to proceed.
        </Alert>
      )}
      {!store.pChainTxId && (
        <Alert variant="warning">
          No P-Chain transaction ID from the previous step. You can enter it manually below, or go back to{' '}
          <strong>P-Chain Weight Update</strong>.
        </Alert>
      )}

      <div className="flex flex-col rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
        <div className="p-4 space-y-3">
          <p className="text-sm text-gray-500">
            Finalize the delegation removal by calling{' '}
            <a
              href="https://github.com/ava-labs/icm-contracts/blob/main/contracts/validator-manager/StakingManager.sol"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 underline"
            >
              completeDelegatorRemoval
            </a>
            . This will aggregate the P-Chain signature, return your delegated stake, and distribute rewards (minus
            delegation fees).
          </p>

          <CompleteDelegatorRemoval
            delegationID={store.delegationId}
            stakingManagerAddress={validatorManagerDetails.contractOwner || ''}
            tokenType={store.tokenType}
            subnetIdL1={store.subnetIdL1}
            signingSubnetId={validatorManagerDetails.signingSubnetId}
            pChainTxId={store.pChainTxId}
            onSuccess={(data) => {
              store.setGlobalSuccess(data.message);
              store.setGlobalError(null);
            }}
            onError={(message) => store.setGlobalError(message)}
          />
        </div>
        <div className="shrink-0 px-4 py-2.5 border-t border-zinc-200/80 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 flex items-center justify-between mt-auto">
          <span className="text-xs text-zinc-500">Calls completeDelegatorRemoval()</span>
          <span className="text-[11px] text-zinc-400 font-mono">
            {store.tokenType === 'native' ? 'NativeTokenStakingManager' : 'ERC20TokenStakingManager'}
          </span>
        </div>
      </div>
    </div>
  );
}
