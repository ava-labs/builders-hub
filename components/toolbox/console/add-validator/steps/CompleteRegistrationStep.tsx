'use client';

import React, { useMemo } from 'react';
import CompletePChainRegistration, {
  type ManagerType,
} from '@/components/toolbox/console/shared/CompletePChainRegistration';
import { useAddValidatorStore } from '@/components/toolbox/stores/addValidatorStore';
import { useValidatorManagerContext } from '@/components/toolbox/contexts/ValidatorManagerContext';
import { Alert } from '@/components/toolbox/components/Alert';
import { useValidatorPreflight } from '@/components/toolbox/hooks/useValidatorPreflight';
import { StepCodeViewer } from '@/components/console/step-code-viewer';
import { ManagerTypeBadge } from '../ManagerTypeBadge';
import { VmcChainSwitchBanner } from '../VmcChainSwitchBanner';
import { buildStepConfig } from '../codeConfig';
import { ActionPanel, StepLayout, Working } from '@/components/toolbox/console/shared/validator-flow-ui';

export default function CompleteRegistrationStep() {
  const store = useAddValidatorStore();
  const vmcCtx = useValidatorManagerContext();

  const isStaking = vmcCtx.ownerType === 'StakingManager';
  // For inheritance-model L1s (NativeStakingManager IS the ValidatorManager),
  // contractOwner is the deployer EOA, so validatorManagerAddress is the right
  // target for completeValidatorRegistration.
  const stakingManagerAddress = vmcCtx.staking.stakingManagerAddress || vmcCtx.validatorManagerAddress || null;

  const managerType: ManagerType =
    isStaking && vmcCtx.staking.stakingType === 'native'
      ? 'PoS-Native'
      : isStaking && vmcCtx.staking.stakingType === 'erc20'
        ? 'PoS-ERC20'
        : 'PoA';

  const managerAddress = isStaking ? stakingManagerAddress || '' : vmcCtx.validatorManagerAddress || '';

  // Only PoS persists a validationID (set on initiate). PoA derives it locally
  // from the warp message inside CompletePChainRegistration, so we leave it
  // undefined and let preflight skip the on-chain status read.
  const preflight = useValidatorPreflight({
    validationID: isStaking && store.validationID ? store.validationID : undefined,
    stakingManagerAddress: isStaking ? stakingManagerAddress : null,
    validatorManagerAddress: vmcCtx.validatorManagerAddress || null,
  });

  const stepConfig = useMemo(() => buildStepConfig(managerType), [managerType]);

  return (
    <StepLayout aside={<StepCodeViewer activeStep={3} steps={stepConfig} />}>
      {vmcCtx.chainMismatch && <VmcChainSwitchBanner mismatch={vmcCtx.chainMismatch} />}
      {!store.pChainTxId && (
        <Alert variant="warning">
          No P-Chain transaction ID from the previous step. Enter it below, or go back to{' '}
          <strong>P-Chain Registration</strong>.
        </Alert>
      )}
      {isStaking && store.validationID && preflight.isLoading && <Working>Checking validator status</Working>}
      {isStaking && store.validationID && !preflight.isLoading && preflight.status !== 1 && preflight.status !== 0 && (
        <Alert variant="info">
          {preflight.status === 2
            ? 'This validator is already active. Registration is complete.'
            : `Unexpected validator status: ${preflight.statusLabel}.`}
        </Alert>
      )}
      <ActionPanel
        label="Complete on the L1"
        action={
          <ManagerTypeBadge ownerType={vmcCtx.ownerType} stakingType={vmcCtx.staking.stakingType} isDetecting={false} />
        }
        call="Calls completeValidatorRegistration()"
      >
        <CompletePChainRegistration
          subnetIdL1={store.subnetIdL1}
          pChainTxId={store.pChainTxId}
          validationID={isStaking ? store.validationID : undefined}
          signingSubnetId={vmcCtx.signingSubnetId || store.subnetIdL1}
          managerType={managerType}
          managerAddress={managerAddress}
          ownershipState={!isStaking ? vmcCtx.ownershipStatus : undefined}
          contractOwner={!isStaking ? vmcCtx.contractOwner : undefined}
          isLoadingOwnership={!isStaking ? vmcCtx.isLoadingOwnership : undefined}
          ownerType={!isStaking ? vmcCtx.ownerType : undefined}
          onSuccess={(data) => {
            store.setGlobalSuccess(data.message);
            store.setGlobalError(null);
          }}
          onError={(message) => store.setGlobalError(message)}
        />
      </ActionPanel>
    </StepLayout>
  );
}
