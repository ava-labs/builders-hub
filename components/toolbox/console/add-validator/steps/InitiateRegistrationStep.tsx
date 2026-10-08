'use client';

import React, { useMemo } from 'react';
import { ValidatorListInput, type ConvertToL1Validator } from '@/components/toolbox/components/ValidatorListInput';
import {
  useAddValidatorStore,
  deserializeValidators,
  serializeValidators,
} from '@/components/toolbox/stores/addValidatorStore';
import { useValidatorManagerContext } from '@/components/toolbox/contexts/ValidatorManagerContext';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { Alert } from '@/components/toolbox/components/Alert';
import { StepCodeViewer } from '@/components/console/step-code-viewer';
import { ContractDeployViewer, type ContractSource } from '@/components/console/contract-deploy-viewer';
import PoAInitiate from '@/components/toolbox/console/permissioned-l1s/add-validator/InitiateValidatorRegistration';
import StakingInitiate from '@/components/toolbox/console/permissionless-l1s/stake/InitiateValidatorRegistration';
import { ManagerTypeBadge } from '../ManagerTypeBadge';
import { VmcChainSwitchBanner } from '../VmcChainSwitchBanner';
import { buildStepConfig, type ManagerCodeFlavor } from '../codeConfig';
import { ActionPanel, StepLayout, Working } from '@/components/toolbox/console/shared/validator-flow-ui';
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

function contractSourcesFor(flavor: ManagerCodeFlavor): ContractSource[] | null {
  if (flavor === 'PoS-Native') {
    return [
      {
        name: 'NativeTokenStakingManager',
        filename: 'NativeTokenStakingManager.sol',
        url: `https://raw.githubusercontent.com/ava-labs/icm-services/${ICM_COMMIT}/contracts/validator-manager/NativeTokenStakingManager.sol`,
        description: 'Manages validator registration and staking with native tokens. Stake is sent as msg.value.',
      },
    ];
  }
  if (flavor === 'PoS-ERC20') {
    return [
      {
        name: 'ERC20TokenStakingManager',
        filename: 'ERC20TokenStakingManager.sol',
        url: `https://raw.githubusercontent.com/ava-labs/icm-services/${ICM_COMMIT}/contracts/validator-manager/ERC20TokenStakingManager.sol`,
        description:
          'Manages validator registration and staking with ERC20 tokens. Requires token approval before staking.',
      },
    ];
  }
  return null;
}

