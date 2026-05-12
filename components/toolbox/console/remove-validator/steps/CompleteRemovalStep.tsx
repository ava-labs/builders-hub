'use client';

import React, { useMemo } from 'react';
import { Alert } from '@/components/toolbox/components/Alert';
import { useRemoveValidatorStore } from '@/components/toolbox/stores/removeValidatorStore';
import { useValidatorManagerContext } from '@/components/toolbox/contexts/ValidatorManagerContext';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import PoACompleteValidatorRemoval from '@/components/toolbox/console/permissioned-l1s/remove-validator/CompleteValidatorRemoval';
import StakingCompleteValidatorRemoval from '@/components/toolbox/console/permissionless-l1s/withdraw/CompleteValidatorRemoval';
import { StepCodeViewer } from '@/components/console/step-code-viewer';
import { ManagerTypeBadge } from '@/components/toolbox/console/add-validator/ManagerTypeBadge';
import { VmcChainSwitchBanner } from '@/components/toolbox/console/add-validator/VmcChainSwitchBanner';
import { buildStepConfig, type ManagerCodeFlavor } from '../codeConfig';
import versions from '@/scripts/versions.json';

const ICM_COMMIT = versions['ava-labs/icm-services'];

function flavorFor(
  ownerType: ReturnType<typeof useValidatorManagerContext>['ownerType'],
  stakingType: ReturnType<typeof useValidatorManagerContext>['staking']['stakingType'],
): ManagerCodeFlavor {
  if (ownerType === 'StakingManager' && stakingType === 'native') return 'PoS-Native';
  if (ownerType === 'StakingManager' && stakingType === 'erc20') return 'PoS-ERC20';
  return 'PoA';
}

export default function CompleteRemovalStep() {
  const store = useRemoveValidatorStore();
  const vmcCtx = useValidatorManagerContext();
  const coreWalletClient = useWalletStore((s) => s.coreWalletClient);

  const flavor = useMemo(() => flavorFor(vmcCtx.ownerType, vmcCtx.staking.stakingType), [
    vmcCtx.ownerType,
    vmcCtx.staking.stakingType,
  ]);
  const stepConfig = useMemo(() => buildStepConfig(flavor), [flavor]);
  const isStaking = flavor !== 'PoA';
  const stakingManagerAddress = vmcCtx.staking.stakingManagerAddress || vmcCtx.validatorManagerAddress || '';
  const tokenType: 'native' | 'erc20' =
    vmcCtx.staking.stakingType === 'erc20' ? 'erc20' : 'native';

  // PoA derives ownership from the wallet check we already did in step 1.
  const isContractOwner =
    vmcCtx.ownershipStatus === 'currentWallet' ? true : vmcCtx.ownershipStatus === 'differentEOA' ? false : null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">Complete Removal</h2>
          <ManagerTypeBadge
            ownerType={vmcCtx.ownerType}
            stakingType={vmcCtx.staking.stakingType}
            isDetecting={false}
          />
        </div>
        {vmcCtx.chainMismatch && <VmcChainSwitchBanner mismatch={vmcCtx.chainMismatch} />}
        {isStaking && !coreWalletClient && (
          <Alert variant="warning">Core Wallet required for P-Chain signature extraction.</Alert>
        )}
        {!store.pChainTxId && (
          <Alert variant="warning">
            No P-Chain transaction ID from the previous step. You can enter it manually below, or go back to{' '}
            <strong>P-Chain Weight Update</strong>.
          </Alert>
        )}
        <div className="flex flex-col rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
          <div className="p-4 space-y-3">
            {isStaking ? (
              <StakingCompleteValidatorRemoval
                validationID={store.validationId}
                stakingManagerAddress={stakingManagerAddress}
                tokenType={tokenType}
                subnetIdL1={store.subnetIdL1}
                signingSubnetId={vmcCtx.signingSubnetId || store.subnetIdL1}
                pChainTxId={store.pChainTxId}
                onSuccess={(data) => {
                  store.setGlobalSuccess(data.message);
                  store.setGlobalError(null);
                }}
                onError={(message) => store.setGlobalError(message)}
              />
            ) : (
              <PoACompleteValidatorRemoval
                subnetIdL1={store.subnetIdL1}
                validationId={store.validationId}
                pChainTxId={store.pChainTxId}
                eventData={null}
                isContractOwner={isContractOwner}
                validatorManagerAddress={vmcCtx.validatorManagerAddress}
                signingSubnetId={vmcCtx.signingSubnetId}
                contractOwner={vmcCtx.contractOwner}
                isLoadingOwnership={vmcCtx.isLoadingOwnership}
                ownerType={vmcCtx.ownerType}
                onSuccess={(message) => {
                  store.setGlobalSuccess(message);
                  store.setGlobalError(null);
                }}
                onError={(message) => store.setGlobalError(message)}
              />
            )}
          </div>
          <div className="shrink-0 px-4 py-2.5 border-t border-zinc-200/80 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 flex items-center justify-between mt-auto">
            <span className="text-xs text-zinc-500">Calls completeValidatorRemoval()</span>
            <a
              href={`https://github.com/ava-labs/icm-services/tree/${ICM_COMMIT}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 font-mono transition-colors"
            >
              @{ICM_COMMIT.slice(0, 7)}
            </a>
          </div>
        </div>
      </div>
      <StepCodeViewer activeStep={3} steps={stepConfig} className="lg:sticky lg:top-4 lg:self-start" />
    </div>
  );
}
