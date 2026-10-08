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
import { ActionPanel, StepLayout } from '@/components/toolbox/console/shared/validator-flow-ui';

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

  const flavor = useMemo(
    () => flavorFor(vmcCtx.ownerType, vmcCtx.staking.stakingType),
    [vmcCtx.ownerType, vmcCtx.staking.stakingType],
  );
  const stepConfig = useMemo(() => buildStepConfig(flavor), [flavor]);
  const isStaking = flavor !== 'PoA';
  const stakingManagerAddress = vmcCtx.staking.stakingManagerAddress || vmcCtx.validatorManagerAddress || '';
  const tokenType: 'native' | 'erc20' = vmcCtx.staking.stakingType === 'erc20' ? 'erc20' : 'native';

  // PoA derives ownership from the wallet check we already did in step 1.
  const isContractOwner =
    vmcCtx.ownershipStatus === 'currentWallet' ? true : vmcCtx.ownershipStatus === 'differentEOA' ? false : null;

  return (
    <StepLayout aside={<StepCodeViewer activeStep={3} steps={stepConfig} />}>
      {vmcCtx.chainMismatch && <VmcChainSwitchBanner mismatch={vmcCtx.chainMismatch} />}
      {isStaking && !coreWalletClient && (
        <Alert variant="warning">P-Chain signature extraction needs Core or a Console wallet.</Alert>
      )}
      {!store.pChainTxId && (
        <Alert variant="warning">
          No P-Chain transaction ID from the previous step. Enter it below, or go back to{' '}
          <strong>P-Chain Weight Update</strong>.
        </Alert>
      )}
      <ActionPanel
        label="Complete on the L1"
        action={
          <ManagerTypeBadge ownerType={vmcCtx.ownerType} stakingType={vmcCtx.staking.stakingType} isDetecting={false} />
        }
        call="Calls completeValidatorRemoval()"
      >
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
      </ActionPanel>
    </StepLayout>
  );
}
