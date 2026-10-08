'use client';

import React, { useMemo } from 'react';
import { Alert } from '@/components/toolbox/components/Alert';
import SelectValidationID from '@/components/toolbox/components/SelectValidationID';
import { useRemoveValidatorStore } from '@/components/toolbox/stores/removeValidatorStore';
import { useValidatorManagerContext } from '@/components/toolbox/contexts/ValidatorManagerContext';
import { useViemChainStore } from '@/components/toolbox/stores/toolboxStore';
import { useValidatorPreflight, ValidatorStatus } from '@/components/toolbox/hooks/useValidatorPreflight';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import PoAInitiateValidatorRemoval from '@/components/toolbox/console/permissioned-l1s/remove-validator/InitiateValidatorRemoval';
import { PosInitiateRemoval } from '../PosInitiateRemoval';
import { ResendRemovalMessage } from '../ResendRemovalMessage';
import { StepCodeViewer } from '@/components/console/step-code-viewer';
import { ManagerTypeBadge } from '@/components/toolbox/console/add-validator/ManagerTypeBadge';
import { VmcChainSwitchBanner } from '@/components/toolbox/console/add-validator/VmcChainSwitchBanner';
import { buildStepConfig, type ManagerCodeFlavor } from '../codeConfig';
import { ActionPanel, StepLayout, Working } from '@/components/toolbox/console/shared/validator-flow-ui';

function flavorFor(
  ownerType: ReturnType<typeof useValidatorManagerContext>['ownerType'],
  stakingType: ReturnType<typeof useValidatorManagerContext>['staking']['stakingType'],
): ManagerCodeFlavor {
  if (ownerType === 'StakingManager' && stakingType === 'native') return 'PoS-Native';
  if (ownerType === 'StakingManager' && stakingType === 'erc20') return 'PoS-ERC20';
  return 'PoA';
}

