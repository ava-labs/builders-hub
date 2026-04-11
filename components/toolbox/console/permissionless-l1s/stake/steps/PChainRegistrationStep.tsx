'use client';

import React from 'react';
import SubmitPChainTxRegisterL1Validator from '@/components/toolbox/console/permissioned-l1s/add-validator/SubmitPChainTxRegisterL1Validator';
import { useStakeValidatorStore, deserializeStakeValidators } from '@/components/toolbox/stores/stakeValidatorStore';
import { useValidatorManagerContext } from '@/components/toolbox/console/permissioned-l1s/shared/ValidatorManagerContext';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { Alert } from '@/components/toolbox/components/Alert';

export default function PChainRegistrationStep() {
  const store = useStakeValidatorStore();
  const vmcCtx = useValidatorManagerContext();
  const { pChainBalance } = useWalletStore();

  const userPChainBalanceNavax = pChainBalance ? BigInt(Math.floor(pChainBalance * 1e9)) : null;

  const validators = deserializeStakeValidators(store.validators);
  const validator = validators[0];
  const validatorBalance = validator ? (Number(validator.validatorBalance) / 1e9).toString() : '0.1';
  const blsProofOfPossession = validator?.nodePOP?.proofOfPossession || store.blsProofOfPossession;

  return (
    <div className="space-y-4">
      {!store.evmTxHash && (
        <Alert variant="warning">
          No transaction hash from the initiation step. You can enter it manually below, or go back to{' '}
          <strong>Initiate Registration</strong>.
        </Alert>
      )}

      <div className="flex flex-col rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
        <div className="p-4 space-y-3">
          <SubmitPChainTxRegisterL1Validator
            subnetIdL1={store.subnetIdL1}
            signingSubnetId={vmcCtx.signingSubnetId || store.subnetIdL1}
            validatorBalance={validatorBalance}
            userPChainBalanceNavax={userPChainBalanceNavax}
            blsProofOfPossession={blsProofOfPossession}
            evmTxHash={store.evmTxHash}
            onSuccess={(pChainTxId) => {
              store.setPChainTxId(pChainTxId);
              store.setGlobalError(null);
            }}
            onError={(message) => store.setGlobalError(message)}
          />
        </div>
        <div className="shrink-0 px-4 py-2.5 border-t border-zinc-200/80 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 flex items-center justify-between mt-auto">
          <span className="text-xs text-zinc-500">Submits RegisterL1ValidatorTx</span>
          <span className="text-[11px] text-zinc-400 font-mono">P-Chain</span>
        </div>
      </div>
    </div>
  );
}
