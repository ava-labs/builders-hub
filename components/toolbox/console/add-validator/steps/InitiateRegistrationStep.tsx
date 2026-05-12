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
  const flavor = useMemo(() => flavorFor(vmcCtx.ownerType, vmcCtx.staking.stakingType), [
    vmcCtx.ownerType,
    vmcCtx.staking.stakingType,
  ]);
  const stepConfig = useMemo(() => buildStepConfig(flavor), [flavor]);
  const contractSources = contractSourcesFor(flavor);

  const isStaking = flavor !== 'PoA';
  const stakingManagerAddress = vmcCtx.staking.stakingManagerAddress || vmcCtx.validatorManagerAddress || '';
  const userPChainBalanceNavax = pChainBalance ? BigInt(Math.floor(pChainBalance * 1e9)) : null;

  const handleValidatorsChange = (newValidators: ConvertToL1Validator[]) => {
    store.setValidators(serializeValidators(newValidators));
  };

  const body = (
    <div className="flex flex-col rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
      <div className="p-4 space-y-4">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">Validator Details</h3>
          <ManagerTypeBadge
            ownerType={vmcCtx.ownerType}
            stakingType={vmcCtx.staking.stakingType}
            isDetecting={isDetecting}
          />
        </div>

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

        {isStaking && vmcCtx.staking.isLoading && validators.length > 0 && (
          <p className="text-xs text-zinc-500 animate-pulse">Resolving staking manager address...</p>
        )}

        {validators.length > 0 && !isDetecting && (
          <div className="border-t border-zinc-200 dark:border-zinc-800 pt-4">
            {isStaking ? (
              stakingManagerAddress ? (
                <StakingInitiate
                  nodeID={validator?.nodeID || ''}
                  blsPublicKey={validator?.nodePOP?.publicKey || ''}
                  stakingManagerAddress={stakingManagerAddress}
                  tokenType={flavor === 'PoS-Native' ? 'native' : 'erc20'}
                  erc20TokenAddress={flavor === 'PoS-ERC20' ? vmcCtx.staking.erc20TokenAddress ?? undefined : undefined}
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
                <p className="text-xs text-zinc-500">Resolving staking manager address...</p>
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
      </div>
      <div className="shrink-0 px-4 py-2.5 border-t border-zinc-200/80 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 flex items-center justify-between mt-auto">
        <span className="text-xs text-zinc-500">Calls initiateValidatorRegistration()</span>
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
  );

  // ContractDeployViewer is itself a 2-col grid (children left, source right),
  // so for PoS we use it as the *only* wrapper. Stacking it inside another grid
  // with a StepCodeViewer (as the PoA path does) collapses everything into three
  // cramped columns. PoA has no live contract source to deploy/inspect, so it
  // falls back to the StepCodeViewer side panel.
  if (contractSources) {
    return <ContractDeployViewer contracts={contractSources}>{body}</ContractDeployViewer>;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
      <div className="space-y-4">{body}</div>
      <StepCodeViewer activeStep={1} steps={stepConfig} className="lg:sticky lg:top-4 lg:self-start" />
    </div>
  );
}