export default function InitiateRemovalStep() {
  const store = useRemoveValidatorStore();
  const vmcCtx = useValidatorManagerContext();
  const viemChain = useViemChainStore();

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
  const isStaking = flavor !== 'PoA';

  const stakingManagerAddress = vmcCtx.staking.stakingManagerAddress || vmcCtx.validatorManagerAddress || '';
  const validatorManagerAddress = vmcCtx.validatorManagerAddress || stakingManagerAddress;
  const uptimeBlockchainID = vmcCtx.staking.settings?.uptimeBlockchainID || '';
  const tokenType: 'native' | 'erc20' = vmcCtx.staking.stakingType === 'erc20' ? 'erc20' : 'native';
  const rpcUrl = viemChain?.rpcUrls?.default?.http[0] || '';

  // Detect the "stuck in PendingRemoved" state at the dispatcher level so we
  // can surface the contract's resendValidatorRemovalMessage path regardless
  // of PoA vs PoS branch. Both branches share the same on-chain symptom:
  // validator.status = PendingRemoved + sentNonce > receivedNonce. That
  // happens when the SetL1ValidatorWeight warp failed P-Chain verification
  // (typical cause: validator-set drift between aggregator snapshot and
  // P-Chain's verifying snapshot during Fuji churn). The contract's
  // resendValidatorRemovalMessage re-emits the same warp from a fresh tx,
  // giving the user another extraction point without changing on-chain state.
  const walletEVMAddress = useWalletStore((s) => s.walletEVMAddress);
  const preflight = useValidatorPreflight({
    validationID: store.validationId || undefined,
    stakingManagerAddress: stakingManagerAddress || null,
    validatorManagerAddress: validatorManagerAddress || null,
    walletAddress: walletEVMAddress || undefined,
    stakingManagerType: tokenType,
  });
  const isPendingPChainOp =
    !!store.validationId &&
    !!preflight.validatorData &&
    preflight.status === ValidatorStatus.PendingRemoved &&
    preflight.validatorData.sentNonce > preflight.validatorData.receivedNonce;

  const body = (
    <ActionPanel
      label="Validator to remove"
      action={
        <ManagerTypeBadge
          ownerType={vmcCtx.ownerType}
          stakingType={vmcCtx.staking.stakingType}
          isDetecting={isDetecting}
        />
      }
      call={
        isStaking
          ? 'Calls initiateValidatorRemoval() · uptime path or force, picked for you'
          : 'Calls initiateValidatorRemoval()'
      }
    >
      {!store.subnetIdL1 && (
        <Alert variant="warning">
          No L1 subnet selected. Go back to <strong>Select L1 Subnet</strong> to choose one.
        </Alert>
      )}

      {vmcCtx.chainMismatch && <VmcChainSwitchBanner mismatch={vmcCtx.chainMismatch} />}

      {/* Stuck-in-PendingRemoved recovery path. Surfaced above the per-branch
            UI so the user sees it whether they're on PoA or PoS. The branch
            components below will still render and self-block via preflight,
            but the user has a clear "resend the warp" affordance here. */}
      {isPendingPChainOp && validatorManagerAddress && (
        <ResendRemovalMessage
          validatorManagerAddress={validatorManagerAddress}
          validationID={store.validationId}
          onSuccess={(hash) => {
            store.setEvmTxHash(hash);
            store.setGlobalError(null);
            store.setGlobalSuccess(
              'Resent removal message. Continue to the P-Chain Weight Update step with this fresh transaction.',
            );
          }}
          onError={(message) => store.setGlobalError(message)}
        />
      )}

      {isDetecting && !vmcCtx.chainMismatch && store.subnetIdL1 && <Working>Detecting validator manager</Working>}

      {!isDetecting && !vmcCtx.chainMismatch && (
        <>
          {isStaking ? (
            <>
              <SelectValidationID
                value={store.validationId}
                onChange={(selection) => {
                  store.setValidationId(selection.validationId);
                  store.setNodeId(selection.nodeId);
                }}
                format="hex"
                subnetId={store.subnetIdL1}
                // getValidator() lives on the VMC, not the StakingManager — for
                // composition-model L1s they're different contracts.
                validatorManagerAddress={validatorManagerAddress}
              />

              {store.validationId && stakingManagerAddress && (
                <div className="-mx-5 border-t border-zinc-200 px-5 pt-5 md:-mx-6 md:px-6 dark:border-zinc-800">
                  <PosInitiateRemoval
                    validationID={store.validationId}
                    stakingManagerAddress={stakingManagerAddress}
                    validatorManagerAddress={validatorManagerAddress}
                    rpcUrl={rpcUrl}
                    uptimeBlockchainID={uptimeBlockchainID}
                    tokenType={tokenType}
                    onSuccess={(data) => {
                      store.setEvmTxHash(data.txHash);
                      store.setGlobalError(null);
                    }}
                    onError={(message) => store.setGlobalError(message)}
                  />
                </div>
              )}
            </>
          ) : (
            <PoAInitiateValidatorRemoval
              subnetId={store.subnetIdL1 || ''}
              validatorManagerAddress={vmcCtx.validatorManagerAddress}
              resetForm={false}
              initialNodeId={store.nodeId}
              initialValidationId={store.validationId}
              ownershipState={vmcCtx.ownershipStatus}
              refetchOwnership={vmcCtx.refetchOwnership}
              ownershipError={vmcCtx.ownershipError}
              onSuccess={(data) => {
                store.setNodeId(data.nodeId);
                store.setValidationId(data.validationId);
                store.setEvmTxHash(data.txHash);
                store.setGlobalError(null);
              }}
              onError={(message) => store.setGlobalError(message)}
            />
          )}
        </>
      )}
    </ActionPanel>
  );

  return <StepLayout aside={<StepCodeViewer activeStep={1} steps={stepConfig} />}>{body}</StepLayout>;
}