export default function InitiateRegistrationStep() {
  const store = useAddValidatorStore();
  const vmcCtx = useValidatorManagerContext();
  const { pChainAddress, pChainBalance, isTestnet } = useWalletStore();

  const validators = deserializeValidators(store.validators);
  const validator = validators[0];

  const isDetecting =
    !!vmcCtx.chainMismatch ||
    vmcCtx.isDetectingOwnerType ||
    vmcCtx.isLoadingOwnership ||
    (vmcCtx.ownerType === 'StakingManager' && vmcCtx.staking.isLoading);
  const flavor = useMemo(
    () => flavorFor(vmcCtx.ownerType, vmcCtx.staking.stakingType),
    [vmcCtx.ownerType, vmcCtx.staking.stakingType],
  );
  const stepConfig = useMemo(() => buildStepConfig(flavor), [flavor]);
  const contractSources = contractSourcesFor(flavor);

  const isStaking = flavor !== 'PoA';
  const stakingManagerAddress = vmcCtx.staking.stakingManagerAddress || vmcCtx.validatorManagerAddress || '';
  const userPChainBalanceNavax = pChainBalance ? BigInt(Math.floor(pChainBalance * 1e9)) : null;

  const handleValidatorsChange = (newValidators: ConvertToL1Validator[]) => {
    store.setValidators(serializeValidators(newValidators));
  };

  const body = (
    <ActionPanel
      label="Validator details"
      action={
        <ManagerTypeBadge
          ownerType={vmcCtx.ownerType}
          stakingType={vmcCtx.staking.stakingType}
          isDetecting={isDetecting}
        />
      }
      call="Calls initiateValidatorRegistration()"
    >
      {!store.subnetIdL1 && (
        <Alert variant="warning">
          No L1 subnet selected. Go back to <strong>Select L1 Subnet</strong> to choose one.
        </Alert>
      )}

      {vmcCtx.chainMismatch && <VmcChainSwitchBanner mismatch={vmcCtx.chainMismatch} />}

      <ValidatorListInput
        validators={validators}
        onChange={handleValidatorsChange}
        defaultAddress={pChainAddress ?? ''}
        label=""
        // PoA validates new validator weight against the existing L1 total.
        // PoS uses stake amount as weight, so hide consensus-weight input and
        // surface the user's P-Chain balance instead.
        l1TotalInitializedWeight={
          !isStaking && !vmcCtx.l1WeightError && vmcCtx.contractTotalWeight > 0n ? vmcCtx.contractTotalWeight : null
        }
        userPChainBalanceNavax={isStaking ? userPChainBalanceNavax : undefined}
        hideConsensusWeight={isStaking}
        maxValidators={1}
        selectedSubnetId={store.subnetIdL1}
        isTestnet={isTestnet}
      />

      {isStaking && vmcCtx.staking.isLoading && validators.length > 0 && <Working>Resolving staking manager</Working>}

      {validators.length > 0 && !isDetecting && (
        <div className="-mx-5 border-t border-zinc-200 px-5 pt-5 md:-mx-6 md:px-6 dark:border-zinc-800">
          {isStaking ? (
            stakingManagerAddress ? (
              <StakingInitiate
                nodeID={validator?.nodeID || ''}
                blsPublicKey={validator?.nodePOP?.publicKey || ''}
                stakingManagerAddress={stakingManagerAddress}
                tokenType={flavor === 'PoS-Native' ? 'native' : 'erc20'}
                erc20TokenAddress={flavor === 'PoS-ERC20' ? (vmcCtx.staking.erc20TokenAddress ?? undefined) : undefined}
                remainingBalanceOwner={validator?.remainingBalanceOwner}
                disableOwner={validator?.deactivationOwner}
                onSuccess={(data) => {
                  store.setEvmTxHash(data.txHash);
                  store.setValidationID(data.validationID);
                  store.setGlobalError(null);
                }}
                onError={(message) => store.setGlobalError(message)}
              />
            ) : (
              <Working>Resolving staking manager</Working>
            )
          ) : (
            <PoAInitiate
              subnetId={store.subnetIdL1 || ''}
              validatorManagerAddress={vmcCtx.validatorManagerAddress}
              validators={validators}
              ownershipState={vmcCtx.ownershipStatus}
              refetchOwnership={vmcCtx.refetchOwnership}
              ownershipError={vmcCtx.ownershipError}
              contractTotalWeight={vmcCtx.contractTotalWeight}
              l1WeightError={vmcCtx.l1WeightError}
              onSuccess={(data) => {
                store.setEvmTxHash(data.txHash);
                store.setValidatorBalance(data.validatorBalance);
                store.setBlsProofOfPossession(data.blsProofOfPossession);
                // PoA derives validationID locally from the warp message in the next steps.
                store.setValidationID('');
                store.setGlobalError(null);
              }}
              onError={(message) => store.setGlobalError(message)}
            />
          )}
        </div>
      )}
    </ActionPanel>
  );

  // ContractDeployViewer is itself a 2-col grid (children left, source right),
  // so for PoS we use it as the *only* wrapper. Stacking it inside another grid
  // with a StepCodeViewer (as the PoA path does) collapses everything into three
  // cramped columns. PoA has no live contract source to deploy/inspect, so it
  // falls back to the StepCodeViewer side panel.
  if (contractSources) {
    return <ContractDeployViewer contracts={contractSources}>{body}</ContractDeployViewer>;
  }

  return <StepLayout aside={<StepCodeViewer activeStep={1} steps={stepConfig} />}>{body}</StepLayout>;
}
