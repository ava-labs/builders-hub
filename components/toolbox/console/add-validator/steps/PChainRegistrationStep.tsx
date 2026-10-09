'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import SubmitPChainTxRegisterL1Validator from '@/components/toolbox/console/permissioned-l1s/add-validator/SubmitPChainTxRegisterL1Validator';
import { useAddValidatorStore, deserializeValidators } from '@/components/toolbox/stores/addValidatorStore';
import { useValidatorManagerContext } from '@/components/toolbox/contexts/ValidatorManagerContext';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { Alert } from '@/components/toolbox/components/Alert';
import { StepCodeViewer } from '@/components/console/step-code-viewer';
import { ManagerTypeBadge } from '../ManagerTypeBadge';
import { buildStepConfig } from '../codeConfig';
import { ActionPanel, LINK, StepLayout } from '@/components/toolbox/console/shared/validator-flow-ui';

const PCHAIN_MIN_BALANCE = 0.1; // AVAX needed for P-Chain transaction gas

export default function PChainRegistrationStep() {
  const store = useAddValidatorStore();
  const vmcCtx = useValidatorManagerContext();
  const pChainBalance = useWalletStore((s) => s.pChainBalance);
  const isTestnet = useWalletStore((s) => s.isTestnet);

  const userPChainBalanceNavax = pChainBalance ? BigInt(Math.floor(pChainBalance * 1e9)) : null;
  const hasSufficientPChainBalance = pChainBalance >= PCHAIN_MIN_BALANCE;

  const validators = deserializeValidators(store.validators);
  const validator = validators[0];

  const isStaking = vmcCtx.ownerType === 'StakingManager';
  // PoS persists validator balance on the validator object (set as stake amount);
  // PoA persists it on the store at initiate-time.
  const validatorBalance = isStaking
    ? validator
      ? (Number(validator.validatorBalance) / 1e9).toString()
      : '0.1'
    : store.validatorBalance;
  const blsProofOfPossession = isStaking
    ? validator?.nodePOP?.proofOfPossession || store.blsProofOfPossession
    : store.blsProofOfPossession;

  const flavor =
    vmcCtx.ownerType === 'StakingManager' && vmcCtx.staking.stakingType === 'native'
      ? 'PoS-Native'
      : vmcCtx.ownerType === 'StakingManager' && vmcCtx.staking.stakingType === 'erc20'
        ? 'PoS-ERC20'
        : 'PoA';
  const stepConfig = useMemo(() => buildStepConfig(flavor), [flavor]);

  return (
    <StepLayout aside={<StepCodeViewer activeStep={2} steps={stepConfig} />}>
      {!store.evmTxHash && (
        <Alert variant="warning">
          No transaction hash from the previous step. Enter it below, or go back to{' '}
          <strong>Initiate Registration</strong>.
        </Alert>
      )}
      {!hasSufficientPChainBalance && (
        <Alert variant="warning">
          Not enough P-Chain balance for fees. You need at least{' '}
          <span className="font-mono">{PCHAIN_MIN_BALANCE} AVAX</span>.{' '}
          {isTestnet ? (
            <Link href="/console/primary-network/faucet" className={LINK}>
              Get testnet tokens from the faucet
            </Link>
          ) : (
            <Link href="/console/primary-network/c-p-bridge" className={LINK}>
              Bridge AVAX from C-Chain to P-Chain
            </Link>
          )}
        </Alert>
      )}
      <ActionPanel
        label="Register on the P-Chain"
        action={
          <ManagerTypeBadge ownerType={vmcCtx.ownerType} stakingType={vmcCtx.staking.stakingType} isDetecting={false} />
        }
        call="Submits RegisterL1ValidatorTx"
        meta={<span className="font-mono text-[11px] text-zinc-400 dark:text-zinc-500">P-Chain</span>}
      >
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
      </ActionPanel>
    </StepLayout>
  );
}
