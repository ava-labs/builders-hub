'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { Alert } from '@/components/toolbox/components/Alert';
import { useRemoveValidatorStore } from '@/components/toolbox/stores/removeValidatorStore';
import { useValidatorManagerContext } from '@/components/toolbox/contexts/ValidatorManagerContext';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import SubmitPChainTxWeightUpdate from '@/components/toolbox/console/shared/SubmitPChainTxWeightUpdate';
import { StepCodeViewer } from '@/components/console/step-code-viewer';
import { ManagerTypeBadge } from '@/components/toolbox/console/add-validator/ManagerTypeBadge';
import { buildStepConfig, type ManagerCodeFlavor } from '../codeConfig';
import { ActionPanel, LINK, StepLayout } from '@/components/toolbox/console/shared/validator-flow-ui';

const PCHAIN_MIN_BALANCE = 0.1;

function flavorFor(
  ownerType: ReturnType<typeof useValidatorManagerContext>['ownerType'],
  stakingType: ReturnType<typeof useValidatorManagerContext>['staking']['stakingType'],
): ManagerCodeFlavor {
  if (ownerType === 'StakingManager' && stakingType === 'native') return 'PoS-Native';
  if (ownerType === 'StakingManager' && stakingType === 'erc20') return 'PoS-ERC20';
  return 'PoA';
}

export default function PChainRemovalStep() {
  const store = useRemoveValidatorStore();
  const vmcCtx = useValidatorManagerContext();
  const pChainBalance = useWalletStore((s) => s.pChainBalance);
  const isTestnet = useWalletStore((s) => s.isTestnet);

  const hasSufficientPChainBalance = pChainBalance >= PCHAIN_MIN_BALANCE;
  const flavor = useMemo(
    () => flavorFor(vmcCtx.ownerType, vmcCtx.staking.stakingType),
    [vmcCtx.ownerType, vmcCtx.staking.stakingType],
  );
  const stepConfig = useMemo(() => buildStepConfig(flavor), [flavor]);

  return (
    <StepLayout aside={<StepCodeViewer activeStep={2} steps={stepConfig} />}>
      {!store.evmTxHash && (
        <Alert variant="warning">
          No transaction hash from the previous step. Enter it below, or go back to <strong>Initiate Removal</strong>.
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
        label="Set weight to zero on the P-Chain"
        action={
          <ManagerTypeBadge ownerType={vmcCtx.ownerType} stakingType={vmcCtx.staking.stakingType} isDetecting={false} />
        }
        call="Submits SetL1ValidatorWeightTx"
        meta={<span className="font-mono text-[11px] text-zinc-400 dark:text-zinc-500">P-Chain</span>}
      >
        <SubmitPChainTxWeightUpdate
          subnetIdL1={store.subnetIdL1}
          initialEvmTxHash={store.evmTxHash}
          // The signing subnet for *any* warp from the StakingManager is the
          // subnet that owns the chain where the StakingManager lives — i.e.
          // the VMC's home chain's subnet. For inheritance-model L1s that's
          // the L1's own subnet; for composition-model L1s (VMC on C-Chain)
          // that's the Primary Network. `vmcCtx.signingSubnetId` is set to
          // exactly that from useVMCAddress.
          signingSubnetId={vmcCtx.signingSubnetId || store.subnetIdL1}
          txHashLabel="Initiate Removal Transaction Hash"
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
