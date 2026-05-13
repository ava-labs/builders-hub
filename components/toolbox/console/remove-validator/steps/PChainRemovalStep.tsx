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
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">P-Chain Weight Update</h2>
          <ManagerTypeBadge ownerType={vmcCtx.ownerType} stakingType={vmcCtx.staking.stakingType} isDetecting={false} />
        </div>
        {!store.evmTxHash && (
          <Alert variant="warning">
            No transaction hash from the initiation step. You can enter it manually below, or go back to{' '}
            <strong>Initiate Removal</strong>.
          </Alert>
        )}
        {!hasSufficientPChainBalance && (
          <Alert variant="warning">
            Insufficient P-Chain balance for transaction fees. You need at least {PCHAIN_MIN_BALANCE} AVAX.{' '}
            {isTestnet ? (
              <Link href="/console/primary-network/faucet" className="underline font-medium">
                Get testnet tokens from the faucet
              </Link>
            ) : (
              <Link href="/console/primary-network/c-p-bridge" className="underline font-medium">
                Bridge AVAX from C-Chain to P-Chain
              </Link>
            )}
          </Alert>
        )}
        <div className="flex flex-col rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
          <div className="p-4 space-y-3">
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
          </div>
          <div className="shrink-0 px-4 py-2.5 border-t border-zinc-200/80 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 flex items-center justify-between mt-auto">
            <span className="text-xs text-zinc-500">Submits SetL1ValidatorWeightTx</span>
            <span className="text-[11px] text-zinc-400 font-mono">P-Chain</span>
          </div>
        </div>
      </div>
      <StepCodeViewer activeStep={2} steps={stepConfig} className="lg:sticky lg:top-4 lg:self-start" />
    </div>
  );
}
